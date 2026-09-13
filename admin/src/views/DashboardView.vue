<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiFetch } from '../services/api';
import { Bike, Shield, MapPin, Trophy, Users, UserCheck, Contact } from '@lucide/vue';

const stats = ref({
  riders: 0,
  teams: 0,
  stages: 0,
  pools: 0,
  teamRiders: 0,
  addresses: 0,
  participants: 0
});
const loading = ref(true);

onMounted(async () => {
  try {
    const [riders, teams, stages, pools, teamRiders, addresses, participants] = await Promise.all([
      apiFetch<any[]>('/riders'),
      apiFetch<any[]>('/teams'),
      apiFetch<any[]>('/stages'),
      apiFetch<any[]>('/pools'),
      apiFetch<any[]>('/team-riders'),
      apiFetch<any[]>('/addresses'),
      apiFetch<any[]>('/participants')
    ]);

    stats.value = {
      riders: riders.length,
      teams: teams.length,
      stages: stages.length,
      pools: pools.length,
      teamRiders: teamRiders.length,
      addresses: addresses.length,
      participants: participants.length
    };
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
  } finally {
    loading.value = false;
  }
});

const cards = [
  { label: 'Renners', key: 'riders', icon: Bike, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
  { label: 'Ploegen', key: 'teams', icon: Shield, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { label: 'Ploegopstellingen', key: 'teamRiders', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  { label: 'Etappes', key: 'stages', icon: MapPin, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  { label: 'Actieve Pools', key: 'pools', icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { label: 'Adresboek (Contacten)', key: 'addresses', icon: Contact, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  { label: 'Pool Deelnemers', key: 'participants', icon: UserCheck, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' }
];    
</script>

<template>
  <div class="space-y-8">
    <div>
      <h2 class="text-2xl font-bold tracking-tight text-slate-900">Tourpool Beheerdashboard</h2>
      <p class="mt-1 text-sm text-slate-500">Overzicht van data en configuratie in MariaDB</p>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      <div 
        v-for="card in cards" 
        :key="card.key"
        class="shadow-xs flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 transition hover:shadow-sm"
      >
        <div>
          <span class="text-sm font-medium text-slate-500">{{ card.label }}</span>
          <div class="mt-2 text-3xl font-bold text-slate-900">
            <span v-if="loading" class="animate-pulse text-2xl text-slate-400">...</span>
            <span v-else>{{ stats[card.key as keyof typeof stats] }}</span>
          </div>
        </div>
        <div :class="['p-3 rounded-xl border', card.bg, card.color, card.border]">
          <component :is="card.icon" class="h-6 w-6" />
        </div>
      </div>
    </div>

    <!-- Snelkoppelingen -->
    <div class="shadow-xs rounded-xl border border-slate-200 bg-white p-6">
      <h3 class="mb-4 text-base font-semibold text-slate-900">Snelle acties</h3>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <RouterLink 
          to="/riders" 
          class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
        >
          <Bike class="h-5 w-5 text-sky-600" />
          <span class="text-sm font-medium">Renners beheren</span>
        </RouterLink>
        <RouterLink 
          to="/team-riders" 
          class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
        >
          <Users class="h-5 w-5 text-indigo-600" />
          <span class="text-sm font-medium">Opstellingen bekijken</span>
        </RouterLink>
        <RouterLink 
          to="/stages" 
          class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
        >
          <MapPin class="h-5 w-5 text-rose-600" />
          <span class="text-sm font-medium">Etappeschema inzien</span>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
