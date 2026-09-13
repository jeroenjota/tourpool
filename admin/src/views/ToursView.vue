<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiFetch } from '../services/api';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  RefreshCw, 
  Calendar, 
  Check
} from '@lucide/vue';

interface Tour {
  tourID: number;
  naam: string;
  StartDatum?: string | null;
  EindDatum?: string | null;
}

interface Team {
  ploegID: number;
  naam: string;
  ploegCode?: string | null;
  landID?: string | null;
}

interface TourTeamItem {
  tourID: number;
  tourNaam?: string;
  ploegID: number;
  ploegNaam: string;
  ploegCode?: string | null;
  ploegLand?: string | null;
  volgorde?: number | null;
}

const tours = ref<Tour[]>([]);
const selectedTourID = ref<number | null>(null);
const allTeams = ref<Team[]>([]);
const tourTeams = ref<TourTeamItem[]>([]);
const loading = ref(true);
const savingTeam = ref<number | null>(null);

// Zoek- en filterstatussen
const searchQuery = ref('');
const filterStatus = ref<'all' | 'selected' | 'unselected'>('all');

// Modal voor Tour bewerken/toevoegen
const tourModalOpen = ref(false);
const editingTour = ref<{ tourID?: number; naam: string; StartDatum: string; EindDatum: string }>({
  naam: '',
  StartDatum: '',
  EindDatum: ''
});

const activeTour = computed(() => {
  return tours.value.find(t => t.tourID === selectedTourID.value) || null;
});

const fetchInitialData = async () => {
  loading.value = true;
  try {
    const [toursRes, teamsRes] = await Promise.all([
      apiFetch<Tour[]>('/tours'),
      apiFetch<Team[]>('/teams')
    ]);
    tours.value = toursRes;
    allTeams.value = teamsRes;

    if (tours.value.length > 0 && !selectedTourID.value) {
      selectedTourID.value = tours.value[0].tourID;
    }

    await fetchTourTeams();
  } catch (err) {
    console.error('Error fetching data:', err);
  } finally {
    loading.value = false;
  }
};

const fetchTourTeams = async () => {
  if (!selectedTourID.value) return;
  try {
    tourTeams.value = await apiFetch<TourTeamItem[]>(`/tour-teams?tourID=${selectedTourID.value}`);
  } catch (err) {
    console.error('Error fetching tour teams:', err);
  }
};

onMounted(fetchInitialData);

const selectTour = async (tourID: number) => {
  selectedTourID.value = tourID;
  loading.value = true;
  await fetchTourTeams();
  loading.value = false;
};

// Set van deelnemende ploeg IDs
const selectedPloegIdsSet = computed(() => {
  return new Set(tourTeams.value.map(tt => tt.ploegID));
});

// Map van ploegID naar volgorde
const ploegVolgordeMap = computed(() => {
  const map = new Map<number, number | null>();
  for (const tt of tourTeams.value) {
    map.set(tt.ploegID, tt.volgorde ?? null);
  }
  return map;
});

// Gefilterde en gesorteerde lijst van alle ploegen
const filteredTeams = computed(() => {
  let list = allTeams.value.map(team => {
    const isSelected = selectedPloegIdsSet.value.has(team.ploegID);
    const volgorde = ploegVolgordeMap.value.get(team.ploegID) ?? null;
    return {
      ...team,
      isSelected,
      volgorde
    };
  });

  // Zoekfilter
  if (searchQuery.value.trim() !== '') {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(t => 
      t.naam.toLowerCase().includes(q) || 
      (t.ploegCode && t.ploegCode.toLowerCase().includes(q)) ||
      (t.landID && t.landID.toLowerCase().includes(q))
    );
  }

  // Deelname-filter
  if (filterStatus.value === 'selected') {
    list = list.filter(t => t.isSelected);
  } else if (filterStatus.value === 'unselected') {
    list = list.filter(t => !t.isSelected);
  }

  // Sortering: geselecteerde ploegen eerst op volgorde, daarna niet-geselecteerde alfabetisch
  return list.sort((a, b) => {
    if (a.isSelected && b.isSelected) {
      return (a.volgorde ?? 9999) - (b.volgorde ?? 9999) || a.naam.localeCompare(b.naam);
    }
    if (a.isSelected && !b.isSelected) return -1;
    if (!a.isSelected && b.isSelected) return 1;
    return a.naam.localeCompare(b.naam);
  });
});

// Toggle deelname van ploeg in de geselecteerde tour
const toggleTeamParticipation = async (team: Team, currentlySelected: boolean) => {
  if (!selectedTourID.value) return;
  savingTeam.value = team.ploegID;

  try {
    if (currentlySelected) {
      // Verwijderen uit tour
      await apiFetch(`/tour-teams/${selectedTourID.value}/${team.ploegID}`, {
        method: 'DELETE'
      });
    } else {
      // Toevoegen aan tour met volgende volgordenummer
      const currentMax = tourTeams.value.reduce((max, t) => Math.max(max, t.volgorde || 0), 0);
      await apiFetch('/tour-teams', {
        method: 'POST',
        body: JSON.stringify({
          tourID: selectedTourID.value,
          ploegID: team.ploegID,
          volgorde: currentMax + 1
        })
      });
    }
    await fetchTourTeams();
  } catch (err) {
    alert(`Fout bij aanpassen deelname: ${err instanceof Error ? err.message : err}`);
  } finally {
    savingTeam.value = null;
  }
};

// Update volgorde van een geselecteerde ploeg
const updateTeamOrder = async (team: Team, newOrder: number | null) => {
  if (!selectedTourID.value) return;
  try {
    await apiFetch(`/tour-teams/${selectedTourID.value}/${team.ploegID}`, {
      method: 'PUT',
      body: JSON.stringify({
        volgorde: newOrder !== null && !isNaN(newOrder) ? Number(newOrder) : null
      })
    });
    await fetchTourTeams();
  } catch (err) {
    console.error('Error updating team order:', err);
  }
};

// Tour modal logica
const openCreateTourModal = () => {
  editingTour.value = {
    naam: '',
    StartDatum: '',
    EindDatum: ''
  };
  tourModalOpen.value = true;
};

const openEditTourModal = (t: Tour) => {
  editingTour.value = {
    tourID: t.tourID,
    naam: t.naam,
    StartDatum: t.StartDatum ? t.StartDatum.substring(0, 10) : '',
    EindDatum: t.EindDatum ? t.EindDatum.substring(0, 10) : ''
  };
  tourModalOpen.value = true;
};

const saveTour = async () => {
  if (!editingTour.value.naam) return;

  try {
    const payload = {
      naam: editingTour.value.naam,
      StartDatum: editingTour.value.StartDatum ? new Date(editingTour.value.StartDatum).toISOString() : null,
      EindDatum: editingTour.value.EindDatum ? new Date(editingTour.value.EindDatum).toISOString() : null
    };

    if (editingTour.value.tourID) {
      await apiFetch(`/tours/${editingTour.value.tourID}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      const created = await apiFetch<Tour>('/tours', {
        method: 'POST',
        body: JSON.stringify({
          tourID: Date.now() % 100000,
          ...payload
        })
      });
      selectedTourID.value = created.tourID;
    }

    tourModalOpen.value = false;
    await fetchInitialData();
  } catch (err) {
    alert(`Fout bij opslaan tour: ${err instanceof Error ? err.message : err}`);
  }
};

const deleteTour = async (id: number) => {
  if (!confirm(`Weet je zeker dat je Tour #${id} wilt verwijderen?`)) return;
  try {
    await apiFetch(`/tours/${id}`, { method: 'DELETE' });
    selectedTourID.value = null;
    await fetchInitialData();
  } catch (err) {
    alert(`Fout bij verwijderen tour: ${err instanceof Error ? err.message : err}`);
  }
};
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900">Tours & Deelnemende Ploegen</h2>
        <p class="text-xs text-slate-500">Selecteer en beheer welke ploegen deelnemen aan elke ronde</p>
      </div>

      <div class="flex items-center gap-3">
        <button 
          @click="fetchInitialData" 
          class="shadow-xs rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50"
          title="Verversen"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
        </button>
        <button 
          @click="openCreateTourModal" 
          class="shadow-xs flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
        >
          <Plus class="h-4 w-4" />
          <span>Nieuwe Tour</span>
        </button>
      </div>
    </div>

    <!-- Tour Tabs / Selector -->
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
      <button
        v-for="t in tours"
        :key="t.tourID"
        @click="selectTour(t.tourID)"
        class="flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition"
        :class="[
          selectedTourID === t.tourID
            ? 'border-amber-500/80 bg-amber-500 text-slate-950 shadow-xs'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
        ]"
      >
        <Calendar class="h-4 w-4" />
        <span>{{ t.naam }}</span>
        <span 
          class="py-0.2 rounded-full px-2 font-mono text-xs font-bold"
          :class="selectedTourID === t.tourID ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-100 text-slate-600'"
        >
          {{ t.tourID === selectedTourID ? `${tourTeams.length} ploegen` : `#${t.tourID}` }}
        </span>
      </button>
    </div>

    <!-- Active Tour Info Banner -->
    <div v-if="activeTour" class="shadow-xs flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:flex-row md:items-center">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
            Tour ID #{{ activeTour.tourID }}
          </span>
          <h3 class="text-lg font-bold text-slate-900">{{ activeTour.naam }}</h3>
        </div>
        <div class="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-500">
          <span>Periode: <strong class="text-slate-800">{{ activeTour.StartDatum ? new Date(activeTour.StartDatum).toLocaleDateString('nl-NL') : 'Niet ingesteld' }}</strong> t/m <strong class="text-slate-800">{{ activeTour.EindDatum ? new Date(activeTour.EindDatum).toLocaleDateString('nl-NL') : 'Niet ingesteld' }}</strong></span>
          <span>•</span>
          <span>Deelnemende ploegen: <strong class="font-mono font-bold text-amber-700">{{ tourTeams.length }}</strong> van de {{ allTeams.length }} beschikbaar</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button 
          @click="openEditTourModal(activeTour)"
          class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          <Edit2 class="h-3.5 w-3.5 text-slate-500" />
          <span>Tour bewerken</span>
        </button>
        <button 
          @click="deleteTour(activeTour.tourID)"
          class="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
        >
          <Trash2 class="h-3.5 w-3.5" />
          <span>Verwijderen</span>
        </button>
      </div>
    </div>

    <!-- Ploegen Selectie Grid -->
    <div v-if="loading" class="shadow-xs rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
      Ploegen laden...
    </div>
    <div v-else-if="filteredTeams.length === 0" class="shadow-xs rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
      Geen ploegen gevonden voor dit filter.
    </div>
    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div 
        v-for="team in filteredTeams" 
        :key="team.ploegID"
        class="shadow-xs group relative flex items-center justify-between gap-3 rounded-xl border p-3.5 transition"
        :class="[
          team.isSelected
            ? 'border-amber-300/80 bg-amber-50/40 hover:border-amber-400 hover:bg-amber-50/70'
            : 'border-slate-200 bg-white opacity-70 hover:opacity-100 hover:border-slate-300'
        ]"
      >
        <!-- Checkbox + Info -->
        <div class="flex min-w-0 flex-1 cursor-pointer items-center gap-3" @click="toggleTeamParticipation(team, team.isSelected)">
          <div 
            class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition"
            :class="[
              team.isSelected
                ? 'border-amber-500 bg-amber-500 text-slate-950'
                : 'border-slate-300 bg-white group-hover:border-slate-400'
            ]"
          >
            <Check v-if="team.isSelected" class="stroke-3 h-3.5 w-3.5" />
          </div>

          <div class="min-w-0 flex-1">
            <h4 
              class="truncate text-sm font-semibold leading-snug"
              :class="team.isSelected ? 'text-slate-900' : 'text-slate-600'"
              :title="team.naam"
            >
              {{ team.naam }}
            </h4>
            <div class="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
              <span v-if="team.ploegCode" class="rounded bg-amber-100/70 px-1 font-mono text-[10px] font-semibold text-amber-700">
                {{ team.ploegCode }}
              </span>
              <span v-if="team.landID">
                ({{ team.landID }})
              </span>
            </div>
          </div>
        </div>

        <!-- Volgorde input voor geselecteerde ploegen -->
        <div v-if="team.isSelected" class="flex shrink-0 items-center gap-1" title="Volgorde in de Tour">
          <span class="text-[10px] font-medium text-slate-400">Nr:</span>
          <input 
            type="number"
            :value="team.volgorde"
            @change="e => updateTeamOrder(team, (e.target as HTMLInputElement).valueAsNumber)"
            class="shadow-2xs w-12 rounded border border-slate-200 bg-white px-1.5 py-1 text-center font-mono text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none"
            placeholder="-"
          />
        </div>
      </div>
    </div>

    <!-- Footer Summary -->
    <div class="shadow-xs flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
      <span>
        In <strong>{{ activeTour?.naam }}</strong> doen <strong>{{ tourTeams.length }}</strong> van de <strong>{{ allTeams.length }}</strong> ploegen mee.
      </span>
      <span class="text-slate-400">Klik op een kaart om deelname in/uit te schakelen</span>
    </div>

    <!-- Tour Create / Edit Modal -->
    <div v-if="tourModalOpen" class="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 pb-4">
          <h3 class="text-lg font-bold text-slate-900">
            {{ editingTour.tourID ? `Tour #${editingTour.tourID} bewerken` : 'Nieuwe Tour toevoegen' }}
          </h3>
          <button @click="tourModalOpen = false" class="text-slate-400 hover:text-slate-700">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">Tournaam *</label>
            <input 
              v-model="editingTour.naam" 
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
              placeholder="bv. Tour 2026"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Startdatum</label>
              <input 
                v-model="editingTour.StartDatum" 
                type="date"
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Einddatum</label>
              <input 
                v-model="editingTour.EindDatum" 
                type="date"
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
              />
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button 
            @click="tourModalOpen = false" 
            class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
          >
            Annuleren
          </button>
          <button 
            @click="saveTour" 
            class="shadow-xs rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
          >
            Opslaan
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
