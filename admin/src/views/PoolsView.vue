<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiFetch } from '../services/api';
import { Plus, Trash2, Edit2, X } from '@lucide/vue';

interface Pool {
  poolID: number;
  tourID: number;
  Naam: string;
  Org?: string | null;
  StartInschr?: string | null;
  EindInschr?: string | null;
}

const pools = ref<Pool[]>([]);
const tours = ref<{ tourID: number; naam: string }[]>([]);
const loading = ref(true);
const modalOpen = ref(false);
const editingPool = ref<Partial<Pool> | null>(null);

const fetchPools = async () => {
  loading.value = true;
  try {
    pools.value = await apiFetch<Pool[]>('/pools');
  } catch (err) {
    console.error('Error fetching pools:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  try {
    tours.value = await apiFetch<any[]>('/tours');
  } catch (err) {
    console.error(err);
  }
  await fetchPools();
});

const openCreateModal = () => {
  editingPool.value = { tourID: tours.value[0]?.tourID || 1, Naam: '', Org: '' };
  modalOpen.value = true;
};

const openEditModal = (pool: Pool) => {
  editingPool.value = { ...pool };
  modalOpen.value = true;
};

const savePool = async () => {
  if (!editingPool.value || !editingPool.value.Naam) return;

  try {
    const payload = {
      tourID: Number(editingPool.value.tourID),
      Naam: editingPool.value.Naam,
      Org: editingPool.value.Org || null,
      StartInschr: editingPool.value.StartInschr || null,
      EindInschr: editingPool.value.EindInschr || null
    };

    if (editingPool.value.poolID) {
      await apiFetch(`/pools/${editingPool.value.poolID}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      await apiFetch('/pools', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
    modalOpen.value = false;
    await fetchPools();
  } catch (err) {
    alert(`Fout bij opslaan: ${err instanceof Error ? err.message : err}`);
  }
};

const deletePool = async (id: number) => {
  if (!confirm(`Weet je zeker dat je pool #${id} wilt verwijderen?`)) return;
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
            <span class="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              Actief
            </span>
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
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button @click="modalOpen = false" class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">Annuleren</button>
          <button @click="savePool" class="shadow-xs rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">Opslaan</button>
        </div>
      </div>
    </div>
  </div>
</template>
