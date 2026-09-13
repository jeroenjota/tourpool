<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiFetch } from '../services/api';
import { Search, Plus, Trash2, Edit2, X, RefreshCw } from '@lucide/vue';

interface Rider {
  rennerID: number;
  anaam: string;
  tnaam?: string | null;
  vnaam?: string | null;
  landID?: string | null;
  gebDatum?: string | null;
}

const riders = ref<Rider[]>([]);
const countries = ref<{ iso2: string; land: string }[]>([]);
const searchQuery = ref('');
const selectedLand = ref('');
const loading = ref(true);
const modalOpen = ref(false);
const editingRider = ref<Partial<Rider> | null>(null);

const fetchRiders = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (searchQuery.value) params.append('search', searchQuery.value);
    if (selectedLand.value) params.append('landID', selectedLand.value);
    
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    riders.value = await apiFetch<Rider[]>(`/riders${queryStr}`);
  } catch (err) {
    console.error('Error fetching riders:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  try {
    countries.value = await apiFetch<any[]>('/countries');
  } catch (err) {
    console.error(err);
  }
  await fetchRiders();
});

const openCreateModal = () => {
  editingRider.value = { anaam: '', vnaam: '', tnaam: '', landID: 'NL', gebDatum: '' };
  modalOpen.value = true;
};

const openEditModal = (rider: Rider) => {
  editingRider.value = { ...rider };
  modalOpen.value = true;
};

const saveRider = async () => {
  if (!editingRider.value || !editingRider.value.anaam) return;

  try {
    const payload = {
      anaam: editingRider.value.anaam,
      vnaam: editingRider.value.vnaam || null,
      tnaam: editingRider.value.tnaam || null,
      landID: editingRider.value.landID || null,
      gebDatum: editingRider.value.gebDatum || null
    };

    if (editingRider.value.rennerID) {
      await apiFetch(`/riders/${editingRider.value.rennerID}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      await apiFetch('/riders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
    modalOpen.value = false;
    await fetchRiders();
  } catch (err) {
    alert(`Fout bij opslaan: ${err instanceof Error ? err.message : err}`);
  }
};

const deleteRider = async (id: number) => {
  if (!confirm(`Weet je zeker dat je deze renner wilt verwijderen?`)) return;
  try {
    await apiFetch(`/riders/${id}`, { method: 'DELETE' });
    await fetchRiders();
  } catch (err) {
    alert(`Fout bij verwijderen: ${err instanceof Error ? err.message : err}`);
  }
};

const formatRiderName = (r: Rider) => {
  const given = [r.vnaam, r.tnaam].filter(Boolean).join(' ');
  const namePart = given ? `${r.anaam}, ${given}` : r.anaam;
  return r.landID ? `${namePart} (${r.landID})` : namePart;
};
</script>

<template>
  <div class="space-y-6">
    <!-- Action header met gecentreerd zoekvak -->
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="shrink-0">
        <h2 class="text-xl font-bold text-slate-900">Rennersoverzicht</h2>
        <p class="text-xs text-slate-500">Beheer alle wielrenners in de Tourpool database</p>
      </div>

      <!-- Gecentreerd zoek- en filtergedeelte -->
      <div class="flex w-full flex-1 items-center justify-center gap-3 lg:max-w-xl">
        <div class="relative w-full">
          <Search class="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input 
            v-model="searchQuery" 
            @input="fetchRiders"
            placeholder="Zoek renner op voor- of achternaam..." 
            class="shadow-xs w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div class="w-44 shrink-0">
          <select 
            v-model="selectedLand" 
            @change="fetchRiders"
            class="shadow-xs w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none"
          >
            <option value="">Alle landen</option>
            <option v-for="c in countries" :key="c.iso2" :value="c.iso2">
              {{ c.iso2 }} - {{ c.land }}
            </option>
          </select>
        </div>
      </div>

      <!-- Knoppen rechts -->
      <div class="flex shrink-0 items-center gap-3">
        <button 
          @click="fetchRiders" 
          class="shadow-xs rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50"
          title="Verversen"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
        </button>
        <button 
          @click="openCreateModal" 
          class="shadow-xs flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
        >
          <Plus class="h-4 w-4" />
          <span>Nieuwe renner</span>
        </button>
      </div>
    </div>

    <!-- Cards Grid (1 col mobile, 2 cols tablet, 4 cols desktop) -->
    <div v-if="loading && riders.length === 0" class="shadow-xs rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
      Renners laden...
    </div>
    <div v-else-if="riders.length === 0" class="shadow-xs rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
      Geen renners gevonden voor deze selectie.
    </div>
    <div v-else class="grid grid-cols-1 gap-1 sm:grid-cols-3 xl:grid-cols-6">
      <div 
        v-for="rider in riders" 
        :key="rider.rennerID"
        class="shadow-xs group flex items-center justify-between gap-1 rounded-xl border border-slate-200 bg-white p-2 transition hover:border-slate-400 hover:shadow-sm"
      >
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-sm font-medium leading-snug text-slate-900" :title="formatRiderName(rider)">
            {{ formatRiderName(rider) }}
          </h3>
        </div>

        <div class="flex shrink-0 items-center gap-1">
          <button 
            @click="openEditModal(rider)" 
            class="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="Bewerken"
          >
            <Edit2 class="h-3.5 w-3.5" />
          </button>
          <button 
            @click="deleteRider(rider.rennerID)" 
            class="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            title="Verwijderen"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Totaal teller footer -->
    <div class="shadow-xs flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
      <span>Totaal <strong>{{ riders.length }}</strong> renners getoond</span>
      <span class="text-slate-400">1 kolom (mobiel) • 2 kolommen (tablet) • 4 kolommen (desktop)</span>
    </div>

    <!-- Edit/Create Modal -->
    <div v-if="modalOpen" class="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 pb-4">
          <h3 class="text-lg font-bold text-slate-900">
            {{ editingRider?.rennerID ? `Renner #${editingRider.rennerID} bewerken` : 'Nieuwe renner toevoegen' }}
          </h3>
          <button @click="modalOpen = false" class="text-slate-400 hover:text-slate-700">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">Achternaam *</label>
            <input 
              v-model="editingRider!.anaam" 
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
              placeholder="bv. Vingegaard"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Voornaam</label>
              <input 
                v-model="editingRider!.vnaam" 
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
                placeholder="bv. Jonas"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Tussenvoegsel</label>
              <input 
                v-model="editingRider!.tnaam" 
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
                placeholder="bv. van"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Land (ISO2)</label>
              <select 
                v-model="editingRider!.landID" 
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none"
              >
                <option :value="null">Geen</option>
                <option v-for="c in countries" :key="c.iso2" :value="c.iso2">
                  {{ c.iso2 }} ({{ c.land }})
                </option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Geboortedatum</label>
              <input 
                v-model="editingRider!.gebDatum" 
                type="date"
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
              />
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button 
            @click="modalOpen = false" 
            class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
          >
            Annuleren
          </button>
          <button 
            @click="saveRider" 
            class="shadow-xs rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
          >
            Opslaan
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
