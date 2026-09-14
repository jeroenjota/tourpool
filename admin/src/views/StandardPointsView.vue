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
  Sparkles,
  GripVertical
} from '@lucide/vue';

interface StandardPoint {
  prestatieID: number;
  Omschrijving: string;
  punten: number;
  volgorde?: number | null;
}

const points = ref<StandardPoint[]>([]);
const loading = ref(true);
const savingOrder = ref(false);
const searchQuery = ref('');
const modalOpen = ref(false);
const editingItem = ref<Partial<StandardPoint> | null>(null);

// Drag and drop state
const draggedIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

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

const filteredPoints = computed(() => {
  let list = points.value;
  if (searchQuery.value.trim() !== '') {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(p => 
      (p.Omschrijving && p.Omschrijving.toLowerCase().includes(q)) ||
      String(p.prestatieID).includes(q) ||
      String(p.punten).includes(q) ||
      (p.volgorde !== null && p.volgorde !== undefined && String(p.volgorde).includes(q))
    );
  }
  return [...list].sort((a, b) => (a.volgorde ?? 9999) - (b.volgorde ?? 9999) || a.prestatieID - b.prestatieID);
});

// Drag & drop handlers
const onDragStart = (event: DragEvent, index: number) => {
  draggedIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  }
};

const onDragOver = (event: DragEvent, index: number) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  dragOverIndex.value = index;
};

const onDragLeave = (_event: DragEvent, index: number) => {
  if (dragOverIndex.value === index) {
    dragOverIndex.value = null;
  }
};

const onDrop = async (dropIndex: number) => {
  if (draggedIndex.value === null || draggedIndex.value === dropIndex) {
    draggedIndex.value = null;
    dragOverIndex.value = null;
    return;
  }

  // Work on sorted points list
  const currentList = [...filteredPoints.value];
  const [draggedItem] = currentList.splice(draggedIndex.value, 1);
  currentList.splice(dropIndex, 0, draggedItem);

  // Re-assign volgorde 1..N
  currentList.forEach((item, idx) => {
    item.volgorde = idx + 1;
  });

  points.value = currentList;
  draggedIndex.value = null;
  dragOverIndex.value = null;

  // Persist new order to backend
  savingOrder.value = true;
  try {
    await apiFetch('/standard-points/reorder', {
      method: 'PUT',
      body: JSON.stringify({
        items: currentList.map(p => ({
          prestatieID: p.prestatieID,
          volgorde: p.volgorde!
        }))
      })
    });
  } catch (err) {
    console.error('Error saving new standard points order:', err);
    await fetchPoints();
  } finally {
    savingOrder.value = false;
  }
};

const onDragEnd = () => {
  draggedIndex.value = null;
  dragOverIndex.value = null;
};

const openCreateModal = () => {
  const maxVolgorde = points.value.reduce((max, p) => Math.max(max, p.volgorde || 0), 0);
  editingItem.value = {
    Omschrijving: '',
    punten: 10,
    volgorde: maxVolgorde + 1
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

  try {
    const payload = {
      Omschrijving: editingItem.value.Omschrijving.trim(),
      punten: Number(editingItem.value.punten ?? 0),
      volgorde: editingItem.value.volgorde !== undefined && editingItem.value.volgorde !== null && editingItem.value.volgorde !== ('' as any)
        ? Number(editingItem.value.volgorde)
        : null
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
  { omschrijving: 'etapPl1', punten: 10, volgorde: 1 },
  { omschrijving: 'etapPl2', punten: 7, volgorde: 2 },
  { omschrijving: 'etapPl3', punten: 5, volgorde: 3 },
  { omschrijving: 'etapPl4', punten: 4, volgorde: 4 },
  { omschrijving: 'etapPl5', punten: 3, volgorde: 5 },
  { omschrijving: 'etapPl6', punten: 2, volgorde: 6 },
  { omschrijving: 'etapPl7', punten: 1, volgorde: 7 },
  { omschrijving: 'etapGeel1', punten: 6, volgorde: 21 },
  { omschrijving: 'etapGeel2', punten: 4, volgorde: 22 },
  { omschrijving: 'etapGeel3', punten: 3, volgorde: 23 },
  { omschrijving: 'etapGroen1', punten: 3, volgorde: 31 },
  { omschrijving: 'etapGroen2', punten: 2, volgorde: 32 },
  { omschrijving: 'etapGroen3', punten: 1, volgorde: 33 },
  { omschrijving: 'etapBol1', punten: 3, volgorde: 41 },
  { omschrijving: 'etapBol2', punten: 2, volgorde: 42 },
  { omschrijving: 'etapBol3', punten: 1, volgorde: 43 },
  { omschrijving: 'etapWit1', punten: 3, volgorde: 51 },
  { omschrijving: 'etapWit2', punten: 2, volgorde: 52 },
  { omschrijving: 'etapWit3', punten: 1, volgorde: 53 },
  { omschrijving: 'eindGeelPl1', punten: 50, volgorde: 71 },
  { omschrijving: 'eindGeelPl2', punten: 30, volgorde: 72 },
  { omschrijving: 'eindGeelPl3', punten: 15, volgorde: 73 },
  { omschrijving: 'eindGeelPl4', punten: 10, volgorde: 74 },
  { omschrijving: 'eindGeelPl5', punten: 5, volgorde: 75 },
  { omschrijving: 'eindGroenPl1', punten: 15, volgorde: 81 },
  { omschrijving: 'eindGroenPl2', punten: 10, volgorde: 82 },
  { omschrijving: 'eindGroenPl3', punten: 5, volgorde: 83 },
  { omschrijving: 'eindBolPl1', punten: 15, volgorde: 91 },
  { omschrijving: 'eindBolPl2', punten: 10, volgorde: 92 },
  { omschrijving: 'eindBolPl3', punten: 5, volgorde: 93 },
  { omschrijving: 'eindWitPl1', punten: 15, volgorde: 101 },
  { omschrijving: 'eindWitPl2', punten: 10, volgorde: 102 },
  { omschrijving: 'eindWitPl3', punten: 5, volgorde: 103 }
];

const addAllMissingPresets = async () => {
  const currentDescriptions = new Set(points.value.map(p => p.Omschrijving.toLowerCase()));
  const toAdd = presets.filter(p => !currentDescriptions.has(p.omschrijving.toLowerCase()));

  if (toAdd.length === 0) {
    alert('Alle standaard prestaties zijn al aanwezig.');
    return;
  }

  if (!confirm(`Wil je de ${toAdd.length} ontbrekende standaard prestaties toevoegen?`)) return;

  for (const item of toAdd) {
    await apiFetch('/standard-points', {
      method: 'POST',
      body: JSON.stringify({
        Omschrijving: item.omschrijving,
        punten: item.punten,
        volgorde: item.volgorde
      })
    });
  }
  await fetchPoints();
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
          @click="addAllMissingPresets"
          class="shadow-xs flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
          title="Voeg automatisch de standaard prestatie-templates toe"
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

    <!-- Cards Grid (4 kolommen op groot scherm, 2 op tablet, 1 op mobiel) -->
    <div v-if="loading && points.length === 0" class="shadow-xs rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
      Punten laden...
    </div>
    <div v-else-if="filteredPoints.length === 0" class="shadow-xs rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
      Geen standaard punten gevonden voor deze zoekopdracht.
    </div>
    <div v-else class="grid select-none grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      <div 
        v-for="(p, idx) in filteredPoints" 
        :key="p.prestatieID"
        draggable="true"
        @dragstart="onDragStart($event, idx)"
        @dragover="onDragOver($event, idx)"
        @dragleave="onDragLeave($event, idx)"
        @drop="onDrop(idx)"
        @dragend="onDragEnd"
        class="shadow-xs group flex cursor-grab items-center justify-between gap-3 rounded-xl border p-4 transition-all duration-150 active:cursor-grabbing"
        :class="[
          draggedIndex === idx 
            ? 'opacity-40 scale-95 border-dashed border-amber-400 bg-amber-50/20' 
            : dragOverIndex === idx 
              ? 'border-amber-500 ring-2 ring-amber-400/50 bg-amber-50/50 scale-[1.02]' 
              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
        ]"
      >
        <!-- Drag Handle + Info -->
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <div class="cursor-grab text-slate-300 transition group-hover:text-slate-500">
            <GripVertical class="h-4 w-4" />
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span v-if="p.volgorde" class="py-0.2 rounded border border-slate-200 bg-slate-100 px-1.5 font-mono text-[10px] font-bold text-slate-700">
                #{{ p.volgorde }}
              </span>
              <span class="font-mono text-[10px] text-slate-400">ID #{{ p.prestatieID }}</span>
            </div>
            <h3 class="mt-0.5 truncate text-sm font-bold text-slate-900" :title="p.Omschrijving">
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
    </div>

    <!-- Footer count -->
    <div class="shadow-xs flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
      <span>Totaal <strong>{{ filteredPoints.length }}</strong> standaard prestaties geconfigureerd</span>
      <span class="flex items-center gap-1.5 text-slate-400">
        <span v-if="savingOrder" class="animate-pulse font-semibold text-amber-600">Volgorde opslaan...</span>
        <span v-else>💡 Sleep een kaartje om de volgorde aan te passen</span>
      </span>
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

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Aantal punten *</label>
              <input 
                v-model.number="editingItem!.punten" 
                type="number"
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
                placeholder="10" 
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Volgorde</label>
              <input 
                v-model.number="editingItem!.volgorde" 
                type="number"
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
                placeholder="bv. 1" 
              />
            </div>
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
