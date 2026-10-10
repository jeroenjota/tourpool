<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiFetch } from '../services/api';
import { auth } from '@tourpool/client';
import { RouterLink } from 'vue-router';
import { Plus, Trash2, Edit2, X, UserCheck, Trophy, Award, Sliders, Eye, EyeOff } from '@lucide/vue';

interface Pool {
  poolID: number;
  tourID: number;
  Naam: string;
  Org?: string | null;
  orgID?: number | null;
  orgStraat?: string | null;
  orgHuisnummer?: string | null;
  orgPostcode?: string | null;
  orgPlaats?: string | null;
  orgEmail?: string | null;
  orgTel?: string | null;
  StartInschr?: string | null;
  EindInschr?: string | null;
  visibleToUsers: boolean | number;
}

interface Organisation {
  orgID?: number;
  naam: string;
  straat: string | null;
  huisnummer: string | null;
  postcode: string | null;
  plaats: string | null;
  email: string | null;
  tel: string | null;
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

const isAdmin = computed(() => auth.account?.role === 'admin');
const pools = ref<Pool[]>([]);
const tours = ref<{ tourID: number; naam: string }[]>([]);
const loading = ref(true);
const modalOpen = ref(false);
const editingPool = ref<Partial<Pool> | null>(null);
const savingPool = ref(false);
const changingVisibility = ref<Set<number>>(new Set());
const participants = ref<Participant[]>([]);
const poolOptions = ref<PoolOption[]>([]);
const stages = ref<Stage[]>([]);
const organisations = ref<Organisation[]>([]);
const emptyOrganisation = (): Organisation => ({ naam: '', straat: '', huisnummer: '', postcode: '', plaats: '', email: '', tel: '' });
// null = geen organisatie, 0 = nieuwe organisatie.
const selectedOrgID = ref<number | null>(null);
const orgForm = ref<Organisation>(emptyOrganisation());
const orgFields = [
  { key: 'straat', label: 'Straat', class: 'col-span-2 md:col-span-3' },
  { key: 'huisnummer', label: 'Huisnr.', class: 'col-span-1' },
  { key: 'postcode', label: 'Postcode', class: 'col-span-1' },
  { key: 'plaats', label: 'Plaats', class: 'col-span-1 md:col-span-3' },
  { key: 'tel', label: 'Telefoon', class: 'col-span-2' },
  { key: 'email', label: 'E-mail', class: 'col-span-2' }
] as const;

const fetchOrganisations = async () => {
  organisations.value = await apiFetch<Organisation[]>('/organisations');
};

const selectOrganisation = () => {
  const org = organisations.value.find(item => item.orgID === selectedOrgID.value);
  orgForm.value = org ? { ...org } : emptyOrganisation();
};

const formatOrgAddress = (p: Pool) => [
  [p.orgStraat, p.orgHuisnummer].filter(Boolean).join(' '),
  [p.orgPostcode, p.orgPlaats].filter(Boolean).join(' '),
  p.orgTel,
  p.orgEmail
].filter(Boolean).join(' · ');

const fetchPools = async () => {
  loading.value = true;
  try {
    if (isAdmin.value) {
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
      return;
    }
    // Poolbeheerders mogen alleen gegevens per eigen pool opvragen.
    const [poolsData, stageData] = await Promise.all([apiFetch<Pool[]>('/pools'), apiFetch<Stage[]>('/stages')]);
    const perPool = await Promise.all(poolsData.map(pool => Promise.all([
      apiFetch<Participant[]>(`/participants?poolID=${pool.poolID}`),
      apiFetch<PoolOption[]>(`/options?poolID=${pool.poolID}`)
    ])));
    pools.value = poolsData;
    participants.value = perPool.flatMap(([items]) => items);
    poolOptions.value = perPool.flatMap(([, options]) => options);
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

const formatEnrollmentDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}-${month}-${year}`;
};

onMounted(async () => {
  if (!isAdmin.value) {
    await fetchPools();
    return;
  }
  try {
    [tours.value] = await Promise.all([apiFetch<typeof tours.value>('/tours'), fetchOrganisations()]);
  } catch (err) {
    console.error(err);
  }
  await fetchPools();
});

const openCreateModal = () => {
  editingPool.value = { tourID: tours.value[0]?.tourID || 1, Naam: '', Org: '', visibleToUsers: true };
  const lastOrgID = pools.value.find(item => item.orgID)?.orgID ?? null;
  selectedOrgID.value = organisations.value.some(org => org.orgID === lastOrgID) ? lastOrgID : (organisations.value.length ? null : 0);
  selectOrganisation();
  modalOpen.value = true;
};

const openEditModal = (pool: Pool) => {
  editingPool.value = {
    ...pool,
    visibleToUsers: Boolean(pool.visibleToUsers),
    StartInschr: pool.StartInschr?.slice(0, 10) || '',
    EindInschr: pool.EindInschr?.slice(0, 10) || ''
  };
  selectedOrgID.value = pool.orgID ?? (pool.Org ? 0 : null);
  selectOrganisation();
  if (!pool.orgID && pool.Org) orgForm.value.naam = pool.Org;
  modalOpen.value = true;
};

const savePool = async () => {
  if (!editingPool.value || !editingPool.value.Naam) return;
  if (editingPool.value.StartInschr && editingPool.value.EindInschr &&
      editingPool.value.StartInschr > editingPool.value.EindInschr) {
    alert('De einddatum van de inschrijving mag niet voor de begindatum liggen.');
    return;
  }

  if (selectedOrgID.value !== null && !orgForm.value.naam.trim()) {
    alert('Vul de naam van de organisatie in.');
    return;
  }

  savingPool.value = true;
  try {
    // De organisatie wordt apart bewaard, zodat hij bij een volgende pool opnieuw te kiezen is.
    let orgID: number | null = null;
    if (selectedOrgID.value !== null) {
      const body = JSON.stringify(orgForm.value);
      const saved = selectedOrgID.value
        ? await apiFetch<Organisation>(`/organisations/${selectedOrgID.value}`, { method: 'PUT', body })
        : await apiFetch<Organisation>('/organisations', { method: 'POST', body });
      orgID = saved.orgID ?? selectedOrgID.value;
      await fetchOrganisations();
    }
    const payload = {
      tourID: Number(editingPool.value.tourID),
      Naam: editingPool.value.Naam,
      Org: orgID ? orgForm.value.naam.trim() : null,
      orgID,
      StartInschr: editingPool.value.StartInschr || null,
      EindInschr: editingPool.value.EindInschr || null,
      visibleToUsers: Boolean(editingPool.value.visibleToUsers)
    };

    if (editingPool.value.poolID) {
      await apiFetch(`/pools/${editingPool.value.poolID}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      await apiFetch<Pool>('/pools', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
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

const toggleVisibility = async (item: Pool) => {
  if (changingVisibility.value.has(item.poolID)) return;
  changingVisibility.value.add(item.poolID);
  try {
    const updated = await apiFetch<Pool>(`/pools/${item.poolID}`, {
      method: 'PUT',
      body: JSON.stringify({ visibleToUsers: !item.visibleToUsers })
    });
    item.visibleToUsers = updated.visibleToUsers;
  } catch (err) {
    alert(`Zichtbaarheid wijzigen mislukt: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    changingVisibility.value.delete(item.poolID);
  }
};
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900">{{ isAdmin ? 'Pools beheren' : 'Mijn pools' }}</h2>
        <p class="text-xs text-slate-500">Overzicht van poolcompetities en inschrijfperiodes</p>
      </div>
      <button 
        v-if="isAdmin"
        @click="openCreateModal" 
        class="btn flex items-center gap-2 text-sm"
      >
        <Plus class="h-4 w-4" />
        <span>Nieuwe pool</span>
      </button>
    </div>

    <p v-if="!loading && !pools.length" class="text-sm text-slate-700">
      {{ isAdmin ? 'Er zijn nog geen pools.' : 'Er zijn nog geen pools aan jouw account gekoppeld. Vraag de beheerder om je toe te voegen.' }}
    </p>

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
          <button
            v-if="isAdmin"
            type="button"
            :disabled="changingVisibility.has(p.poolID)"
            :aria-pressed="Boolean(p.visibleToUsers)"
            :aria-label="`${p.Naam}: ${p.visibleToUsers ? 'verbergen' : 'zichtbaar maken'} voor gebruikers`"
            @click="toggleVisibility(p)"
            class="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            :class="p.visibleToUsers ? 'border-green-200 bg-green-50 text-green-800' : 'border-slate-300 bg-slate-100 text-slate-700'">
            <component :is="p.visibleToUsers ? Eye : EyeOff" class="h-4 w-4" />
            {{ changingVisibility.has(p.poolID) ? 'Opslaan...' : p.visibleToUsers ? 'Zichtbaar voor gebruikers' : 'Onzichtbaar voor gebruikers' }}
          </button>
          <p class="text-xs text-slate-500">
            Organisator: <span class="font-semibold text-slate-800">{{ p.Org || 'Onbekend' }}</span>
            <span v-if="formatOrgAddress(p)" class="block">Inleveradres: {{ formatOrgAddress(p) }}</span>
          </p>
          <p class="text-xs text-slate-600">
            Inschrijving:
            <span class="font-semibold text-slate-800">
              vanaf {{ p.StartInschr ? formatEnrollmentDate(p.StartInschr) : 'direct' }}
              {{ p.EindInschr ? `tot en met ${formatEnrollmentDate(p.EindInschr)}` : 'tot de tourstart' }}
            </span>
          </p>
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

        <div v-if="isAdmin" class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
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
      <div class="w-full max-w-xl space-y-5 rounded-2xl border-4 border-slate-500 bg-yellow-100 p-6 shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 pb-4">
          <h3 class="text-lg font-bold text-slate-900">
            {{ editingPool?.poolID ? `Pool #${editingPool.poolID} bewerken` : 'Nieuwe pool aanmaken' }}
          </h3>
          <button @click="modalOpen = false" class="text-slate-400 hover:text-slate-700">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4">
          <div class="flex flex-col gap-4 md:flex-row">
            <div class="min-w-0 flex-1">
              <label class="mb-1 ml-2 block text-base font-semibold text-slate-700">Poolnaam *</label>
              <input
                v-model="editingPool!.Naam"
                class="w-full rounded-lg border border-slate-500 bg-slate-50 px-2 py-2 text-base text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none"
                placeholder="bv. Tour de France 2026 Pool"
              />
            </div>
            <div class="md:w-40 md:shrink-0">
              <label class="mb-1 block text-base font-semibold text-slate-700">Koppel aan Tour</label>
              <select
                v-model="editingPool!.tourID"
                class="w-full rounded-lg border border-slate-500 bg-slate-50 px-3 py-2 text-base text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none"
              >
                <option v-for="t in tours" :key="t.tourID" :value="t.tourID">
                  {{ t.naam }}
                </option>
              </select>
            </div>
          </div>
          <fieldset class="space-y-3 rounded-lg border border-slate-300 p-3">
            <legend class="px-1 text-base font-semibold text-slate-700">Organisator en inleveradres</legend>
            <select
              v-model="selectedOrgID"
              @change="selectOrganisation"
              aria-label="Organisatie"
              class="w-full rounded-lg border border-slate-500 bg-slate-50 px-3 py-2 text-base text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none"
            >
              <option :value="null">Geen organisatie</option>
              <option v-for="org in organisations" :key="org.orgID" :value="org.orgID">{{ org.naam }}</option>
              <option :value="0">+ Nieuwe organisatie</option>
            </select>
            <div v-if="selectedOrgID !== null" class="grid grid-cols-2 gap-2 md:grid-cols-4">
              <label class="col-span-2 text-sm font-semibold text-slate-700 md:col-span-4">
                Naam *
                <input v-model="orgForm.naam" class="mt-1 w-full rounded-lg border border-slate-500 bg-white px-2 py-1.5 text-base font-normal" placeholder="bv. Café de Laurierboom" />
              </label>
              <label v-for="field in orgFields" :key="field.key" class="text-sm font-semibold text-slate-700" :class="field.class">
                {{ field.label }}
                <input
                  v-model="orgForm[field.key]"
                  :type="field.key === 'email' ? 'email' : field.key === 'tel' ? 'tel' : 'text'"
                  class="mt-1 w-full rounded-lg border border-slate-500 bg-white px-2 py-1.5 text-base font-normal"
                />
              </label>
              <p v-if="selectedOrgID" class="col-span-2 text-xs text-slate-600 md:col-span-4">
                Wijzigingen gelden voor alle pools van deze organisatie.
              </p>
            </div>
          </fieldset>

          <div class="flex flex-col justify-around gap-2 border-t border-slate-200 pt-4 text-center md:flex-row">
            <label class="mb-3 block text-base font-semibold text-slate-700">
              Inschrijving vanaf
              <input v-model="editingPool!.StartInschr" type="date" :max="editingPool!.EindInschr || undefined" class="mt-1 block w-full rounded-lg border border-slate-500 bg-white px-3 py-2 text-base" />
            </label>
            <label class="mb-3 block text-base font-semibold text-slate-700">
              tot en met
              <input v-model="editingPool!.EindInschr" type="date" :min="editingPool!.StartInschr || undefined" class="mt-1 block w-full rounded-lg border border-slate-500 bg-white px-3 py-2 text-base" />
            </label>
          </div>

          <div>
            <label class="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input v-model="editingPool!.visibleToUsers" type="checkbox" class="h-4 w-4 accent-amber-500" />
              Zichtbaar voor gebruikers
            </label>
            <p class="mt-1 text-xs text-slate-600">
              Bij onzichtbare pools kunnen gebruikers ook hun bestaande ploegen en PDF's niet openen. De gegevens blijven bewaard.
            </p>
          </div>
          <p v-if="!editingPool?.poolID" class="text-xs text-slate-600">
            De standaardpunten worden automatisch gekopieerd naar deze pool.
          </p>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button @click="modalOpen = false" class="btn text-sm">Annuleren</button>
          <button @click="savePool" :disabled="savingPool" class="btn text-sm">{{ savingPool ? 'Opslaan...' : 'Opslaan' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
