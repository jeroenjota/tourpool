<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { apiFetch } from '../services/api';

interface Tour { tourID: number; naam: string }
interface Rider {
  rennerID: number;
  vnaam?: string | null;
  tnaam?: string | null;
  anaam: string;
  nietGestartEtappe?: number | null;
}
interface Result { uitslagType: string; plaats: number; rennerID: number }
const categories = [
  { key: 'eindKlas', label: 'Algemeen klassement', limit: 'AantalEindKlasGeel' },
  { key: 'eindPunt', label: 'Puntenklassement', limit: 'AantalEindKlasGroen' },
  { key: 'eindBerg', label: 'Bergklassement', limit: 'AantalEindKlasBol' },
  { key: 'eindJon', label: 'Jongerenklassement', limit: 'AantalEindKlasWit' }
] as const;
type Category = typeof categories[number]['key'];
type Limits = Partial<Record<typeof categories[number]['limit'], number | null>> & { poolID: number };
const tours = ref<Tour[]>([]);
const tourID = ref<number | null>(null);
const finalStage = ref<number | null>(null);
const riders = ref<Rider[]>([]);
const form = ref<Record<Category, Array<number | null>>>({ eindKlas: [], eindPunt: [], eindBerg: [], eindJon: [] });
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const success = ref('');
const sortedRiders = computed(() => [...riders.value].sort((a, b) => a.anaam.localeCompare(b.anaam, 'nl')));
const riderName = (rider: Rider) => [rider.anaam, [rider.vnaam, rider.tnaam].filter(Boolean).join(' ')].filter(Boolean).join(', ');

const loadTour = async () => {
  finalStage.value = null;
  error.value = '';
  success.value = '';
  if (tourID.value == null) return;
  loading.value = true;
  try {
    const [stages, tourRiders, pools, options, results] = await Promise.all([
      apiFetch<Array<{ etappeNr: number | null }>>(`/stages?tour=${tourID.value}`),
      apiFetch<Rider[]>(`/team-riders?tourID=${tourID.value}&activeOnly=1`),
      apiFetch<Array<{ poolID: number; tourID: number }>>('/pools'),
      apiFetch<Limits[]>('/options'),
      apiFetch<Array<Result & { etappeNr: number }>>(`/stage-results?tourID=${tourID.value}`)
    ]);
    const lastStage = Math.max(0, ...stages.map(stage => stage.etappeNr ?? 0));
    if (!lastStage) throw new Error('Deze tour heeft nog geen etappes.');
    finalStage.value = lastStage + 1;
    riders.value = tourRiders.filter(rider => rider.nietGestartEtappe == null || rider.nietGestartEtappe > lastStage);
    const poolIDs = new Set(pools.filter(pool => pool.tourID === tourID.value).map(pool => pool.poolID));
    const tourOptions = options.filter(option => poolIDs.has(option.poolID));
    for (const category of categories) {
      const existing = results.filter(result => result.etappeNr === finalStage.value && result.uitslagType === category.key);
      const count = Math.max(1, ...tourOptions.map(option => Number(option[category.limit] ?? 0)), ...existing.map(result => result.plaats));
      form.value[category.key] = Array.from({ length: count }, (_, index) =>
        existing.find(result => result.plaats === index + 1)?.rennerID ?? null
      );
    }
  } catch (cause) {
    error.value = `Eindklassementen laden mislukt: ${cause instanceof Error ? cause.message : String(cause)}`;
  } finally {
    loading.value = false;
  }
};

const save = async () => {
  if (tourID.value == null || finalStage.value == null) return;
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    const results: Result[] = [];
    for (const category of categories) {
      const selected = form.value[category.key];
      const filled = selected.filter((id): id is number => id !== null);
      if (new Set(filled).size !== filled.length) throw new Error(`Een renner staat dubbel in ${category.label.toLowerCase()}.`);
      selected.forEach((rennerID, index) => {
        if (rennerID !== null) results.push({ uitslagType: category.key, plaats: index + 1, rennerID });
      });
    }
    await apiFetch(`/stage-results/final/${tourID.value}`, {
      method: 'PUT',
      body: JSON.stringify({ tourID: tourID.value, etappeNr: finalStage.value, results })
    });
    success.value = 'Eindklassementen opgeslagen. Punten, eindprijzen en totaal prijzengeld zijn opnieuw berekend voor alle pools van deze tour.';
  } catch (cause) {
    error.value = `Opslaan mislukt: ${cause instanceof Error ? cause.message : String(cause)}`;
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  try {
    tours.value = await apiFetch<Tour[]>('/tours');
    tourID.value = tours.value[0]?.tourID ?? null;
    await loadTour();
  } catch (cause) {
    error.value = `Tours laden mislukt: ${cause instanceof Error ? cause.message : String(cause)}`;
  }
});
</script>

<template>
  <div class="h-full space-y-4 overflow-y-auto">
    <h2 class="text-xl font-bold text-slate-900">Eindklassementen</h2>
    <p class="text-sm text-slate-600">Voer de definitieve klassementen na de laatste etappe in. Elke pool gebruikt zijn eigen aantallen en puntenregels.</p>
    <label class="block text-sm font-medium">
      Tour
      <select v-model="tourID" :disabled="loading || saving" class="ml-2 rounded border border-slate-300 p-2" @change="loadTour">
        <option v-for="tour in tours" :key="tour.tourID" :value="tour.tourID">{{ tour.naam }}</option>
      </select>
    </label>
    <p v-if="finalStage" class="text-sm text-slate-600">De eindstand wordt verwerkt op etappe {{ finalStage }} (laatste etappe + 1), zonder extra dagprijzen.</p>
    <p v-if="error" role="alert" class="rounded border border-rose-200 bg-rose-50 p-3 text-rose-700">{{ error }}</p>
    <p v-if="success" role="status" class="rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">{{ success }}</p>
    <p v-if="loading">Laden...</p>
    <form v-else-if="finalStage" class="space-y-4" @submit.prevent="save">
      <div class="grid gap-4 lg:grid-cols-2">
        <section v-for="category in categories" :key="category.key" class="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h3 class="font-semibold">{{ category.label }}</h3>
          <label v-for="(_, index) in form[category.key]" :key="index" class="flex items-center gap-3 text-sm">
            <span class="w-6">{{ index + 1 }}.</span>
            <select v-model="form[category.key][index]" :disabled="saving" class="min-w-0 flex-1 rounded border border-slate-300 p-2">
              <option :value="null">Niet ingevoerd</option>
              <option v-for="rider in sortedRiders" :key="rider.rennerID" :value="rider.rennerID">{{ riderName(rider) }}</option>
            </select>
          </label>
          <button v-if="form[category.key].length < 10" type="button" class="btn text-sm" :disabled="saving" @click="form[category.key].push(null)">Plaats toevoegen</button>
        </section>
      </div>
      <button type="submit" class="btn" :disabled="saving">{{ saving ? 'Verwerken...' : 'Eindstand opslaan en verwerken' }}</button>
    </form>
  </div>
</template>
