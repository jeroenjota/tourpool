<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { apiFetch } from '../services/api';
import { useActivePoolStore } from '../stores/activePool';
import { Plus, RefreshCw, Download, Trash2 } from '@lucide/vue';

interface StandardPoint {
  prestatieID: number;
  uitslagtype: string | null;
  plaats: number | null;
  Omschrijving: string | null;
  punten: number;
  volgorde: number | null;
}

interface PointAllocation {
  prestatieID: number;
  poolID: number;
  Omschrijving: string | null;
  Punten: number | null;
  uitslagtype: string | null;
  plaats: number | null;
  volgorde: number | null;
}

const activePoolStore = useActivePoolStore();
const allocations = ref<PointAllocation[]>([]);
const standardPoints = ref<StandardPoint[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const searchQuery = ref('');
const pointInputs = ref<Record<number, string>>({});

const typeOrder = ['rit', 'klasgeel', 'klasgroen', 'klasbol', 'klaswit', 'eindklas', 'eindpunt', 'eindberg', 'eindjon'];
const typeRank = (type: string | null) => {
  const rank = typeOrder.indexOf((type ?? '').toLowerCase());
  return rank === -1 ? typeOrder.length : rank;
};

// Sorteer op uitslagtype en plaats, zodat een later toegevoegde plaats altijd op zijn plek komt.
const comparePoints = (a: StandardPoint | PointAllocation, b: StandardPoint | PointAllocation) =>
  typeRank(a.uitslagtype) - typeRank(b.uitslagtype) ||
  (a.plaats ?? 9999) - (b.plaats ?? 9999) ||
  (a.volgorde ?? 9999) - (b.volgorde ?? 9999) ||
  a.prestatieID - b.prestatieID;

const filteredAllocations = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return allocations.value
    .filter(point => !query ||
      (point.Omschrijving ?? '').toLowerCase().includes(query) ||
      String(point.prestatieID).includes(query) ||
      (point.uitslagtype ?? '').toLowerCase().includes(query) ||
      String(point.plaats ?? '').includes(query) ||
      String(point.Punten ?? '').includes(query))
    .sort(comparePoints);
});


const placeKey = (uitslagtype: string | null, plaats: number) => `${(uitslagtype ?? '').toLowerCase()}-${plaats}`;
const assignedPlaces = computed(() => new Set(
  allocations.value.filter(point => point.plaats != null).map(point => placeKey(point.uitslagtype, point.plaats!))
));

// Plaatsen moeten op volgorde: plaats N kan pas als plaats N-1 er is.
const addBlockedReason = (point: StandardPoint) => {
  if (point.plaats == null || point.plaats <= 1) return '';
  return assignedPlaces.value.has(placeKey(point.uitslagtype, point.plaats - 1))
    ? ''
    : `Voeg eerst plaats ${point.plaats - 1} toe`;
};

// Alleen de hoogste plaats mag weg, anders ontstaat er een gat.
const deleteBlockedReason = (point: PointAllocation) => {
  if (point.plaats == null) return '';
  return assignedPlaces.value.has(placeKey(point.uitslagtype, point.plaats + 1))
    ? `Verwijder eerst plaats ${point.plaats + 1}`
    : '';
};

const missingStandardPoints = computed(() => {
  const assignedIDs = new Set(allocations.value.map(point => point.prestatieID));
  return standardPoints.value.filter(point => !assignedIDs.has(point.prestatieID));
});

const categoryColumns = <T extends StandardPoint | PointAllocation>(points: T[]) => {
  const stages: T[] = [];
  const jerseys: T[] = [];
  const final: T[] = [];
  const other: T[] = [];
  const sorted = [...points].sort(comparePoints);
  for (const point of sorted) {
    const category = point.uitslagtype?.toLowerCase();
    if (category === 'rit') stages.push(point);
    else if (['klasgeel', 'klasgroen', 'klasbol', 'klaswit'].includes(category ?? '')) jerseys.push(point);
    else if (category === 'eindklas') final.push(point);
    else other.push(point);
  }
  const split = Math.max(jerseys.length, final.length, other.length) || stages.length;
  return [
    { key: 'stage-first', title: 'Etappeplaatsen', points: stages.slice(0, split) },
    { key: 'stage-second', title: 'Etappeplaatsen (vervolg)', points: stages.slice(split) },
    { key: 'jerseys', title: 'Etappetruien', points: jerseys },
    { key: 'final', title: 'Eindklassement', points: final },
    { key: 'other', title: 'Overige klassementen', points: other }
  ];
};

const allocationColumns = computed(() => categoryColumns(filteredAllocations.value));

const fetchAllocations = async (poolID: number | null) => {
  if (!poolID) {
    allocations.value = [];
    pointInputs.value = {};
    standardPoints.value = [];
    error.value = '';
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    const [allocationData, standardPointData] = await Promise.all([
      apiFetch<PointAllocation[]>(`/point-allocations?poolID=${poolID}`),
      apiFetch<StandardPoint[]>('/standard-points')
    ]);
    if (activePoolStore.activePoolID === poolID) {
      allocations.value = allocationData;
      pointInputs.value = Object.fromEntries(
        allocationData.map(point => [point.prestatieID, String(point.Punten ?? 0)])
      );
      standardPoints.value = standardPointData;
    }
  } catch (cause) {
    if (activePoolStore.activePoolID === poolID) {
      error.value = `Fout bij laden: ${cause instanceof Error ? cause.message : String(cause)}`;
    }
  } finally {
    if (activePoolStore.activePoolID === poolID) loading.value = false;
  }
};

watch(() => activePoolStore.activePoolID, poolID => {
  void fetchAllocations(poolID);
}, { immediate: true });

const loadAllocations = async (poolID: number | null) => {
  if (!poolID || saving.value || loading.value) return;
  if (!confirm('Alle prestaties en aangepaste punten van de actieve pool vervangen door de standaardpunten?')) return;

  saving.value = true;
  error.value = '';
  try {
    await apiFetch(`/point-allocations/load/${poolID}`, { method: 'PUT' });
    await fetchAllocations(activePoolStore.activePoolID);
  } catch (cause) {
    error.value = `Fout bij laden van standaardpunten: ${cause instanceof Error ? cause.message : String(cause)}`;
  } finally {
    saving.value = false;
  }
};

const blurPointsInput = (event: KeyboardEvent) => {
  if (event.target instanceof HTMLInputElement) event.target.blur();
};

const updatePointsInput = (point: PointAllocation, event: Event) => {
  if (event.target instanceof HTMLInputElement) {
    pointInputs.value[point.prestatieID] = event.target.value;
  }
};

const addStandardPoint = async (point: StandardPoint) => {
  const poolID = activePoolStore.activePoolID;
  if (!poolID || addBlockedReason(point)) return;

  saving.value = true;
  error.value = '';
  try {
    await apiFetch('/point-allocations', {
      method: 'POST',
      body: JSON.stringify({
        prestatieID: point.prestatieID,
        poolID,
        Omschrijving: point.Omschrijving,
        Punten: point.punten,
        uitslagtype: point.uitslagtype,
        plaats: point.plaats,
        volgorde: point.volgorde
      })
    });
    await fetchAllocations(poolID);
  } catch (cause) {
    error.value = `Fout bij toevoegen: ${cause instanceof Error ? cause.message : String(cause)}`;
  } finally {
    saving.value = false;
  }
};

let pendingPointSave: Promise<boolean> | null = null;

const savePoint = async (point: PointAllocation): Promise<boolean> => {
  while (pendingPointSave) {
    if (!await pendingPointSave) return false;
  }
  if (point.poolID !== activePoolStore.activePoolID) return true;
  if (saving.value) return false;
  const input = pointInputs.value[point.prestatieID]?.trim() ?? '';
  const points = Number(input);
  if (!input || !Number.isInteger(points)) {
    error.value = `Punten voor "${point.Omschrijving ?? `#${point.prestatieID}`}" moeten een geheel getal zijn.`;
    return false;
  }
  if (points === (point.Punten ?? 0)) return true;

  saving.value = true;
  error.value = '';
  const request = (async () => {
    try {
      await apiFetch(`/point-allocations/${point.prestatieID}/${point.poolID}`, {
        method: 'PUT',
        body: JSON.stringify({ Punten: points })
      });
      point.Punten = points;
      return true;
    } catch (cause) {
      error.value = `Fout bij opslaan: ${cause instanceof Error ? cause.message : String(cause)}`;
      return false;
    } finally {
      saving.value = false;
    }
  })();
  pendingPointSave = request;
  try {
    return await request;
  } finally {
    if (pendingPointSave === request) pendingPointSave = null;
  }
};

onBeforeRouteLeave(async () => {
  for (const point of allocations.value) {
    if (!await savePoint(point)) return false;
  }
  return true;
});

const deletePoint = async (point: PointAllocation) => {
  const poolID = activePoolStore.activePoolID;
  if (!poolID || saving.value || loading.value || deleteBlockedReason(point)) return;

  saving.value = true;
  error.value = '';
  try {
    await apiFetch(`/point-allocations/${point.prestatieID}/${poolID}`, { method: 'DELETE' });
    await fetchAllocations(poolID);
  } catch (cause) {
    error.value = `Fout bij verwijderen: ${cause instanceof Error ? cause.message : String(cause)}`;
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="shrink-0">
        <h2 class="text-2xl font-bold text-slate-900">Puntentoekenning</h2>
      </div>
      <div class="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          @click="fetchAllocations(activePoolStore.activePoolID)"
          :disabled="loading || saving || !activePoolStore.activePoolID"
          class="shadow-xs flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          title="Opgeslagen poolpunten verversen zonder ze te vervangen"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
          <span>Verversen</span>
        </button>
        <button
          type="button"
          @click="loadAllocations(activePoolStore.activePoolID)"
          :disabled="loading || saving || !activePoolStore.activePoolID"
          class="shadow-xs flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
          title="Alle poolprestaties vervangen door de standaardpunten"
        >
          <Download class="h-4 w-4" />
          <span>Standaardpunten laden</span>
        </button>
      </div>
    </div>

    <p v-if="error" role="alert" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </p>
    <div v-if="!activePoolStore.activePoolID" class="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
      Selecteer eerst een actieve pool op de pagina Pools.
    </div>
    <div v-else-if="loading && allocations.length === 0" class="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
      Poolpunten laden...
    </div>
    <div v-else-if="filteredAllocations.length === 0" class="shadow-xs rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
      {{ allocations.length ? 'Geen prestaties gevonden.' : 'Er zijn nog geen prestaties aan deze pool toegekend.' }}
    </div>
    <div
      v-else
      class="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
    >
      <section v-for="column in allocationColumns" :key="column.key" class="min-w-0 space-y-1">
        <h3 v-if="column.key !== 'stage-second' || column.points.length > 0" class="text-sm font-bold text-slate-900">{{ column.title }}</h3>
        <p v-if="column.points.length === 0 && column.key !== 'stage-second'" class="rounded-lg border border-dashed border-slate-300 p-4 text-xs text-slate-500">Geen prestaties</p>
      <div
        v-for="point in column.points"
        :key="point.prestatieID"
        class="shadow-xs flex items-center justify-between gap-3 rounded-xl border border-slate-600 bg-white px-4 py-1 transition hover:border-slate-300 hover:shadow-sm"
      >
        <div class="min-w-0 flex-1">
          <h3 class="mt-0.5 truncate text-sm font-bold text-slate-900" :title="point.Omschrijving || 'Naamloze prestatie'">
            {{ point.Omschrijving || 'Naamloze prestatie' }}
          </h3>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <input
            :value="pointInputs[point.prestatieID]"
            type="number"
            step="1"
            required
            :disabled="saving || loading"
            :aria-label="`Punten voor ${point.Omschrijving || `prestatie #${point.prestatieID}`}`"
            @input="updatePointsInput(point, $event)"
            @blur="savePoint(point)"
            @keydown.enter.prevent="blurPointsInput"
            class="shadow-2xs w-16 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-right font-mono text-sm font-bold text-amber-800 focus:border-amber-500 focus:outline-none disabled:opacity-50"
          />
          <button type="button" @click="deletePoint(point)" :disabled="saving || loading || !!deleteBlockedReason(point)" class="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400" :title="deleteBlockedReason(point) || 'Verwijderen'">
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      </section>
    </div>
    <div v-if="activePoolStore.activePoolID" class="shadow-xs text-slate-500">
      <strong>{{ filteredAllocations.length }}</strong> van {{ standardPoints.length }} prestaties ingesteld voor deze pool
      <span v-if="saving" role="status" class="ml-2 font-semibold text-amber-600">Opslaan...</span>
    </div>

    <section v-if="activePoolStore.activePoolID && missingStandardPoints.length" class="space-y-3">
      <div>
        <h3 class="font-bold text-slate-900">Standaardprestaties toevoegen</h3>
        <p class="text-xs text-slate-500">Voeg een standaardprestatie toe die nog niet aan deze pool is gekoppeld.</p>
      </div>
      <div
        class="grid grid-cols-1 items-start gap-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
      >
        <div v-for="point in missingStandardPoints" :key="point.prestatieID" class="shadow-xs flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-600 bg-white px-4 py-1 transition hover:border-slate-300 hover:shadow-sm">
          <div class="min-w-0 flex-1">
            <h3 class="mt-0.5 truncate text-sm font-bold text-slate-900" :title="point.Omschrijving || `Prestatie #${point.prestatieID}`">{{ point.Omschrijving || `Prestatie #${point.prestatieID}` }}</h3>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <span class="shadow-2xs rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-sm font-bold text-amber-800">{{ point.punten }} pt</span>
            <button type="button" @click="addStandardPoint(point)" :disabled="saving || !!addBlockedReason(point)" class="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-amber-50" :title="addBlockedReason(point) || 'Toevoegen aan actieve pool'">
              <Plus class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>
