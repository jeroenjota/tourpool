<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiFetch } from '../services/api';
import { Save } from '@lucide/vue';

interface OptionItem {
  poolID: number;
  inleg: number;
  PloegRennerAantal: number;
  PloegReserveAantal: number;
  AantalEtapPlaatsen: number;
  AantalKlasGeel: number;
  AantalKlasGroen: number;
  AantalKlasBol: number;
  AantalKlasWit: number;
  AantalEindKlasGeel: number;
  AantalEindKlasGroen: number;
  AantalEindKlasBol: number;
  AantalEindKlasWit: number;
  PrijsNr1Percentage: number;
  PrijsNr2Percentage: number;
  PrijsNr3Percentage: number;
  PrijsNr4Percentage: number;
  PrijsNrLaatstBedrag: number;
}

const options = ref<OptionItem | null>(null);
const loading = ref(true);
const saving = ref(false);

const prizePercentages = ref({
  p1: 0,
  p2: 0,
  p3: 0,
  p4: 0
});

const normalizeToPercent = (val?: number | null) => {
  if (val == null || isNaN(val)) return 0;
  return val <= 1 && val > 0 ? Math.round(val * 10000) / 100 : val;
};

const normalizeToDecimal = (val?: number | null) => {
  if (val == null || isNaN(val)) return 0;
  return val > 1 ? Number((val / 100).toFixed(4)) : Number(val.toFixed(4));
};

const totalPercentage = computed(() => {
  return Number((
    Number(prizePercentages.value.p1 || 0) +
    Number(prizePercentages.value.p2 || 0) +
    Number(prizePercentages.value.p3 || 0) +
    Number(prizePercentages.value.p4 || 0)
  ).toFixed(2));
});

const fetchOptions = async () => {
  loading.value = true;
  try {
    const list = await apiFetch<OptionItem[]>('/options');
    options.value = list[0] || null;
    if (options.value) {
      prizePercentages.value = {
        p1: normalizeToPercent(options.value.PrijsNr1Percentage),
        p2: normalizeToPercent(options.value.PrijsNr2Percentage),
        p3: normalizeToPercent(options.value.PrijsNr3Percentage),
        p4: normalizeToPercent(options.value.PrijsNr4Percentage)
      };
    }
  } catch (err) {
    console.error('Error fetching options:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchOptions);

const isPercentageValid = computed(() => {
  return totalPercentage.value <= 100;
});

const saveOptions = async () => {
  if (!options.value) return;

  if (!isPercentageValid.value) {
    alert(`De totale prijsverdeling mag niet meer dan 100% zijn (momenteel ${totalPercentage.value}%).`);
    return;
  }

  saving.value = true;
  try {
    const payload = {
      ...options.value,
      PrijsNr1Percentage: normalizeToDecimal(prizePercentages.value.p1),
      PrijsNr2Percentage: normalizeToDecimal(prizePercentages.value.p2),
      PrijsNr3Percentage: normalizeToDecimal(prizePercentages.value.p3),
      PrijsNr4Percentage: normalizeToDecimal(prizePercentages.value.p4)
    };

    await apiFetch(`/options/${options.value.poolID}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    alert('Pool opties succesvol opgeslagen!');
    await fetchOptions();
  } catch (err) {
    alert(`Fout bij opslaan: ${err instanceof Error ? err.message : err}`);
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="max-w-4xl space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900">Pool Opties & Reglement</h2>
        <p class="text-xs text-slate-500">Instellingen voor inleg, ploeggroottes en prijspercentages (tblOpties)</p>
      </div>
      <button 
        v-if="options"
        @click="saveOptions" 
        :disabled="saving || !isPercentageValid"
        class="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50 shadow-xs"
      >
        <Save class="h-4 w-4" />
        <span>{{ saving ? 'Opslaan...' : 'Wijzigingen opslaan' }}</span>
      </button>
    </div>

    <div v-if="loading" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 shadow-xs">
      Opties laden...
    </div>

    <div v-else-if="options" class="space-y-6">
      <!-- 1. Algemeen & Inleg -->
      <div class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div class="border-b border-slate-100 pb-3">
          <h3 class="text-base font-semibold text-slate-900">1. Algemeen & Inleg</h3>
          <p class="mt-0.5 text-xs text-slate-500">Basisinstellingen voor inleggelden en ploegformaties</p>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">Inleg per deelnemer (€)</label>
            <input 
              v-model.number="options.inleg" 
              type="number" 
              step="0.5" 
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">Aantal renners per ploeg</label>
            <input 
              v-model.number="options.PloegRennerAantal" 
              type="number" 
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">Aantal reserve-renners</label>
            <input 
              v-model.number="options.PloegReserveAantal" 
              type="number" 
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
            />
          </div>
        </div>
      </div>

      <!-- 2. Prijsverdeling -->
      <div class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div class="flex flex-col justify-between gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
          <div>
            <h3 class="text-base font-semibold text-slate-900">2. Prijsverdeling</h3>
            <p class="mt-0.5 text-xs text-slate-500">Percentages van de prijzenpot voor de topklasseringen en troostprijs</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500">Prijzenpot:</span>
            <span 
              class="rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold transition-colors"
              :class="[
                !isPercentageValid
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : totalPercentage === 100 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border-amber-200'
              ]"
            >
              {{ totalPercentage }}% totaal
            </span>
          </div>
        </div>

        <div v-if="!isPercentageValid" class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          ⚠️ De totale prijsverdeling is momenteel <strong>{{ totalPercentage }}%</strong>. Dit mag maximaal <strong>100%</strong> zijn.
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">1e Prijs</label>
            <div class="relative">
              <input 
                v-model.number="prizePercentages.p1" 
                type="number" 
                step="1"
                min="0"
                max="100" 
                class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
                placeholder="50"
              />
              <span class="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">2e Prijs</label>
            <div class="relative">
              <input 
                v-model.number="prizePercentages.p2" 
                type="number" 
                step="1"
                min="0"
                max="100" 
                class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
                placeholder="35"
              />
              <span class="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">3e Prijs</label>
            <div class="relative">
              <input 
                v-model.number="prizePercentages.p3" 
                type="number" 
                step="1"
                min="0"
                max="100" 
                class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
                placeholder="15"
              />
              <span class="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700">4e Prijs</label>
            <div class="relative">
              <input 
                v-model.number="prizePercentages.p4" 
                type="number" 
                step="1"
                min="0"
                max="100" 
                class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
                placeholder="0"
              />
              <span class="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
            </div>
          </div>
          <div class="col-span-2 sm:col-span-1">
            <label class="mb-1 block text-xs font-semibold text-slate-700">Rode Lantaarn</label>
            <div class="relative">
              <input 
                v-model.number="options.PrijsNrLaatstBedrag" 
                type="number" 
                step="0.5" 
                class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" 
              />
              <span class="absolute right-3 top-2 text-xs font-bold text-slate-400">€</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Meetellende plaatsen na elke etappe -->
      <div class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div class="border-b border-slate-100 pb-3">
          <h3 class="text-base font-semibold text-slate-900">3. Meetellende plaatsen na elke etappe</h3>
          <p class="mt-0.5 text-xs text-slate-500">Aantal renners per categorie dat na afloop van een etappe punten oplevert</p>
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div class="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <label class="mb-1 block text-xs font-semibold text-slate-800">🏁 Rit (Daguitslag)</label>
            <input 
              v-model.number="options.AantalEtapPlaatsen" 
              type="number" 
              class="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 font-mono text-sm text-slate-900 focus:border-amber-500 focus:outline-none" 
            />
            <span class="mt-1 block text-[10px] text-slate-500">Top X van de etappe</span>
          </div>

          <div class="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <label class="mb-1 block text-xs font-semibold text-amber-800">🟡 Gele trui</label>
            <input 
              v-model.number="options.AantalKlasGeel" 
              type="number" 
              class="w-full rounded-md border border-amber-200 bg-white px-3 py-1.5 font-mono text-sm text-amber-900 focus:border-amber-500 focus:outline-none" 
            />
            <span class="mt-1 block text-[10px] text-amber-700/80">Algemeen klassement</span>
          </div>

          <div class="rounded-lg border border-rose-200 bg-rose-50/60 p-3">
            <label class="mb-1 block text-xs font-semibold text-rose-800">🔴 Bolletjestrui</label>
            <input 
              v-model.number="options.AantalKlasBol" 
              type="number" 
              class="w-full rounded-md border border-rose-200 bg-white px-3 py-1.5 font-mono text-sm text-rose-900 focus:border-rose-500 focus:outline-none" 
            />
            <span class="mt-1 block text-[10px] text-rose-700/80">Bergklassement</span>
          </div>

          <div class="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
            <label class="mb-1 block text-xs font-semibold text-emerald-800">🟢 Groene trui</label>
            <input 
              v-model.number="options.AantalKlasGroen" 
              type="number" 
              class="w-full rounded-md border border-emerald-200 bg-white px-3 py-1.5 font-mono text-sm text-emerald-900 focus:border-emerald-500 focus:outline-none" 
            />
            <span class="mt-1 block text-[10px] text-emerald-700/80">Puntenklassement</span>
          </div>

          <div class="rounded-lg border border-slate-300 bg-slate-100/70 p-3">
            <label class="mb-1 block text-xs font-semibold text-slate-800">⚪ Witte trui</label>
            <input 
              v-model.number="options.AantalKlasWit" 
              type="number" 
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm text-slate-900 focus:border-slate-500 focus:outline-none" 
            />
            <span class="mt-1 block text-[10px] text-slate-600">Jongerenklassement</span>
          </div>
        </div>
      </div>

      <!-- 4. Meetellende plaatsen in de eindstand van de Tour -->
      <div class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div class="border-b border-slate-100 pb-3">
          <h3 class="text-base font-semibold text-slate-900">4. Meetellende plaatsen in de eindstand van de Tour</h3>
          <p class="mt-0.5 text-xs text-slate-500">Aantal renners per klassement dat in de uiteindelijke einduitslag punten oplevert</p>
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <label class="mb-1 block text-xs font-semibold text-amber-800">🟡 Eindklassement (Geel)</label>
            <input 
              v-model.number="options.AantalEindKlasGeel" 
              type="number" 
              class="w-full rounded-md border border-amber-200 bg-white px-3 py-1.5 font-mono text-sm text-amber-900 focus:border-amber-500 focus:outline-none" 
            />
            <span class="mt-1 block text-[10px] text-amber-700/80">Eindstand Algemeen</span>
          </div>

          <div class="rounded-lg border border-rose-200 bg-rose-50/60 p-3">
            <label class="mb-1 block text-xs font-semibold text-rose-800">🔴 Bergklassement (Bol)</label>
            <input 
              v-model.number="options.AantalEindKlasBol" 
              type="number" 
              class="w-full rounded-md border border-rose-200 bg-white px-3 py-1.5 font-mono text-sm text-rose-900 focus:border-rose-500 focus:outline-none" 
            />
            <span class="mt-1 block text-[10px] text-rose-700/80">Eindstand Berg</span>
          </div>

          <div class="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
            <label class="mb-1 block text-xs font-semibold text-emerald-800">🟢 Puntenklassement (Groen)</label>
            <input 
              v-model.number="options.AantalEindKlasGroen" 
              type="number" 
              class="w-full rounded-md border border-emerald-200 bg-white px-3 py-1.5 font-mono text-sm text-emerald-900 focus:border-emerald-500 focus:outline-none" 
            />
            <span class="mt-1 block text-[10px] text-emerald-700/80">Eindstand Punten</span>
          </div>

          <div class="rounded-lg border border-slate-300 bg-slate-100/70 p-3">
            <label class="mb-1 block text-xs font-semibold text-slate-800">⚪ Jongerenklassement (Wit)</label>
            <input 
              v-model.number="options.AantalEindKlasWit" 
              type="number" 
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm text-slate-900 focus:border-slate-500 focus:outline-none" 
            />
            <span class="mt-1 block text-[10px] text-slate-600">Eindstand Jongeren</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
