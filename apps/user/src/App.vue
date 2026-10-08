<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from "vue";
import {
  apiFetch,
  auth,
  downloadPdf,
  emptyProfile,
  errorMessage,
  loadSession,
  logout,
  type Profile,
} from "@tourpool/client";
import LoginForm from "@tourpool/client/LoginForm.vue";
import ProfileFields from "@tourpool/client/ProfileFields.vue";

interface Pool {
  poolID: number;
  Naam: string | null;
  Org: string | null;
  tourNaam: string;
  editable: boolean;
  closesAt: string | null;
  reason: string;
  registrationStart: string | null;
  registrationEnd: string | null;
  inleg: number | string | null;
  PloegRennerAantal: number;
  PloegReserveAantal: number;
}
interface Entry {
  deelnID: number;
  poolID: number;
  poolNaam: string;
  ploegnaam: string;
  Betaald: boolean | number | null;
}
interface Rider {
  rennerID: number;
  Rugnummer: number;
  vnaam: string | null;
  tnaam: string | null;
  anaam: string;
  ploegNaam: string;
}
const pools = ref<Pool[]>([]);
const entries = ref<Entry[]>([]);
const selectedEntryID = ref<number | null>(null);
const selectedEntry = computed(() =>
  entries.value.find((entry) => entry.deelnID === selectedEntryID.value),
);
const profile = ref<Profile>(emptyProfile());
const loading = ref(true);
const busy = ref(false);
const error = ref("");
const message = ref("");
emptyProfile;
const editingProfile = ref(false);
const profileDialog = ref<HTMLDialogElement | null>(null);
const editing = ref(false);
const editingID = ref<number | null>(null);
const teamError = ref("");
const selectedPoolID = ref<number | null>(null);
const ploegnaam = ref("");
const riders = ref<Rider[]>([]);
const savedRiders = ref<Rider[]>([]);
const selected = ref<number[]>([]);
const search = ref("");
const now = ref(Date.now());
const timer = setInterval(() => {
  now.value = Date.now();
}, 1000);
onBeforeUnmount(() => clearInterval(timer));
const activePool = computed(() =>
  pools.value.find((p) => p.poolID === selectedPoolID.value),
);
const isOpen = (p: Pool) =>
  p.editable && !!p.closesAt && now.value < Date.parse(p.closesAt);
const editable = computed(() => !!activePool.value && isOpen(activePool.value));
const mainCount = computed(() =>
  activePool.value
    ? activePool.value.PloegRennerAantal - activePool.value.PloegReserveAantal
    : 0,
);
const riderName = (r: Rider) =>
  [r.vnaam, r.tnaam, r.anaam].filter(Boolean).join(" ");
const selectedRiders = computed(() =>
  selected.value
    .map(
      (id) =>
        riders.value.find((r) => r.rennerID === id) ||
        savedRiders.value.find((r) => r.rennerID === id),
    )
    .filter((r): r is Rider => !!r),
);
const available = computed(() =>
  riders.value.filter(
    (r) =>
      !selected.value.includes(r.rennerID) &&
      `${r.Rugnummer} ${riderName(r)} ${r.ploegNaam}`
        .toLowerCase()
        .includes(search.value.toLowerCase()),
  ),
);
const dutchTime = (date: string) =>
  new Date(date).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" });
const enrollmentDate = (date: string) =>
  date.slice(0, 10).split("-").reverse().join("-");
watch(
  () => auth.account?.accountID,
  () => {
    entries.value = [];
    pools.value = [];
    profile.value = emptyProfile();
    selectedEntryID.value = null;
    editing.value = false;
    editingProfile.value = false;
    selected.value = [];
    riders.value = [];
    savedRiders.value = [];
    message.value = "";
  },
  { flush: "sync" },
);

async function refresh() {
  loading.value = true;
  error.value = "";
  try {
    const [p, e, details] = await Promise.all([
      apiFetch<Pool[]>("/me/pools"),
      apiFetch<Entry[]>("/me/entries"),
      apiFetch<Profile>("/me/profile"),
    ]);
    pools.value = p;
    entries.value = e;
    if (!e.some((entry) => entry.deelnID === selectedEntryID.value)) {
      selectedEntryID.value = e[0]?.deelnID ?? null;
    }
    profile.value = {
      username: details.username || auth.account?.username || "",
      email: details.email || "",
      vNaam: details.vNaam || "",
      tNaam: details.tNaam || "",
      aNaam: details.aNaam || "",
      plaats: details.plaats || "",
      tel: details.tel || "",
    };
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}
onMounted(async () => {
  try {
    await loadSession();
    if (auth.account) await refresh();
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
});
async function signOut() {
  busy.value = true;
  error.value = "";
  try {
    await logout();
    entries.value = [];
    pools.value = [];
    editing.value = false;
    editingProfile.value = false;
    profile.value = emptyProfile();
    selected.value = [];
    riders.value = [];
    message.value = "";
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}
async function openTeam(p: Pool, entry?: Entry) {
  busy.value = true;
  error.value = "";
  message.value = "";
  teamError.value = "";
  try {
    const [availableRiders, detail] = await Promise.all([
      apiFetch<Rider[]>(`/me/pools/${p.poolID}/riders`),
      entry
        ? apiFetch<Entry & { riders: Rider[] }>(`/me/entries/${entry.deelnID}`)
        : Promise.resolve(null),
    ]);
    selectedPoolID.value = p.poolID;
    riders.value = availableRiders;
    savedRiders.value = detail?.riders || [];
    selected.value = detail?.riders.map((r) => r.rennerID) || [];
    editingID.value = entry?.deelnID || null;
    ploegnaam.value = entry?.ploegnaam || profile.value.vNaam;
    search.value = "";
    editing.value = true;
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}
async function openSelectedTeam() {
  const entry = selectedEntry.value;
  const p = pools.value.find((pool) => pool.poolID === entry?.poolID);
  if (!entry || !p) {
    error.value =
      "De geselecteerde tourploeg of bijbehorende pool is niet beschikbaar. Ververs het overzicht.";
    return;
  }
  await openTeam(p, entry);
}
function addRider(id: number) {
  if (
    !editable.value ||
    !activePool.value ||
    selected.value.length >= activePool.value.PloegRennerAantal
  )
    return;
  selected.value.push(id);
}
function moveRider(index: number, direction: number) {
  const target = index + direction;
  if (target < 0 || target >= selected.value.length) return;
  const id = selected.value.splice(index, 1)[0];
  if (id !== undefined) selected.value.splice(target, 0, id);
}
async function saveTeam(print = false) {
  busy.value = true;
  error.value = "";
  message.value = "";
  teamError.value = "";
  try {
    if (!editable.value)
      throw new Error(
        "De inschrijving is gesloten. Je ploeg kan niet meer worden gewijzigd.",
      );
    if (!ploegnaam.value.trim()) throw new Error("Vul een ploegnaam in.");
    const result = await apiFetch<{ deelnID: number }>(
      editingID.value ? `/me/entries/${editingID.value}` : "/me/entries",
      {
        method: editingID.value ? "PUT" : "POST",
        body: JSON.stringify({
          poolID: selectedPoolID.value,
          ploegnaam: ploegnaam.value,
          riders: selected.value,
        }),
      },
    );
    editingID.value = result.deelnID;
    selectedEntryID.value = result.deelnID;
    if (print) {
      try {
        await downloadPdf(result.deelnID);
      } catch (err) {
        throw new Error(
          `Je tourploeg is opgeslagen, maar de PDF kon niet worden gedownload: ${errorMessage(
            err,
          )}`,
        );
      }
    }
    editing.value = false;
    await refresh();
    if (!error.value) {
      message.value = print
        ? "Tourploeg opgeslagen en PDF gedownload. Open de PDF om het formulier af te drukken en lever het in bij de organisatie. Je kunt hieronder nog een tourploeg invullen, in dezelfde of een andere pool."
        : "Tourploeg opgeslagen. Download de PDF zodra de ploeg compleet is en lever deze in bij de organisatie. Je kunt hieronder nog een tourploeg invullen, in dezelfde of een andere pool.";
    }
  } catch (err) {
    teamError.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}
async function saveProfile() {
  busy.value = true;
  error.value = "";
  try {
    const { email: _email, ...profileFields } = profile.value;
    const savedProfile = await apiFetch<Profile>("/me/profile", {
      method: "PUT",
      body: JSON.stringify(profileFields),
    });
    if (auth.account) auth.account.username = savedProfile.username;
    profile.value = { ...profile.value, ...savedProfile };
    profileDialog.value?.close();
    editingProfile.value = false;
    message.value = "Gegevens opgeslagen.";
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}
async function openProfileEditor() {
  editingProfile.value = true;
  await nextTick();
  profileDialog.value?.showModal();
}
function cancelProfileEdit() {
  profileDialog.value?.close();
  editingProfile.value = false;
  refresh();
}
async function pdf(entry: Entry) {
  busy.value = true;
  error.value = "";
  try {
    await downloadPdf(entry.deelnID);
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="mx-auto max-w-full p-2 md:p-4">
    <p v-if="error" class="my-4 bg-red-100 p-4 text-red-800" role="alert">
      {{ error }}
    </p>
    <p v-if="loading">Gegevens laden...</p>
    <LoginForm v-else-if="!auth.account" @signed-in="refresh" />
    <template v-else>
      <div class="max-w-180 md:max-w-360 mx-auto rounded-2xl border border-yellow-700 bg-amber-800 px-4">
        <header
          class="mx-auto flex flex-wrap items-center justify-between gap-2 align-middle md:flex-row">
          <h1
            class="text-shadow-2xs my-5 text-3xl font-extrabold text-yellow-100 md:text-4xl">
            Jota's Tourpool Pagina
          </h1>
          <h2 class="text-2xl text-yellow-100">Ingelogd als {{ auth.account.username }}</h2>
            <button
              class="max-[600px]:min-h-11 m-1 cursor-pointer rounded-md border border-yellow-700 bg-yellow-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="busy"
              @click="openProfileEditor">
              Gegevens wijzigen
            </button>
          <button
            class="max-[600px]:min-h-11 m-1 cursor-pointer rounded-md border border-yellow-700 bg-yellow-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="busy"
            @click="signOut">
            Uitloggen
          </button>
        </header>
      </div>
      <p
        v-if="message"
        class="my-4 bg-green-100 p-4 text-green-800"
        role="status">
        {{ message }}
      </p>
      <dialog
        v-if="editingProfile"
        ref="profileDialog"
        class="m-auto max-h-[90vh] w-[min(100%-1.5rem,48rem)] max-w-none overflow-y-auto rounded-xl border border-yellow-700 bg-yellow-100 p-4 shadow-xl backdrop:bg-black/50 md:p-6"
        aria-labelledby="profile-dialog-title"
        @cancel.prevent="cancelProfileEdit">
        <form @submit.prevent="saveProfile">
          <div class="mb-4 flex items-center justify-between gap-4 border-b border-yellow-700/30 pb-3">
            <h2 id="profile-dialog-title" class="text-xl font-bold">Gegevens wijzigen</h2>
            <button
              class="max-[600px]:min-h-11 m-1 cursor-pointer rounded-md border border-yellow-700 bg-yellow-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              :disabled="busy"
              aria-label="Profielvenster sluiten"
              @click="cancelProfileEdit">
              Sluiten
            </button>
          </div>
          <fieldset
            :disabled="busy"
            class="max-w-140 md:max-w-180 mx-auto min-w-0 items-center justify-center">
            <ProfileFields v-model="profile" />
            <div class="flex flex-row justify-between gap-2 p-2">
              <button
                class="max-[600px]:min-h-11 m-1 cursor-pointer rounded-md border border-yellow-700 bg-yellow-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                type="submit">
                Gegevens opslaan
              </button>
              <button
                class="max-[600px]:min-h-11 m-1 cursor-pointer rounded-md border border-yellow-700 bg-yellow-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                @click="cancelProfileEdit">
                Annuleren
              </button>
            </div>
          </fieldset>
        </form>
      </dialog>

      <section
        v-if="editing && activePool"
        class="my-4 rounded-xl border border-yellow-700 bg-yellow-100 p-3 min-[601px]:p-5">
        <h2 class="mb-4 text-[1.4rem]">
          {{ editingID ? "Mijn tourploeg" : "Nieuwe tourploeg" }} -
          {{ activePool.Naam }}
        </h2>
        <p v-if="!editable" class="my-4">
          Deze pool is gesloten voor wijzigingen. Je opgeslagen ploeg blijft
          zichtbaar.
        </p>
        <p class="my-4">
          {{ activePool.PloegRennerAantal }} renners, waarvan
          {{ activePool.PloegReserveAantal }} reserves. Volgorde bepaalt de
          reservevolgorde.
        </p>
        <form
          @submit.prevent="saveTeam()"
          @invalid.capture="teamError = 'Vul een ploegnaam in.'">
          <fieldset :disabled="busy || !editable" class="min-w-0">
            <label class="my-3 block font-semibold"
              >Ploegnaam
              <input
                class="max-w-120 block w-full rounded-md border border-slate-500 bg-white p-2.5 font-normal"
                v-model="ploegnaam"
                required
                maxlength="255"
            /></label>
            <h3 class="my-4 text-[1.1rem]">
              Gekozen: {{ selected.length }} /
              {{ activePool.PloegRennerAantal }}
            </h3>
            <ol>
              <li
                v-for="(r, index) in selectedRiders"
                :key="r.rennerID"
                class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 p-2">
                <span
                  >{{ index + 1 }}. {{ index >= mainCount ? "Reserve: " : ""
                  }}{{ r.Rugnummer }} - {{ riderName(r) }}</span
                >
                <span
                  v-if="
                    !riders.some(
                      (availableRider) =>
                        availableRider.rennerID === r.rennerID,
                    )
                  "
                  class="bg-red-100 p-4 text-red-800"
                  >Niet meer beschikbaar in deze tour; kies een vervanger.</span
                >
                <div class="flex flex-wrap">
                  <button
                    class="max-[600px]:min-h-11 m-1 cursor-pointer rounded-md border border-yellow-700 bg-yellow-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    :disabled="index === 0"
                    :aria-label="`${riderName(r)} omhoog`"
                    @click="moveRider(index, -1)">
                    Omhoog
                  </button>
                  <button
                    class="max-[600px]:min-h-11 m-1 cursor-pointer rounded-md border border-yellow-700 bg-yellow-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    :disabled="index === selected.length - 1"
                    :aria-label="`${riderName(r)} omlaag`"
                    @click="moveRider(index, 1)">
                    Omlaag
                  </button>
                  <button
                    class="max-[600px]:min-h-11 m-1 cursor-pointer rounded-md border border-yellow-700 bg-yellow-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    @click="selected.splice(index, 1)">
                    Verwijderen
                  </button>
                </div>
              </li>
            </ol>
            <label class="my-3 block font-semibold"
              >Zoek renner
              <input
                class="max-w-120 block w-full rounded-md border border-slate-500 bg-white p-2.5 font-normal"
                v-model="search"
                type="search"
            /></label>
            <ul class="max-h-96 overflow-auto border border-slate-300 bg-white">
              <li
                v-for="r in available"
                :key="r.rennerID"
                class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 p-2">
                <span
                  >{{ r.Rugnummer }} - {{ riderName(r) }} ({{
                    r.ploegNaam
                  }})</span
                >
                <button
                  class="max-[600px]:min-h-11 m-1 cursor-pointer rounded-md border border-yellow-700 bg-yellow-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  :disabled="selected.length >= activePool.PloegRennerAantal"
                  @click="addRider(r.rennerID)">
                  Kiezen
                </button>
              </li>
            </ul>
            <p
              v-if="teamError"
              class="my-4 bg-red-100 p-4 text-red-800"
              role="alert">
              {{ teamError }}
            </p>
            <button
              class="max-[600px]:min-h-11 m-1 cursor-pointer rounded-md border border-yellow-700 bg-yellow-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              type="submit">
              {{ busy ? "Bezig met opslaan..." : "Tourploeg opslaan" }}
            </button>
            <button
              class="max-[600px]:min-h-11 m-1 cursor-pointer rounded-md border border-yellow-700 bg-yellow-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              :disabled="selected.length !== activePool.PloegRennerAantal"
              @click="saveTeam(true)">
              Opslaan en PDF downloaden
            </button>
            <p
              v-if="selected.length !== activePool.PloegRennerAantal"
              class="my-4">
              Je kunt je ploeg alvast opslaan. Kies alle
              {{ activePool.PloegRennerAantal }} renners inclusief reserves om
              het formulier als PDF te downloaden en af te drukken.
            </p>
          </fieldset>
          <button
            class="max-[600px]:min-h-11 m-1 cursor-pointer rounded-md border border-yellow-700 bg-yellow-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            :disabled="busy"
            @click="editing = false">
            Terug zonder opslaan
          </button>
        </form>
      </section>

      <template v-else>
        <section
          class="my-4 rounded-xl border border-yellow-700 bg-yellow-100 p-3 min-[601px]:p-5">
          <h2 class="mb-4 text-[1.4rem]">Mijn tourploegen</h2>
          <p class="my-4">
            Je kunt meerdere ploegen per pool invullen. Lever per ploeg de PDF
            in bij de organisatie en betaal daar. De admin bevestigt je
            betaling.
          </p>
          <p v-if="!entries.length" class="my-4">
            Je hebt nog geen tourploegen ingevuld.
          </p>
          <label v-else class="my-3 block font-semibold">
            Kies mijn tourploeg
            <select
              class="max-w-120 block w-full rounded-md border border-slate-500 bg-white p-2.5 font-normal"
              v-model="selectedEntryID"
              :disabled="busy">
              <option
                v-for="entry in entries"
                :key="entry.deelnID"
                :value="entry.deelnID">
                {{ entry.ploegnaam }} - {{ entry.poolNaam }} (#{{
                  entry.deelnID
                }})
              </option>
            </select>
          </label>
          <article
            v-if="selectedEntry"
            class="my-3 rounded-lg border border-yellow-700 bg-white p-4">
            <h3 class="my-4 text-[1.1rem]">
              {{ selectedEntry.ploegnaam }} - {{ selectedEntry.poolNaam }}
            </h3>
            <p class="my-4">
              Inschrijving #{{ selectedEntry.deelnID }} -
              {{ selectedEntry.Betaald ? "Betaald" : "Nog niet betaald" }}
            </p>
            <button
              class="max-[600px]:min-h-11 m-1 cursor-pointer rounded-md border border-yellow-700 bg-yellow-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="
                busy || !pools.some((p) => p.poolID === selectedEntry?.poolID)
              "
              @click="openSelectedTeam">
              Bekijken / wijzigen
            </button>
            <button
              class="max-[600px]:min-h-11 m-1 cursor-pointer rounded-md border border-yellow-700 bg-yellow-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="busy"
              @click="pdf(selectedEntry)">
              PDF downloaden
            </button>
          </article>
        </section>
        <section
          class="my-4 rounded-xl border border-yellow-700 bg-yellow-100 p-3 min-[601px]:p-5">
          <h2 class="mb-4 text-[1.4rem]">Pools</h2>
          <button
            class="max-[600px]:min-h-11 m-1 cursor-pointer rounded-md border border-yellow-700 bg-yellow-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="busy || loading"
            @click="refresh">
            Verversen
          </button>
          <article
            v-for="p in pools"
            :key="p.poolID"
            class="my-3 rounded-lg border border-yellow-700 bg-white p-4">
            <h3 class="my-4 text-[1.1rem]">
              {{ p.Org }} - {{ p.Naam }} ({{ p.tourNaam }})
            </h3>
            <p class="my-4">
              Inleg: EUR {{ Number(p.inleg || 0).toFixed(2) }} per ploeg.
            </p>
            <p class="my-4">
              Inschrijving vanaf
              {{
                p.registrationStart
                  ? enrollmentDate(p.registrationStart)
                  : "direct"
              }}
              {{
                p.registrationEnd
                  ? `tot en met ${enrollmentDate(p.registrationEnd)}`
                  : "tot de tourstart"
              }}.
            </p>
            <p v-if="p.closesAt" class="my-4">
              Sluit op {{ dutchTime(p.closesAt) }} (Nederlandse tijd).
            </p>
            <p v-if="!isOpen(p)" class="my-4">
              {{ p.reason || "De inschrijving is gesloten." }}
            </p>
            <button
              class="max-[600px]:min-h-11 m-1 cursor-pointer rounded-md border border-yellow-700 bg-yellow-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="busy || !isOpen(p)"
              @click="openTeam(p)">
              Nieuwe tourploeg invullen
            </button>
          </article>
        </section>
      </template>
    </template>
  </main>
</template>
