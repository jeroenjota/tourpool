<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiFetch } from '../services/api';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  RefreshCw, 
  Trophy, 
  Search, 
  UserCheck, 
  CreditCard,
  Mail,
  MapPin
} from '@lucide/vue';

interface Pool {
  poolID: number;
  tourID: number;
  Naam: string;
  Org?: string | null;
}

interface Address {
  adrID: number;
  vNaam?: string | null;
  tNaam?: string | null;
  aNaam?: string | null;
  plaats?: string | null;
  tel?: string | null;
  email?: string | null;
}

interface Participant {
  deelnID: number;
  poolID: number;
  poolNaam?: string;
  adrID: number;
  vNaam?: string | null;
  tNaam?: string | null;
  aNaam?: string | null;
  plaats?: string | null;
  tel?: string | null;
  email?: string | null;
  roepnaam?: string | null;
  Betaald?: number | boolean | null;
}

interface PoolOption {
  poolID: number;
  inleg: number;
}

const pools = ref<Pool[]>([]);
const selectedPoolID = ref<number | null>(null);
const allAddresses = ref<Address[]>([]);
const participants = ref<Participant[]>([]);
const poolOption = ref<PoolOption | null>(null);
const loading = ref(true);

const searchQuery = ref('');
const filterPaidStatus = ref<'all' | 'paid' | 'unpaid'>('all');

// Modal states
const addModalOpen = ref(false);
const editModalOpen = ref(false);

const addForm = ref<{ adrID: number | null; roepnaam: string; Betaald: boolean }>({
  adrID: null,
  roepnaam: '',
  Betaald: false
});

const editingParticipant = ref<Participant | null>(null);

const fetchInitialData = async () => {
  loading.value = true;
  try {
    const [poolsRes, addressesRes] = await Promise.all([
      apiFetch<Pool[]>('/pools'),
      apiFetch<Address[]>('/addresses')
    ]);
    pools.value = poolsRes;
    allAddresses.value = addressesRes;

    if (pools.value.length > 0 && !selectedPoolID.value) {
      selectedPoolID.value = pools.value[0].poolID;
    }

    await fetchPoolData();
  } catch (err) {
    console.error('Error fetching initial data:', err);
  } finally {
    loading.value = false;
  }
};

const fetchPoolData = async () => {
  if (!selectedPoolID.value) return;
  try {
    const [partsRes, optionsRes] = await Promise.all([
      apiFetch<Participant[]>(`/participants?poolID=${selectedPoolID.value}`),
      apiFetch<PoolOption[]>(`/options?poolID=${selectedPoolID.value}`).catch(() => [])
    ]);
    participants.value = partsRes;
    poolOption.value = optionsRes.find(o => o.poolID === selectedPoolID.value) || null;
  } catch (err) {
    console.error('Error fetching pool data:', err);
  }
};

onMounted(fetchInitialData);

const onPoolChange = async (poolID: number) => {
  selectedPoolID.value = poolID;
  loading.value = true;
  await fetchPoolData();
  loading.value = false;
};

const activePool = computed(() => {
  return pools.value.find(p => p.poolID === selectedPoolID.value) || null;
});

const formatFullName = (p: { vNaam?: string | null; tNaam?: string | null; aNaam?: string | null }) => {
  const given = [p.vNaam, p.tNaam].filter(Boolean).join(' ');
  return given ? `${p.aNaam}, ${given}` : (p.aNaam || '-');
};

// Alle adressen gesorteerd voor de dropdown (een adres mag meerdere keren meedoen met unieke roepnaam)
const sortedAddresses = computed(() => {
  return [...allAddresses.value].sort((a, b) => (a.aNaam || '').localeCompare(b.aNaam || ''));
});

// Gefilterde deelnemers
const filteredParticipants = computed(() => {
  let list = participants.value;

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(p => 
      (p.aNaam && p.aNaam.toLowerCase().includes(q)) ||
      (p.vNaam && p.vNaam.toLowerCase().includes(q)) ||
      (p.roepnaam && p.roepnaam.toLowerCase().includes(q)) ||
      (p.plaats && p.plaats.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q))
    );
  }

  if (filterPaidStatus.value === 'paid') {
    list = list.filter(p => !!p.Betaald);
  } else if (filterPaidStatus.value === 'unpaid') {
    list = list.filter(p => !p.Betaald);
  }

  return list;
});

// Statistieken
const paidCount = computed(() => participants.value.filter(p => !!p.Betaald).length);
const unpaidCount = computed(() => participants.value.length - paidCount.value);
const inlegBedrag = computed(() => poolOption.value?.inleg ?? 10.00);
const totalInlegCollected = computed(() => (paidCount.value * inlegBedrag.value).toFixed(2));
const totalInlegExpected = computed(() => (participants.value.length * inlegBedrag.value).toFixed(2));

// Snel toggle betaald status
const togglePaid = async (p: Participant) => {
  const nextStatus = !p.Betaald;
  try {
    await apiFetch(`/participants/${p.deelnID}`, {
      method: 'PUT',
      body: JSON.stringify({
        Betaald: nextStatus ? 1 : 0
      })
    });
    p.Betaald = nextStatus;
  } catch (err) {
    alert(`Fout bij bijwerken betaalstatus: ${err instanceof Error ? err.message : err}`);
  }
};

// Deelnemer toevoegen
const openAddModal = () => {
  addForm.value = {
    adrID: sortedAddresses.value[0]?.adrID || null,
    roepnaam: '',
    Betaald: false
  };
  onAddressSelectChange();
  addModalOpen.value = true;
};

const onAddressSelectChange = () => {
  if (!addForm.value.adrID) return;
  const sel = allAddresses.value.find(a => a.adrID === addForm.value.adrID);
  if (!sel) return;

  // Tel hoe vaak dit adres al in de pool zit
  const existingCount = participants.value.filter(p => p.adrID === addForm.value.adrID).length;
  const baseName = sel.vNaam || sel.aNaam || '';

  if (existingCount > 0) {
    addForm.value.roepnaam = `${baseName} ${existingCount + 1}`;
  } else {
    addForm.value.roepnaam = baseName;
  }
};

const addParticipant = async () => {
  if (!selectedPoolID.value || !addForm.value.adrID) {
    alert('Selecteer een adres uit het adresboek.');
    return;
  }

  const trimmedRoepnaam = addForm.value.roepnaam.trim();
  if (!trimmedRoepnaam) {
    alert('Vul een roepnaam/teamnaam in voor deze deelname.');
    return;
  }

  // Controleer of dit adres met deze roepnaam al in deze pool zit
  const duplicate = participants.value.find(
    p => p.adrID === addForm.value.adrID && (p.roepnaam || '').trim().toLowerCase() === trimmedRoepnaam.toLowerCase()
  );
  if (duplicate) {
    alert(`Dit adres doet al mee onder de roepnaam "${duplicate.roepnaam}". Kies een andere roepnaam voor de extra deelname (bijv. "${trimmedRoepnaam} 2").`);
    return;
  }

  try {
    await apiFetch('/participants', {
      method: 'POST',
      body: JSON.stringify({
        poolID: selectedPoolID.value,
        adrID: Number(addForm.value.adrID),
        roepnaam: trimmedRoepnaam,
        Betaald: addForm.value.Betaald ? 1 : 0
      })
    });
    addModalOpen.value = false;
    await fetchPoolData();
  } catch (err) {
    alert(`Fout bij toevoegen deelnemer: ${err instanceof Error ? err.message : err}`);
  }
};

// Deelnemer bewerken
const openEditModal = (p: Participant) => {
  editingParticipant.value = { ...p, Betaald: !!p.Betaald };
  editModalOpen.value = true;
};

const saveParticipant = async () => {
  if (!editingParticipant.value) return;

  const trimmedRoepnaam = (editingParticipant.value.roepnaam || '').trim();
  if (!trimmedRoepnaam) {
    alert('Vul een roepnaam/teamnaam in.');
    return;
  }

  // Controleer of een andere deelname van hetzelfde adres al deze roepnaam heeft
  const duplicate = participants.value.find(
    p => p.deelnID !== editingParticipant.value!.deelnID &&
         p.adrID === editingParticipant.value!.adrID &&
         (p.roepnaam || '').trim().toLowerCase() === trimmedRoepnaam.toLowerCase()
  );
  if (duplicate) {
    alert(`Dit adres heeft al een deelname met de roepnaam "${duplicate.roepnaam}". Kies een andere roepnaam.`);
    return;
  }

  try {
    await apiFetch(`/participants/${editingParticipant.value.deelnID}`, {
      method: 'PUT',
      body: JSON.stringify({
        roepnaam: trimmedRoepnaam,
        Betaald: editingParticipant.value.Betaald ? 1 : 0
      })
    });
    editModalOpen.value = false;
    await fetchPoolData();
  } catch (err) {
    alert(`Fout bij opslaan: ${err instanceof Error ? err.message : err}`);
  }
};

// Deelnemer verwijderen uit pool
const deleteParticipant = async (p: Participant) => {
  const name = formatFullName(p);
  if (!confirm(`Weet je zeker dat je ${name} wilt verwijderen uit ${activePool.value?.Naam}?`)) return;

  try {
    await apiFetch(`/participants/${p.deelnID}`, { method: 'DELETE' });
    await fetchPoolData();
  } catch (err) {
    alert(`Fout bij verwijderen: ${err instanceof Error ? err.message : err}`);
  }
};
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900">Deelnemers per Pool</h2>
        <p class="text-xs text-slate-500">Koppel adressen uit het adresboek aan een specifieke pool (tblDeelnemers)</p>
      </div>

      <!-- Knoppen rechts -->
      <div class="flex items-center gap-3">
        <button 
          @click="fetchPoolData" 
          class="shadow-xs rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50"
          title="Verversen"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
        </button>
        <button 
          @click="openAddModal" 
          :disabled="!selectedPoolID || allAddresses.length === 0"
          class="shadow-xs flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus class="h-4 w-4" />
          <span>Deelnemer toevoegen</span>
        </button>
      </div>
    </div>

    <!-- Pool Tabs / Selector -->
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
      <button
        v-for="p in pools"
        :key="p.poolID"
        @click="onPoolChange(p.poolID)"
        class="flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition"
        :class="[
          selectedPoolID === p.poolID
            ? 'border-amber-500/80 bg-amber-500 text-slate-950 shadow-xs'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
        ]"
      >
        <Trophy class="h-4 w-4" />
        <span>{{ p.Naam }}</span>
        <span 
          class="rounded-full px-2 py-0.2 text-xs font-mono font-bold"
          :class="selectedPoolID === p.poolID ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-100 text-slate-600'"
        >
          {{ p.poolID === selectedPoolID ? `${participants.length} dln` : `#${p.poolID}` }}
        </span>
      </button>
    </div>

    <!-- Active Pool Summary Banner -->
    <div v-if="activePool" class="shadow-xs grid grid-cols-1 md:grid-cols-4 gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div class="space-y-1 md:col-span-1 border-r-0 md:border-r border-slate-100 pr-4">
        <span class="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 border border-slate-200">
          Pool ID #{{ activePool.poolID }}
        </span>
        <h3 class="text-base font-bold text-slate-900 mt-1">{{ activePool.Naam }}</h3>
        <p class="text-xs text-slate-500">Org: <strong class="text-slate-800">{{ activePool.Org || '-' }}</strong></p>
      </div>

      <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
        <div>
          <span class="text-xs text-slate-500 font-medium">Deelnemers</span>
          <div class="text-2xl font-bold text-slate-900 mt-0.5 font-mono">{{ participants.length }}</div>
        </div>
        <div class="p-2.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
          <UserCheck class="h-5 w-5" />
        </div>
      </div>

      <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
        <div>
          <span class="text-xs text-slate-500 font-medium">Betaald / Onbetaald</span>
          <div class="text-lg font-bold text-slate-900 mt-0.5 font-mono">
            <span class="text-emerald-600">{{ paidCount }}</span>
            <span class="text-slate-400 font-normal"> / </span>
            <span class="text-amber-600">{{ unpaidCount }}</span>
          </div>
        </div>
        <div class="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CreditCard class="h-5 w-5" />
        </div>
      </div>

      <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
        <div>
          <span class="text-xs text-slate-500 font-medium">Inleg (€{{ inlegBedrag }}/deelnemer)</span>
          <div class="text-lg font-bold text-slate-900 mt-0.5 font-mono">
            <span class="text-emerald-700">€{{ totalInlegCollected }}</span>
            <span class="text-xs text-slate-400 font-normal"> / €{{ totalInlegExpected }}</span>
          </div>
        </div>
        <div class="p-2.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Trophy class="h-5 w-5" />
        </div>
      </div>
    </div>

    <!-- Toolbar: Zoeken & Filteren -->
    <div class="shadow-xs flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
      <div class="relative flex-1 md:max-w-md">
        <Search class="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
        <input 
          v-model="searchQuery" 
          placeholder="Zoek op naam, roepnaam, plaats of e-mail..." 
          class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:bg-white focus:outline-none"
        />
      </div>

      <div class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
        <button
          @click="filterPaidStatus = 'all'"
          class="rounded-md px-3 py-1.5 text-xs font-semibold transition"
          :class="filterPaidStatus === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
        >
          Alle ({{ participants.length }})
        </button>
        <button
          @click="filterPaidStatus = 'paid'"
          class="rounded-md px-3 py-1.5 text-xs font-semibold transition"
          :class="filterPaidStatus === 'paid' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
        >
          Betaald ({{ paidCount }})
        </button>
        <button
          @click="filterPaidStatus = 'unpaid'"
          class="rounded-md px-3 py-1.5 text-xs font-semibold transition"
          :class="filterPaidStatus === 'unpaid' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
        >
          Onbetaald ({{ unpaidCount }})
        </button>
      </div>
    </div>

    <!-- Deelnemers Table -->
    <div class="shadow-xs overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-700">
          <thead class="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-5 py-3.5">ID</th>
              <th class="px-5 py-3.5">Deelnemer (Adres)</th>
              <th class="px-5 py-3.5">Roepnaam in Pool</th>
              <th class="px-5 py-3.5">Contact</th>
              <th class="px-5 py-3.5">Betaalstatus</th>
              <th class="px-5 py-3.5 text-right">Acties</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loading && participants.length === 0">
              <td colspan="6" class="px-5 py-8 text-center text-slate-400">Deelnemers laden...</td>
            </tr>
            <tr v-else-if="filteredParticipants.length === 0">
              <td colspan="6" class="px-5 py-8 text-center text-slate-400">
                Geen deelnemers gevonden voor deze selectie.
              </td>
            </tr>
            <tr v-for="p in filteredParticipants" :key="p.deelnID" class="transition hover:bg-slate-50/80">
              <td class="px-5 py-3 font-mono text-xs text-slate-400">#{{ p.deelnID }}</td>
              <td class="px-5 py-3">
                <div class="font-semibold text-slate-900">{{ formatFullName(p) }}</div>
                <div class="text-xs text-slate-400 font-mono">Adr #{{ p.adrID }}</div>
              </td>
              <td class="px-5 py-3">
                <span v-if="p.roepnaam" class="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-800">
                  {{ p.roepnaam }}
                </span>
                <span v-else class="text-slate-400 italic text-xs">-</span>
              </td>
              <td class="px-5 py-3 text-xs text-slate-600 space-y-0.5">
                <div v-if="p.plaats" class="flex items-center gap-1.5">
                  <MapPin class="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{{ p.plaats }}</span>
                </div>
                <div v-if="p.email" class="flex items-center gap-1.5">
                  <Mail class="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <a :href="`mailto:${p.email}`" class="text-amber-700 hover:underline">{{ p.email }}</a>
                </div>
              </td>
              <td class="px-5 py-3">
                <button
                  @click="togglePaid(p)"
                  class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition border shadow-2xs cursor-pointer"
                  :class="[
                    p.Betaald
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  ]"
                  title="Klik om status te wijzigen"
                >
                  <span class="h-1.5 w-1.5 rounded-full" :class="p.Betaald ? 'bg-emerald-500' : 'bg-amber-500'"></span>
                  <span>{{ p.Betaald ? 'Betaald' : 'Nog betalen' }}</span>
                </button>
              </td>
              <td class="space-x-2 px-5 py-3 text-right">
                <button 
                  @click="openEditModal(p)" 
                  class="rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  title="Bewerken"
                >
                  <Edit2 class="h-4 w-4" />
                </button>
                <button 
                  @click="deleteParticipant(p)" 
                  class="rounded p-1.5 text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
                  title="Verwijderen uit pool"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer count -->
      <div class="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500 flex justify-between items-center">
        <span>Totaal <strong>{{ filteredParticipants.length }}</strong> van de <strong>{{ participants.length }}</strong> deelnemers getoond</span>
        <span class="text-slate-400">Klik op de betaalstatus-badge om direct te schakelen</span>
      </div>
    </div>

    <!-- Modal: Deelnemer Toevoegen aan Pool -->
    <div v-if="addModalOpen" class="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h3 class="text-lg font-bold text-slate-900">Deelnemer toevoegen</h3>
            <p class="text-xs text-slate-500">{{ activePool?.Naam }}</p>
          </div>
          <button @click="addModalOpen = false" class="text-slate-400 hover:text-slate-700"><X class="h-5 w-5" /></button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">Selecteer adres uit adresboek *</label>
            <select 
              v-model="addForm.adrID" 
              @change="onAddressSelectChange"
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none"
            >
              <option :value="null" disabled>Kies een persoon...</option>
              <option v-for="a in sortedAddresses" :key="a.adrID" :value="a.adrID">
                {{ formatFullName(a) }} {{ a.plaats ? `(${a.plaats})` : '' }}
              </option>
            </select>
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">Roepnaam / Teamnaam in Pool *</label>
            <input 
              v-model="addForm.roepnaam" 
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
              placeholder="bv. Ploeg Jansen (of Jansen 2)" 
            />
            <p class="text-[11px] text-slate-500 mt-1">
              Doet hetzelfde adres vaker mee? Geef dan een unieke roepnaam op (bijv. "Jan 2").
            </p>
          </div>

          <div class="flex items-center gap-2 pt-1">
            <input 
              id="add-betaald" 
              v-model="addForm.Betaald" 
              type="checkbox" 
              class="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            <label for="add-betaald" class="text-sm font-semibold text-slate-700 cursor-pointer">
              Inleg is al betaald (€{{ inlegBedrag }})
            </label>
          </div>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button @click="addModalOpen = false" class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">Annuleren</button>
          <button @click="addParticipant" class="shadow-xs rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">Toevoegen</button>
        </div>
      </div>
    </div>

    <!-- Modal: Deelnemer Bewerken -->
    <div v-if="editModalOpen && editingParticipant" class="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h3 class="text-lg font-bold text-slate-900">Deelnemer bewerken</h3>
            <p class="text-xs text-slate-500">{{ formatFullName(editingParticipant) }}</p>
          </div>
          <button @click="editModalOpen = false" class="text-slate-400 hover:text-slate-700"><X class="h-5 w-5" /></button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">Roepnaam / Teamnaam</label>
            <input 
              v-model="editingParticipant.roepnaam" 
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
              placeholder="bv. Ploeg Jansen" 
            />
          </div>

          <div class="flex items-center gap-2 pt-1">
            <input 
              id="edit-betaald" 
              v-model="editingParticipant.Betaald" 
              type="checkbox" 
              class="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            <label for="edit-betaald" class="text-sm font-semibold text-slate-700 cursor-pointer">
              Inleg is betaald (€{{ inlegBedrag }})
            </label>
          </div>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button @click="editModalOpen = false" class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">Annuleren</button>
          <button @click="saveParticipant" class="shadow-xs rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">Opslaan</button>
        </div>
      </div>
    </div>
  </div>
</template>
