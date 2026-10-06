<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiFetch } from '../services/api';
import { RouterLink } from 'vue-router';
import { Plus, Trash2, Edit2, X, UserCheck, Trophy, Award, Sliders } from '@lucide/vue';

interface Pool {
  poolID: number;
  tourID: number;
  Naam: string;
  Org?: string | null;
  StartInschr?: string | null;
  EindInschr?: string | null;
}

interface PoolOption {
  poolID: number;
  inleg?: number | string | null;
  geldEtappeHoog?: number | string | null;
  geldEtappeTotaal?: number | string | null;
  geldEtappeLaagTTL?: number | string | null;
  PrijsNr1Percentage?: number | string | null;
  PrijsNr2Percentage?: number | string | null;
  PrijsNr3Percentage?: number | string | null;
  PrijsNr4Percentage?: number | string | null;
  PrijsNrLaatstBedrag?: number | string | null;
}

interface Participant {
  poolID: number;
}

interface Stage {
  tour: number | string;
  etappeNr?: number | null;
}

interface StandardPoint {
  prestatieID: number;
  uitslagtype: string | null;
  plaats: number | null;
  Omschrijving: string | null;
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
const participants = ref<Participant[]>([]);
const poolOptions = ref<PoolOption[]>([]);
const stages = ref<Stage[]>([]);

const fetchPools = async () => {
  loading.value = true;
  try {
    const [poolsData, participantData, optionData, stageData] = await Promise.all([
      apiFetch<Pool[]>('/pools'),
      apiFetch<Participant[]>('/participants'),
      apiFetch<PoolOption[]>('/options'),
      apiFetch<Stage[]>('/stages')
    ]);
    pools.value = poolsData;
    participants.value = participantData;
    poolOptions.value = optionData;
    stages.value = stageData.filter(stage => stage.etappeNr != null);
  } catch (err) {
    console.error('Error fetching pools:', err);
  } finally {
    loading.value = false;
  }
};

const poolPages = [
  { name: 'Deelnemers', page: 'participants', icon: UserCheck },
  { name: 'Poolstand', page: 'standings', icon: Trophy },
  { name: 'Puntentoekenning', page: 'point-allocations', icon: Award },
  { name: 'Opties', page: 'options', icon: Sliders }
];

const prizeCurrencyFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR'
});

const prizeBreakdowns = computed(() => {
  const toCents = (amount: number | string | null | undefined) =>
    Math.round(Number(amount ?? 0) * 100);
  const getPercentage = (value: number | string | null | undefined) => {
    const percentage = Number(value ?? 0);
    return percentage > 0 && percentage <= 1 ? percentage * 100 : percentage;
  };

  return Object.fromEntries(pools.value.map(pool => {
    const option = poolOptions.value.find(item => item.poolID === pool.poolID);
    if (!option) return [pool.poolID, null];

    const participantCount = participants.value.filter(participant => participant.poolID === pool.poolID).length;
    const stageCount = stages.value.filter(stage => Number(stage.tour) === pool.tourID).length;
    const totalInlegCents = participantCount * toCents(option.inleg);
    const stagePrizePerStageCents =
      toCents(option.geldEtappeHoog) +
      toCents(option.geldEtappeTotaal) +
      toCents(option.geldEtappeLaagTTL);
    const stagePrizeTotalCents = stagePrizePerStageCents * stageCount;
    const redLanternCents = toCents(option.PrijsNrLaatstBedrag);
    const remainingCents = totalInlegCents - stagePrizeTotalCents - redLanternCents;
    const distributableCents = Math.max(remainingCents, 0);
    const prizes = [
      { label: '1e prijs', percentage: getPercentage(option.PrijsNr1Percentage) },
      { label: '2e prijs', percentage: getPercentage(option.PrijsNr2Percentage) },
      { label: '3e prijs', percentage: getPercentage(option.PrijsNr3Percentage) },
      { label: '4e prijs', percentage: getPercentage(option.PrijsNr4Percentage) }
    ].map(prize => ({
      ...prize,
      amountCents: Math.round(distributableCents * prize.percentage / 100)
    }));

    return [pool.poolID, {
      participantCount,
      stageCount,
      totalInlegCents,
      stagePrizePerStageCents,
      stagePrizeTotalCents,
      redLanternCents,
      remainingCents,
      prizes
    }];
  }));
});

const formatPrizeAmount = (amountCents: number) =>
  prizeCurrencyFormatter.format(amountCents / 100);

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
  selectedPrestatieIds.value = standardPoints.value.map(point => point.prestatieID);
  allocationPoints.value = Object.fromEntries(
    standardPoints.value.map(point => [point.prestatieID, point.punten])
  );
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
          Punten: allocationPoints.value[point.prestatieID] ?? point.punten,
          uitslagtype: point.uitslagtype,
          plaats: point.plaats,
          volgorde: point.volgorde
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

    if (poolID && standardPoints.value.length > 0) {
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
  const poolNaam = pools.value.find(p => p.poolID === id)?.Naam || 'Onbekend';
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
          <span class="font-mono text-xs text-slate-400">Pool #{{ p.poolID }} (Tour #{{ p.tourID }})</span>
          <h3 class="text-lg font-bold text-slate-900">{{ p.Naam }}</h3>
          <p class="text-xs text-slate-500">Organisator: <span class="font-semibold text-slate-800">{{ p.Org || 'Onbekend' }}</span></p>
          <nav class="flex flex-wrap gap-2" :aria-label="`Onderdelen van ${p.Naam}`">
            <RouterLink
              v-for="item in poolPages"
              :key="item.page"
              :to="`/pools/${p.poolID}/${item.page}`"
              class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
            >
              <component :is="item.icon" class="h-3.5 w-3.5" />
              <span>{{ item.name }}</span>
            </RouterLink>
          </nav>
        </div>

        <div v-if="prizeBreakdowns[p.poolID]" class="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h4 class="text-sm font-bold text-slate-900">Prijzenpot</h4>
              <p class="text-xs text-slate-500">
                {{ prizeBreakdowns[p.poolID]!.participantCount }} deelnemers · {{ prizeBreakdowns[p.poolID]!.stageCount }} etappes
              </p>
            </div>
            <div class="text-right">
              <span class="block text-xs font-medium text-slate-500">Te verdelen na inhoudingen</span>
              <strong class="font-mono text-lg text-amber-700">
                {{ formatPrizeAmount(Math.max(prizeBreakdowns[p.poolID]!.remainingCents, 0)) }}
              </strong>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div class="space-y-1.5">
              <div class="flex justify-between gap-3">
                <span class="text-slate-600">Totale inleg</span>
                <strong class="font-mono text-slate-900">{{ formatPrizeAmount(prizeBreakdowns[p.poolID]!.totalInlegCents) }}</strong>
              </div>
              <div class="flex justify-between gap-3">
                <span class="text-slate-600">
                  Etappeprijzen ({{ formatPrizeAmount(prizeBreakdowns[p.poolID]!.stagePrizePerStageCents) }} × {{ prizeBreakdowns[p.poolID]!.stageCount }})
                </span>
                <strong class="font-mono text-rose-700">−{{ formatPrizeAmount(prizeBreakdowns[p.poolID]!.stagePrizeTotalCents) }}</strong>
              </div>
              <div class="flex justify-between gap-3">
                <span class="text-slate-600">Rode lantaarn</span>
                <strong class="font-mono text-rose-700">−{{ formatPrizeAmount(prizeBreakdowns[p.poolID]!.redLanternCents) }}</strong>
              </div>
              <div class="flex justify-between gap-3 border-t border-slate-100 pt-1.5">
                <span class="font-semibold text-slate-700">Restant</span>
                <strong class="font-mono" :class="prizeBreakdowns[p.poolID]!.remainingCents < 0 ? 'text-rose-700' : 'text-slate-900'">
                  {{ formatPrizeAmount(prizeBreakdowns[p.poolID]!.remainingCents) }}
                </strong>
              </div>
              <p v-if="prizeBreakdowns[p.poolID]!.remainingCents < 0" class="text-xs text-rose-700">
                De inhoudingen zijn hoger dan de totale inleg; de eindprijzen zijn daarom op €0,00 begrensd.
              </p>
            </div>

            <div class="space-y-1.5 border-t border-slate-100 pt-2 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
              <div v-for="prize in prizeBreakdowns[p.poolID]!.prizes" :key="prize.label" class="flex justify-between gap-3">
                <span class="text-slate-600">{{ prize.label }} ({{ prize.percentage }}%)</span>
                <strong class="font-mono text-slate-900">{{ formatPrizeAmount(prize.amountCents) }}</strong>
              </div>
            </div>
          </div>
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
