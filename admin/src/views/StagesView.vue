<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiFetch } from '../services/api';
import { RefreshCw } from '@lucide/vue';

interface Stage {
  tour: string;
  etappeNr?: number | null;
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
    const list = await apiFetch<Stage[]>('/stages');
    // Sorteer op datum
    stages.value = list.sort((a, b) => {
      const dateA = a.datum ? new Date(a.datum).getTime() : 0;
      const dateB = b.datum ? new Date(b.datum).getTime() : 0;
      return dateA - dateB;
    });
  } catch (err) {
    console.error('Error fetching stages:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchStages);

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
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900">Etappe-overzicht</h2>
        <p class="text-xs text-slate-500">Volledig rittenschema op chronologische volgorde van datum</p>
      </div>
      <button 
        @click="fetchStages" 
        class="shadow-xs rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50"
        title="Verversen"
      >
        <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <!-- Table -->
    <div class="shadow-xs overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-700">
          <thead class="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-5 py-3.5">Datum</th>
              <th class="px-5 py-3.5">Etappe</th>
              <th class="px-5 py-3.5">Start</th>
              <th class="px-5 py-3.5">Finish</th>
              <th class="px-5 py-3.5">Afstand</th>
              <th class="px-5 py-3.5">Type</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loading && stages.length === 0">
              <td colspan="6" class="px-5 py-8 text-center text-slate-400">Etappes laden...</td>
            </tr>
            <tr 
              v-for="s in stages" 
              :key="s.datum || s.etappeNr || Math.random()" 
              class="transition"
              :class="s.type === 'rustdag' ? 'bg-slate-50/50 hover:bg-slate-100/50' : 'hover:bg-slate-50/80'"
            >
              <!-- Datum -->
              <td class="px-5 py-3.5 text-xs font-medium text-slate-600 capitalize">
                {{ formatStageDate(s.datum) }}
              </td>

              <!-- Etappe Nr -->
              <td class="px-5 py-3.5 font-mono">
                <span v-if="s.etappeNr" class="font-bold text-amber-700 bg-amber-50 border border-amber-200/80 rounded px-2 py-0.5 text-xs">
                  #{{ s.etappeNr }}
                </span>
                <span v-else class="text-xs text-slate-400 font-sans italic">
                  Rustdag
                </span>
              </td>

              <!-- Start -->
              <td class="px-5 py-3.5">
                <span v-if="s.Start" class="font-semibold text-slate-900">{{ s.Start }}</span>
                <span v-else class="text-slate-400 italic text-xs">-</span>
              </td>

              <!-- Finish -->
              <td class="px-5 py-3.5">
                <span v-if="s.Finish" class="font-semibold text-slate-900">{{ s.Finish }}</span>
                <span v-else class="text-slate-400 italic text-xs">-</span>
              </td>

              <!-- Afstand -->
              <td class="px-5 py-3.5 font-mono text-xs text-slate-600 font-medium">
                {{ s.kms ? `${s.kms} km` : '-' }}
              </td>

              <!-- Type -->
              <td class="px-5 py-3.5">
                <span class="rounded border px-2.5 py-0.5 text-xs font-semibold capitalize" :class="getTypeBadgeClass(s.type)">
                  {{ s.type || 'Vlak' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer count -->
      <div class="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500 flex justify-between items-center">
        <span>Totaal <strong>{{ stages.length }}</strong> rittendagen getoond</span>
        <span class="text-slate-400">Chronologisch gesorteerd inclusief rustdagen</span>
      </div>
    </div>
  </div>
</template>
