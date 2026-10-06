<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiFetch } from '../services/api';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  RefreshCw, 
  Search, 
  Sparkles
} from '@lucide/vue';

interface StandardPoint {
  prestatieID: number;
  Omschrijving: string;
  punten: number;
  uitslagtype?: string | null;
  plaats?: number | null;
  volgorde?: number | null;
}

const points = ref<StandardPoint[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const modalOpen = ref(false);
const editingItem = ref<Partial<StandardPoint> | null>(null);

const fetchPoints = async () => {
  loading.value = true;
  try {
    points.value = await apiFetch<StandardPoint[]>('/standard-points');
  } catch (err) {
    console.error('Error fetching standard points:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchPoints);

const typeOrder = ['rit', 'klasgeel', 'klasgroen', 'klasbol', 'klaswit', 'eindklas', 'eindpunt', 'eindberg', 'eindjon'];
const typeRank = (type?: string | null) => {
  const rank = typeOrder.indexOf((type ?? '').toLowerCase());
  return rank === -1 ? typeOrder.length : rank;
};

const uitslagtypeOptions = [
  { value: 'rit', label: 'Etappe' },
  { value: 'klasGeel', label: 'Gele trui (na etappe)' },
  { value: 'klasGroen', label: 'Groene trui (na etappe)' },
  { value: 'klasBol', label: 'Bolletjestrui (na etappe)' },
  { value: 'klasWit', label: 'Witte trui (na etappe)' },
  { value: 'eindKlas', label: 'Eindklassement' },
  { value: 'eindPunt', label: 'Eindklassement punten' },
  { value: 'eindBerg', label: 'Eindklassement berg' },
  { value: 'eindJon', label: 'Eindklassement jongeren' }
];

const filteredPoints = computed(() => {
  let list = points.value;
  if (searchQuery.value.trim() !== '') {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(p => 
      (p.Omschrijving && p.Omschrijving.toLowerCase().includes(q)) ||
      String(p.prestatieID).includes(q) ||
      String(p.punten).includes(q)
    );
  }
  return [...list].sort((a, b) =>
    typeRank(a.uitslagtype) - typeRank(b.uitslagtype) ||
    (a.plaats ?? 9999) - (b.plaats ?? 9999) ||
    a.prestatieID - b.prestatieID
  );
});

const pointColumns = computed(() => {
  const columns = [
    { key: 'stage', title: 'Etappeplaatsen', types: ['rit'], points: [] as StandardPoint[] },
    { key: 'jerseys', title: 'Etappetruien', types: ['klasgeel', 'klasgroen', 'klasbol', 'klaswit'], points: [] as StandardPoint[] },
    { key: 'final', title: 'Eindklassement', types: ['eindklas'], points: [] as StandardPoint[] },
    { key: 'other', title: 'Overige klassementen', types: ['eindpunt', 'eindberg', 'eindjon'], points: [] as StandardPoint[] }
  ];
  const untyped = { key: 'untyped', title: 'Zonder uitslagtype', types: [] as string[], points: [] as StandardPoint[] };
  for (const point of filteredPoints.value) {
    const type = (point.uitslagtype ?? '').toLowerCase();
    (columns.find(column => column.types.includes(type)) ?? untyped).points.push(point);
  }
  return untyped.points.length ? [...columns, untyped] : columns;
});

const openCreateModal = () => {
  editingItem.value = {
    Omschrijving: '',
    uitslagtype: 'rit',
    plaats: 1,
    punten: 10
  };
  modalOpen.value = true;
};

const openEditModal = (item: StandardPoint) => {
  editingItem.value = { ...item };
  modalOpen.value = true;
};

const savePoint = async () => {
  if (!editingItem.value || !editingItem.value.Omschrijving?.trim()) {
    alert('Vul een omschrijving in.');
    return;
  }
  const plaats = Number(editingItem.value.plaats);
  if (!editingItem.value.uitslagtype || !Number.isInteger(plaats) || plaats < 1) {
    alert('Kies een uitslagtype en vul een plaats van 1 of hoger in.');
    return;
  }

  try {
    const payload = {
      Omschrijving: editingItem.value.Omschrijving.trim(),
      uitslagtype: editingItem.value.uitslagtype,
      plaats,
      punten: Number(editingItem.value.punten ?? 0)
    };

    if (editingItem.value.prestatieID) {
      await apiFetch(`/standard-points/${editingItem.value.prestatieID}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      await apiFetch('/standard-points', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    modalOpen.value = false;
    await fetchPoints();
  } catch (err) {
    alert(`Fout bij opslaan: ${err instanceof Error ? err.message : err}`);
  }
};

const deletePoint = async (id: number) => {
  if (!confirm(`Weet je zeker dat je prestatie #${id} wilt verwijderen?`)) return;
  try {
    await apiFetch(`/standard-points/${id}`, { method: 'DELETE' });
    await fetchPoints();
  } catch (err) {
    alert(`Fout bij verwijderen: ${err instanceof Error ? err.message : err}`);
  }
};

// Snelle presets toevoegen inclusief logische volgorde
const presets = [
  { omschrijving: 'Winnaar etappe', plaats: 1, punten: 15, volgorde: 1, uitslagtype: 'rit' },
  { omschrijving: '2e etappe', plaats: 2, punten: 12, volgorde: 2, uitslagtype: 'rit' },
  { omschrijving: '3e etappe', plaats: 3, punten: 9, volgorde: 3, uitslagtype: 'rit' },
  { omschrijving: '4e etappe', plaats: 4, punten: 7, volgorde: 4, uitslagtype: 'rit' },
  { omschrijving: '5e etappe', plaats: 5, punten: 6, volgorde: 5, uitslagtype: 'rit' },
  { omschrijving: '6e etappe', plaats: 6, punten: 5, volgorde: 6, uitslagtype: 'rit' },
  { omschrijving: '7e etappe', plaats: 7, punten: 4, volgorde: 7, uitslagtype: 'rit' },
  { omschrijving: '8e etappe', plaats: 8, punten: 3, volgorde: 8, uitslagtype: 'rit' },
  { omschrijving: '9e etappe', plaats: 9, punten: 2, volgorde: 9, uitslagtype: 'rit' },
  { omschrijving: '10e etappe', plaats: 10, punten: 1, volgorde: 10, uitslagtype: 'rit' },
  { omschrijving: 'Gele trui na etappe', plaats: 1, punten: 5, volgorde: 21, uitslagtype: 'klasGeel' },
  { omschrijving: '2e in Klassement na etappe', plaats: 2, punten: 3, volgorde: 22, uitslagtype: 'klasGeel' },
  { omschrijving: '3e in Klassement na etappe', plaats: 3, punten: 1, volgorde: 23, uitslagtype: 'klasGeel' },
  { omschrijving: 'Groene trui na etappe', plaats: 1, punten: 5, volgorde: 31, uitslagtype: 'klasGroen' },
  { omschrijving: 'Bolletjes trui na etappe', plaats: 1, punten: 5, volgorde: 32, uitslagtype: 'klasBol' },
  { omschrijving: 'Witte trui na etappe', plaats: 1, punten: 5, volgorde: 51, uitslagtype: 'klasWit' },
  { omschrijving: 'Tourwinnaar', plaats: 1, punten: 50, volgorde: 71, uitslagtype: 'eindKlas' },
  { omschrijving: '2e in tour', plaats: 2, punten: 30, volgorde: 72, uitslagtype: 'eindKlas' },
  { omschrijving: '3e in tour', plaats: 3, punten: 15, volgorde: 73, uitslagtype: 'eindKlas' },
  { omschrijving: '4e in tour', plaats: 4, punten: 10, volgorde: 74, uitslagtype: 'eindKlas' },
  { omschrijving: '5e in tour', plaats: 5, punten: 7, volgorde: 75, uitslagtype: 'eindKlas' },
  { omschrijving: '6e in tour', plaats: 6, punten: 5, volgorde: 76, uitslagtype: 'eindKlas' },
  { omschrijving: '7e in tour', plaats: 7, punten: 4, volgorde: 77, uitslagtype: 'eindKlas' },
  { omschrijving: '8e in tour', plaats: 8, punten: 3, volgorde: 78, uitslagtype: 'eindKlas' },
  { omschrijving: '9e in tour', plaats: 9, punten: 2, volgorde: 79, uitslagtype: 'eindKlas' },
  { omschrijving: '10e in tour', plaats: 10, punten: 1, volgorde: 80, uitslagtype: 'eindKlas' },
  { omschrijving: '1e puntenkl', plaats: 1, punten: 15, volgorde: 81, uitslagtype: 'eindPunt' },
  { omschrijving: '2e puntenkl', plaats: 2, punten: 10, volgorde: 82, uitslagtype: 'eindPunt' },
  { omschrijving: '3e puntenkl', plaats: 3, punten: 5, volgorde: 83, uitslagtype: 'eindPunt' },
  { omschrijving: '1e in bergkl', plaats: 1, punten: 15, volgorde: 91, uitslagtype: 'eindBerg' },
  { omschrijving: '2e in bergkl', plaats: 2, punten: 10, volgorde: 92, uitslagtype: 'eindBerg' },
  { omschrijving: '3e in bergkl', plaats: 3, punten: 5, volgorde: 93, uitslagtype: 'eindBerg' },
  { omschrijving: '1e in jong.kl', plaats: 1, punten: 15, volgorde: 101, uitslagtype: 'eindJon' },
  { omschrijving: '2e in jong.kl', plaats: 2, punten: 10, volgorde: 102, uitslagtype: 'eindJon' },
  { omschrijving: '3e in jong.kl', plaats: 3, punten: 5, volgorde: 103, uitslagtype: 'eindJon' }
];

const loadingPresets = ref(false);

const loadPresets = async () => {
  if (!confirm(
    `Alle huidige standaardpunten worden verwijderd en vervangen door ${presets.length} presets.\n\n` +
    'De puntentoekenning van bestaande pools blijft ongewijzigd. Doorgaan?'
  )) return;

  loadingPresets.value = true;
  try {
    await apiFetch('/standard-points/presets', {
      method: 'PUT',
      body: JSON.stringify({
        items: presets.map(item => ({
          Omschrijving: item.omschrijving,
          uitslagtype: item.uitslagtype,
          plaats: item.plaats,
          punten: item.punten,
          volgorde: item.volgorde
        }))
      })
    });
  } catch (err) {
    alert(`Fout bij laden van presets: ${err instanceof Error ? err.message : err}`);
  } finally {
    loadingPresets.value = false;
    await fetchPoints();
  }
};
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="shrink-0">
        <h2 class="text-xl font-bold text-slate-900">Standaard Punten (tblStandaardPunten)</h2>
        <p class="text-xs text-slate-500">Beheer standaard puntentellingen voor etappe- en klassementsprestaties</p>
      </div>

      <!-- Gecentreerd zoekveld -->
      <div class="relative w-full lg:max-w-md">
        <Search class="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
        <input 
          v-model="searchQuery" 
          placeholder="Zoek op omschrijving of punten..." 
          class="shadow-xs w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none"
        />
      </div>

      <!-- Knoppen rechts -->
      <div class="flex shrink-0 items-center gap-2.5">
        <button 
          @click="loadPresets"
          :disabled="loadingPresets"
          class="shadow-xs flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
          title="Standaardtabel leegmaken en opnieuw vullen met de presets"
        >
          <Sparkles class="h-4 w-4 text-amber-600" />
          <span>Presets laden</span>
        </button>
        <button 
          @click="fetchPoints" 
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
          <span>Nieuwe prestatie</span>
        </button>
      </div>
    </div>

    <!-- Kolommen per soort prestatie -->
    <div v-if="loading && points.length === 0" class="shadow-xs rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
      Punten laden...
    </div>
    <div v-else-if="filteredPoints.length === 0" class="shadow-xs rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
      Geen standaard punten gevonden voor deze zoekopdracht.
    </div>
    <div v-else class="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <section v-for="column in pointColumns" :key="column.key" class="min-w-0 space-y-1.5">
        <h3 class="text-sm font-bold text-slate-900">{{ column.title }}</h3>
        <p v-if="column.points.length === 0" class="rounded-lg border border-dashed border-slate-300 p-4 text-xs text-slate-500">Geen prestaties</p>
      <div 
        v-for="p in column.points" 
        :key="p.prestatieID"
        class="shadow-xs flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2 transition hover:border-slate-300 hover:shadow-sm"
      >
        <div class="flex min-w-0 flex-1 items-center gap-1">
          <div class="min-w-0 flex-1">
            <h3 class="mt-0.5 truncate px-1.5 text-sm font-bold text-slate-900" :title="p.Omschrijving">
              {{ p.Omschrijving }}
            </h3>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <span class="shadow-2xs rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-sm font-bold text-amber-800">
            {{ p.punten }} pt
          </span>

          <div class="flex items-center gap-0.5">
            <button 
              @click.stop="openEditModal(p)" 
              class="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              title="Bewerken"
            >
              <Edit2 class="h-3.5 w-3.5" />
            </button>
            <button 
              @click.stop="deletePoint(p.prestatieID)" 
              class="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              title="Verwijderen"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
      </section>
    </div>

    <!-- Footer count -->
    <div class="shadow-xs flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
      <span>Totaal <strong>{{ filteredPoints.length }}</strong> standaard prestaties geconfigureerd</span>
    </div>

    <!-- Modal: Prestatie toevoegen / bewerken -->
    <div v-if="modalOpen" class="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 pb-4">
          <h3 class="text-lg font-bold text-slate-900">
            {{ editingItem?.prestatieID ? `Prestatie #${editingItem.prestatieID} bewerken` : 'Nieuwe standaard prestatie' }}
          </h3>
          <button @click="modalOpen = false" class="text-slate-400 hover:text-slate-700"><X class="h-5 w-5" /></button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">Omschrijving / Prestatiecode *</label>
            <input 
              v-model="editingItem!.Omschrijving" 
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
              placeholder="bv. etapPl1, geelPl1, eindGeelPl1..." 
            />
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <label class="mb-1 block text-xs font-semibold text-slate-700">Uitslagtype *</label>
              <select 
                v-model="editingItem!.uitslagtype" 
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none"
              >
                <option :value="null" disabled>Kies een type...</option>
                <option v-for="option in uitslagtypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Plaats *</label>
              <input 
                v-model.number="editingItem!.plaats" 
                type="number"
                min="1"
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
                placeholder="1" 
              />
            </div>
          </div>

          <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Aantal punten *</label>
              <input 
                v-model.number="editingItem!.punten" 
                type="number"
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
                placeholder="10" 
              />
          </div>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button @click="modalOpen = false" class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">Annuleren</button>
          <button @click="savePoint" class="shadow-xs rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">Opslaan</button>
        </div>
      </div>
    </div>
  </div>
</template>
