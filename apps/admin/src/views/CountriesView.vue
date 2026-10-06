<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiFetch } from '../services/api';
import { Search } from '@lucide/vue';

interface Country {
  id: number;
  country: string;
  land: string;
  iso2: string;
  code: string;
  continent: string;
  vlag: string;
}

const countries = ref<Country[]>([]);
const searchQuery = ref('');
const loading = ref(true);

const fetchCountries = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (searchQuery.value) params.append('search', searchQuery.value);
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    countries.value = await apiFetch<Country[]>(`/countries${queryStr}`);
  } catch (err) {
    console.error('Error fetching countries:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchCountries);
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-xl font-bold text-white">Landenoverzicht</h2>
        <p class="text-xs text-slate-400">Landcodes, vlaggen en continenten (tblLanden)</p>
      </div>
    </div>

    <!-- Search -->
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4">
      <div class="relative">
        <Search class="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
        <input 
          v-model="searchQuery" 
          @input="fetchCountries"
          placeholder="Zoek land op naam of code..." 
          class="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
        />
      </div>
    </div>

    <!-- Table -->
    <div class="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-300">
          <thead class="bg-slate-900/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th class="px-5 py-3.5">Vlag</th>
              <th class="px-5 py-3.5">Land (NL)</th>
              <th class="px-5 py-3.5">Country (EN)</th>
              <th class="px-5 py-3.5">ISO-2</th>
              <th class="px-5 py-3.5">Code (3-letter)</th>
              <th class="px-5 py-3.5">Continent</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-850">
            <tr v-if="loading">
              <td colspan="6" class="px-5 py-8 text-center text-slate-500">Landen laden...</td>
            </tr>
            <tr v-for="c in countries" :key="c.id" class="hover:bg-slate-900/50 transition">
              <td class="px-5 py-3 text-xl">{{ c.vlag }}</td>
              <td class="px-5 py-3 font-medium text-white">{{ c.land }}</td>
              <td class="px-5 py-3 text-slate-400">{{ c.country }}</td>
              <td class="px-5 py-3 font-mono text-amber-400 font-semibold">{{ c.iso2 }}</td>
              <td class="px-5 py-3 font-mono text-slate-300">{{ c.code }}</td>
              <td class="px-5 py-3 text-slate-400">{{ c.continent }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
