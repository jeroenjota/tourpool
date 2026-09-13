<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiFetch } from '../services/api';

interface Stage {
  tour: string;
  etappeNr: number;
  datum?: string | null;
  Start?: string | null;
  Finish?: string | null;
  kms?: number | null;
  type?: string | null;
}

const stages = ref<Stage[]>([]);
const loading = ref(true);

const fetchStages = async () => {
  loading.value = true;
  try {
    stages.value = await apiFetch<Stage[]>('/stages');
  } catch (err) {
    console.error('Error fetching stages:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchStages);
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-xl font-bold text-slate-900">Etappe-overzicht</h2>
        <p class="text-xs text-slate-500">Routes, datums, afstanden en typen ritten</p>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-700">
          <thead class="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th class="px-5 py-3.5">Etappe</th>
              <th class="px-5 py-3.5">Datum</th>
              <th class="px-5 py-3.5">Start</th>
              <th class="px-5 py-3.5">Finish</th>
              <th class="px-5 py-3.5">Afstand</th>
              <th class="px-5 py-3.5">Type</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loading">
              <td colspan="6" class="px-5 py-8 text-center text-slate-400">Etappes laden...</td>
            </tr>
            <tr v-for="s in stages" :key="s.etappeNr" class="hover:bg-slate-50/80 transition">
              <td class="px-5 py-3 font-mono font-bold text-amber-600">#{{ s.etappeNr }}</td>
              <td class="px-5 py-3 text-slate-500">{{ s.datum ? new Date(s.datum).toLocaleDateString('nl-NL') : '-' }}</td>
              <td class="px-5 py-3 font-semibold text-slate-900">{{ s.Start || '-' }}</td>
              <td class="px-5 py-3 font-semibold text-slate-900">{{ s.Finish || '-' }}</td>
              <td class="px-5 py-3 font-mono text-xs text-slate-600 font-medium">{{ s.kms ? `${s.kms} km` : '-' }}</td>
              <td class="px-5 py-3">
                <span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700">
                  {{ s.type || 'Vlak' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
