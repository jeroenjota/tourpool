<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  ref,
  watch,
} from "vue";
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
import {Edit2, Plus, BanknoteCheck, Printer, BanknoteArrowUp  } from '@lucide/vue'; 
// import { Plus, Trash2, Edit2, X, UserCheck, Trophy, Award, Sliders, Eye, EyeOff, FileText, RefreshCw  } from '@lucide/vue';

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
  tourJaar: number | null;
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
  orgNaam: string | null;
  tourNaam: string;
  tourJaar: number | null;
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
interface PointAllocation {
  prestatieID: number;
  Omschrijving: string | null;
  Punten: number | null;
  uitslagtype: string | null;
  plaats: number | null;
  volgorde: number | null;
}
const pointsDialog = ref<HTMLDialogElement | null>(null);
const pointsPool = ref<Pool | null>(null);
const points = ref<PointAllocation[]>([]);
const pointsLoading = ref(false);
const pointsError = ref("");
async function showPoints(p: Pool) {
  pointsPool.value = p;
  points.value = [];
  pointsError.value = "";
  pointsLoading.value = true;
  pointsDialog.value?.showModal();
  try {
    points.value = await apiFetch<PointAllocation[]>(
      `${apiPrefix.value}/pools/${p.poolID}/point-allocations`,
    );
  } catch (err) {
    pointsError.value = errorMessage(err);
  } finally {
    pointsLoading.value = false;
  }
}
const pools = ref<Pool[]>([]);
const entries = ref<Entry[]>([]);
const selectedEntryID = ref<number | null>(null);
const selectedTourYear = ref("");
const selectedEntry = computed(() =>
  entries.value.find((entry) => entry.deelnID === selectedEntryID.value),
);
const tourYears = computed(() => {
  const years = new Map<string, { value: string; label: string; year: number }>();
  for (const entry of entries.value) {
    const value =
      entry.tourJaar === null
        ? `tour:${entry.tourNaam}`
        : `year:${entry.tourJaar}`;
    years.set(value, {
      value,
      label: String(entry.tourJaar ?? entry.tourNaam),
      year: entry.tourJaar ?? Number.NEGATIVE_INFINITY,
    });
  }
  return [...years.values()].sort(
    (a, b) => b.year - a.year || a.label.localeCompare(b.label, "nl"),
  );
});
const visibleEntries = computed(() =>
  entries.value.filter((entry) => {
    const value =
      entry.tourJaar === null
        ? `tour:${entry.tourNaam}`
        : `year:${entry.tourJaar}`;
    return value === selectedTourYear.value;
  }),
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
const suggestedPloegnaam = ref("");
const guestEntries = ref<
  {
    deelnID: number;
    ploegnaam: string;
    poolNaam: string;
    dropOff: string;
    deadline: string;
    pdf: Blob;
  }[]
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
const orgAdr = (p: Pool) => {
  const p1 = [p.orgStraat, p.orgHuisnummer].filter(Boolean).join(" ");
  const p2 = [p.orgPostcode, p.orgPlaats].filter(Boolean).join(" ");
  const parts = [p1, p2].filter(Boolean).join(" ");
  return parts.length ? parts : "";
};
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
const canEditEntry = (entry: Entry) => {
  const entryPool = pools.value.find((p) => p.poolID === entry.poolID);
  return !!entryPool && isOpen(entryPool);
};
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
  riders.value
    .filter(
      (r) =>
        !selected.value.includes(r.rennerID) &&
        `${r.Rugnummer} ${riderName(r)} ${r.ploegNaam}`
          .toLowerCase()
          .includes(search.value.toLowerCase()),
    )
    .sort((a, b) => Number(a.Rugnummer) - Number(b.Rugnummer)),
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
    selectedTourYear.value = "";
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
    if (!tourYears.value.some((year) => year.value === selectedTourYear.value)) {
      selectedTourYear.value = tourYears.value[0]?.value ?? "";
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
    if (
      auth.account &&
      new URLSearchParams(window.location.search).has("reset")
    )
      await logout();
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
  const result = await apiFetch<{
    deelnID: number;
    deadline: string;
    pdf: string;
  }>("/public/entries", {
    method: "POST",
    body: JSON.stringify({
      poolID: p.poolID,
      ploegnaam: ploegnaam.value,
      riders: selected.value,
      profile: guestFields,
    }),
  });
  const pdf = new Blob(
    [Uint8Array.from(atob(result.pdf), (c) => c.charCodeAt(0))],
    {
      type: "application/pdf",
    },
  );
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
  message.value = `Inschrijfnummer ${
    result.deelnID
  } is aangemaakt en de PDF is gedownload. Let op: je ploeg is nog NIET actief. Hij doet pas mee nadat je het formulier hebt ingeleverd en de inleg hebt betaald. Niet betaald voor ${dutchTime(
    result.deadline,
  )}? Dan wordt de inschrijving automatisch verwijderd.`;
}
async function openTeam(p: Pool, entry?: Entry) {
  busy.value = true;
  error.value = "";
  message.value = "";
  teamError.value = "";
  try {
    const [availableRiders, detail, suggestion] = await Promise.all([
      apiFetch<Rider[]>(`${apiPrefix.value}/pools/${p.poolID}/riders`),
      entry
        ? apiFetch<Entry & { riders: Rider[] }>(`/me/entries/${entry.deelnID}`)
        : Promise.resolve(null),
      !entry && !guest.value
        ? apiFetch<{ ploegnaam: string }>(
            `/me/pools/${p.poolID}/suggested-team-name`,
          )
        : Promise.resolve(null),
    ]);
    selectedPoolID.value = p.poolID;
    riders.value = availableRiders;
    savedRiders.value = detail?.riders || [];
    selected.value = detail?.riders.map((r) => r.rennerID) || [];
    editingID.value = entry?.deelnID || null;
    suggestedPloegnaam.value = "";
    ploegnaam.value = entry?.ploegnaam || suggestion?.ploegnaam || "";
    search.value = "";
    editing.value = true;
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}
async function suggestGuestTeamName() {
  const p = activePool.value;
  if (!guest.value || !p) return;
  if (ploegnaam.value && ploegnaam.value !== suggestedPloegnaam.value) return;
  const firstName = guestProfile.value.vNaam;
  const lastName = guestProfile.value.aNaam;
  const query = new URLSearchParams({
    firstName,
    lastName,
  });
  try {
    const result = await apiFetch<{ ploegnaam: string }>(
      `/public/pools/${p.poolID}/suggested-team-name?${query}`,
    );
    if (guestProfile.value.vNaam !== firstName || guestProfile.value.aNaam !== lastName) return;
    if (!ploegnaam.value || ploegnaam.value === suggestedPloegnaam.value) {
      ploegnaam.value = result.ploegnaam;
      suggestedPloegnaam.value = result.ploegnaam;
    }
  } catch (err) {
    teamError.value = errorMessage(err);
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
async function openEntry(entry: Entry) {
  if (!canEditEntry(entry)) {
    error.value = "De inschrijving is gesloten. Je ploeg kan niet meer worden gewijzigd.";
    return;
  }
  selectedEntryID.value = entry.deelnID;
  await openSelectedTeam();
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
  <main
    class="mx-auto p-2 md:p-4"
    :class="{ 'flex h-dvh flex-col overflow-hidden': editing && activePool }">
    <p v-if="error" class="my-4 bg-red-100 p-4 text-red-800" role="alert">
      {{ error }}
    </p>
    <p v-if="loading">Gegevens laden...</p>
    <template v-else-if="!auth.account && !guest">
      <LoginForm @signed-in="refresh" />
      <section
        class="max-w-140 md:max-w-140 mx-auto my-4 rounded-xl border border-yellow-700 bg-yellow-100 p-3 md:p-5">
        <h2 class="mb-2 text-center text-2xl font-bold">
          Meedoen zonder account? Dat kan!
        </h2>
        <p class="my-2">
          Vul je tourploeg in en druk het formulier 2 keer af; één voor jezelf
          en één om in te leveren bij de organisatie.<br />Zonder account kun je
          je ploeg achteraf niet meer bekijken of wijzigen.
        </p>
        <div class="flex justify-center">
          <button
            class="btn max-[600px]:min-h-11 m-1 text-center"
            @click="startGuest">
            Een pool toevoegen zonder account
          </button>
        </div>
        <p class="my-2 text-center text-xl font-semibold text-red-800">
          LET OP!
        </p>
        <p class="my-2 text-center text-red-800">
          Deze ploeg doet pas mee nadat de inleg is betaald.<br />Hij wordt
          verwijderd als je niet
          <span class="underline">binnen 48 uur</span> hebt betaald.
        </p>
      </section>
    </template>
    <template v-else>
      <div
        class="max-w-140 mx-auto w-full shrink-0 rounded-2xl border border-yellow-700 bg-amber-800 px-4 md:max-w-6xl">
        <header
          v-if="guest || !auth.account"
          class="mx-auto flex flex-wrap items-center justify-between gap-2 align-middle md:flex-row">
          <h1
            class="text-shadow-2xs text-3xl font-extrabold text-yellow-100 md:text-4xl"
            :class="editing ? 'my-2' : 'my-5'">
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
            class="text-shadow-2xs text-3xl font-extrabold text-yellow-100 md:text-4xl"
            :class="editing ? 'my-2' : 'my-5'">
            Jota's Tourpool
          </h1>
          <h2 v-if="!editing" class="text-2xl text-yellow-100">
            Ingelogd als<span
              class="ml-2 rounded-2xl border-2 border-amber-100 p-2 text-3xl font-extrabold text-amber-100"
              >{{ auth.account.username }}</span
            >
          </h2>
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
        :class="
          guest
            ? 'border border-red-800 bg-amber-100 font-semibold text-red-900'
            : 'bg-green-100 text-green-800'
        "
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
          <div
            class="mb-4 flex items-center justify-between gap-4 border-b border-yellow-700/30 pb-3">
            <h2 id="profile-dialog-title" class="text-xl font-bold">
              Gegevens wijzigen
            </h2>
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
              <button class="btn max-[600px]:min-h-11 m-1" type="submit">
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
        <section
          class="max-w-140 md:max-w-180 mx-auto mt-4 border-t border-yellow-700/30 p-3">
          <AccountSettings :show-username="false" />
        </section>
      </dialog>

      <dialog
        ref="pointsDialog"
        class="m-auto max-h-[90dvh] w-[min(100%-1.5rem,48rem)] max-w-none overflow-y-auto rounded-xl border border-yellow-700 bg-yellow-100 p-4 shadow-xl backdrop:bg-black/50 md:p-6"
        aria-labelledby="points-dialog-title">
        <div class="mb-4 flex items-center justify-between gap-4 border-b border-yellow-700/30 pb-3">
          <h2 id="points-dialog-title" class="text-xl font-bold">
            Puntentoekenning — {{ pointsPool?.Naam }} - {{ pointsPool?.Org }}
          </h2>
          <button
            type="button"
            class="btn max-[600px]:min-h-11"
            @click="pointsDialog?.close()">
            Sluiten
          </button>
        </div>
        <p v-if="pointsLoading" role="status">Puntentoekenning laden...</p>
        <p v-else-if="pointsError" class="bg-red-100 p-3 text-red-800" role="alert">
          {{ pointsError }}
        </p>
        <p v-else-if="!points.length">Voor deze pool is nog geen puntentoekenning ingesteld.</p>
        <table v-else class="w-full text-left">
          <caption class="sr-only">Puntentoekenning voor {{ pointsPool?.Naam }}</caption>
          <thead>
            <tr class="border-b border-yellow-700">
              <th scope="col" class="p-1">Voor</th>
              <th scope="col" class="p-1 text-right">Plaats</th>
              <th scope="col" class="p-1 text-right">Punten</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="point in points" :key="point.prestatieID" class="border-b border-yellow-700/20">
              <td class="p-1">{{ point.Omschrijving || point.uitslagtype || `Prestatie ${point.prestatieID}` }}</td>
              <td class="p-1 text-right tabular-nums">{{ point.plaats ?? "—" }}</td>
              <td class="p-1 text-right tabular-nums">{{ point.Punten ?? "—" }}</td>
            </tr>
          </tbody>
        </table>
      </dialog>

      <section
        v-if="editing && activePool"
        class="mx-auto my-1 flex min-h-0 w-full max-w-6xl flex-1 flex-col rounded-xl border border-yellow-700 bg-yellow-100 px-3 py-1">
        <div class="shrink-0 text-center">
          <div class="grid grid-cols-3 items-center gap-2">
            <h2 class="col-start-2 my-0 min-w-0 text-center text-3xl">
              {{ editingID ? "Mijn tourploeg" : "Nieuwe tourploeg" }}
            </h2>
            <button
              type="button"
              class="btn max-[600px]:min-h-11 wrap-break-word min-w-0 max-w-full justify-self-end"
              :disabled="pointsLoading"
              @click="showPoints(activePool)">
              Puntentoekenning
            </button>
          </div>
          <p class="my-1">
            voor de {{ activePool.Naam }}, georganiseerd door
            {{ activePool.Org }}
          </p>
          <hr />
          <div v-if="!editable" class="my-4">
            <p>
              Deze pool is gesloten voor wijzigingen. Je opgeslagen ploeg blijft
              zichtbaar.
            </p>
          </div>
        </div>
        <form
          class="flex min-h-0 flex-1 flex-col"
          @submit.prevent="saveTeam()"
          @invalid.capture="
            teamError = guest
              ? 'Vul alle verplichte velden in.'
              : 'Vul een ploegnaam in.'
          ">
          <fieldset
            :disabled="busy || !editable"
            class="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
            <div
              class="shrink-0 space-y-3"
              :class="{ 'max-h-[22dvh] overflow-y-auto md:max-h-[35dvh]': guest }">
              <div class="grid shrink-0 grid-cols-2 gap-3 text-left md:gap-6">
                <div class="col-start-1 min-w-0">
                  <div
                    v-if="guest"
                    class="mb-2 grid gap-2 sm:grid-cols-[2fr_1fr_3fr]">
                    <label class="block min-w-0 font-semibold"
                      >Voornaam
                      <input
                        class="block w-full rounded-md border border-slate-500 bg-white p-2 font-normal"
                        v-model="guestProfile.vNaam"
                        @change="suggestGuestTeamName"
                        autocomplete="given-name"
                        required
                        maxlength="24"
                    /></label>
                    <label class="block min-w-0 font-semibold"
                      >Voorv.
                      <input
                        class="block w-full rounded-md border border-slate-500 bg-white p-2 font-normal"
                        v-model="guestProfile.tNaam"
                        maxlength="12"
                    /></label>
                    <label class="block min-w-0 font-semibold"
                      >Achternaam
                      <input
                        class="block w-full rounded-md border border-slate-500 bg-white p-2 font-normal"
                        v-model="guestProfile.aNaam"
                        @change="suggestGuestTeamName"
                        autocomplete="family-name"
                        required
                        maxlength="24"
                    /></label>
                  </div>
                  <p v-if="!guest && auth.account" class="mb-2">
                    Ingelogd als
                    <strong class="block break-all text-xl text-amber-900">{{
                      auth.account.username
                    }}</strong>
                  </p>
                  <label class="block font-semibold"
                    >Ploegnaam
                    <input
                      class="block w-full rounded-md border border-slate-500 bg-white p-2 font-normal"
                      v-model="ploegnaam"
                      required
                      maxlength="255"
                  /></label>
                </div>
                <div v-if="editable" class="col-start-2 min-w-0 text-sm md:text-base">
                  <ul class="list-inside list-disc">
                    <li>Selecteer {{ activePool.PloegRennerAantal }} renners, de
                      laatste {{ activePool.PloegReserveAantal }} zijn reserves.
                    </li>
                    <li>Inleveren en betalen bij:</li>
                    <li class="list-none pl-4 font-bold">
                      {{ activePool.Org }}<br />{{ orgAdr(activePool) }}
                    </li>
                  </ul>
                  <div
                    v-if="guest"
                    class="mt-1 space-y-1 rounded-md border border-red-800 bg-amber-100 px-3 pt-1 text-sm">
                    <p class="font-semibold text-red-800">
                      Je ploeg is pas actief en doet pas mee nadat de inleg is
                      betaald. Lever het formulier binnen 48 uur in en betaal,
                      anders wordt de inschrijving automatisch verwijderd.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div
              class="grid min-h-0 flex-1 gap-4 overflow-y-auto md:grid-cols-2 md:overflow-hidden lg:grid-cols-[2fr_3fr]">
              <div class="flex min-h-0 min-w-0 flex-col">
                <label class="mb-2 block shrink-0 font-semibold"
                  >Zoek renner
                  <input
                    class="block w-full rounded-md border border-slate-500 bg-white p-2.5 font-normal"
                    v-model="search"
                    type="search"
                    placeholder="Naam, rugnummer of ploeg"
                /></label>
                <ul
                  class="h-72 shrink-0 overflow-auto rounded-md border border-slate-300 bg-white md:h-auto md:min-h-0 md:flex-1 md:shrink"
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
                      :disabled="
                        selected.length >= activePool.PloegRennerAantal
                      "
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
                  <li v-if="!available.length" class="px-3 py-2 text-slate-600">
                    Geen renners gevonden.
                  </li>
                </ul>
              </div>
              <div class="flex min-h-0 min-w-0 flex-col">
                <h3 class="mb-2 shrink-0 font-semibold">
                  Gekozen: {{ selected.length }} /
                  {{ activePool.PloegRennerAantal }}
                </h3>
                <p v-if="editable && selected.length > 1" class="mb-2 shrink-0 text-sm">
                  Sleep een renner aan het greepje om de volgorde te wijzigen
                  (of gebruik de pijltjestoetsen op het greepje).
                </p>
                <ol
                  class="min-h-24 shrink-0 rounded-md border border-slate-300 bg-white sm:grid sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-[repeat(10,auto)] sm:content-start sm:gap-x-2 md:min-h-0 md:flex-1 md:shrink md:overflow-auto"
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
                      index === mainCount
                        ? 'border-t-2 border-t-yellow-700'
                        : '',
                    ]">
                    <button
                      type="button"
                      class="flex h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-slate-500 hover:bg-yellow-100 active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
                      :aria-label="`${riderName(
                        r,
                      )} verplaatsen (pijltjestoetsen)`"
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
                    <span
                      class="w-7 shrink-0 text-right tabular-nums"
                      :class="
                        index >= mainCount ? 'font-semibold text-slate-600' : ''
                      "
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
          </fieldset>
          <div class="shrink-0 border-t border-yellow-700/30 pt-2">
            <p
              v-if="teamError"
              class="mb-2 bg-red-100 p-2 text-red-800"
              role="alert">
              {{ teamError }}
            </p>
            <template v-if="guest">
              <button
                class="btn max-[600px]:min-h-11 m-1"
                type="submit"
                :disabled="busy || !editable || selected.length !== activePool.PloegRennerAantal">
                {{
                  busy
                    ? "Bezig met inschrijven..."
                    : "Inschrijven en PDF downloaden"
                }}
              </button>
            </template>
            <template v-else>
              <button
                class="btn max-[600px]:min-h-11 m-1"
                type="submit"
                :disabled="busy || !editable">
                {{ busy ? "Bezig met opslaan..." : "Tourploeg opslaan" }}
              </button>
              <button
                class="btn max-[600px]:min-h-11 m-1"
                type="button"
                :disabled="busy || !editable || selected.length !== activePool.PloegRennerAantal"
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
              v-if="editable && guest && selected.length !== activePool.PloegRennerAantal"
              class="my-1 text-sm">
              Kies alle {{ activePool.PloegRennerAantal }} renners inclusief
              reserves om in te schrijven.
            </p>
            <p
              v-else-if="editable && selected.length !== activePool.PloegRennerAantal"
              class="my-1 text-sm">
              Je kunt je ploeg alvast opslaan. Kies alle
              {{ activePool.PloegRennerAantal }} renners inclusief reserves om
              het formulier als PDF te downloaden en af te drukken.
            </p>
          </div>
        </form>
      </section>

      <template v-else>
        <section
          class="mx-auto my-2 max-w-sm rounded-xl border border-yellow-700 bg-yellow-100 p-3 md:max-w-6xl md:p-3">
          <div class="flex flex-row justify-between gap-4">
            <h2 class="mb-2 ml-1 text-2xl">Beschikbare pools</h2>
            <button class="btn" :disabled="busy || loading" @click="refresh">
              Verversen
            </button>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article
              v-for="p in pools"
              :key="p.poolID"
              class="flex flex-col rounded-lg border border-yellow-700 bg-white p-4">
              <h3 class="mb-1 text-center text-lg font-semibold">
                {{ p.Org || "Geen organisatie" }} {{ p.tourJaar }}
              </h3>
              <p class="mb-3 text-center">{{ p.Naam }}</p>
              <p class="my-2">
                Inleg: EUR {{ Number(p.inleg || 0).toFixed(2) }} per ploeg.
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
              <p v-if="!isOpen(p)" class="my-2">
                {{ p.reason || "De inschrijving is gesloten." }}
              </p>
              <div class="mt-auto flex justify-center pt-3">
                <button
                  class="btn max-[600px]:min-h-11 m-1 inline-flex items-center gap-2"
                  :disabled="busy || !isOpen(p)"
                  @click="openTeam(p)" title="Voeg ploeg toe aan deze pool">
                  <Plus class="h-4 w-4"  /> 
                  <p>Voeg ploeg toe</p>
                </button>
              </div>
            </article>
          </div>
        </section>
        <section
          v-if="guest"
          class="mx-auto my-2 max-w-sm rounded-xl border border-yellow-700 bg-yellow-100 p-3 md:max-w-6xl md:p-5">
          <h2 class="mb-4 text-[1.4rem]">Ingeschreven tourploegen</h2>
          <p class="my-4">
            Kies hieronder een pool en vul je ploeg in. Druk de PDF af, lever
            hem in bij de organisatie en betaal daar de inleg. Deze lijst
            verdwijnt als je de pagina sluit.
          </p>
          <p v-if="!guestEntries.length" class="my-1 text-center font-semibold text-red-600">
            Je hebt nog geen ploeg ingeschreven.
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
          <div class="flex items-center justify-start gap-2">
            <h2 class="text-xl">Mijn tourploegen voor:</h2>
              <select
                class="block w-20 rounded-md border border-slate-500 bg-white p-0.5 text-center font-normal"
                v-model="selectedTourYear"
                :disabled="busy">
                <option v-for="year in tourYears" :key="year.value" :value="year.value">
                  {{ year.label }}
                </option>
              </select>
          </div>
          <p class="my-4">
            Je kunt meerdere ploegen per pool invullen. Lever per ploeg de PDF
            in bij de organisatie en betaal daar. De admin bevestigt je
            betaling.
          </p>
          <p v-if="!entries.length" class="my-4">
            Je hebt nog geen tourploegen ingevuld.
          </p>
          <p v-if="entries.length && !visibleEntries.length" class="my-4">
            Je hebt nog geen tourploegen voor dit tourjaar.
          </p>
          <div v-if="visibleEntries.length" class="mt-4 grid gap-3 md:grid-cols-4">
            <article
              v-for="entry in visibleEntries"
              :key="entry.deelnID"
              class="rounded-lg border border-yellow-700 bg-yellow-200 p-2"
              :title="entry.Betaald ? 'Inschrijving is betaald' : 'MOET NOG BETAALD WORDEN'">
              <div class="flex items-center justify-between">
                <h3 class="my-2 text-lg font-semibold">{{ entry.ploegnaam }}</h3>
                  <BanknoteCheck v-if="entry.Betaald" class="text-green-600" />
                  <BanknoteArrowUp v-else class="h-8 w-8 text-red-600" />
              </div>
              <p>{{ entry.poolNaam }} </p>
              <p class="text-sm text-slate-700">
                {{ entry.orgNaam || "Geen organisatie" }} ·
                {{ entry.tourJaar ?? entry.tourNaam }}
              </p>
              <p v-if="!canEditEntry(entry)" class="my-1 text-sm text-slate-700">
                Inschrijving gesloten — deze ploeg kan niet meer worden aangepast.
              </p>
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs text-red-600">{{ entry.Betaald ? '' : 'Ploeg telt niet mee!' }}</p>
                <button
                  class="btn max-[600px]:min-h-11 m-1"
                  :disabled="busy || !canEditEntry(entry)"
                  :aria-label="canEditEntry(entry) ? 'Tourploeg aanpassen' : 'Tourploeg aanpassen (inschrijving gesloten)'"
                  @click="openEntry(entry)">
                  <Edit2 class="h-4 w-4" />
                </button>
                <button
                  class="btn max-[600px]:min-h-11 m-1"
                  :disabled="busy"
                  @click="pdf(entry)">
                  <Printer class="h-4 w-4" />
                </button>
              </div>
            </article>
          </div>
        </section>
      </template>
    </template>
  </main>
</template>
