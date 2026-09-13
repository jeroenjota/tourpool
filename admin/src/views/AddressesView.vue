<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiFetch } from '../services/api';
import { Plus, Trash2, Edit2, X, RefreshCw, Search } from '@lucide/vue';

interface Address {
  adrID: number;
  vNaam?: string | null;
  tNaam?: string | null;
  aNaam?: string | null;
  plaats?: string | null;
  tel?: string | null;
  email?: string | null;
}

const addresses = ref<Address[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const modalOpen = ref(false);
const editingAddress = ref<Partial<Address> | null>(null);

const fetchAddresses = async () => {
  loading.value = true;
  try {
    addresses.value = await apiFetch<Address[]>('/addresses');
  } catch (err) {
    console.error('Error fetching addresses:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchAddresses);

const formatFullName = (a: Address | Partial<Address>) => {
  const given = [a.vNaam, a.tNaam].filter(Boolean).join(' ');
  return given ? `${a.aNaam}, ${given}` : (a.aNaam || '-');
};

const filteredAddresses = computed(() => {
  let list = addresses.value;
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(a => 
      (a.aNaam && a.aNaam.toLowerCase().includes(q)) ||
      (a.vNaam && a.vNaam.toLowerCase().includes(q)) ||
      (a.plaats && a.plaats.toLowerCase().includes(q)) ||
      (a.email && a.email.toLowerCase().includes(q)) ||
      (a.tel && a.tel.includes(q))
    );
  }
  return [...list].sort((a, b) => {
    const aName = a.aNaam || '';
    const bName = b.aNaam || '';
    const cmp = aName.localeCompare(bName, 'nl');
    if (cmp !== 0) return cmp;
    return (a.vNaam || '').localeCompare(b.vNaam || '', 'nl');
  });
});

const openCreateModal = () => {
  const maxId = addresses.value.reduce((max, a) => Math.max(max, a.adrID || 0), 0);
  editingAddress.value = { 
    adrID: maxId + 1, 
    vNaam: '', 
    tNaam: '', 
    aNaam: '', 
    email: '', 
    plaats: '', 
    tel: '' 
  };
  modalOpen.value = true;
};

const openEditModal = (a: Address) => {
  editingAddress.value = { ...a };
  modalOpen.value = true;
};

const saveAddress = async () => {
  if (!editingAddress.value || !editingAddress.value.aNaam) {
    alert('Vul minimaal een achternaam in.');
    return;
  }

  try {
    const isEdit = addresses.value.some(a => a.adrID === editingAddress.value!.adrID);
    if (isEdit) {
      await apiFetch(`/addresses/${editingAddress.value.adrID}`, {
        method: 'PUT',
        body: JSON.stringify(editingAddress.value)
      });
    } else {
      await apiFetch('/addresses', {
        method: 'POST',
        body: JSON.stringify(editingAddress.value)
      });
    }
    modalOpen.value = false;
    await fetchAddresses();
  } catch (err) {
    alert(`Fout bij opslaan: ${err instanceof Error ? err.message : err}`);
  }
};

const deleteAddress = async (id: number) => {
  if (!confirm(`Weet je zeker dat je adres #${id} wilt verwijderen?`)) return;
  try {
    await apiFetch(`/addresses/${id}`, { method: 'DELETE' });
    await fetchAddresses();
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
        <h2 class="text-xl font-bold text-slate-900">Adresboek</h2>
        <p class="text-xs text-slate-500">Centraal bestand van contact- en NAW-gegevens van deelnemers (tblAdressen)</p>
      </div>

      <!-- Zoekveld -->
      <div class="relative w-full lg:max-w-md">
        <Search class="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
        <input 
          v-model="searchQuery" 
          placeholder="Zoek op naam, plaats of e-mail..." 
          class="shadow-xs w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none"
        />
      </div>

      <!-- Knoppen rechts -->
      <div class="flex shrink-0 items-center gap-3">
        <button 
          @click="fetchAddresses" 
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
          <span>Nieuw adres</span>
        </button>
      </div>
    </div>

    <!-- Cards Grid (1 col mobiel, 2 tablet, 3 md, 4 lg, 6 2xl) -->
    <div v-if="loading && addresses.length === 0" class="shadow-xs rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
      Adressen laden...
    </div>
    <div v-else-if="filteredAddresses.length === 0" class="shadow-xs rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
      Geen adressen gevonden voor deze zoekopdracht.
    </div>
    <div v-else class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
      <div 
        v-for="a in filteredAddresses" 
        :key="a.adrID"
        class="shadow-xs group flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm"
      >
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-sm font-medium leading-snug text-slate-900" :title="formatFullName(a)">
            {{ formatFullName(a) }}
          </h3>
        </div>

        <div class="flex shrink-0 items-center gap-0.5">
          <button 
            @click="openEditModal(a)" 
            class="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="Details / Bewerken"
          >
            <Edit2 class="h-3.5 w-3.5" />
          </button>
          <button 
            @click="deleteAddress(a.adrID)" 
            class="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            title="Verwijderen"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Footer count -->
    <div class="shadow-xs flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
      <span>Totaal <strong>{{ filteredAddresses.length }}</strong> van de <strong>{{ addresses.length }}</strong> adressen getoond</span>
      <span class="text-slate-400">Gesorteerd op achternaam • Details en beheer via bewerkknop</span>
    </div>

    <!-- Modal -->
    <div v-if="modalOpen" class="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 pb-4">
          <h3 class="text-lg font-bold text-slate-900">
            {{ editingAddress?.adrID && addresses.some(a => a.adrID === editingAddress?.adrID) ? `Adres #${editingAddress.adrID} bewerken` : 'Nieuw adres toevoegen' }}
          </h3>
          <button @click="modalOpen = false" class="text-slate-400 hover:text-slate-700"><X class="h-5 w-5" /></button>
        </div>

        <div class="space-y-4">
          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-1">
              <label class="mb-1 block text-xs font-semibold text-slate-700">Voornaam</label>
              <input v-model="editingAddress!.vNaam" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" placeholder="Jan" />
            </div>
            <div class="col-span-1">
              <label class="mb-1 block text-xs font-semibold text-slate-700">Tussenvoegsel</label>
              <input v-model="editingAddress!.tNaam" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" placeholder="van" />
            </div>
            <div class="col-span-1">
              <label class="mb-1 block text-xs font-semibold text-slate-700">Achternaam *</label>
              <input v-model="editingAddress!.aNaam" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" placeholder="Jansen" />
            </div>
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">E-mailadres</label>
            <input v-model="editingAddress!.email" type="email" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" placeholder="jan@example.com" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Woonplaats</label>
              <input v-model="editingAddress!.plaats" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" placeholder="Amsterdam" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Telefoonnummer</label>
              <input v-model="editingAddress!.tel" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" placeholder="06-12345678" />
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button @click="modalOpen = false" class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">Annuleren</button>
          <button @click="saveAddress" class="shadow-xs rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">Opslaan</button>
        </div>
      </div>
    </div>
  </div>
</template>
