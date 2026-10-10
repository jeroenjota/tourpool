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
import AccountSettings from "@tourpool/client/AccountSettings.vue";

interface Pool {
  poolID: number;
  Naam: string | null;
  Org: string | null;
  orgStraat: string | null;
  orgHuisnummer: string | null;
  orgPostcode: string | null;
  orgPlaats: string | null;
  orgEmail: string | null;
  orgTel: string | null;
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
// Gastmodus: inschrijven zonder account. Alleen de PDF's van deze sessie blijven beschikbaar.
const guest = ref(false);
const guestProfile = ref<Profile>(emptyProfile());
const guestEntries = ref<
  { deelnID: number; ploegnaam: string; poolNaam: string; dropOff: string; deadline: string; pdf: Blob }[]
>([]);
const apiPrefix = computed(() => (guest.value ? "/public" : "/me"));
const now = ref(Date.now());
const timer = setInterval(() => {
  now.value = Date.now();
}, 1000);
onBeforeUnmount(() => clearInterval(timer));
const activePool = computed(() =>
  pools.value.find((p) => p.poolID === selectedPoolID.value),
);
// Inleveradres van de organisatie; leeg als er geen adres is ingevuld.
const dropOff = (p: Pool) => {
  const parts = [
    [p.orgStraat, p.orgHuisnummer].filter(Boolean).join(" "),
    [p.orgPostcode, p.orgPlaats].filter(Boolean).join(" "),
    p.orgTel && `tel. ${p.orgTel}`,
    p.orgEmail,
  ].filter(Boolean);
  return parts.length ? [p.Org, ...parts].filter(Boolean).join(", ") : "";
};
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
  ).sort((a, b) => Number(a.Rugnummer) - Number(b.Rugnummer)),
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
    if (auth.account) guest.value = false;
  },
  { flush: "sync" },
);

async function refresh() {
  loading.value = true;
  error.value = "";
  try {
    if (guest.value) {
      pools.value = await apiFetch<Pool[]>("/public/pools");
      return;
    }
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
    // A reset link must show the reset form, even if another account is still signed in.
    if (auth.account && new URLSearchParams(window.location.search).has("reset")) await logout();
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
async function startGuest() {
  guest.value = true;
  editing.value = false;
  message.value = "";
  guestProfile.value = emptyProfile();
  await refresh();
}
function leaveGuest() {
  guest.value = false;
  editing.value = false;
  pools.value = [];
  selected.value = [];
  riders.value = [];
  message.value = "";
  error.value = "";
}
function saveBlob(blob: Blob, deelnID: number) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tourpool-inschrijving-${deelnID}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function submitGuestTeam() {
  const p = activePool.value;
  if (!p) return;
  if (selected.value.length !== p.PloegRennerAantal)
    throw new Error(
      `Kies ${p.PloegRennerAantal} renners, inclusief ${p.PloegReserveAantal} reserves.`,
    );
  const { username: _username, ...guestFields } = guestProfile.value;
  const result = await apiFetch<{ deelnID: number; deadline: string; pdf: string }>("/public/entries", {
    method: "POST",
    body: JSON.stringify({
      poolID: p.poolID,
      ploegnaam: ploegnaam.value,
      riders: selected.value,
      profile: guestFields,
    }),
  });
  const pdf = new Blob([Uint8Array.from(atob(result.pdf), (c) => c.charCodeAt(0))], {
    type: "application/pdf",
  });
  guestEntries.value.unshift({
    deelnID: result.deelnID,
    ploegnaam: ploegnaam.value,
    poolNaam: p.Naam || "",
    dropOff: dropOff(p),
    deadline: result.deadline,
    pdf,
  });
  saveBlob(pdf, result.deelnID);
  editing.value = false;
  message.value = `Inschrijfnummer ${result.deelnID} is aangemaakt en de PDF is gedownload. Let op: je ploeg is nog NIET actief. Hij doet pas mee nadat je het formulier hebt ingeleverd en de inleg hebt betaald. Niet betaald voor ${dutchTime(result.deadline)}? Dan wordt de inschrijving automatisch verwijderd.`;
}
async function openTeam(p: Pool, entry?: Entry) {
  busy.value = true;
  error.value = "";
  message.value = "";
  teamError.value = "";
  try {
    const [availableRiders, detail] = await Promise.all([
      apiFetch<Rider[]>(`${apiPrefix.value}/pools/${p.poolID}/riders`),
      entry
        ? apiFetch<Entry & { riders: Rider[] }>(`/me/entries/${entry.deelnID}`)
        : Promise.resolve(null),
    ]);
    selectedPoolID.value = p.poolID;
    riders.value = availableRiders;
    savedRiders.value = detail?.riders || [];
    selected.value = detail?.riders.map((r) => r.rennerID) || [];
    editingID.value = entry?.deelnID || null;
    ploegnaam.value = entry?.ploegnaam || (guest.value ? "" : profile.value.vNaam);
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
function removeRider(index: number) {
  if (editable.value) selected.value.splice(index, 1);
}

// Pointer events (instead of HTML5 drag and drop) so reordering also works on touchscreens.
const draggingID = ref<number | null>(null);
function startDrag(event: PointerEvent, id: number) {
  if (!editable.value || busy.value) return;
  event.preventDefault();
  draggingID.value = id;
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // Capture is optional; dragging still works without it.
  }
}
function onDrag(event: PointerEvent) {
  if (draggingID.value === null) return;
  const row = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>("[data-rider-index]");
  if (!row) return;
  const target = Number(row.dataset.riderIndex);
  const from = selected.value.indexOf(draggingID.value);
  if (from === -1 || target === from) return;
  selected.value.splice(from, 1);
  selected.value.splice(target, 0, draggingID.value);
}
function endDrag() {
  draggingID.value = null;
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
    if (guest.value) {
      await submitGuestTeam();
      return;
    }
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
    <template v-else-if="!auth.account && !guest">
      <LoginForm @signed-in="refresh" />
      <section
        class="mx-auto my-4 max-w-sm rounded-xl border border-yellow-700 bg-yellow-100 p-3 md:max-w-xl md:p-5">
        <h2 class="mb-2 text-xl font-bold">Meedoen zonder account?</h2>
        <p class="my-2">
          Vul je tourploeg in en druk het formulier af om in te leveren bij de
          organisatie. Zonder account kun je je ploeg achteraf niet meer
          bekijken of wijzigen.
        </p>
        <p class="my-2 font-semibold text-red-800">
          Je ploeg doet pas mee nadat de inleg is betaald. Niet betaald binnen
          48 uur? Dan wordt de inschrijving automatisch verwijderd.
        </p>
        <button class="btn max-[600px]:min-h-11 m-1" @click="startGuest">
          Inschrijven zonder account
        </button>
      </section>
    </template>
    <template v-else>
      <div class="max-w-180 mx-auto rounded-2xl border border-yellow-700 bg-amber-800 px-4 md:max-w-6xl">
        <header
          v-if="guest || !auth.account"
          class="mx-auto flex flex-wrap items-center justify-between gap-2 align-middle md:flex-row">
          <h1
            class="text-shadow-2xs my-5 text-3xl font-extrabold text-yellow-100 md:text-4xl">
            Jota's Tourpool
          </h1>
          <h2 class="text-2xl text-yellow-100">Inschrijven zonder account</h2>
          <button
            class="btn max-[600px]:min-h-11 m-1"
            :disabled="busy"
            @click="leaveGuest">
            Naar inloggen
          </button>
        </header>
        <header
          v-else
          class="mx-auto flex flex-wrap items-center justify-between gap-2 align-middle md:flex-row">
          <h1
            class="text-shadow-2xs my-5 text-3xl font-extrabold text-yellow-100 md:text-4xl">
            Jota's Tourpool
          </h1>
          <h2 class="text-2xl text-yellow-100">Ingelogd als<span class="ml-2 rounded-2xl border-2 border-amber-100 p-2 text-3xl font-extrabold text-amber-100">{{ auth.account.username }}</span></h2>
            <button
              class="btn max-[600px]:min-h-11 m-1"
              :disabled="busy"
              @click="openProfileEditor">
              Account bijwerken
            </button>
          <button
            class="btn max-[600px]:min-h-11 m-1"
            :disabled="busy"
            @click="signOut">
            Uitloggen
          </button>
        </header>
      </div>
      <p
        v-if="message"
        class="my-4 p-4"
        :class="guest ? 'border border-red-800 bg-amber-100 font-semibold text-red-900' : 'bg-green-100 text-green-800'"
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
              class="btn max-[600px]:min-h-11 m-1"
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
                class="btn max-[600px]:min-h-11 m-1"
                type="submit">
                Gegevens opslaan
              </button>
              <button
                class="btn max-[600px]:min-h-11 m-1"
                type="button"
                @click="cancelProfileEdit">
                Annuleren
              </button>
            </div>
          </fieldset>
        </form>
        <section class="max-w-140 md:max-w-180 mx-auto mt-4 border-t border-yellow-700/30 p-3">
          <AccountSettings :show-username="false" />
        </section>
      </dialog>

      <section
        v-if="editing && activePool"
        class="mx-auto my-2 max-w-sm rounded-xl border border-yellow-700 bg-yellow-100 p-3 md:max-w-6xl md:p-5">

        <div class="flex items-center justify-between gap-2">
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
          <p v-if="dropOff(activePool)" class="my-4">
            Inleveren en betalen bij: {{ dropOff(activePool) }}
          </p>
          
        </div>
        <form
          @submit.prevent="saveTeam()"
          @invalid.capture="teamError = guest ? 'Vul alle verplichte velden in.' : 'Vul een ploegnaam in.'">
          <fieldset :disabled="busy || !editable" class="min-w-0">
            <div v-if="guest" class="grid max-w-3xl grid-cols-12 gap-x-3">
              <p class="col-span-12 my-2">
                Zonder account wordt je ploeg direct ingeschreven en kun je hem
                daarna niet meer wijzigen. Controleer alles goed.
              </p>
              <p class="col-span-12 my-2 rounded-md bg-red-100 p-2 font-semibold text-red-800">
                Je ploeg is pas actief en doet pas mee nadat de inleg is
                betaald. Lever het formulier binnen 48 uur in en betaal, anders
                wordt de inschrijving automatisch verwijderd.
              </p>
              <label class="col-span-12 my-1 block font-semibold sm:col-span-4">Voornaam
                <input class="block w-full rounded-md border border-slate-500 bg-white p-2 font-normal" v-model="guestProfile.vNaam" autocomplete="given-name" required maxlength="24" /></label>
              <label class="col-span-4 my-1 block font-semibold sm:col-span-2">Voorv.
                <input class="block w-full rounded-md border border-slate-500 bg-white p-2 font-normal" v-model="guestProfile.tNaam" maxlength="12" /></label>
              <label class="col-span-8 my-1 block font-semibold sm:col-span-6">Achternaam
                <input class="block w-full rounded-md border border-slate-500 bg-white p-2 font-normal" v-model="guestProfile.aNaam" autocomplete="family-name" required maxlength="24" /></label>
              <label class="col-span-12 my-1 block font-semibold sm:col-span-4">Woonplaats (optioneel)
                <input class="block w-full rounded-md border border-slate-500 bg-white p-2 font-normal" v-model="guestProfile.plaats" autocomplete="address-level2" maxlength="24" /></label>
              <label class="col-span-12 my-1 block font-semibold sm:col-span-3">Telefoon (optioneel)
                <input class="block w-full rounded-md border border-slate-500 bg-white p-2 font-normal" v-model="guestProfile.tel" type="tel" autocomplete="tel" maxlength="12" /></label>
              <label class="col-span-12 my-1 block font-semibold sm:col-span-5">E-mailadres (optioneel)
                <input class="block w-full rounded-md border border-slate-500 bg-white p-2 font-normal" v-model="guestProfile.email" type="email" autocomplete="email" maxlength="64" /></label>
            </div>
            <label class="my-3 block font-semibold"
              >Ploegnaam
              <input
                class="max-w-120 block w-full rounded-md border border-slate-500 bg-white p-2.5 font-normal"
                v-model="ploegnaam"
                required
                maxlength="255"
            /></label>
            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-[2fr_3fr]">
              <div class="min-w-0">
                <label class="mb-2 block font-semibold"
                  >Zoek renner
                  <input
                    class="block w-full rounded-md border border-slate-500 bg-white p-2.5 font-normal"
                    v-model="search"
                    type="search"
                    placeholder="Naam, rugnummer of ploeg"
                /></label>
                <ul
                  class="h-112 overflow-auto rounded-md border border-slate-300 bg-white"
                  aria-label="Beschikbare renners">
                  <li
                    v-for="(r, index) in available"
                    :key="r.rennerID"
                    :class="
                      index > 0 &&
                      available[index - 1]?.ploegNaam !== r.ploegNaam
                        ? 'border-t-2 border-t-yellow-700'
                        : ''
                    ">
                    <button
                      type="button"
                      class="max-[600px]:min-h-11 flex w-full cursor-pointer items-center gap-3 border-b border-slate-200 px-3 py-1.5 text-left hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="selected.length >= activePool.PloegRennerAantal"
                      :title="`${riderName(r)} (${r.ploegNaam}) kiezen`"
                      @click="addRider(r.rennerID)">
                      <span
                        class="w-32 shrink-0 truncate text-sm font-semibold text-yellow-900 sm:w-44"
                        >{{
                          available[index - 1]?.ploegNaam === r.ploegNaam
                            ? ""
                            : r.ploegNaam
                        }}</span
                      >
                      <span class="w-8 shrink-0 text-right tabular-nums">{{
                        r.Rugnummer
                      }}</span>
                      <span class="min-w-0 flex-1 truncate">{{
                        riderName(r)
                      }}</span>
                      <svg
                        class="h-5 w-5 shrink-0 text-yellow-800"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true">
                        <path
                          d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
                      </svg>
                    </button>
                  </li>
                  <li
                    v-if="!available.length"
                    class="px-3 py-2 text-slate-600">
                    Geen renners gevonden.
                  </li>
                </ul>
              </div>
              <div class="min-w-0">
                <h3 class="mb-2 font-semibold">
                  Gekozen: {{ selected.length }} /
                  {{ activePool.PloegRennerAantal }}
                </h3>
                <p v-if="editable && selected.length > 1" class="mb-2 text-sm">
                  Sleep een renner aan het greepje om de volgorde te wijzigen
                  (of gebruik de pijltjestoetsen op het greepje).
                </p>
                <ol
                  class="min-h-24 rounded-md border border-slate-300 bg-white sm:grid sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-[repeat(10,auto)] sm:content-start sm:gap-x-2"
                  aria-label="Gekozen renners">
                  <li
                    v-for="(r, index) in selectedRiders"
                    :key="r.rennerID"
                    :data-rider-index="index"
                    class="flex items-center gap-2 border-b border-slate-200 px-2 py-1.5"
                    :class="[
                      draggingID === r.rennerID
                        ? 'bg-yellow-200 shadow-md'
                        : index >= mainCount
                          ? 'bg-slate-50'
                          : '',
                      index === mainCount ? 'border-t-2 border-t-yellow-700' : '',
                    ]">
                    <button
                      type="button"
                      class="flex h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-slate-500 hover:bg-yellow-100 active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
                      :aria-label="`${riderName(r)} verplaatsen (pijltjestoetsen)`"
                      title="Slepen om te verplaatsen"
                      @pointerdown="startDrag($event, r.rennerID)"
                      @pointermove="onDrag"
                      @pointerup="endDrag"
                      @pointercancel="endDrag"
                      @keydown.up.prevent="moveRider(index, -1)"
                      @keydown.down.prevent="moveRider(index, 1)">
                      <svg
                        class="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true">
                        <circle cx="7" cy="5" r="1.5" />
                        <circle cx="13" cy="5" r="1.5" />
                        <circle cx="7" cy="10" r="1.5" />
                        <circle cx="13" cy="10" r="1.5" />
                        <circle cx="7" cy="15" r="1.5" />
                        <circle cx="13" cy="15" r="1.5" />
                      </svg>
                    </button>
                    <span class="w-7 shrink-0 text-right tabular-nums"
                      :class="index >= mainCount ? 'font-semibold text-slate-600' : ''"
                      >{{
                        index >= mainCount
                          ? `R${index - mainCount + 1}`
                          : `${index + 1}.`
                      }}</span
                    >
                    <span class="min-w-0 flex-1">
                      <span class="block truncate"
                        >{{ riderName(r) }} ({{ r.Rugnummer }})</span
                      >
                      <span
                        v-if="
                          !riders.some(
                            (availableRider) =>
                              availableRider.rennerID === r.rennerID,
                          )
                        "
                        class="block text-sm text-red-800"
                        >Niet meer beschikbaar in deze tour; kies een
                        vervanger.</span
                      >
                    </span>
                    <button
                      type="button"
                      class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                      :aria-label="`${riderName(r)} verwijderen`"
                      title="Verwijderen"
                      @click="removeRider(index)">
                      <svg
                        class="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true">
                        <path
                          fill-rule="evenodd"
                          d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.44c-.8.08-1.58.18-2.37.3a.75.75 0 1 0 .22 1.49l.15-.02.8 10.46A2.75 2.75 0 0 0 7.55 19h4.9a2.75 2.75 0 0 0 2.74-2.58l.8-10.46.15.02a.75.75 0 1 0 .22-1.49c-.79-.12-1.57-.22-2.37-.3v-.44A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.67.03 2.5.08v-.33c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.33C8.33 4.03 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                          clip-rule="evenodd" />
                      </svg>
                    </button>
                  </li>
                  <li
                    v-if="!selectedRiders.length"
                    class="px-3 py-2 text-slate-600">
                    Nog geen renners gekozen. Klik links op een renner.
                  </li>
                </ol>
              </div>
            </div>
            <p
              v-if="teamError"
              class="my-4 bg-red-100 p-4 text-red-800"
              role="alert">
              {{ teamError }}
            </p>
            <template v-if="guest">
              <button
                class="btn max-[600px]:min-h-11 m-1"
                type="submit"
                :disabled="selected.length !== activePool.PloegRennerAantal">
                {{ busy ? "Bezig met inschrijven..." : "Inschrijven en PDF downloaden" }}
              </button>
            </template>
            <template v-else>
            <button
              class="btn max-[600px]:min-h-11 m-1"
              type="submit">
              {{ busy ? "Bezig met opslaan..." : "Tourploeg opslaan" }}
            </button>
            <button
              class="btn max-[600px]:min-h-11 m-1"
              type="button"
              :disabled="selected.length !== activePool.PloegRennerAantal"
              @click="saveTeam(true)">
              Opslaan en PDF downloaden
            </button>
            </template>
            <button
              class="btn max-[600px]:min-h-11 m-1"
              type="button"
              :disabled="busy"
              @click="editing = false">
              Terug zonder opslaan
            </button>
            <p
              v-if="guest && selected.length !== activePool.PloegRennerAantal"
              class="my-4">
              Kies alle {{ activePool.PloegRennerAantal }} renners inclusief
              reserves om in te schrijven.
            </p>
            <p
              v-else-if="selected.length !== activePool.PloegRennerAantal"
              class="my-4">
              Je kunt je ploeg alvast opslaan. Kies alle
              {{ activePool.PloegRennerAantal }} renners inclusief reserves om
              het formulier als PDF te downloaden en af te drukken.
            </p>
          </fieldset>
        </form>
      </section>

      <template v-else>
        <section
          v-if="guest"
          class="mx-auto my-2 max-w-sm rounded-xl border border-yellow-700 bg-yellow-100 p-3 md:max-w-6xl md:p-5">
          <h2 class="mb-4 text-[1.4rem]">Ingeschreven tourploegen</h2>
          <p class="my-4">
            Kies hieronder een pool en vul je ploeg in. Druk de PDF af, lever
            hem in bij de organisatie en betaal daar de inleg. Deze lijst
            verdwijnt als je de pagina sluit.
          </p>
          <p v-if="!guestEntries.length" class="my-4">
            Je hebt in deze sessie nog geen ploeg ingeschreven.
          </p>
          <article
            v-for="entry in guestEntries"
            :key="entry.deelnID"
            class="my-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-yellow-700 bg-white p-4">
            <span>
              {{ entry.ploegnaam }} - {{ entry.poolNaam }} (inschrijfnummer
              {{ entry.deelnID }})
              <span class="block text-sm font-semibold text-red-800">
                Nog niet actief: betalen voor {{ dutchTime(entry.deadline) }},
                anders wordt de inschrijving verwijderd.
              </span>
              <span v-if="entry.dropOff" class="block text-sm">
                Inleveren en betalen bij: {{ entry.dropOff }}
              </span>
            </span>
            <button
              class="btn max-[600px]:min-h-11 m-1"
              @click="saveBlob(entry.pdf, entry.deelnID)">
              PDF opnieuw downloaden
            </button>
          </article>
        </section>
        <section
          v-else
          class="mx-auto my-2 max-w-sm rounded-xl border border-yellow-700 bg-yellow-100 p-3 md:max-w-6xl md:p-5">
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
              {{
                selectedEntry.Betaald
                  ? "Betaald"
                  : "Nog niet betaald (telt pas mee in de stand na betaling)"
              }}
            </p>
            <button
              class="btn max-[600px]:min-h-11 m-1"
              :disabled="
                busy || !pools.some((p) => p.poolID === selectedEntry?.poolID)
              "
              @click="openSelectedTeam">
              Bekijken / wijzigen
            </button>
            <button
              class="btn max-[600px]:min-h-11 m-1"
              :disabled="busy"
              @click="pdf(selectedEntry)">
              PDF downloaden
            </button>
          </article>
        </section>
        <section
          class="mx-auto my-2 max-w-sm rounded-xl border border-yellow-700 bg-yellow-100 p-3 md:max-w-6xl md:p-3">

          <div class="flex flex-row justify-between gap-4">
            <h2 class="mb-2 ml-1 text-2xl">Beschikbare pools</h2>
            <button
              class="btn"
              :disabled="busy || loading"
              @click="refresh">
              Verversen
            </button>
          </div>

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
            <p v-if="dropOff(p)" class="my-4">
              Formulier inleveren en betalen bij: {{ dropOff(p) }}
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
              class="btn max-[600px]:min-h-11 m-1"
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
