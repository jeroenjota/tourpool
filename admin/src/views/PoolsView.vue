<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiFetch } from '../services/api';
import { Plus, Trash2, Edit2, X } from '@lucide/vue';
import { useActivePoolStore } from '../stores/activePool';

interface Pool {
  poolID: number;
  tourID: number;
  Naam: string;
  Org?: string | null;
  StartInschr?: string | null;
  EindInschr?: string | null;
}

interface StandardPoint {
  prestatieID: number;
  Omschrijving: string;
  punten: number;
  volgorde?: number | null;
}

interface PointAllocation {
  prestatieID: number;
  poolID: number;
  Omschrijving?: string | null;
  Punten?: number | null;
  volgorde?: number | null;
}

const pools = ref<Pool[]>([]);
const tours = ref<{ tourID: number; naam: string }[]>([]);
const loading = ref(true);
const modalOpen = ref(false);
const editingPool = ref<Partial<Pool> | null>(null);
const standardPoints = ref<StandardPoint[]>([]);
const selectedPrestatieIds = ref<number[]>([]);
const allocationPoints = ref<Record<number, number>>({});
const loadingPointAllocations = ref(false);
const savingPool = ref(false);
const activePoolStore = useActivePoolStore();

const fetchPools = async () => {
  loading.value = true;
  try {
    pools.value = await apiFetch<Pool[]>('/pools');
    if (pools.value.length > 0 && !activePoolStore.activePoolID) {
      activePoolStore.setActivePool(pools.value[0].poolID);
    }
  } catch (err) {
    console.error('Error fetching pools:', err);
  } finally {
    loading.value = false;
  }
};

const setActivePool = (poolID: number) => {
  activePoolStore.setActivePool(poolID);
};

onMounted(async () => {
  try {
    tours.value = await apiFetch<any[]>('/tours');
    standardPoints.value = await apiFetch<StandardPoint[]>('/standard-points');
  } catch (err) {
    console.error(err);
  }
  await fetchPools();
});

const openCreateModal = () => {
  editingPool.value = { tourID: tours.value[0]?.tourID || 1, Naam: '', Org: '' };
  selectedPrestatieIds.value = [];
  allocationPoints.value = {};
  modalOpen.value = true;
};

const openEditModal = async (pool: Pool) => {
  editingPool.value = { ...pool };
  selectedPrestatieIds.value = [];
  allocationPoints.value = {};
  modalOpen.value = true;

  loadingPointAllocations.value = true;
  try {
    const allocations = await apiFetch<PointAllocation[]>(`/point-allocations?poolID=${pool.poolID}`);
    selectedPrestatieIds.value = allocations.map(allocation => allocation.prestatieID);
    allocationPoints.value = Object.fromEntries(
      allocations.map(allocation => {
        const standardPoint = standardPoints.value.find(point => point.prestatieID === allocation.prestatieID);
        return [allocation.prestatieID, allocation.Punten ?? standardPoint?.punten ?? 0];
      })
    );
  } catch (err) {
    modalOpen.value = false;
    alert(`Fout bij laden van prestaties: ${err instanceof Error ? err.message : err}`);
  } finally {
    loadingPointAllocations.value = false;
  }
};

const onPointSelectionChange = (point: StandardPoint) => {
  if (selectedPrestatieIds.value.includes(point.prestatieID) && allocationPoints.value[point.prestatieID] === undefined) {
    allocationPoints.value[point.prestatieID] = point.punten;
  }
};

const syncPointAllocations = async (poolID: number) => {
  const allocations = await apiFetch<PointAllocation[]>(`/point-allocations?poolID=${poolID}`);
  const selectedIds = new Set(selectedPrestatieIds.value);
  const currentByPointId = new Map(allocations.map(allocation => [allocation.prestatieID, allocation]));

  await Promise.all([
    ...allocations
      .filter(allocation => !selectedIds.has(allocation.prestatieID))
      .map(allocation => apiFetch(`/point-allocations/${allocation.prestatieID}/${poolID}`, { method: 'DELETE' })),
    ...allocations
      .filter(allocation => selectedIds.has(allocation.prestatieID))
      .filter(allocation => allocation.Punten !== allocationPoints.value[allocation.prestatieID])
      .map(allocation => apiFetch(`/point-allocations/${allocation.prestatieID}/${poolID}`, {
        method: 'PUT',
        body: JSON.stringify({ Punten: allocationPoints.value[allocation.prestatieID] ?? 0 })
      })),
    ...standardPoints.value
      .filter(point => selectedIds.has(point.prestatieID) && !currentByPointId.has(point.prestatieID))
      .map(point => apiFetch('/point-allocations', {
        method: 'POST',
        body: JSON.stringify({
          prestatieID: point.prestatieID,
          poolID,
          Omschrijving: point.Omschrijving,
          Punten: allocationPoints.value[point.prestatieID] ?? point.punten
        })
      }))
  ]);
};

const savePool = async () => {
  if (!editingPool.value || !editingPool.value.Naam) return;

  savingPool.value = true;
  try {
    const payload = {
      tourID: Number(editingPool.value.tourID),
      Naam: editingPool.value.Naam,
      Org: editingPool.value.Org || null,
      StartInschr: editingPool.value.StartInschr || null,
      EindInschr: editingPool.value.EindInschr || null
    };

    let poolID = editingPool.value.poolID;
    if (poolID) {
      await apiFetch(`/pools/${editingPool.value.poolID}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      const createdPool = await apiFetch<Pool>('/pools', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      poolID = createdPool.poolID;
    }

    if (poolID) {
      await syncPointAllocations(poolID);
    }
    modalOpen.value = false;
    await fetchPools();
  } catch (err) {
    alert(`Fout bij opslaan: ${err instanceof Error ? err.message : err}`);
  } finally {
    savingPool.value = false;
  }
};

const deletePool = async (id: number) => {
  const poolNaam = pools.find(p => p.poolID === id)?.Naam || 'Onbekend';
  if (!confirm(`Weet je zeker dat je alle data mbt pool "${poolNaam}" (ID: ${id}) wilt verwijderen?`)) return;
  try {
    await apiFetch(`/pools/${id}`, { method: 'DELETE' });
    await fetchPools();
  } catch (err) {
    alert(`Fout bij verwijderen: ${err instanceof Error ? err.message : err}`);
  }
};
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900">Pools beheren</h2>
        <p class="text-xs text-slate-500">Overzicht van poolcompetities en inschrijfperiodes</p>
      </div>
      <button 
        @click="openCreateModal" 
        class="shadow-xs flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
      >
        <Plus class="h-4 w-4" />
        <span>Nieuwe pool</span>
      </button>
    </div>

    <!-- Grid -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div 
        v-for="p in pools" 
        :key="p.poolID"
        class="shadow-xs flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300"
      >
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs text-slate-400">Pool #{{ p.poolID }} (Tour #{{ p.tourID }})</span>
            <button
              @click="setActivePool(p.poolID)"
              class="rounded-full border px-2.5 py-0.5 text-xs font-semibold transition"
              :class="activePoolStore.activePoolID === p.poolID
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-100 text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700'"
            >
              {{ activePoolStore.activePoolID === p.poolID ? 'Actief' : 'Actief maken' }}
            </button>
          </div>
          <h3 class="text-lg font-bold text-slate-900">{{ p.Naam }}</h3>
          <p class="text-xs text-slate-500">Organisator: <span class="font-semibold text-slate-800">{{ p.Org || 'Onbekend' }}</span></p>
        </div>

        <div class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button 
            @click="openEditModal(p)" 
            class="rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <Edit2 class="h-4 w-4" />
          </button>
          <button 
            @click="deletePool(p.poolID)" 
            class="rounded p-1.5 text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="modalOpen" class="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 pb-4">
          <h3 class="text-lg font-bold text-slate-900">
            {{ editingPool?.poolID ? `Pool #${editingPool.poolID} bewerken` : 'Nieuwe pool aanmaken' }}
          </h3>
          <button @click="modalOpen = false" class="text-slate-400 hover:text-slate-700">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">Poolnaam *</label>
            <input 
              v-model="editingPool!.Naam" 
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
              placeholder="bv. Tour de France 2026 Pool"
            />
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">Organisator</label>
            <input 
              v-model="editingPool!.Org" 
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
              placeholder="bv. Jeroen"
            />
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">Koppel aan Tour</label>
            <select 
              v-model="editingPool!.tourID" 
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none"
            >
              <option v-for="t in tours" :key="t.tourID" :value="t.tourID">
                {{ t.naam }} (ID #{{ t.tourID }})
              </option>
            </select>
          </div>

          <div class="border-t border-slate-200 pt-4">
            <div class="mb-2 flex items-center justify-between">
              <label class="block text-xs font-semibold text-slate-700">Prestaties en punten</label>
              <span class="text-xs text-slate-400">{{ selectedPrestatieIds.length }} geselecteerd</span>
            </div>
            <div v-if="loadingPointAllocations" class="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
              Prestaties laden...
            </div>
            <div v-else-if="standardPoints.length === 0" class="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
              Geen standaardprestaties beschikbaar.
            </div>
            <div v-else class="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              <label
                v-for="point in standardPoints"
                :key="point.prestatieID"
                class="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <span class="flex min-w-0 items-center gap-2">
                  <input v-model="selectedPrestatieIds" type="checkbox" :value="point.prestatieID" @change="onPointSelectionChange(point)" class="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500" />
                  <span class="truncate text-slate-700">{{ point.Omschrijving }}</span>
                </span>
                <input
                  v-if="selectedPrestatieIds.includes(point.prestatieID)"
                  v-model.number="allocationPoints[point.prestatieID]"
                  type="number"
                  min="0"
                  class="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs text-slate-700 focus:border-amber-500 focus:outline-none"
                  aria-label="Aantal punten voor deze prestatie"
                />
                <span v-else class="shrink-0 font-mono text-xs text-slate-400">{{ point.punten }} pt</span>
              </label>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button @click="modalOpen = false" class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">Annuleren</button>
          <button @click="savePool" :disabled="savingPool || loadingPointAllocations" class="shadow-xs rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50">{{ savingPool ? 'Opslaan...' : 'Opslaan' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
