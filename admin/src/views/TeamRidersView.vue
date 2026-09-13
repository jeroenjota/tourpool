<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiFetch } from '../services/api';
import { Plus, Trash2, X, RefreshCw, UserPlus, Users, Search } from '@lucide/vue';

interface Tour {
  tourID: number;
  naam: string;
}

interface Team {
  ploegID: number;
  naam: string;
  ploegCode?: string | null;
  landID?: string | null;
}

interface Rider {
  rennerID: number;
  anaam: string;
  vnaam?: string | null;
  tnaam?: string | null;
  landID?: string | null;
}

interface TeamRiderItem {
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

interface TourTeamItem {
  tourID: number;
  ploegID: number;
  ploegNaam: string;
  ploegCode?: string | null;
  ploegLand?: string | null;
  volgorde?: number | null;
}

const tours = ref<Tour[]>([]);
const selectedTourID = ref<number>(1);
const allTeams = ref<Team[]>([]);
const allRiders = ref<Rider[]>([]);
const tourTeams = ref<TourTeamItem[]>([]);
const teamRiders = ref<TeamRiderItem[]>([]);
const loading = ref(true);

const searchQuery = ref('');

// Modal states
const addRiderModalOpen = ref(false);
const activeTeamForRider = ref<TourTeamItem | null>(null);
const newRiderForm = ref<{ rennerID: number | null; Rugnummer: number | ''; nietGestartEtappe: number | null }>({
  rennerID: null,
  Rugnummer: '',
  nietGestartEtappe: null
});

const addTeamModalOpen = ref(false);
const selectedTeamToAdd = ref<number | null>(null);
const newTeamVolgorde = ref<number | ''>('');

const fetchData = async () => {
  loading.value = true;
  try {
    const [toursRes, allTeamsRes, allRidersRes] = await Promise.all([
      apiFetch<Tour[]>('/tours'),
      apiFetch<Team[]>('/teams'),
      apiFetch<Rider[]>('/riders')
    ]);
    tours.value = toursRes;
    allTeams.value = allTeamsRes;
    allRiders.value = allRidersRes;

    if (!selectedTourID.value && tours.value.length > 0) {
      selectedTourID.value = tours.value[0].tourID;
    }

    await fetchTourData();
  } catch (err) {
    console.error('Error fetching initial data:', err);
  } finally {
    loading.value = false;
  }
};

const fetchTourData = async () => {
  if (!selectedTourID.value) return;
  try {
    const [ttRes, trRes] = await Promise.all([
      apiFetch<TourTeamItem[]>(`/tour-teams?tourID=${selectedTourID.value}`),
      apiFetch<TeamRiderItem[]>(`/team-riders?tourID=${selectedTourID.value}`)
    ]);
    tourTeams.value = ttRes;
    teamRiders.value = trRes;
  } catch (err) {
    console.error('Error fetching tour data:', err);
  }
};

onMounted(fetchData);

const onTourChange = async () => {
  loading.value = true;
  await fetchTourData();
  loading.value = false;
};

// Groepeer renners per ploegID
const teamCards = computed(() => {
  let list = tourTeams.value;

  if (searchQuery.value.trim() !== '') {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(t => {
      const matchTeam = t.ploegNaam.toLowerCase().includes(q) || (t.ploegCode && t.ploegCode.toLowerCase().includes(q));
      const teamRidersList = teamRiders.value.filter(r => r.ploegID === t.ploegID);
      const matchRider = teamRidersList.some(r => 
        r.anaam.toLowerCase().includes(q) || 
        (r.vnaam && r.vnaam.toLowerCase().includes(q)) || 
        String(r.Rugnummer).includes(q)
      );
      return matchTeam || matchRider;
    });
  }

  const mapped = list.map(tt => {
    const riders = teamRiders.value
      .filter(r => r.ploegID === tt.ploegID)
      .sort((a, b) => a.Rugnummer - b.Rugnummer);

    return {
      ...tt,
      riders
    };
  });

  return mapped.sort((a, b) => (a.volgorde ?? 9999) - (b.volgorde ?? 9999) || a.ploegNaam.localeCompare(b.ploegNaam));
});

const formatRiderName = (r: { anaam: string; vnaam?: string | null; tnaam?: string | null; rennerLand?: string | null }) => {
  const given = [r.vnaam, r.tnaam].filter(Boolean).join(' ');
  const namePart = given ? `${r.anaam}, ${given}` : r.anaam;
  return r.rennerLand ? `${namePart} (${r.rennerLand})` : namePart;
};

// Ploeg toevoegen aan Tour
const availableTeamsForTour = computed(() => {
  const currentPloegIDs = new Set(tourTeams.value.map(tt => tt.ploegID));
  return allTeams.value.filter(t => !currentPloegIDs.has(t.ploegID));
});

const openAddTeamModal = () => {
  selectedTeamToAdd.value = availableTeamsForTour.value[0]?.ploegID || null;
  const maxVolgorde = tourTeams.value.reduce((max, t) => Math.max(max, t.volgorde || 0), 0);
  newTeamVolgorde.value = maxVolgorde + 1;
  addTeamModalOpen.value = true;
};

const addTeamToTour = async () => {
  if (!selectedTeamToAdd.value) return;
  try {
    await apiFetch('/tour-teams', {
      method: 'POST',
      body: JSON.stringify({
        tourID: selectedTourID.value,
        ploegID: selectedTeamToAdd.value,
        volgorde: newTeamVolgorde.value !== '' ? Number(newTeamVolgorde.value) : null
      })
    });
    addTeamModalOpen.value = false;
    await fetchTourData();
  } catch (err) {
    alert(`Fout bij toevoegen ploeg aan tour: ${err instanceof Error ? err.message : err}`);
  }
};

const removeTeamFromTour = async (team: TourTeamItem, riderCount: number) => {
  const msg = riderCount > 0
    ? `Weet je zeker dat je ${team.ploegNaam} uit deze Tour wilt verwijderen? De ${riderCount} opgestelde renners worden ook ontkoppeld.`
    : `Weet je zeker dat je ${team.ploegNaam} uit deze Tour wilt verwijderen?`;
  
  if (!confirm(msg)) return;

  try {
    const ridersToDelete = teamRiders.value.filter(r => r.ploegID === team.ploegID);
    for (const r of ridersToDelete) {
      await apiFetch(`/team-riders/${selectedTourID.value}/${team.ploegID}/${r.rennerID}`, { method: 'DELETE' });
    }
    await apiFetch(`/tour-teams/${selectedTourID.value}/${team.ploegID}`, { method: 'DELETE' });
    await fetchTourData();
  } catch (err) {
    alert(`Fout bij verwijderen ploeg: ${err instanceof Error ? err.message : err}`);
  }
};

// Renner toevoegen aan Ploeg
const availableRidersForTeam = computed(() => {
  if (!activeTeamForRider.value) return [];
  const currentTourRiderIDs = new Set(teamRiders.value.map(r => r.rennerID));
  return allRiders.value.filter(r => !currentTourRiderIDs.has(r.rennerID));
});

const openAddRiderModal = (team: TourTeamItem) => {
  activeTeamForRider.value = team;
  const existingRiders = teamRiders.value.filter(r => r.ploegID === team.ploegID);
  
  let nextNr = 1;
  if (existingRiders.length > 0) {
    const maxNr = Math.max(...existingRiders.map(r => r.Rugnummer));
    nextNr = maxNr + 1;
  }

  newRiderForm.value = {
    rennerID: availableRidersForTeam.value[0]?.rennerID || null,
    Rugnummer: nextNr,
    nietGestartEtappe: null
  };
  addRiderModalOpen.value = true;
};

const addRiderToTeam = async () => {
  if (!activeTeamForRider.value || !newRiderForm.value.rennerID || newRiderForm.value.Rugnummer === '') return;

  try {
    await apiFetch('/team-riders', {
      method: 'POST',
      body: JSON.stringify({
        tourID: selectedTourID.value,
        ploegID: activeTeamForRider.value.ploegID,
        rennerID: Number(newRiderForm.value.rennerID),
        Rugnummer: Number(newRiderForm.value.Rugnummer),
        nietGestartEtappe: newRiderForm.value.nietGestartEtappe ? Number(newRiderForm.value.nietGestartEtappe) : null
      })
    });
    addRiderModalOpen.value = false;
    await fetchTourData();
  } catch (err) {
    alert(`Fout bij toevoegen renner: ${err instanceof Error ? err.message : err}`);
  }
};

const removeRiderFromTeam = async (r: TeamRiderItem) => {
  if (!confirm(`Weet je zeker dat je ${r.anaam} (#${r.Rugnummer}) wilt verwijderen uit deze ploeg?`)) return;
  try {
    await apiFetch(`/team-riders/${selectedTourID.value}/${r.ploegID}/${r.rennerID}`, {
      method: 'DELETE'
    });
    await fetchTourData();
  } catch (err) {
    alert(`Fout bij verwijderen: ${err instanceof Error ? err.message : err}`);
  }
};
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="shrink-0">
        <h2 class="text-xl font-bold text-slate-900">Ploegopstellingen</h2>
        <p class="text-xs text-slate-500">Renners per ploeg selecteren en rugnummers toewijzen</p>
      </div>

      <!-- Zoekvak en Tour-selectie -->
      <div class="flex w-full flex-1 items-center justify-center gap-3 lg:max-w-xl">
        <div class="w-48 shrink-0">
          <select 
            v-model="selectedTourID" 
            @change="onTourChange"
            class="shadow-xs w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-amber-500 focus:outline-none"
          >
            <option v-for="t in tours" :key="t.tourID" :value="t.tourID">
              {{ t.naam }}
            </option>
          </select>
        </div>

        <div class="relative w-full">
          <Search class="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input 
            v-model="searchQuery" 
            placeholder="Zoek ploeg of renner..." 
            class="shadow-xs w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      <!-- Knoppen rechts -->
      <div class="flex shrink-0 items-center gap-3">
        <button 
          @click="fetchTourData" 
          class="shadow-xs rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50"
          title="Verversen"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
        </button>
        <button 
          @click="openAddTeamModal" 
          class="shadow-xs flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
        >
          <Plus class="h-4 w-4" />
          <span>Ploeg toevoegen</span>
        </button>
      </div>
    </div>

    <!-- Cards Grid per Ploeg -->
    <div v-if="loading && teamCards.length === 0" class="shadow-xs rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
      Opstellingen laden...
    </div>
    <div v-else-if="teamCards.length === 0" class="shadow-xs rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
      Geen ploegen gevonden voor deze selectie.
    </div>
    <div v-else class="grid grid-cols-1 gap-5 md:grid-cols-3 xl:grid-cols-4">
      <div 
        v-for="card in teamCards" 
        :key="card.ploegID"
        class="shadow-xs flex flex-col justify-between rounded-xl border border-slate-200 bg-white transition hover:border-slate-300"
      >
        <!-- Team Header -->
        <div class="rounded-t-xl border-b border-slate-100 bg-slate-50/50 p-4">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span v-if="card.volgorde" class="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-700">
                  #{{ card.volgorde }}
                </span>
                <span v-if="card.ploegCode" class="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-xs font-bold text-amber-700">
                  {{ card.ploegCode }}
                </span>
                <span v-if="card.ploegLand" class="text-xs font-medium text-slate-400">
                  ({{ card.ploegLand }})
                </span>
              </div>
              <h3 class="mt-1 truncate text-base font-bold text-slate-900" :title="card.ploegNaam">
                {{ card.ploegNaam }}
              </h3>
            </div>

            <div class="flex shrink-0 items-center gap-2">
              <span class="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                {{ card.riders.length }} renners
              </span>
              <button 
                @click="removeTeamFromTour(card, card.riders.length)"
                class="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                title="Ploeg uit deze Tour verwijderen"
              >
                <X class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Riders List -->
        <div class="max-h-90 min-h-40 flex-1 divide-y divide-slate-100 overflow-y-auto p-3">
          <div v-if="card.riders.length === 0" class="flex flex-col items-center justify-center py-8 text-center text-xs text-slate-400">
            <Users class="mb-2 h-8 w-8 text-slate-300" />
            <span>Nog geen renners toegevoegd</span>
          </div>
          <div 
            v-for="r in card.riders" 
            :key="r.rennerID"
            class="group/rider flex items-center justify-between rounded px-1 py-2 text-sm transition hover:bg-slate-50/80"
          >
            <div class="flex min-w-0 flex-1 items-center gap-2.5">
              <span class="w-8 shrink-0 rounded border border-amber-200/80 bg-amber-50 px-1.5 py-0.5 text-center font-mono text-xs font-bold text-amber-700">
                {{ r.Rugnummer }}
              </span>
              <span class="truncate text-xs font-medium text-slate-800" :title="formatRiderName(r)">
                {{ formatRiderName(r) }}
              </span>
              <span v-if="r.nietGestartEtappe" class="py-0.2 shrink-0 rounded border border-rose-200 bg-rose-50 px-1.5 text-[10px] font-semibold text-rose-700">
                Uit rit {{ r.nietGestartEtappe }}
              </span>
            </div>

            <button 
              @click="removeRiderFromTeam(r)"
              class="rounded p-1 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover/rider:opacity-100"
              title="Renner verwijderen"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <!-- Team Footer Action -->
        <div class="rounded-b-xl border-t border-slate-100 bg-slate-50/30 p-3">
          <button 
            @click="openAddRiderModal(card)"
            class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white py-1.5 text-xs font-semibold text-slate-700 transition hover:border-amber-400 hover:text-amber-700"
          >
            <UserPlus class="h-3.5 w-3.5" />
            <span>Renner toevoegen</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Totaal teller footer -->
    <div class="shadow-xs flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
      <span>Totaal <strong>{{ teamCards.length }}</strong> ploegen in deze selectie (<strong>{{ teamRiders.length }}</strong> renners totaal)</span>
      <span class="text-slate-400">Ploegopstellingen per kaart</span>
    </div>

    <!-- Modal: Renner toevoegen aan ploeg -->
    <div v-if="addRiderModalOpen" class="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h3 class="text-lg font-bold text-slate-900">Renner toevoegen</h3>
            <p class="text-xs text-slate-500">{{ activeTeamForRider?.ploegNaam }}</p>
          </div>
          <button @click="addRiderModalOpen = false" class="text-slate-400 hover:text-slate-700">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">Kies renner *</label>
            <select 
              v-model="newRiderForm.rennerID" 
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none"
            >
              <option :value="null" disabled>Selecteer een renner...</option>
              <option v-for="r in availableRidersForTeam" :key="r.rennerID" :value="r.rennerID">
                {{ formatRiderName(r) }}
              </option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Rugnummer *</label>
              <input 
                v-model.number="newRiderForm.Rugnummer" 
                type="number"
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
                placeholder="bv. 101"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Opgave etappe</label>
              <input 
                v-model.number="newRiderForm.nietGestartEtappe" 
                type="number"
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
                placeholder="Optioneel"
              />
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button 
            @click="addRiderModalOpen = false" 
            class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
          >
            Annuleren
          </button>
          <button 
            @click="addRiderToTeam" 
            class="shadow-xs rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
          >
            Toevoegen
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Ploeg toevoegen aan Tour -->
    <div v-if="addTeamModalOpen" class="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 pb-4">
          <h3 class="text-lg font-bold text-slate-900">Ploeg toevoegen aan Tour</h3>
          <button @click="addTeamModalOpen = false" class="text-slate-400 hover:text-slate-700">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">Kies ploeg *</label>
            <select 
              v-model="selectedTeamToAdd" 
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none"
            >
              <option :value="null" disabled>Selecteer een ploeg...</option>
              <option v-for="t in availableTeamsForTour" :key="t.ploegID" :value="t.ploegID">
                {{ t.naam }} {{ t.ploegCode ? `[${t.ploegCode}]` : '' }} {{ t.landID ? `(${t.landID})` : '' }}
              </option>
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">Volgorde</label>
            <input 
              v-model.number="newTeamVolgorde" 
              type="number"
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
              placeholder="bv. 1"
            />
          </div>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button 
            @click="addTeamModalOpen = false" 
            class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
          >
            Annuleren
          </button>
          <button 
            @click="addTeamToTour" 
            class="shadow-xs rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
          >
            Toevoegen
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
