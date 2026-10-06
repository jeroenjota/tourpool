<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { apiFetch } from "../services/api";
import { RefreshCw, X, Save, Check, Plus, Edit2 } from "@lucide/vue";

interface Stage {
  tour: string;
  etappeNr?: number | null;
  datum?: string | null;
  Start?: string | null;
  Finish?: string | null;
  kms?: number | null;
  type?: string | null;
}

interface Tour {
  tourID: number;
  naam: string;
}

interface TourRider {
  tourID: number;
  ploegID: number;
  ploegNaam: string;
  ploegCode?: string | null;
  ploegLand?: string | null;
  rennerID: number;
  Rugnummer: number;
  nietGestartEtappe?: number | null;
  anaam: string;
  vnaam?: string | null;
  tnaam?: string | null;
  rennerLand?: string | null;
}

interface PoolOption {
  poolID: number;
  AantalEtapPlaatsen?: number | null;
  AantalKlasGeel?: number | null;
  AantalKlasGroen?: number | null;
  AantalKlasBol?: number | null;
  AantalKlasWit?: number | null;
}

interface Pool {
  poolID: number;
  tourID: number;
}

interface StageResultItem {
  tourID: number;
  etappeNr: number;
  uitslagType: string;
  plaats: number;
  rennerID: number;
  anaam?: string;
  vnaam?: string | null;
  tnaam?: string | null;
  rennerLand?: string | null;
  Rugnummer?: number | null;
  ploegNaam?: string | null;
  ploegCode?: string | null;
}

const stages = ref<Stage[]>([]);
const tours = ref<Tour[]>([]);
const selectedTourID = ref<number | null>(null);
const tourRiders = ref<TourRider[]>([]);
const poolOptions = ref<PoolOption | null>(null);
const allStageResults = ref<StageResultItem[]>([]);
const loading = ref(true);
const saving = ref(false);
const createStageModalOpen = ref(false);
const editingStage = ref<Stage | null>(null);
const stageForm = ref<{
  etappeNr: number | "";
  datum: string;
  Start: string;
  Finish: string;
  kms: number | "";
  type: string;
}>({
  etappeNr: 1,
  datum: "",
  Start: "",
  Finish: "",
  kms: "",
  type: "vlak",
});

// Modal state voor uitslag invoeren
const modalOpen = ref(false);
const activeStage = ref<Stage | null>(null);
const isTeamTimeTrial = computed(
  () => activeStage.value?.type?.toLowerCase() === "ttt",
);

// Formulier state per categorie
const resultForm = ref<{
  rit: (number | null)[];
  geel: (number | null)[];
  bol: (number | null)[];
  groen: (number | null)[];
  wit: (number | null)[];
}>({
  rit: [],
  geel: [],
  bol: [],
  groen: [],
  wit: [],
});
const nonStarterRiderIDs = ref<number[]>([]);

const targetCounts = computed(() => ({
  rit: poolOptions.value?.AantalEtapPlaatsen ?? 7,
  geel: poolOptions.value?.AantalKlasGeel ?? 3,
  bol: poolOptions.value?.AantalKlasBol ?? 3,
  groen: poolOptions.value?.AantalKlasGroen ?? 3,
  wit: poolOptions.value?.AantalKlasWit ?? 1,
}));

const fetchData = async () => {
  loading.value = true;
  try {
    tours.value = await apiFetch<Tour[]>("/tours");
    if (!tours.value.some((tour) => tour.tourID === selectedTourID.value)) {
      selectedTourID.value = tours.value[0]?.tourID ?? null;
    }

    if (selectedTourID.value === null) {
      stages.value = [];
      tourRiders.value = [];
      poolOptions.value = null;
      allStageResults.value = [];
      return;
    }

    const tourID = selectedTourID.value;
    const [stagesRes, ridersRes, poolsRes, optionsRes, resultsRes] = await Promise.all([
      apiFetch<Stage[]>(`/stages?tour=${tourID}`),
      apiFetch<TourRider[]>(`/team-riders?tourID=${tourID}`),
      apiFetch<Pool[]>("/pools"),
      apiFetch<PoolOption[]>("/options").catch(() => []),
      apiFetch<StageResultItem[]>(`/stage-results?tourID=${tourID}`),
    ]);

    stages.value = stagesRes.sort((a, b) => {
      const dateA = a.datum ? new Date(a.datum).getTime() : 0;
      const dateB = b.datum ? new Date(b.datum).getTime() : 0;
      return dateA - dateB;
    });

    tourRiders.value = ridersRes;
    const tourPool = poolsRes.find((pool) => pool.tourID === tourID);
    poolOptions.value = optionsRes.find((options) => options.poolID === tourPool?.poolID) || null;
    allStageResults.value = resultsRes;
  } catch (err) {
    console.error("Error fetching stage data:", err);
  } finally {
    loading.value = false;
  }
};

const onTourChange = () => {
  stages.value = [];
  tourRiders.value = [];
  poolOptions.value = null;
  allStageResults.value = [];
  void fetchData();
};

onMounted(fetchData);

const openCreateStageModal = () => {
  editingStage.value = null;
  const lastStageNumber = stages.value.reduce(
    (highest, stage) => Math.max(highest, stage.etappeNr ?? 0),
    0,
  );
  stageForm.value = {
    etappeNr: lastStageNumber + 1,
    datum: "",
    Start: "",
    Finish: "",
    kms: "",
    type: "vlak",
  };
  createStageModalOpen.value = true;
};

const openEditStageModal = (stage: Stage) => {
  editingStage.value = stage;
  stageForm.value = {
    etappeNr: stage.etappeNr ?? "",
    datum: stage.datum ? String(stage.datum).slice(0, 10) : "",
    Start: stage.Start ?? "",
    Finish: stage.Finish ?? "",
    kms: stage.kms ?? "",
    type: stage.type?.toLowerCase() === "rustdag" ? "rustdag" : stage.type ?? "vlak",
  };
  createStageModalOpen.value = true;
};

const closeStageModal = () => {
  createStageModalOpen.value = false;
  editingStage.value = null;
};

const saveStage = async () => {
  if (selectedTourID.value === null) return;

  const isRestDay = stageForm.value.type === "rustdag";
  if (!editingStage.value && !isRestDay && stageForm.value.etappeNr === "") return;
  saving.value = true;

  try {
    const payload = {
      datum: stageForm.value.datum,
      Start: isRestDay ? null : stageForm.value.Start.trim(),
      Finish: isRestDay ? null : stageForm.value.Finish.trim(),
      kms: isRestDay || stageForm.value.kms === "" ? null : Number(stageForm.value.kms),
      type: stageForm.value.type,
    };
    const stageToEdit = editingStage.value;

    if (stageToEdit) {
      const endpoint =
        stageToEdit.etappeNr == null
          ? `/stages/rest-day/${stageToEdit.tour}/${String(stageToEdit.datum).slice(0, 10)}`
          : `/stages/${stageToEdit.tour}/${stageToEdit.etappeNr}`;
      await apiFetch(endpoint, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch("/stages", {
        method: "POST",
        body: JSON.stringify({
          tour: String(selectedTourID.value),
          etappeNr: isRestDay ? null : Number(stageForm.value.etappeNr),
          ...payload,
        }),
      });
    }
    closeStageModal();
    await fetchData();
  } catch (err) {
    alert(`Fout bij ${editingStage.value ? "wijzigen" : "toevoegen"} etappe: ${err instanceof Error ? err.message : err}`);
  } finally {
    saving.value = false;
  }
};

// Gesorteerde lijst van renners voor in de dropdowns
const sortedTourRiders = computed(() => {
  return [...tourRiders.value].sort((a, b) => {
    const aName = a.anaam || "";
    const bName = b.anaam || "";
    return aName.localeCompare(bName, "nl");
  });
});

const activeTourRidersForStage = computed(() =>
  sortedTourRiders.value.filter(
    rider =>
      rider.nietGestartEtappe == null ||
      rider.nietGestartEtappe >= (activeStage.value?.etappeNr ?? Number.MAX_SAFE_INTEGER)
  )
);

const formatRiderOption = (r: TourRider) => {
  const given = [r.vnaam, r.tnaam].filter(Boolean).join(" ");
  const namePart = given ? `${r.anaam}, ${given}` : r.anaam;
  const parts = [namePart];
  if (r.Rugnummer) parts.push(`(#${r.Rugnummer})`);
  if (r.ploegCode) parts.push(`[${r.ploegCode}]`);
  return parts.join(" ");
};

const formatStageDate = (d?: string | null) => {
  if (!d) return "-";
  const date = new Date(d);
  return date.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const isRestDay = (stage: Stage) => stage.type?.toLowerCase() === "rustdag";
const hasStageResults = (stage: Stage) =>
  Boolean(
    stage.etappeNr &&
      allStageResults.value.some(
        (result) => result.etappeNr === stage.etappeNr,
      ),
  );

// Modal openen om uitslag in te voeren
const openResultModal = (s: Stage) => {
  if (isRestDay(s) || !s.etappeNr) return;

  activeStage.value = s;

  // Initialiseer form arrays op basis van optie-aantallen
  const initCategory = (
    key: "rit" | "geel" | "bol" | "groen" | "wit",
    count: number,
  ) => {
    const existing = allStageResults.value.filter(
      (r) => r.etappeNr === s.etappeNr && r.uitslagType.toLowerCase() === key,
    );
    const arr: (number | null)[] = [];
    for (let pos = 1; pos <= count; pos++) {
      const match = existing.find((r) => r.plaats === pos);
      arr.push(match ? match.rennerID : null);
    }
    return arr;
  };

  resultForm.value = {
    rit: initCategory("rit", targetCounts.value.rit),
    geel: initCategory("geel", targetCounts.value.geel),
    bol: initCategory("bol", targetCounts.value.bol),
    groen: initCategory("groen", targetCounts.value.groen),
    wit: initCategory("wit", targetCounts.value.wit),
  };
  nonStarterRiderIDs.value = activeTourRidersForStage.value
    .filter(rider => rider.nietGestartEtappe === s.etappeNr)
    .map(rider => rider.rennerID);

  modalOpen.value = true;
};

const saveResults = async () => {
  if (!activeStage.value || !activeStage.value.etappeNr) return;
  saving.value = true;

  try {
    const resultsPayload: Array<{
      uitslagType: string;
      plaats: number;
      rennerID: number;
    }> = [];

    const appendResults = (key: "rit" | "geel" | "bol" | "groen" | "wit") => {
      const arr = resultForm.value[key];
      for (let i = 0; i < arr.length; i++) {
        if (arr[i]) {
          resultsPayload.push({
            uitslagType: key,
            plaats: i + 1,
            rennerID: Number(arr[i]),
          });
        }
      }
    };

    if (!isTeamTimeTrial.value) appendResults("rit");
    appendResults("geel");
    appendResults("bol");
    appendResults("groen");
    appendResults("wit");

    await apiFetch("/stage-results/batch", {
      method: "PUT",
      body: JSON.stringify({
        tourID: selectedTourID.value,
        etappeNr: activeStage.value.etappeNr,
        results: resultsPayload,
        nietGestartRenners: nonStarterRiderIDs.value,
      }),
    });

    alert(
      `Uitslag voor Etappe #${activeStage.value.etappeNr} succesvol opgeslagen!`,
    );
    modalOpen.value = false;
    await fetchData();
  } catch (err) {
    alert(
      `Fout bij opslaan uitslag: ${err instanceof Error ? err.message : err}`,
    );
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3 bg-yellow-300">
      <div>
        <h2 class="mt-2 text-xl font-bold text-slate-900">
          Etappe-overzicht & Uitslagen
        </h2>
        <p class="text-xs text-slate-500">
          Klik op een etapperij om de daguitslag en klassementstruien in te voeren
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          :disabled="loading || selectedTourID === null"
          class="flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          @click="openCreateStageModal">
          <Plus class="h-4 w-4" />
          <span>Etappe toevoegen</span>
        </button>
        <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span>Tour</span>
          <select
            v-model="selectedTourID"
            :disabled="loading || tours.length === 0"
            class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none disabled:opacity-60"
            @change="onTourChange">
            <option v-for="tour in tours" :key="tour.tourID" :value="tour.tourID">
              {{ tour.naam }}
            </option>
          </select>
        </label>
        <button
          @click="fetchData"
          class="shadow-xs rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50"
          title="Verversen">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <div
      class="shadow-xs overflow-x-auto rounded-xl border border-yellow-800 bg-white">
      <table class="min-w-120 w-full border-collapse border text-left text-sm">
        <thead
          class="bg-yellow-300 text-xs font-semibold uppercase text-slate-600">
          <tr>
            <th scope="col" class="px-4 py-2">Etappe</th>
            <th scope="col" class="px-4 py-2">Datum</th>
            <th scope="col" class="px-4 py-2">Parcours</th>
            <th scope="col" class="px-4 py-2">Lengte</th>
            <th scope="col" class="px-4 py-2">Type</th>
            <th scope="col" class="px-4 py-2">Acties</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          <tr v-if="loading && stages.length === 0">
            <td colspan="6" class="px-4 py-10 text-center text-slate-400">
              Etappes laden...
            </td>
          </tr>
          <tr v-else-if="stages.length === 0">
            <td colspan="6" class="px-4 py-10 text-center text-slate-400">
              Geen etappes gevonden.
            </td>
          </tr>
          <tr
            v-for="s in stages"
            :key="`${s.tour}-${s.datum}-${s.etappeNr}`"
            :class="
              isRestDay(s)
                ? 'bg-yellow-50/70'
                : hasStageResults(s)
                ? 'cursor-pointer bg-yellow-200 hover:bg-emerald-100'
                : 'cursor-pointer bg-yellow-100 hover:bg-yellow-200'
            "
            @click="openResultModal(s)">
            <td class="whitespace-nowrap px-4 py-2 font-medium">
              <span class="inline-flex items-center gap-2">
                <button
                  v-if="!isRestDay(s) && s.etappeNr"
                  type="button"
                  class="font-semibold text-amber-700 hover:text-amber-900 hover:underline"
                  :aria-label="`Uitslag invoeren voor etappe ${s.etappeNr}`"
                  @click.stop="openResultModal(s)">
                  {{ s.etappeNr }}
                </button>
                <Check
                  v-if="hasStageResults(s)"
                  class="h-4 w-4 text-emerald-700"
                  aria-label="Uitslag ingevoerd" />
              </span>
            </td>
            <td class="whitespace-nowrap px-4 py-2 text-slate-700">
              {{ formatStageDate(s.datum) }}
            </td>
            <td class="px-4 py-2 font-medium text-slate-900">
              <span v-if="isRestDay(s)">Rustdag</span>
              <span v-else>{{ s.Start || "?" }} - {{ s.Finish || "?" }}</span>
            </td>
            <td class="whitespace-nowrap px-4 py-2 text-slate-700">
              <span v-if="!isRestDay(s) && s.kms != null">{{ s.kms }} km</span>
            </td>
            <td class="px-4 py-2 capitalize text-slate-700">
              {{ isRestDay(s) ? "" : s.type }}
            </td>
            <td class="whitespace-nowrap px-4 py-2">
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 hover:text-amber-900"
                :aria-label="`Etappe ${isRestDay(s) ? 'rustdag' : s.etappeNr} wijzigen`"
                @click.stop="openEditStageModal(s)">
                <Edit2 class="h-3.5 w-3.5" />
                Wijzigen
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Etappe toevoegen of wijzigen -->
    <div
      v-if="createStageModalOpen"
      class="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        class="w-full max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        @submit.prevent="saveStage">
        <div class="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h3 class="text-lg font-bold text-slate-900">
              {{ editingStage ? "Etappe wijzigen" : "Etappe toevoegen" }}
            </h3>
            <p class="text-sm text-slate-500">{{ tours.find((tour) => tour.tourID === selectedTourID)?.naam }}</p>
          </div>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-700"
            aria-label="Sluiten"
            @click="closeStageModal">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="block text-xs font-semibold text-slate-700">
            Etappenummer
            <input
              v-model.number="stageForm.etappeNr"
              type="number"
              min="1"
              :required="!editingStage && stageForm.type !== 'rustdag'"
              :disabled="Boolean(editingStage) || stageForm.type === 'rustdag'"
              class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-amber-500 focus:outline-none disabled:bg-slate-100"
              placeholder="Leeg voor rustdag" />
          </label>
          <label class="block text-xs font-semibold text-slate-700">
            Datum
            <input
              v-model="stageForm.datum"
              type="date"
              required
              class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-amber-500 focus:outline-none" />
          </label>
          <label class="block text-xs font-semibold text-slate-700">
            Start
            <input
              v-model="stageForm.Start"
              type="text"
              :required="stageForm.type !== 'rustdag'"
              :disabled="stageForm.type === 'rustdag'"
              class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-amber-500 focus:outline-none disabled:bg-slate-100" />
          </label>
          <label class="block text-xs font-semibold text-slate-700">
            Finish
            <input
              v-model="stageForm.Finish"
              type="text"
              :required="stageForm.type !== 'rustdag'"
              :disabled="stageForm.type === 'rustdag'"
              class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-amber-500 focus:outline-none disabled:bg-slate-100" />
          </label>
          <label class="block text-xs font-semibold text-slate-700">
            Lengte (km)
            <input
              v-model.number="stageForm.kms"
              type="number"
              min="0"
              step="0.1"
              :disabled="stageForm.type === 'rustdag' || Boolean(editingStage && editingStage.etappeNr == null)"
              class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-amber-500 focus:outline-none disabled:bg-slate-100" />
          </label>
          <label class="block text-xs font-semibold text-slate-700">
            Type
            <select
              v-model="stageForm.type"
              required
              :disabled="Boolean(editingStage && editingStage.etappeNr == null)"
              class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-amber-500 focus:outline-none">
              <option value="vlak">Vlak</option>
              <option value="heuvels">Heuvels</option>
              <option value="bergen">Bergen</option>
              <option value="ITT">ITT</option>
              <option value="TTT">TTT</option>
              <option
                v-if="!editingStage || editingStage.etappeNr == null"
                value="rustdag">
                Rustdag
              </option>
            </select>
          </label>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            @click="closeStageModal">
            Annuleren
          </button>
          <button
            type="submit"
            :disabled="saving"
            class="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50">
            <Save class="h-4 w-4" />
            <span>
              {{
                saving
                  ? "Opslaan..."
                  : editingStage
                  ? "Wijzigingen opslaan"
                  : "Etappe opslaan"
              }}
            </span>
          </button>
        </div>
      </form>
    </div>

    <!-- Modal: Uitslag invoeren per categorie -->
    <div
      v-if="modalOpen && activeStage"
      class="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        class="flex max-h-[92vh] w-full max-w-4xl flex-col space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <!-- Modal Header -->
        <div
          class="flex shrink-0 items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <div class="flex items-center gap-2">
              <span
                class="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-xs font-bold text-amber-800">
                Etappe #{{ activeStage.etappeNr }}
              </span>
              <h3 class="text-lg font-bold text-slate-900">
                Uitslag & Truiendragers invoeren
              </h3>
            </div>
            <p class="mt-0.5 text-xs text-slate-500">
              {{ formatStageDate(activeStage.datum) }} •
              {{ activeStage.Start }} ➔ {{ activeStage.Finish }} ({{
                activeStage.kms
              }}
              km)
            </p>
          </div>
          <button
            @click="modalOpen = false"
            class="text-slate-400 hover:text-slate-700">
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Modal Body: Categorieën Grid -->
        <div class="flex-1 space-y-6 overflow-y-auto pr-1">
          <section class="space-y-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
            <div class="flex items-center justify-between gap-3 border-b border-rose-200 pb-2">
              <div>
                <h4 class="text-sm font-bold text-rose-900">Niet gestart</h4>
                <p class="text-xs text-rose-700">Markeer renners die deze etappe niet zijn gestart.</p>
              </div>
              <span class="shrink-0 rounded-full border border-rose-200 bg-white px-2 py-0.5 text-xs font-semibold text-rose-700">
                {{ nonStarterRiderIDs.length }} geselecteerd
              </span>
            </div>
            <div v-if="activeTourRidersForStage.length === 0" class="text-xs text-slate-500">
              Er zijn geen renners die nog aan deze etappe kunnen starten.
            </div>
            <div v-else class="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              <label
                v-for="rider in activeTourRidersForStage"
                :key="`non-starter-${rider.rennerID}`"
                class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-white"
              >
                <input
                  v-model="nonStarterRiderIDs"
                  type="checkbox"
                  :value="rider.rennerID"
                  class="h-3.5 w-3.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                />
                <span class="truncate" :title="formatRiderOption(rider)">
                  {{ formatRiderOption(rider) }}
                </span>
                <span v-if="rider.nietGestartEtappe === activeStage.etappeNr" class="shrink-0 text-[10px] font-semibold text-rose-700">
                  Niet gestart
                </span>
              </label>
            </div>
          </section>

          <!-- 1. Rit (Daguitslag) -->
          <div
            v-if="!isTeamTimeTrial"
            class="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div
              class="flex items-center justify-between border-b border-slate-200 pb-2">
              <div class="flex items-center gap-2">
                <span class="text-lg">🏁</span>
                <h4 class="text-sm font-bold text-slate-900">
                  Daguitslag (Top {{ targetCounts.rit }})
                </h4>
              </div>
              <span class="text-xs font-semibold text-slate-500"
                >Type 'rit'</span
              >
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div v-for="pos in targetCounts.rit" :key="`rit-${pos}`">
                <label class="mb-1 block text-xs font-semibold text-slate-700"
                  >Plaats {{ pos }}</label
                >
                <select
                  v-model="resultForm.rit[pos - 1]"
                  class="shadow-2xs w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none">
                  <option :value="null">-- Kies renner --</option>
                  <option
                    v-for="r in sortedTourRiders"
                    :key="`rit-${pos}-${r.rennerID}`"
                    :value="r.rennerID">
                    {{ formatRiderOption(r) }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- 2. Klassementstruien Grid -->
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <!-- Gele trui -->
            <div
              class="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <div
                class="flex items-center justify-between border-b border-amber-200 pb-2">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🟡</span>
                  <h4 class="text-sm font-bold text-amber-900">
                    Gele trui (Top {{ targetCounts.geel }})
                  </h4>
                </div>
                <span class="text-xs font-semibold text-amber-700"
                  >Type 'geel'</span
                >
              </div>
              <div class="space-y-2">
                <div v-for="pos in targetCounts.geel" :key="`geel-${pos}`">
                  <label class="mb-1 block text-xs font-semibold text-amber-900"
                    >Geel #{{ pos }}</label
                  >
                  <select
                    v-model="resultForm.geel[pos - 1]"
                    class="shadow-2xs w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none">
                    <option :value="null">-- Kies renner --</option>
                    <option
                      v-for="r in sortedTourRiders"
                      :key="`geel-${pos}-${r.rennerID}`"
                      :value="r.rennerID">
                      {{ formatRiderOption(r) }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Bolletjestrui -->
            <div
              class="space-y-3 rounded-xl border border-rose-200 bg-rose-50/40 p-4">
              <div
                class="flex items-center justify-between border-b border-rose-200 pb-2">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🔴</span>
                  <h4 class="text-sm font-bold text-rose-900">
                    Bolletjestrui (Top {{ targetCounts.bol }})
                  </h4>
                </div>
                <span class="text-xs font-semibold text-rose-700"
                  >Type 'bol'</span
                >
              </div>
              <div class="space-y-2">
                <div v-for="pos in targetCounts.bol" :key="`bol-${pos}`">
                  <label class="mb-1 block text-xs font-semibold text-rose-900"
                    >Bol #{{ pos }}</label
                  >
                  <select
                    v-model="resultForm.bol[pos - 1]"
                    class="shadow-2xs w-full rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-none">
                    <option :value="null">-- Kies renner --</option>
                    <option
                      v-for="r in sortedTourRiders"
                      :key="`bol-${pos}-${r.rennerID}`"
                      :value="r.rennerID">
                      {{ formatRiderOption(r) }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Groene trui -->
            <div
              class="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div
                class="flex items-center justify-between border-b border-emerald-200 pb-2">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🟢</span>
                  <h4 class="text-sm font-bold text-emerald-900">
                    Groene trui (Top {{ targetCounts.groen }})
                  </h4>
                </div>
                <span class="text-xs font-semibold text-emerald-700"
                  >Type 'groen'</span
                >
              </div>
              <div class="space-y-2">
                <div v-for="pos in targetCounts.groen" :key="`groen-${pos}`">
                  <label
                    class="mb-1 block text-xs font-semibold text-emerald-900"
                    >Groen #{{ pos }}</label
                  >
                  <select
                    v-model="resultForm.groen[pos - 1]"
                    class="shadow-2xs w-full rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none">
                    <option :value="null">-- Kies renner --</option>
                    <option
                      v-for="r in sortedTourRiders"
                      :key="`groen-${pos}-${r.rennerID}`"
                      :value="r.rennerID">
                      {{ formatRiderOption(r) }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Witte trui -->
            <div
              class="space-y-3 rounded-xl border border-slate-300 bg-slate-100/60 p-4">
              <div
                class="flex items-center justify-between border-b border-slate-300 pb-2">
                <div class="flex items-center gap-2">
                  <span class="text-lg">⚪</span>
                  <h4 class="text-sm font-bold text-slate-900">
                    Witte trui (Top {{ targetCounts.wit }})
                  </h4>
                </div>
                <span class="text-xs font-semibold text-slate-600"
                  >Type 'wit'</span
                >
              </div>
              <div class="space-y-2">
                <div v-for="pos in targetCounts.wit" :key="`wit-${pos}`">
                  <label class="mb-1 block text-xs font-semibold text-slate-700"
                    >Wit #{{ pos }}</label
                  >
                  <select
                    v-model="resultForm.wit[pos - 1]"
                    class="shadow-2xs w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none">
                    <option :value="null">-- Kies renner --</option>
                    <option
                      v-for="r in sortedTourRiders"
                      :key="`wit-${pos}-${r.rennerID}`"
                      :value="r.rennerID">
                      {{ formatRiderOption(r) }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div
          class="flex shrink-0 justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            @click="modalOpen = false"
            class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">
            Annuleren
          </button>
          <button
            @click="saveResults"
            :disabled="saving"
            class="shadow-xs flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50">
            <Save class="h-4 w-4" />
            <span>{{ saving ? "Opslaan..." : "Uitslag Opslaan" }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
