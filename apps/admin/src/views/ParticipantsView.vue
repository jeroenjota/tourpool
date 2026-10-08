<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { apiFetch } from '../services/api';
import { useActivePoolStore } from '../stores/activePool';
import { loadPrintFonts } from '../services/printFonts';
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
  Bike,
  GripVertical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Printer
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
  ploegnaam?: string | null;
  Betaald?: number | boolean | null;
}

interface UserAccount {
  accountID: number;
  adrID: number;
  username: string;
  email: string;
  vNaam: string | null;
  tNaam: string | null;
  aNaam: string | null;
}

interface PoolOption {
  poolID: number;
  inleg: number;
  PloegRennerAantal?: number | null;
  PloegReserveAantal?: number | null;
}

interface Stage {
  etappeNr?: number | null;
  datum?: string | null;
  Start?: string | null;
  Finish?: string | null;
}

interface TourRider {
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

interface ParticipantRiderItem {
  deelnID: number;
  rennerID: number;
  positie: number;
  anaam: string;
  vnaam?: string | null;
  tnaam?: string | null;
  rennerLand?: string | null;
  Rugnummer?: number | null;
  nietGestartEtappe?: number | null;
  ploegNaam?: string | null;
  ploegCode?: string | null;
}

const pools = ref<Pool[]>([]);
const activePoolStore = useActivePoolStore();
const selectedPoolID = ref<number | null>(activePoolStore.activePoolID);
const allAddresses = ref<Address[]>([]);
const participants = ref<Participant[]>([]);
const poolOption = ref<PoolOption | null>(null);
const stages = ref<Stage[]>([]);
const stagesWithResults = ref<Set<number>>(new Set());
const printStageNumber = ref<number | null>(null);
const tourRiders = ref<TourRider[]>([]);
const participantRidersMap = ref<Record<number, ParticipantRiderItem[]>>({});
const loading = ref(true);

const searchQuery = ref('');
const filterPaidStatus = ref<'all' | 'paid' | 'unpaid'>('all');
const participantSort = ref<{ key: 'ploegnaam' | 'naam'; direction: 'asc' | 'desc' } | null>({
  key: 'ploegnaam',
  direction: 'asc'
});

// Modal states
const addModalOpen = ref(false);
const addAddressModalOpen = ref(false);
const editModalOpen = ref(false);
const manageRidersModalOpen = ref(false);
const selectedStageNumber = ref<number | null>(null);
const savingNewAddress = ref(false);
const newAddressForm = ref({
  vNaam: '',
  tNaam: '',
  aNaam: '',
  plaats: '',
  tel: '',
  email: ''
});

// Drag & drop state for selected riders
const addRiderDragIdx = ref<number | null>(null);
const addRiderDragOverIdx = ref<number | null>(null);

const manageRiderDragIdx = ref<number | null>(null);
const manageRiderDragOverIdx = ref<number | null>(null);

// State for Adding Participant
const addForm = ref<{
  adrID: number | null;
  ploegnaam: string;
  Betaald: boolean;
  selectedRiders: Array<{ rennerID: number; positie: number }>;
}>({
  adrID: null,
  ploegnaam: '',
  Betaald: false,
  selectedRiders: []
});

const riderSearchQuery = ref('');
const editingParticipant = ref<Participant | null>(null);
const userAccounts = ref<UserAccount[]>([]);
const selectedAccountID = ref<number | null>(null);
const loadingAccounts = ref(false);
const linkingAccount = ref(false);
const accountError = ref('');

// State for Managing Team of Existing Participant
const managingParticipant = ref<Participant | null>(null);
const managingSelectedRiders = ref<Array<{ rennerID: number; positie: number }>>([]);
const savingRiders = ref(false);

const totalRiderCount = computed(() => poolOption.value?.PloegRennerAantal ?? 15);
const targetReserveCount = computed(() => poolOption.value?.PloegReserveAantal ?? 5);
const targetRiderCount = computed(() => Math.max(totalRiderCount.value - targetReserveCount.value, 0));
const maxTotalRiders = computed(() => totalRiderCount.value);

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
      activePoolStore.setActivePool(selectedPoolID.value);
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
    const [partsRes, optionsRes, stagesRes, stageResultsRes] = await Promise.all([
      apiFetch<Participant[]>(`/participants?poolID=${selectedPoolID.value}`),
      apiFetch<PoolOption[]>(`/options?poolID=${selectedPoolID.value}`).catch(() => []),
      apiFetch<Stage[]>(`/stages?tour=${activePool.value?.tourID ?? ''}`).catch(() => []),
      activePool.value?.tourID
        ? apiFetch<Array<{ etappeNr: number }>>(`/stage-results?tourID=${activePool.value.tourID}`).catch(() => [])
        : Promise.resolve([])
    ]);
    participants.value = partsRes;
    poolOption.value = optionsRes.find(o => o.poolID === selectedPoolID.value) || null;
    stages.value = stagesRes
      .filter(stage => stage.etappeNr != null)
      .sort((a, b) => (a.etappeNr || 0) - (b.etappeNr || 0));
    selectedStageNumber.value = stages.value.at(-1)?.etappeNr ?? null;
    stagesWithResults.value = new Set(stageResultsRes.map(result => Number(result.etappeNr)));
    printStageNumber.value = nextStageNumber.value;

    // Haal de renners van de actieve tour op
    if (activePool.value?.tourID) {
      tourRiders.value = await apiFetch<TourRider[]>(`/team-riders?tourID=${activePool.value.tourID}`);
    } else {
      tourRiders.value = [];
    }

    // Haal alle geselecteerde renners van de deelnemers in deze pool op
    const allPartRiders = await apiFetch<ParticipantRiderItem[]>('/participant-riders');
    const map: Record<number, ParticipantRiderItem[]> = {};
    for (const pr of allPartRiders) {
      if (!map[pr.deelnID]) map[pr.deelnID] = [];
      map[pr.deelnID].push(pr);
    }
    participantRidersMap.value = map;
  } catch (err) {
    console.error('Error fetching pool data:', err);
  }
};

onMounted(fetchInitialData);

watch(() => activePoolStore.activePoolID, async (poolID) => {
  if (!poolID || poolID === selectedPoolID.value) return;
  selectedPoolID.value = poolID;
  loading.value = true;
  await fetchPoolData();
  loading.value = false;
});

const activePool = computed(() => {
  return pools.value.find(p => p.poolID === selectedPoolID.value) || null;
});

const formatFullName = (p: { vNaam?: string | null; tNaam?: string | null; aNaam?: string | null }) => {
  const given = [p.vNaam, p.tNaam].filter(Boolean).join(' ');
  return given ? `${given} ${p.aNaam}` : (p.aNaam || '-');
};

// Alle adressen gesorteerd voor de dropdown
const sortedAddresses = computed(() => {
  return [...allAddresses.value].sort((a, b) => (a.aNaam || '').localeCompare(b.aNaam || ''));
});

const toggleParticipantSort = (key: 'ploegnaam' | 'naam') => {
  if (participantSort.value?.key !== key) {
    participantSort.value = { key, direction: 'asc' };
    return;
  }

  participantSort.value = participantSort.value.direction === 'asc'
    ? { key, direction: 'desc' }
    : null;
};

const participantSortIcon = (key: 'ploegnaam' | 'naam') => {
  if (participantSort.value?.key !== key) return ArrowUpDown;
  return participantSort.value.direction === 'asc' ? ArrowUp : ArrowDown;
};

const printableParticipantPages = computed(() => {
  const sortedParticipants = [...participants.value].sort((a, b) =>
    (a.ploegnaam || '').localeCompare(b.ploegnaam || '', 'nl', { sensitivity: 'base' })
  );
  const pages: Participant[][] = [];
  const participantsPerPage = 12;
  for (let index = 0; index < sortedParticipants.length; index += participantsPerPage) {
    pages.push(sortedParticipants.slice(index, index + participantsPerPage));
  }
  return pages;
});

const lastStageNumber = computed(() => stages.value.at(-1)?.etappeNr ?? null);
const afterLastStageNumber = computed(() => (lastStageNumber.value ?? 0) + 1);

// Volgende etappe = eerste etappe zonder ingevoerde uitslag.
const nextStageNumber = computed(() => {
  const nextStage = stages.value.find(stage => !stagesWithResults.value.has(stage.etappeNr ?? 0));
  if (nextStage) return nextStage.etappeNr ?? null;
  return stages.value.length > 0 ? afterLastStageNumber.value : null;
});

const printStage = computed(() => stages.value.find(stage => stage.etappeNr === printStageNumber.value) || null);

const printStageTitle = computed(() => {
  if (printStageNumber.value == null) return 'Deelnemersploegen';
  if (!printStage.value) return `Deelnemersploegen na etappe ${lastStageNumber.value}`;

  const details = [
    printStage.value.datum
      ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long' }).format(new Date(printStage.value.datum))
      : null,
    [printStage.value.Start, printStage.value.Finish].filter(Boolean).join(' – ') || null
  ].filter(Boolean).join(', ');
  return `Deelnemersploegen vóór etappe ${printStageNumber.value}${details ? ` (${details})` : ''}`;
});

const isRiderOutBeforePrintStage = (rider: ParticipantRiderItem) =>
  rider.nietGestartEtappe != null && printStageNumber.value != null && rider.nietGestartEtappe <= printStageNumber.value;

const participantRidersForPrint = (deelnID: number) => {
  const sortedRiders = [...(participantRidersMap.value[deelnID] || [])].sort((a, b) => a.positie - b.positie);
  const activeRiders = sortedRiders.filter(rider => !isRiderOutBeforePrintStage(rider));
  const droppedRiders = sortedRiders
    .filter(isRiderOutBeforePrintStage)
    .sort((a, b) => (a.nietGestartEtappe ?? 0) - (b.nietGestartEtappe ?? 0) || a.positie - b.positie);

  return [
    ...activeRiders.map((rider, index) => ({
      ...rider,
      printPlace: index < targetRiderCount.value ? String(index + 1) : `R${index - targetRiderCount.value + 1}`,
      printDropped: false
    })),
    ...droppedRiders.map(rider => ({ ...rider, printPlace: '-', printDropped: true }))
  ];
};

const printRiderName = (rider: { anaam?: string | null; vnaam?: string | null; tnaam?: string | null }) => {
  const lastName = rider.anaam?.trim() || '';
  const firstNames = [rider.vnaam?.trim(), rider.tnaam?.trim()].filter(Boolean).join(' ');
  return [lastName, firstNames].filter(Boolean).join(', ') || '—';
};

const printParticipantRosters = async () => {
  if (!activePool.value || participants.value.length === 0) return;

  await loadPrintFonts();

  const originalTitle = document.title;
  const stageSuffix = printStageNumber.value == null
    ? ''
    : printStage.value ? ` voor etappe ${printStageNumber.value}` : ` na etappe ${lastStageNumber.value}`;
  document.title = `${activePool.value.Naam || `Pool ${activePool.value.poolID}`} - deelnemersploegen${stageSuffix}`;
  window.addEventListener('afterprint', () => {
    document.title = originalTitle;
  }, { once: true });
  window.print();
};


// Gefilterde deelnemers
const filteredParticipants = computed(() => {
  let list = [...participants.value];

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(p => 
      (p.aNaam && p.aNaam.toLowerCase().includes(q)) ||
      (p.vNaam && p.vNaam.toLowerCase().includes(q)) ||
      (p.ploegnaam && p.ploegnaam.toLowerCase().includes(q)) ||
      (p.plaats && p.plaats.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q))
    );
  }

  if (filterPaidStatus.value === 'paid') {
    list = list.filter(p => !!p.Betaald);
  } else if (filterPaidStatus.value === 'unpaid') {
    list = list.filter(p => !p.Betaald);
  }

  if (participantSort.value) {
    const { key, direction } = participantSort.value;
    list.sort((a, b) => {
      const aValue = key === 'ploegnaam' ? (a.ploegnaam || '') : formatFullName(a);
      const bValue = key === 'ploegnaam' ? (b.ploegnaam || '') : formatFullName(b);
      const comparison = aValue.localeCompare(bValue, 'nl', { sensitivity: 'base' });
      return direction === 'asc' ? comparison : -comparison;
    });
  }

  return list;
});

const participantColumns = computed(() => {
  const midpoint = Math.ceil(filteredParticipants.value.length / 2);
  return [
    filteredParticipants.value.slice(0, midpoint),
    filteredParticipants.value.slice(midpoint)
  ];
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

// --- RENNERS SELECTIE HELPER FUNCTIES ---

const filteredAvailableRidersForAdd = computed(() => {
  const chosenIds = new Set(addForm.value.selectedRiders.map(r => r.rennerID));
  let list = tourRiders.value.filter(r => !chosenIds.has(r.rennerID));

  if (riderSearchQuery.value.trim()) {
    const q = riderSearchQuery.value.toLowerCase().trim();
    list = list.filter(r => 
      r.anaam.toLowerCase().includes(q) ||
      (r.vnaam && r.vnaam.toLowerCase().includes(q)) ||
      (r.ploegNaam && r.ploegNaam.toLowerCase().includes(q)) ||
      (r.ploegCode && r.ploegCode.toLowerCase().includes(q)) ||
      String(r.Rugnummer).includes(q)
    );
  }
  return list.sort((a, b) => {
    const lastNameOrder = a.anaam.localeCompare(b.anaam, 'nl', { sensitivity: 'base' });
    return lastNameOrder || (a.vnaam || '').localeCompare(b.vnaam || '', 'nl', { sensitivity: 'base' });
  });
});

const addRiderToAddForm = (r: TourRider) => {
  if (addForm.value.selectedRiders.length >= maxTotalRiders.value) {
    alert(`Het maximum aantal renners (${maxTotalRiders.value}) is bereikt.`);
    return;
  }
  addForm.value.selectedRiders = sortSelectedRiders([...addForm.value.selectedRiders, {
    rennerID: r.rennerID,
    positie: addForm.value.selectedRiders.length + 1
  }], 1);
};

const removeRiderFromAddForm = (rennerID: number) => {
  addForm.value.selectedRiders = sortSelectedRiders(
    addForm.value.selectedRiders.filter(r => r.rennerID !== rennerID),
    1
  );
};

// Drag handlers for Add Form
const onAddRiderDragStart = (e: DragEvent, idx: number) => {
  addRiderDragIdx.value = idx;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }
};

const onAddRiderDragOver = (e: DragEvent, idx: number) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  addRiderDragOverIdx.value = idx;
};

const onAddRiderDragLeave = (_e: DragEvent, idx: number) => {
  if (addRiderDragOverIdx.value === idx) addRiderDragOverIdx.value = null;
};

const onAddRiderDrop = (dropIdx: number) => {
  if (addRiderDragIdx.value === null || addRiderDragIdx.value === dropIdx) {
    addRiderDragIdx.value = null;
    addRiderDragOverIdx.value = null;
    return;
  }

  const list = [...addForm.value.selectedRiders];
  const [dragged] = list.splice(addRiderDragIdx.value, 1);
  list.splice(dropIdx, 0, dragged);

  // Eerst de nieuwe handmatige volgorde vastleggen, daarna uitvallers onderaan houden.
  addForm.value.selectedRiders = sortSelectedRiders(
    list.map((r, index) => ({ ...r, positie: index + 1 })),
    1
  );
  addRiderDragIdx.value = null;
  addRiderDragOverIdx.value = null;
};

const onAddRiderDragEnd = () => {
  addRiderDragIdx.value = null;
  addRiderDragOverIdx.value = null;
};

const getRiderDetails = (rennerID: number) => {
  return tourRiders.value.find(r => r.rennerID === rennerID);
};

const isRiderOutAtSelectedStage = (rennerID: number) => {
  const dropoutStage = getRiderDetails(rennerID)?.nietGestartEtappe;
  return dropoutStage != null && selectedStageNumber.value != null && dropoutStage <= selectedStageNumber.value;
};

const sortSelectedRiders = (
  riders: Array<{ rennerID: number; positie: number }>,
  stageNumber = selectedStageNumber.value
) => {
  return [...riders]
    .sort((a, b) => {
      const aDropoutStage = getRiderDetails(a.rennerID)?.nietGestartEtappe;
      const bDropoutStage = getRiderDetails(b.rennerID)?.nietGestartEtappe;
      const aOut = aDropoutStage != null && stageNumber != null && aDropoutStage <= stageNumber;
      const bOut = bDropoutStage != null && stageNumber != null && bDropoutStage <= stageNumber;
      if (aOut !== bOut) return Number(aOut) - Number(bOut);

      if (aOut && bOut) {
        return (aDropoutStage ?? Number.MAX_SAFE_INTEGER) - (bDropoutStage ?? Number.MAX_SAFE_INTEGER) || a.positie - b.positie;
      }

      return a.positie - b.positie;
    })
    .map((rider, index) => ({ ...rider, positie: index + 1 }));
};

// --- MODALS OPENEN & SLUITEN ---

const openAddModal = () => {
  addForm.value = {
    adrID: sortedAddresses.value[0]?.adrID || null,
    ploegnaam: '',
    Betaald: false,
    selectedRiders: []
  };
  riderSearchQuery.value = '';
  addModalOpen.value = true;
};

const openAddAddressModal = () => {
  newAddressForm.value = {
    vNaam: '',
    tNaam: '',
    aNaam: '',
    plaats: '',
    tel: '',
    email: ''
  };
  addAddressModalOpen.value = true;
};

const addAddress = async () => {
  const form = newAddressForm.value;
  const aNaam = form.aNaam.trim();
  if (!aNaam) {
    alert('Vul minimaal een achternaam in.');
    return;
  }

  const address: Omit<Address, 'adrID'> = {
    vNaam: form.vNaam.trim() || null,
    tNaam: form.tNaam.trim() || null,
    aNaam,
    plaats: form.plaats.trim() || null,
    tel: form.tel.trim() || null,
    email: form.email.trim() || null
  };

  savingNewAddress.value = true;
  try {
    const savedAddress = await apiFetch<Address>('/addresses', {
      method: 'POST',
      body: JSON.stringify(address)
    });
    allAddresses.value = [...allAddresses.value, savedAddress];
    addForm.value.adrID = savedAddress.adrID;
    addAddressModalOpen.value = false;
  } catch (err) {
    alert(`Fout bij toevoegen adres: ${err instanceof Error ? err.message : err}`);
  } finally {
    savingNewAddress.value = false;
  }
};

const addParticipant = async () => {
  if (!selectedPoolID.value || !addForm.value.adrID) {
    alert('Selecteer een adres uit het adresboek.');
    return;
  }

  const trimmedPloegnaam = addForm.value.ploegnaam.trim();

  const duplicate = trimmedPloegnaam
    ? participants.value.find(
      p => p.adrID === addForm.value.adrID && (p.ploegnaam || '').trim().toLowerCase() === trimmedPloegnaam.toLowerCase()
    )
    : undefined;
  if (duplicate) {
    alert(`Dit adres doet al mee onder de ploegnaam "${duplicate.ploegnaam}". Kies een andere ploegnaam voor de extra deelname (bijv. "${trimmedPloegnaam} 2").`);
    return;
  }

  try {
    await apiFetch('/participants', {
      method: 'POST',
      body: JSON.stringify({
        poolID: selectedPoolID.value,
        adrID: Number(addForm.value.adrID),
        ploegnaam: trimmedPloegnaam || null,
        Betaald: addForm.value.Betaald ? 1 : 0,
        riders: addForm.value.selectedRiders
      })
    });
    addModalOpen.value = false;
    await fetchPoolData();
  } catch (err) {
    alert(`Fout bij toevoegen deelnemer: ${err instanceof Error ? err.message : err}`);
  }
};

// --- PLOEGOPSTELLING BEHEREN VAN BESTAANDE DEELNEMER ---
const openManageRidersModal = (p: Participant) => {
  managingParticipant.value = p;
  const current = participantRidersMap.value[p.deelnID] || [];
  managingSelectedRiders.value = sortSelectedRiders(
    current.map(r => ({ rennerID: r.rennerID, positie: r.positie })),
    1
  );
  riderSearchQuery.value = '';
  manageRidersModalOpen.value = true;
};

const filteredAvailableRidersForManage = computed(() => {
  const chosenIds = new Set(managingSelectedRiders.value.map(r => r.rennerID));
  let list = tourRiders.value.filter(r => !chosenIds.has(r.rennerID));

  if (riderSearchQuery.value.trim()) {
    const q = riderSearchQuery.value.toLowerCase().trim();
    list = list.filter(r => 
      r.anaam.toLowerCase().includes(q) || 
      (r.vnaam && r.vnaam.toLowerCase().includes(q)) || 
      (r.ploegNaam && r.ploegNaam.toLowerCase().includes(q)) || 
      (r.ploegCode && r.ploegCode.toLowerCase().includes(q)) || 
      String(r.Rugnummer).includes(q)
    );
  }
  return list.sort((a, b) => {
    const lastNameOrder = a.anaam.localeCompare(b.anaam, 'nl', { sensitivity: 'base' });
    return lastNameOrder || (a.vnaam || '').localeCompare(b.vnaam || '', 'nl', { sensitivity: 'base' });
  });
});

const addRiderToManaging = (r: TourRider) => {
  if (managingSelectedRiders.value.length >= maxTotalRiders.value) {
    alert(`Het maximum aantal renners (${maxTotalRiders.value}) is bereikt.`);
    return;
  }
  managingSelectedRiders.value = sortSelectedRiders([...managingSelectedRiders.value, {
    rennerID: r.rennerID,
    positie: managingSelectedRiders.value.length + 1
  }], 1);
};

const removeRiderFromManaging = (rennerID: number) => {
  managingSelectedRiders.value = sortSelectedRiders(
    managingSelectedRiders.value.filter(r => r.rennerID !== rennerID),
    1
  );
};

// Drag handlers for Manage Modal
const onManageRiderDragStart = (e: DragEvent, idx: number) => {
  manageRiderDragIdx.value = idx;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }
};

const onManageRiderDragOver = (e: DragEvent, idx: number) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  manageRiderDragOverIdx.value = idx;
};

const onManageRiderDragLeave = (_e: DragEvent, idx: number) => {
  if (manageRiderDragOverIdx.value === idx) manageRiderDragOverIdx.value = null;
};

const onManageRiderDrop = (dropIdx: number) => {
  if (manageRiderDragIdx.value === null || manageRiderDragIdx.value === dropIdx) {
    manageRiderDragIdx.value = null;
    manageRiderDragOverIdx.value = null;
    return;
  }

  const list = [...managingSelectedRiders.value];
  const [dragged] = list.splice(manageRiderDragIdx.value, 1);
  list.splice(dropIdx, 0, dragged);

  // Eerst de nieuwe handmatige volgorde vastleggen, daarna uitvallers onderaan houden.
  managingSelectedRiders.value = sortSelectedRiders(
    list.map((r, index) => ({ ...r, positie: index + 1 })),
    1
  );
  manageRiderDragIdx.value = null;
  manageRiderDragOverIdx.value = null;
};

const onManageRiderDragEnd = () => {
  manageRiderDragIdx.value = null;
  manageRiderDragOverIdx.value = null;
};

const saveManagingRiders = async () => {
  if (!managingParticipant.value) return;
  savingRiders.value = true;
  try {
    await apiFetch(`/participant-riders/batch/${managingParticipant.value.deelnID}`, {
      method: 'PUT',
      body: JSON.stringify({
        riders: managingSelectedRiders.value
      })
    });
    manageRidersModalOpen.value = false;
    await fetchPoolData();
  } catch (err) {
    alert(`Fout bij opslaan van de ploegopstelling: ${err instanceof Error ? err.message : err}`);
  } finally {
    savingRiders.value = false;
  }
};

// Deelnemer bewerken
const openEditModal = async (p: Participant) => {
  editingParticipant.value = { ...p, Betaald: !!p.Betaald };
  selectedAccountID.value = null;
  userAccounts.value = [];
  accountError.value = '';
  editModalOpen.value = true;
  loadingAccounts.value = true;
  try {
    userAccounts.value = await apiFetch<UserAccount[]>('/accounts');
    selectedAccountID.value = userAccounts.value.find(account => account.adrID === p.adrID)?.accountID ?? null;
  } catch (error) { accountError.value = `Accounts laden mislukt: ${error instanceof Error ? error.message : String(error)}`; }
  finally { loadingAccounts.value = false; }
};

const linkAccount = async () => {
  const participant = editingParticipant.value;
  const account = userAccounts.value.find(item => item.accountID === selectedAccountID.value);
  if (!participant || !account) {
    accountError.value = 'Kies eerst een gebruikersaccount.';
    return;
  }
  if (!confirm(`Deze inschrijving koppelen aan ${account.email}? Dit account krijgt toegang tot de ploeg. De persoonsgegevens komen voortaan uit dat account. Andere inschrijvingen blijven ongewijzigd. Niet-opgeslagen wijzigingen in dit formulier worden niet meegenomen.`)) return;
  linkingAccount.value = true;
  accountError.value = '';
  try {
    await apiFetch(`/participants/${participant.deelnID}/account`, {
      method: 'PUT',
      body: JSON.stringify({ accountID: account.accountID, expectedAdrID: participant.adrID })
    });
    editModalOpen.value = false;
    await fetchInitialData();
  } catch (error) { accountError.value = `Koppelen mislukt: ${error instanceof Error ? error.message : String(error)}`; }
  finally { linkingAccount.value = false; }
};

const saveParticipant = async () => {
  if (!editingParticipant.value) return;

  const trimmedPloegnaam = (editingParticipant.value.ploegnaam || '').trim();
  if (!trimmedPloegnaam) {
    alert('Vul een ploegnaam in.');
    return;
  }

  const duplicate = participants.value.find(
    p => p.deelnID !== editingParticipant.value!.deelnID &&
         p.adrID === editingParticipant.value!.adrID &&
         (p.ploegnaam || '').trim().toLowerCase() === trimmedPloegnaam.toLowerCase()
  );
  if (duplicate) {
    alert(`Dit adres heeft al een deelname met de ploegnaam "${duplicate.ploegnaam}". Kies een andere ploegnaam.`);
    return;
  }

  try {
    await apiFetch(`/participants/${editingParticipant.value.deelnID}`, {
      method: 'PUT',
      body: JSON.stringify({
        ploegnaam: trimmedPloegnaam,
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
  <div class="space-y-2">
    <!-- Header -->
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900">Deelnemers</h2>
        <p class="text-xs text-slate-500">Kies uit het adresboek en stel hun rennersploeg samen</p>
      </div>

      <!-- Knoppen rechts -->
      <div class="flex items-center gap-3">
        <label
          v-if="stages.length > 0"
          class="shadow-xs flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
          title="Ploegen afdrukken zoals ze gelden vóór deze etappe (uitvallers tot en met deze etappe staan onderaan)"
        >
          <span>Vóór</span>
          <select
            v-model.number="printStageNumber"
            class="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-sm font-semibold text-slate-800 focus:border-amber-500 focus:outline-none"
          >
            <option v-for="stage in stages" :key="stage.etappeNr ?? 0" :value="stage.etappeNr">
              Etappe {{ stage.etappeNr }}{{ stage.etappeNr === nextStageNumber ? ' (volgende)' : '' }}
            </option>
            <option :value="afterLastStageNumber">
              Na laatste etappe{{ afterLastStageNumber === nextStageNumber ? ' (volgende)' : '' }}
            </option>
          </select>
        </label>
        <button
          @click="printParticipantRosters"
          :disabled="loading || participants.length === 0"
          class="shadow-xs flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          title="Deelnemers en renners als PDF afdrukken"
        >
          <Printer class="h-4 w-4" />
          <span>PDF ploegen</span>
        </button>
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
          class="shadow-xs flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus class="h-4 w-4" />
          <span>Deelnemer toevoegen</span>
        </button>
      </div>
    </div>

    <!-- Active Pool Summary Banner -->
    <div v-if="activePool" class="shadow-xs grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-4">
      <div class="space-y-1 border-r-0 border-slate-100 pr-4 md:col-span-1 md:border-r">
        <h3 class="mt-1 text-base font-bold text-slate-900">{{ activePool.Naam }}</h3>
        <p class="text-xs text-slate-500">Ploeggrootte: <strong class="font-mono font-bold text-amber-700">{{ targetRiderCount }} renners</strong> <span v-if="targetReserveCount > 0">(+ {{ targetReserveCount }} reserves)</span></p>
      </div>

      <div class="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 p-3">
        <div>
          <span class="text-xs font-medium text-slate-500">Deelnemers</span>
          <div class="mt-0.5 font-mono text-2xl font-bold text-slate-900">{{ participants.length }}</div>
        </div>
        <div class="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-700">
          <UserCheck class="h-5 w-5" />
        </div>
      </div>

      <div class="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 p-3">
        <div>
          <span class="text-xs font-medium text-slate-500">Betaald / Onbetaald</span>
          <div class="mt-0.5 font-mono text-lg font-bold text-slate-900">
            <span class="text-emerald-600">{{ paidCount }}</span>
            <span class="font-normal text-slate-400"> / </span>
            <span class="text-amber-600">{{ unpaidCount }}</span>
          </div>
        </div>
        <div class="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-700">
          <CreditCard class="h-5 w-5" />
        </div>
      </div>

      <div class="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 p-3">
        <div>
          <span class="text-xs font-medium text-slate-500">Inleg (€{{ inlegBedrag }}/deelnemer)</span>
          <div class="mt-0.5 font-mono text-lg font-bold text-slate-900">
            <span class="text-emerald-700">€{{ totalInlegCollected }}</span>
            <span class="text-xs font-normal text-slate-400"> / €{{ totalInlegExpected }}</span>
          </div>
        </div>
        <div class="rounded-lg border border-indigo-200 bg-indigo-50 p-2.5 text-indigo-700">
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
          placeholder="Zoek op naam, ploegnaam, plaats of e-mail..."
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
      <div v-if="loading && participants.length === 0" class="px-2 py-8 text-center text-slate-400">
        Deelnemers laden...
      </div>
      <div v-else-if="filteredParticipants.length === 0" class="px-2 py-8 text-center text-slate-400">
        Geen deelnemers gevonden voor deze selectie.
      </div>
      <div v-else class="grid grid-cols-1 gap-x-6 divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0">
        <div v-for="(column, columnIndex) in participantColumns" :key="columnIndex" class="col-span-1 min-w-0">
          <div class="participant-header-fields grid grid-cols-6 border-b border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:px-2">
            <button @click="toggleParticipantSort('ploegnaam')" class="flex items-center gap-0.5 text-left hover:text-slate-800" title="Sorteer op ploegnaam">Ploegnaam <component :is="participantSortIcon('ploegnaam')" class="h-3 w-3" /></button>
            <button @click="toggleParticipantSort('naam')" class="flex items-center gap-0.5 text-left hover:text-slate-800" title="Sorteer op naam">Naam <component :is="participantSortIcon('naam')" class="h-3 w-3" /></button>
            <span>Renners</span>
            <span>Contact</span>
            <span>Status</span>
            <span>Acties</span>
          </div>
          <div
            v-for="p in column"
            :key="p.deelnID"
            class="participant-fields grid grid-cols-6 gap-x-1 border-b border-slate-100 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-50/80 md:px-2"
          >
          <!-- Ploegnaam -->
          <div class="min-w-0" title="Ploegnaam">
            <span v-if="p.ploegnaam" class="block truncate rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-xs font-semibold text-amber-800">
              {{ p.ploegnaam }}
            </span>
            <span v-else class="text-xs italic text-slate-400">-</span>
          </div>

          <!-- Naam -->
          <div class="min-w-0" title="Naam">
            <div class="truncate text-xs font-semibold text-slate-900">{{ formatFullName(p) }}</div>
          </div>

          <!-- Opstelling -->
          <div class="min-w-0" title="Opstelling (renners)">
            <button
              @click="openManageRidersModal(p)"
              class="flex max-w-full cursor-pointer items-center gap-1 rounded-lg border px-1.5 py-0.5 text-xs font-semibold transition"
              :class="[
                (participantRidersMap[p.deelnID]?.length || 0) >= maxTotalRiders
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : (participantRidersMap[p.deelnID]?.length || 0) > 0
                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              ]"
              title="Klik om rennersopstelling te bekijken of te wijzigen"
            >
              <Bike class="h-3 w-3" />
              <span>{{ participantRidersMap[p.deelnID]?.length || 0 }}/{{ maxTotalRiders }}</span>
            </button>
          </div>

          <!-- Contact -->
          <div class="min-w-0" title="Contact">
            <div v-if="p.email" class="flex min-w-0 items-center gap-1 text-[11px] text-slate-600">
              <Mail class="h-3 w-3 shrink-0 text-slate-400" />
              <a :href="`mailto:${p.email}`" class="truncate text-xs text-amber-700 hover:underline">{{ p.email }}</a>
            </div>
            <span v-else class="text-xs text-slate-400">-</span>
          </div>

          <!-- Betaalstatus -->
          <div class="min-w-0" title="Betaalstatus">
            <button
              @click="togglePaid(p)"
              class="shadow-2xs flex max-w-full cursor-pointer items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-semibold transition"
              :class="[
                p.Betaald
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
              ]"
              title="Klik om status te wijzigen"
            >
              <span class="h-1.5 w-1.5 rounded-full" :class="p.Betaald ? 'bg-emerald-500' : 'bg-amber-500'"></span>
              <span class="truncate">{{ p.Betaald ? 'Betaald' : 'Open' }}</span>
            </button>
          </div>

          <!-- Acties -->
          <div class="min-w-0" title="Acties">
            <div class="flex items-center gap-1">
            <button
              @click="openEditModal(p)"
              class="rounded p-0.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              title="Bewerken"
            >
              <Edit2 class="h-3.5 w-3.5" />
            </button>
            <button
              @click="deleteParticipant(p)"
              class="rounded p-0.5 text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
              title="Verwijderen uit pool"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
            </div>
          </div>
          </div>
        </div>
      </div>

      <!-- Footer count -->
      <div class="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
        <span>Totaal <strong>{{ filteredParticipants.length }}</strong> van de <strong>{{ participants.length }}</strong> deelnemers getoond</span>
        <span class="text-slate-400">Klik op de rennersbadge om opstellingen direct te beheren</span>
      </div>
    </div>

    <!-- Modal: Deelnemer Toevoegen aan Pool (inclusief rennersselectie) -->
    <div v-if="addModalOpen" class="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="flex max-h-[90vh] w-full max-w-3xl flex-col space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div class="flex shrink-0 items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h3 class="text-lg font-bold text-slate-900">Deelnemer & Renners toevoegen</h3>
            <p class="text-xs text-slate-500">{{ activePool?.Naam }} • Doel: {{ targetRiderCount }} renners <span v-if="targetReserveCount > 0">(+ {{ targetReserveCount }} reserves)</span></p>
          </div>
          <button @click="addModalOpen = false" class="text-slate-400 hover:text-slate-700"><X class="h-5 w-5" /></button>
        </div>

        <div class="flex-1 space-y-4 overflow-y-auto pr-1">
          <!-- Basisgegevens -->
          <div class="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Selecteer adres uit adresboek *</label>
              <div class="flex gap-2">
                <select
                  v-model="addForm.adrID"
                  class="shadow-2xs min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none"
                >
                  <option :value="null" disabled>Kies een persoon...</option>
                  <option v-for="a in sortedAddresses" :key="a.adrID" :value="a.adrID">
                    {{ formatFullName(a) }} {{ a.plaats ? `(${a.plaats})` : '' }}
                  </option>
                </select>
                <button
                  type="button"
                  @click="openAddAddressModal"
                  class="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <Plus class="h-4 w-4" />
                  Nieuw adres
                </button>
              </div>
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Ploegnaam in pool (optioneel)</label>
              <input 
                v-model="addForm.ploegnaam"
                class="shadow-2xs w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none" 
                placeholder="bv. Ploeg Jansen" 
              />
            </div>

            <div class="flex items-center gap-2 pt-1 sm:col-span-2">
              <input 
                id="add-betaald" 
                v-model="addForm.Betaald" 
                type="checkbox" 
                class="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
              />
              <label for="add-betaald" class="cursor-pointer text-xs font-semibold text-slate-700">
                Inleg is direct voldaan (€{{ inlegBedrag }})
              </label>
            </div>
          </div>

          <!-- Rennerskiezer Section -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold uppercase tracking-wider text-slate-500">
                Geselecteerde renners ({{ addForm.selectedRiders.length }} / {{ maxTotalRiders }})
              </label>
              <span 
                class="rounded-full border px-2 py-0.5 text-xs font-semibold"
                :class="addForm.selectedRiders.length >= targetRiderCount ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'"
              >
                {{ addForm.selectedRiders.length }} van de {{ targetRiderCount }} basisrenners
              </span>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <!-- Beschikbare renners -->
              <div class="flex h-[min(70vh,42rem)] flex-col rounded-xl border border-slate-200 bg-white p-3">
                <div class="relative mb-2 shrink-0">
                  <Search class="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input 
                    v-model="riderSearchQuery" 
                    placeholder="Zoek in tour-renners..." 
                    class="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div class="flex-1 divide-y divide-slate-100 overflow-y-auto">
                  <div 
                    v-for="r in filteredAvailableRidersForAdd" 
                    :key="r.rennerID"
                    class="group flex items-center justify-between rounded px-1 py-1.5 text-xs transition hover:bg-slate-50"
                  >
                    <div class="min-w-0 flex-1 pr-2">
                      <strong class="font-semibold text-slate-900">{{ r.anaam }}</strong>, {{ r.vnaam || '' }}
                      <span v-if="r.rennerLand" class="ml-1 text-slate-500">({{ r.rennerLand }})</span>
                      <span v-if="r.ploegCode" class="ml-1 font-mono text-[10px] text-amber-700">[{{ r.ploegCode }}]</span>
                      <span v-if="r.Rugnummer" class="ml-1 text-slate-500">{{ r.Rugnummer }}</span>
                    </div>
                    <button 
                      @click="addRiderToAddForm(r)"
                      class="shrink-0 rounded bg-slate-100 p-1 text-slate-600 transition group-hover:bg-amber-500 group-hover:text-slate-950"
                      title="Toevoegen"
                    >
                      <Plus class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Gekozen renners -->
              <div class="flex h-[min(70vh,42rem)] flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <div class="mb-2 flex shrink-0 items-center justify-between border-b border-slate-200 pb-1 text-xs font-semibold text-slate-700">
                  <span>Opstelling ({{ addForm.selectedRiders.length }})</span>
                  <span class="text-[10px] text-slate-400">1..{{ targetRiderCount }} basis, daarna reserves</span>
                </div>
                <div v-if="addForm.selectedRiders.length === 0" class="flex flex-1 flex-col items-center justify-center text-xs text-slate-400">
                  <Bike class="mb-1 h-6 w-6 text-slate-300" />
                  <span>Klik links op '+' om renners te kiezen</span>
                </div>
                <div v-else class="flex-1 divide-y divide-slate-200/60 overflow-y-auto pr-1">
                  <div 
                    v-for="(item, idx) in addForm.selectedRiders" 
                    :key="item.rennerID"
                    draggable="true"
                    @dragstart="onAddRiderDragStart($event, idx)"
                    @dragover="onAddRiderDragOver($event, idx)"
                    @dragleave="onAddRiderDragLeave($event, idx)"
                    @drop="onAddRiderDrop(idx)"
                    @dragend="onAddRiderDragEnd"
                    class="my-0.5 flex cursor-grab items-center justify-between rounded border bg-white px-1.5 py-1.5 text-xs transition active:cursor-grabbing"
                    :style="idx >= targetRiderCount ? { backgroundColor: '#f1f5f9' } : undefined"
                    :class="[
                      addRiderDragIdx === idx ? 'opacity-40 border-dashed border-amber-400 bg-amber-50/50' : '',
                      addRiderDragOverIdx === idx && addRiderDragIdx !== idx ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400/50 scale-[1.01]' : 'border-slate-200/70 hover:border-slate-300'
                    ]"
                  >
                    <div class="flex min-w-0 flex-1 items-center gap-1.5 pr-1">
                      <GripVertical class="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span 
                        class="w-6 shrink-0 rounded px-1 py-0.5 text-center font-mono text-[10px] font-bold"
                        :class="isRiderOutAtSelectedStage(item.rennerID) ? 'bg-rose-100 text-rose-700' : idx < targetRiderCount ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'"
                      >
                        {{ isRiderOutAtSelectedStage(item.rennerID) ? 'X' : idx < targetRiderCount ? idx + 1 : `R${idx + 1 - targetRiderCount}` }}
                      </span>
                      <span class="truncate font-medium text-slate-800">
                        {{ getRiderDetails(item.rennerID)?.anaam }}, {{ getRiderDetails(item.rennerID)?.vnaam }}
                      </span>
                      <span v-if="getRiderDetails(item.rennerID)?.rennerLand" class="text-slate-500">
                        ({{ getRiderDetails(item.rennerID)?.rennerLand }})
                      </span>
                      <span v-if="getRiderDetails(item.rennerID)?.Rugnummer" class="text-slate-500">
                        nr. {{ getRiderDetails(item.rennerID)?.Rugnummer }}
                      </span>
                      <span v-if="isRiderOutAtSelectedStage(item.rennerID)" class="font-semibold text-rose-600">
                        niet gestart in {{ getRiderDetails(item.rennerID)?.nietGestartEtappe }}
                      </span>
                    </div>
                    <button 
                      @click="removeRiderFromAddForm(item.rennerID)"
                      class="rounded p-1 text-slate-400 hover:text-rose-600"
                      title="Verwijderen"
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex shrink-0 justify-end gap-3 border-t border-slate-200 pt-4">
          <button @click="addModalOpen = false" class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">Annuleren</button>
          <button @click="addParticipant" class="shadow-xs rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">Deelnemer Opslaan</button>
        </div>
      </div>
    </div>

    <!-- Modal: Ploegopstelling van bestaande deelnemer beheren -->
    <div v-if="manageRidersModalOpen && managingParticipant" class="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="flex max-h-[90vh] w-full max-w-3xl flex-col space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div class="flex shrink-0 items-center justify-between border-b border-slate-200 pb-4">
          <>
            <h3 class="text-lg font-bold text-slate-900">Ploegopstelling {{ managingParticipant.ploegnaam }}</h3>
            <p class="text-xs text-slate-500"></p>
            <label class="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
              <span>Opstelling t/m etappe:</span>
              <select
                v-model.number="selectedStageNumber"
                class="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:border-amber-500 focus:outline-none"
              >
                <option v-for="stage in stages" :key="stage.etappeNr ?? 0" :value="stage.etappeNr">
                  Etappe {{ stage.etappeNr }}
                </option>
              </select>
            </label>
            </
          </div>
          <button @click="manageRidersModalOpen = false" class="text-slate-400 hover:text-slate-700"><X class="h-5 w-5" /></button>
        </div>

        <div class="flex-1 space-y-4 overflow-y-auto pr-1">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <!-- Beschikbare renners -->
            <div class="flex h-[min(70vh,42rem)] flex-col rounded-xl border border-slate-200 bg-white p-3">
              <div class="relative mb-2 shrink-0">
                <Search class="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input 
                  v-model="riderSearchQuery" 
                  placeholder="Zoek in tour-renners..." 
                  class="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:bg-white focus:outline-none"
                />
              </div>
              <div class="flex-1 divide-y divide-slate-100 overflow-y-auto">
                <div 
                  v-for="r in filteredAvailableRidersForManage" 
                  :key="r.rennerID"
                  class="group flex items-center justify-between rounded px-1 py-1.5 text-xs transition hover:bg-slate-50"
                >
                  <div class="min-w-0 flex-1 pr-2">
                    <strong class="font-semibold text-slate-900">{{ r.anaam }}</strong>, {{ r.vnaam || '' }}
                    <span v-if="r.rennerLand" class="ml-1 text-slate-500">({{ r.rennerLand }})</span>
                    <span v-if="r.ploegCode" class="ml-1 font-mono text-[10px] text-amber-700">[{{ r.ploegCode }}]</span>
                    <span v-if="r.Rugnummer" class="ml-1 text-slate-500">{{ r.Rugnummer }}</span>
                  </div>
                  <button 
                    @click="addRiderToManaging(r)"
                    class="shrink-0 rounded bg-slate-100 p-1 text-slate-600 transition group-hover:bg-amber-500 group-hover:text-slate-950"
                    title="Toevoegen"
                  >
                    <Plus class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Gekozen renners -->
            <div class="flex h-[min(70vh,42rem)] flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <div class="mb-2 flex shrink-0 items-center justify-between border-b border-slate-200 pb-1 text-xs font-semibold text-slate-700">
                <span>Geselecteerd ({{ managingSelectedRiders.length }} / {{ maxTotalRiders }})</span>
                <span 
                  class="rounded border px-2 py-0.5 text-[10px] font-semibold"
                  :class="managingSelectedRiders.length >= targetRiderCount ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'"
                >
                  {{ managingSelectedRiders.length }} / {{ targetRiderCount }} basis
                </span>
              </div>
              <div v-if="managingSelectedRiders.length === 0" class="flex flex-1 flex-col items-center justify-center text-xs text-slate-400">
                <Bike class="mb-1 h-6 w-6 text-slate-300" />
                <span>Nog geen renners gekozen</span>
              </div>
              <div v-else class="flex-1 divide-y divide-slate-200/60 overflow-y-auto pr-1">
                <div 
                  v-for="(item, idx) in managingSelectedRiders" 
                  :key="item.rennerID"
                  draggable="true"
                  @dragstart="onManageRiderDragStart($event, idx)"
                  @dragover="onManageRiderDragOver($event, idx)"
                  @dragleave="onManageRiderDragLeave($event, idx)"
                  @drop="onManageRiderDrop(idx)"
                  @dragend="onManageRiderDragEnd"
                  class="my-0.5 flex cursor-grab items-center justify-between rounded border bg-white px-1.5 py-1.5 text-xs transition active:cursor-grabbing"
                  :style="idx >= targetRiderCount ? { backgroundColor: '#f1f5f9' } : undefined"
                  :class="[
                    manageRiderDragIdx === idx ? 'opacity-40 border-dashed border-amber-400 bg-amber-50/50' : '',
                    manageRiderDragOverIdx === idx && manageRiderDragIdx !== idx ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400/50 scale-[1.01]' : 'border-slate-200/70 hover:border-slate-300'
                  ]"
                >
                  <div class="flex min-w-0 flex-1 items-center gap-1.5 pr-1">
                    <GripVertical class="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span 
                      class="w-6 shrink-0 rounded px-1 py-0.5 text-center font-mono text-[10px] font-bold"
                      :class="isRiderOutAtSelectedStage(item.rennerID) ? 'bg-rose-100 text-rose-700' : idx < targetRiderCount ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'"
                    >
                      {{ isRiderOutAtSelectedStage(item.rennerID) ? 'X' : idx < targetRiderCount ? idx + 1 : `R${idx + 1 - targetRiderCount}` }}
                    </span>
                    <span class="truncate font-medium text-slate-800">
                      {{ getRiderDetails(item.rennerID)?.anaam }}, {{ getRiderDetails(item.rennerID)?.vnaam }}
                    </span>
                    <span v-if="getRiderDetails(item.rennerID)?.rennerLand" class="text-slate-500">
                      ({{ getRiderDetails(item.rennerID)?.rennerLand }})
                    </span>
                    <span v-if="getRiderDetails(item.rennerID)?.ploegCode" class="font-mono text-[10px] text-slate-400">
                      [{{ getRiderDetails(item.rennerID)?.ploegCode }}]
                    </span>
                    <span v-if="getRiderDetails(item.rennerID)?.Rugnummer" class="text-slate-500">
{{ getRiderDetails(item.rennerID)?.Rugnummer }}
                    </span>
                    <span v-if="isRiderOutAtSelectedStage(item.rennerID)" class="font-semibold text-rose-600">{{ getRiderDetails(item.rennerID)?.nietGestartEtappe }}
                    </span>
                  </div>
                  <button 
                    @click="removeRiderFromManaging(item.rennerID)"
                    class="rounded p-1 text-slate-400 hover:text-rose-600"
                    title="Verwijderen"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex shrink-0 justify-end gap-3 border-t border-slate-200 pt-4">
          <button @click="manageRidersModalOpen = false" class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">Annuleren</button>
          <button 
            @click="saveManagingRiders" 
            :disabled="savingRiders"
            class="shadow-xs rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {{ savingRiders ? 'Opslaan...' : 'Opstelling Opslaan' }}
          </button>
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
          <button :disabled="linkingAccount" @click="editModalOpen = false" class="text-slate-400 hover:text-slate-700"><X class="h-5 w-5" /></button>
        </div>

        <fieldset :disabled="linkingAccount" class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">Ploegnaam</label>
            <input 
              v-model="editingParticipant.ploegnaam"
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
            <label for="edit-betaald" class="cursor-pointer text-sm font-semibold text-slate-700">
              Inleg is betaald (€{{ inlegBedrag }})
            </label>
          </div>
          <div class="border-t border-slate-200 pt-4">
            <label for="participant-account" class="mb-1 block text-xs font-semibold text-slate-700">Koppelen aan gebruikersaccount</label>
            <p v-if="loadingAccounts" class="text-xs text-slate-500">Accounts laden...</p>
            <select id="participant-account" v-model="selectedAccountID" :disabled="loadingAccounts" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <option :value="null">Kies een gebruikersaccount</option>
              <option v-for="account in userAccounts" :key="account.accountID" :value="account.accountID">
                {{ account.username }} — {{ [account.vNaam, account.tNaam, account.aNaam].filter(Boolean).join(' ') }} — {{ account.email }}
              </option>
            </select>
            <p class="mt-2 text-xs text-slate-500">Koppelt alleen deze inschrijving. Renners, ploegnaam en betaling blijven behouden. Het account moet al bestaan.</p>
            <p v-if="accountError" role="alert" class="mt-2 text-sm text-red-700">{{ accountError }}</p>
            <button type="button" :disabled="loadingAccounts || !selectedAccountID || userAccounts.find(account => account.accountID === selectedAccountID)?.adrID === editingParticipant.adrID" class="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50" @click="linkAccount">
              {{ linkingAccount ? 'Bezig met koppelen...' : 'Account koppelen' }}
            </button>
          </div>
        </fieldset>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button :disabled="linkingAccount" @click="editModalOpen = false" class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">Annuleren</button>
          <button :disabled="linkingAccount" @click="saveParticipant" class="shadow-xs rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">Opslaan</button>
        </div>
      </div>
    </div>

    <!-- Modal: Nieuw adres toevoegen aan het adresboek -->
    <div v-if="addAddressModalOpen" class="backdrop-blur-xs fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
      <form @submit.prevent="addAddress" class="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h3 class="text-lg font-bold text-slate-900">Nieuw adres toevoegen</h3>
            <p class="text-xs text-slate-500">Het adres wordt opgeslagen in het centrale adresboek.</p>
          </div>
          <button type="button" @click="addAddressModalOpen = false" class="text-slate-400 hover:text-slate-700">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4">
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Voornaam</label>
              <input v-model="newAddressForm.vNaam" maxlength="24" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" placeholder="Jan" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Tussenvoegsel</label>
              <input v-model="newAddressForm.tNaam" maxlength="12" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" placeholder="van" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Achternaam *</label>
              <input v-model="newAddressForm.aNaam" maxlength="24" required class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" placeholder="Jansen" />
            </div>
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">E-mailadres</label>
            <input v-model="newAddressForm.email" type="email" maxlength="64" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" placeholder="jan@example.com" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Woonplaats</label>
              <input v-model="newAddressForm.plaats" maxlength="24" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" placeholder="Amsterdam" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-700">Telefoonnummer</label>
              <input v-model="newAddressForm.tel" maxlength="12" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" placeholder="06-12345678" />
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button type="button" @click="addAddressModalOpen = false" class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">Annuleren</button>
          <button type="submit" :disabled="savingNewAddress" class="shadow-xs rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50">
            {{ savingNewAddress ? 'Opslaan...' : 'Adres opslaan' }}
          </button>
        </div>
      </form>
    </div>

  <div v-if="activePool" class="pool-print-report" aria-hidden="true">
    <article
      v-for="(page, pageIndex) in printableParticipantPages"
      :key="pageIndex"
      class="pool-print-page"
      :class="{ 'pool-print-page-last': pageIndex === printableParticipantPages.length - 1 }"
    >
      <header class="pool-print-header">
        <div class="pool-print-title">
          <strong>
            <template v-if="activePool.Org?.trim()">{{ activePool.Org.trim() }}, </template>{{ activePool.Naam || `Pool #${activePool.poolID}` }}
          </strong>
          <span>{{ printStageTitle }}</span>
        </div>
        <!-- <span>
          Tour #{{ activePool.tourID }} · {{ participants.length }} deelnemers ·
          {{ printReportDate }} · {{ pageIndex + 1 }}/{{ printableParticipantPages.length }}
        </span> -->
      </header>
      <div class="pool-print-grid">
        <section v-for="participant in page" :key="participant.deelnID" class="pool-print-participant">
          <h2>{{ participant.ploegnaam?.trim() || 'Huh?' }}</h2>
          <div class="pool-print-rider-heading">
            <span>Nr</span><span>Naam</span><span>Ploeg</span>
          </div>
          <div class="pool-print-riders">
            <div
              v-for="rider in participantRidersForPrint(participant.deelnID)"
              :key="rider.rennerID"
              class="pool-print-rider"
              :class="{ 'pool-print-rider-dropped': rider.printDropped }"
            >
              <span class="pool-print-place">{{ rider.printPlace }}</span>
              <span>{{ printRiderName(rider) }}</span>
              <span class="pool-print-code">{{ rider.printDropped ? `NG ${rider.nietGestartEtappe}` : rider.ploegCode || '—' }}</span>
            </div>
            <div v-if="participantRidersForPrint(participant.deelnID).length === 0" class="pool-print-empty">
              Geen renners geselecteerd
            </div>
          </div>
        </section>
      </div>
    </article>
  </div>
  </div>
</template>

<style>
.participant-fields,
.participant-header-fields {
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1fr) minmax(0, 0.55fr) minmax(0, 1.8fr) minmax(0, 0.65fr) minmax(0, 0.65fr);
}

.pool-print-report {
  display: none;
}

@media print {
  @page {
    size: A4 portrait;
    margin: 7mm;
  }

  html,
  body {
    margin: 0 !important;
  }

  body * {
    visibility: hidden !important;
  }

  .pool-print-report,
  .pool-print-report * {
    visibility: visible !important;
  }

  .pool-print-report {
    position: absolute;
    inset: 0;
    display: block !important;
    width: 100%;
    color: #172033;
    font-family: var(--pdf-body-font);
  }

  .pool-print-page {
    display: flex;
    width: 100%;
    height: 283mm;
    flex-direction: column;
    break-after: page;
    page-break-after: always;
  }

  .pool-print-page-last {
    break-after: auto;
    page-break-after: auto;
  }

  .pool-print-header {
    font-family: var(--pdf-heading-font);
    display: flex;
    height: 11mm;
    flex: 0 0 11mm;
    align-items: flex-end;
    justify-content: center;
    gap: 4mm;
    padding-bottom: 1mm;
    margin-bottom: 1.5mm;
    border-bottom: 0.3mm solid #64748b;
    font-size: 11pt;
  }

  .pool-print-title {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: center;
    gap: 0.5mm;
    text-align: center;
  }

  .pool-print-title span {
    font-size: 10pt;
    font-weight: 600;
  }

  .pool-print-header > span {
    flex: 0 0 auto;
  }

  .pool-print-header strong {
    font-size: 11pt;
  }

  .pool-print-grid {
    display: grid;
    min-height: 0;
    flex: 1;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-template-rows: repeat(3, minmax(0, 1fr));
    gap: 2mm;
  }

  .pool-print-participant {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
    border: 0.25mm solid #94a3b8;
  }

  .pool-print-participant h2 {
    margin: 0;
    padding: 1mm;
    background: #e2e8f0;
    font-size: 10pt;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .pool-print-rider-heading,
  .pool-print-rider {
    display: grid;
    grid-template-columns: 5mm minmax(0, 1fr) 10mm;
    gap: 0.6mm;
    align-items: center;
    padding: 0.45mm 0.7mm;
  }

  .pool-print-rider-heading {
    flex: 0 0 auto;
    background: #f8fafc;
    color: #475569;
    font-size: 6.5pt;
    font-weight: 700;
    text-transform: uppercase;
  }

  .pool-print-riders {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }

  .pool-print-rider {
    min-height: 0;
    flex: 1 1 auto;
    border-top: 0.15mm solid #e2e8f0;
    font-size: 8pt;
    line-height: 1.15;
  }

  .pool-print-rider span {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .pool-print-code {
    text-align: center;
    font-weight: 700;
  }

  .pool-print-place {
    color: #475569;
    font-weight: 700;
  }

  .pool-print-rider-dropped {
    color: #94a3b8;
  }

  .pool-print-rider-dropped span:nth-child(2) {
    text-decoration: line-through;
  }

  .pool-print-empty {
    padding: 1mm;
    color: #64748b;
    font-size: 6pt;
  }
}
</style>
