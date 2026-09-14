<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiFetch } from '../services/api';
import { 
  RefreshCw, 
  X, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight 
} from '@lucide/vue';

interface Stage {
  tour: string;
  etappeNr?: number | null;
  datum?: string | null;
  Start?: string | null;
  Finish?: string | null;
  kms?: number | null;
  type?: string | null;
}

interface TourRider {
  tourID: number;
  ploegID: number;
  ploegNaam: string;
  ploegCode?: string | null;
  ploegLand?: string | null;
  rennerID: number;
  Rugnummer: number;
  anaam: string;
  vnaam?: string | null;
  tnaam?: string | null;
  rennerLand?: string | null;
}

interface PoolOption {
  poolID: number;
  AantalEtapPlaatsen?: number | null;
  AantalKlasGeel?: number | null;
  AantalKlasGroen?: number | null;
  AantalKlasBol?: number | null;
  AantalKlasWit?: number | null;
}

interface StageResultItem {
  tourID: number;
  etappeNr: number;
  uitslagType: string;
  plaats: number;
  rennerID: number;
  anaam?: string;
  vnaam?: string | null;
  tnaam?: string | null;
  rennerLand?: string | null;
  Rugnummer?: number | null;
  ploegNaam?: string | null;
  ploegCode?: string | null;
}

const stages = ref<Stage[]>([]);
const tourRiders = ref<TourRider[]>([]);
const poolOptions = ref<PoolOption | null>(null);
const allStageResults = ref<StageResultItem[]>([]);
const loading = ref(true);
const saving = ref(false);

// Modal state voor uitslag invoeren
const modalOpen = ref(false);
const activeStage = ref<Stage | null>(null);

// Formulier state per categorie
const resultForm = ref<{
  rit: (number | null)[];
  geel: (number | null)[];
  bol: (number | null)[];
  groen: (number | null)[];
  wit: (number | null)[];
}>({
  rit: [],
  geel: [],
  bol: [],
  groen: [],
  wit: []
});

const targetCounts = computed(() => ({
  rit: poolOptions.value?.AantalEtapPlaatsen ?? 7,
  geel: poolOptions.value?.AantalKlasGeel ?? 3,
  bol: poolOptions.value?.AantalKlasBol ?? 3,
  groen: poolOptions.value?.AantalKlasGroen ?? 3,
  wit: poolOptions.value?.AantalKlasWit ?? 1
}));

const fetchData = async () => {
  loading.value = true;
  try {
    const [stagesRes, ridersRes, optionsRes, resultsRes] = await Promise.all([
      apiFetch<Stage[]>('/stages'),
      apiFetch<TourRider[]>('/team-riders?tourID=1'),
      apiFetch<PoolOption[]>('/options').catch(() => []),
      apiFetch<StageResultItem[]>('/stage-results?tourID=1')
    ]);

    stages.value = stagesRes.sort((a, b) => {
      const dateA = a.datum ? new Date(a.datum).getTime() : 0;
      const dateB = b.datum ? new Date(b.datum).getTime() : 0;
      return dateA - dateB;
    });

    tourRiders.value = ridersRes;
    poolOptions.value = optionsRes[0] || null;
    allStageResults.value = resultsRes;
  } catch (err) {
    console.error('Error fetching stage data:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchData);

// Gesorteerde lijst van renners voor in de dropdowns
const sortedTourRiders = computed(() => {
  return [...tourRiders.value].sort((a, b) => {
    const aName = a.anaam || '';
    const bName = b.anaam || '';
    return aName.localeCompare(bName, 'nl');
  });
});

const formatRiderOption = (r: TourRider) => {
  const given = [r.vnaam, r.tnaam].filter(Boolean).join(' ');
  const namePart = given ? `${r.anaam}, ${given}` : r.anaam;
  const parts = [namePart];
  if (r.Rugnummer) parts.push(`(#${r.Rugnummer})`);
  if (r.ploegCode) parts.push(`[${r.ploegCode}]`);
  return parts.join(' ');
};

const formatStageDate = (d?: string | null) => {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const getTypeBadgeClass = (type?: string | null) => {
  const t = (type || '').toLowerCase();
  if (t === 'bergen') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (t === 'heuvels') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (t === 'vlak') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (t === 'itt' || t === 'ttt') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (t === 'rustdag') return 'bg-slate-100 text-slate-600 border-slate-200 font-normal italic';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

// Controleer of een etappe al een uitslag heeft
const getStageResultsCount = (etappeNr?: number | null) => {
  if (!etappeNr) return 0;
  return allStageResults.value.filter(r => r.etappeNr === etappeNr).length;
};

const hasStageCompleteResult = (etappeNr?: number | null) => {
  if (!etappeNr) return false;
  const count = getStageResultsCount(etappeNr);
  const required = (
    targetCounts.value.rit +
    targetCounts.value.geel +
    targetCounts.value.bol +
    targetCounts.value.groen +
    targetCounts.value.wit
  );
  return count >= required;
};

// Modal openen om uitslag in te voeren
const openResultModal = (s: Stage) => {
  if (s.type === 'rustdag' || !s.etappeNr) return;

  activeStage.value = s;

  // Initialiseer form arrays op basis van optie-aantallen
  const initCategory = (key: 'rit' | 'geel' | 'bol' | 'groen' | 'wit', count: number) => {
    const existing = allStageResults.value.filter(
      r => r.etappeNr === s.etappeNr && r.uitslagType.toLowerCase() === key
    );
    const arr: (number | null)[] = [];
    for (let pos = 1; pos <= count; pos++) {
      const match = existing.find(r => r.plaats === pos);
      arr.push(match ? match.rennerID : null);
    }
    return arr;
  };

  resultForm.value = {
    rit: initCategory('rit', targetCounts.value.rit),
    geel: initCategory('geel', targetCounts.value.geel),
    bol: initCategory('bol', targetCounts.value.bol),
    groen: initCategory('groen', targetCounts.value.groen),
    wit: initCategory('wit', targetCounts.value.wit)
  };

  modalOpen.value = true;
};

const saveResults = async () => {
  if (!activeStage.value || !activeStage.value.etappeNr) return;
  saving.value = true;

  try {
    const resultsPayload: Array<{ uitslagType: string; plaats: number; rennerID: number }> = [];

    const appendResults = (key: 'rit' | 'geel' | 'bol' | 'groen' | 'wit') => {
      const arr = resultForm.value[key];
      for (let i = 0; i < arr.length; i++) {
        if (arr[i]) {
          resultsPayload.push({
            uitslagType: key,
            plaats: i + 1,
            rennerID: Number(arr[i])
          });
        }
      }
    };

    appendResults('rit');
    appendResults('geel');
    appendResults('bol');
    appendResults('groen');
    appendResults('wit');

    await apiFetch('/stage-results/batch', {
      method: 'PUT',
      body: JSON.stringify({
        tourID: 1,
        etappeNr: activeStage.value.etappeNr,
        results: resultsPayload
      })
    });

    alert(`Uitslag voor Etappe #${activeStage.value.etappeNr} succesvol opgeslagen!`);
    modalOpen.value = false;
    await fetchData();
  } catch (err) {
    alert(`Fout bij opslaan uitslag: ${err instanceof Error ? err.message : err}`);
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900">Etappe-overzicht & Uitslagen</h2>
        <p class="text-xs text-slate-500">Klik op een etappekaart om de daguitslag en klassementstruien in te voeren</p>
      </div>
      <button 
        @click="fetchData" 
        class="shadow-xs rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50"
        title="Verversen"
      >
        <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <!-- Cards Grid (3 kolommen op groot scherm, 2 op tablet, 1 op mobiel) -->
    <div v-if="loading && stages.length === 0" class="shadow-xs rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
      Etappes laden...
    </div>
    <div v-else class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
      <div 
        v-for="s in stages" 
        :key="s.datum || s.etappeNr || Math.random()" 
        @click="openResultModal(s)"
        class="group relative flex flex-col justify-between rounded-xl border p-4 transition shadow-xs"
        :class="[
          s.type === 'rustdag'
            ? 'border-slate-200 bg-slate-50/60 cursor-default opacity-80'
            : 'border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm cursor-pointer'
        ]"
      >
        <!-- Top row: Datum & Type -->
        <div class="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <span class="text-xs font-semibold capitalize text-slate-600">
            {{ formatStageDate(s.datum) }}
          </span>
          <span class="rounded border px-2 py-0.5 text-[11px] font-semibold capitalize" :class="getTypeBadgeClass(s.type)">
            {{ s.type || 'Vlak' }}
          </span>
        </div>

        <!-- Middle: Etappe Nr & Route -->
        <div class="py-3">
          <div class="flex items-center gap-2">
            <span 
              v-if="s.etappeNr" 
              class="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-xs font-bold text-amber-800"
            >
              Etappe #{{ s.etappeNr }}
            </span>
            <span v-else class="font-medium text-slate-400 text-xs italic">
              Rustdag
            </span>
            <span v-if="s.kms" class="font-mono text-xs font-medium text-slate-500">
              ({{ s.kms }} km)
            </span>
          </div>

          <div v-if="s.Start || s.Finish" class="mt-2 text-sm text-slate-900 font-medium leading-snug">
            <span>{{ s.Start || '?' }}</span>
            <span class="text-slate-400 mx-1.5 font-normal">➔</span>
            <span>{{ s.Finish || '?' }}</span>
          </div>
        </div>

        <!-- Bottom: Status Uitslag -->
        <div v-if="s.type !== 'rustdag'" class="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
          <div class="flex items-center gap-1.5">
            <span 
              v-if="hasStageCompleteResult(s.etappeNr)"
              class="flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 text-[11px]"
            >
              <CheckCircle2 class="h-3.5 w-3.5" />
              <span>Uitslag compleet</span>
            </span>
            <span 
              v-else-if="getStageResultsCount(s.etappeNr) > 0"
              class="flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded px-2 py-0.5 text-[11px]"
            >
              <AlertCircle class="h-3.5 w-3.5" />
              <span>Deels ingevoerd ({{ getStageResultsCount(s.etappeNr) }})</span>
            </span>
            <span v-else class="text-slate-400">
              Nog geen uitslag
            </span>
          </div>

          <span class="text-xs font-semibold text-amber-700 group-hover:translate-x-0.5 transition flex items-center">
            Invoeren <ChevronRight class="h-3.5 w-3.5 ml-0.5" />
          </span>
        </div>
      </div>
    </div>

    <!-- Footer count -->
    <div class="shadow-xs flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
      <span>Totaal <strong>{{ stages.length }}</strong> rittendagen getoond (3 kolommen op desktop)</span>
      <span class="text-slate-400">Klik op een etappe om de uitslag en truien in te vullen</span>
    </div>

    <!-- Modal: Uitslag invoeren per categorie -->
    <div v-if="modalOpen && activeStage" class="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-4xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[92vh] flex flex-col">
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b border-slate-200 pb-4 shrink-0">
          <div>
            <div class="flex items-center gap-2">
              <span class="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-xs font-bold text-amber-800">
                Etappe #{{ activeStage.etappeNr }}
              </span>
              <h3 class="text-lg font-bold text-slate-900">Uitslag & Truiendragers invoeren</h3>
            </div>
            <p class="text-xs text-slate-500 mt-0.5">
              {{ formatStageDate(activeStage.datum) }} • {{ activeStage.Start }} ➔ {{ activeStage.Finish }} ({{ activeStage.kms }} km)
            </p>
          </div>
          <button @click="modalOpen = false" class="text-slate-400 hover:text-slate-700"><X class="h-5 w-5" /></button>
        </div>

        <!-- Modal Body: Categorieën Grid -->
        <div class="space-y-6 overflow-y-auto flex-1 pr-1">
          <!-- 1. Rit (Daguitslag) -->
          <div class="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div class="flex items-center justify-between border-b border-slate-200 pb-2">
              <div class="flex items-center gap-2">
                <span class="text-lg">🏁</span>
                <h4 class="text-sm font-bold text-slate-900">Daguitslag (Top {{ targetCounts.rit }})</h4>
              </div>
              <span class="text-xs font-semibold text-slate-500">Type 'rit'</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div v-for="pos in targetCounts.rit" :key="`rit-${pos}`">
                <label class="mb-1 block text-xs font-semibold text-slate-700">Plaats {{ pos }}</label>
                <select 
                  v-model="resultForm.rit[pos - 1]"
                  class="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none shadow-2xs"
                >
                  <option :value="null">-- Kies renner --</option>
                  <option v-for="r in sortedTourRiders" :key="`rit-${pos}-${r.rennerID}`" :value="r.rennerID">
                    {{ formatRiderOption(r) }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- 2. Klassementstruien Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Gele trui -->
            <div class="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <div class="flex items-center justify-between border-b border-amber-200 pb-2">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🟡</span>
                  <h4 class="text-sm font-bold text-amber-900">Gele trui (Top {{ targetCounts.geel }})</h4>
                </div>
                <span class="text-xs font-semibold text-amber-700">Type 'geel'</span>
              </div>
              <div class="space-y-2">
                <div v-for="pos in targetCounts.geel" :key="`geel-${pos}`">
                  <label class="mb-1 block text-xs font-semibold text-amber-900">Geel #{{ pos }}</label>
                  <select 
                    v-model="resultForm.geel[pos - 1]"
                    class="w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none shadow-2xs"
                  >
                    <option :value="null">-- Kies renner --</option>
                    <option v-for="r in sortedTourRiders" :key="`geel-${pos}-${r.rennerID}`" :value="r.rennerID">
                      {{ formatRiderOption(r) }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Bolletjestrui -->
            <div class="space-y-3 rounded-xl border border-rose-200 bg-rose-50/40 p-4">
              <div class="flex items-center justify-between border-b border-rose-200 pb-2">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🔴</span>
                  <h4 class="text-sm font-bold text-rose-900">Bolletjestrui (Top {{ targetCounts.bol }})</h4>
                </div>
                <span class="text-xs font-semibold text-rose-700">Type 'bol'</span>
              </div>
              <div class="space-y-2">
                <div v-for="pos in targetCounts.bol" :key="`bol-${pos}`">
                  <label class="mb-1 block text-xs font-semibold text-rose-900">Bol #{{ pos }}</label>
                  <select 
                    v-model="resultForm.bol[pos - 1]"
                    class="w-full rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-none shadow-2xs"
                  >
                    <option :value="null">-- Kies renner --</option>
                    <option v-for="r in sortedTourRiders" :key="`bol-${pos}-${r.rennerID}`" :value="r.rennerID">
                      {{ formatRiderOption(r) }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Groene trui -->
            <div class="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div class="flex items-center justify-between border-b border-emerald-200 pb-2">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🟢</span>
                  <h4 class="text-sm font-bold text-emerald-900">Groene trui (Top {{ targetCounts.groen }})</h4>
                </div>
                <span class="text-xs font-semibold text-emerald-700">Type 'groen'</span>
              </div>
              <div class="space-y-2">
                <div v-for="pos in targetCounts.groen" :key="`groen-${pos}`">
                  <label class="mb-1 block text-xs font-semibold text-emerald-900">Groen #{{ pos }}</label>
                  <select 
                    v-model="resultForm.groen[pos - 1]"
                    class="w-full rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none shadow-2xs"
                  >
                    <option :value="null">-- Kies renner --</option>
                    <option v-for="r in sortedTourRiders" :key="`groen-${pos}-${r.rennerID}`" :value="r.rennerID">
                      {{ formatRiderOption(r) }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Witte trui -->
            <div class="space-y-3 rounded-xl border border-slate-300 bg-slate-100/60 p-4">
              <div class="flex items-center justify-between border-b border-slate-300 pb-2">
                <div class="flex items-center gap-2">
                  <span class="text-lg">⚪</span>
                  <h4 class="text-sm font-bold text-slate-900">Witte trui (Top {{ targetCounts.wit }})</h4>
                </div>
                <span class="text-xs font-semibold text-slate-600">Type 'wit'</span>
              </div>
              <div class="space-y-2">
                <div v-for="pos in targetCounts.wit" :key="`wit-${pos}`">
                  <label class="mb-1 block text-xs font-semibold text-slate-700">Wit #{{ pos }}</label>
                  <select 
                    v-model="resultForm.wit[pos - 1]"
                    class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-500 focus:outline-none shadow-2xs"
                  >
                    <option :value="null">-- Kies renner --</option>
                    <option v-for="r in sortedTourRiders" :key="`wit-${pos}-${r.rennerID}`" :value="r.rennerID">
                      {{ formatRiderOption(r) }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4 shrink-0">
          <button @click="modalOpen = false" class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">Annuleren</button>
          <button 
            @click="saveResults" 
            :disabled="saving"
            class="shadow-xs rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50 flex items-center gap-2"
          >
            <Save class="h-4 w-4" />
            <span>{{ saving ? 'Opslaan...' : 'Uitslag Opslaan' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
