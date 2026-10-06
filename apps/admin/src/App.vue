<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { apiFetch } from './services/api';
import { useActivePoolStore } from './stores/activePool';
import { 
  Bike, 
  Users, 
  Shield, 
  MapPin, 
  Calendar, 
  Trophy, 
  Contact, 
  Sliders, 
  UserCheck,
  Award,
  ArrowLeft
} from '@lucide/vue';

const route = useRoute();
const activePoolStore = useActivePoolStore();
const showPoolHeader = computed(() => route.meta.poolPage === true);
const isNavItemActive = (path: string) =>
  route.path === path || (path === '/pools' && route.path.startsWith('/pools/'));
const headerPool = ref<{ poolID: number; Naam: string | null; Org: string | null } | null>(null);
const poolHeaderLoading = ref(false);
const poolHeaderError = ref('');

watch(
  [() => route.path, () => activePoolStore.activePoolID],
  async (_values, _oldValues, onCleanup) => {
    let current = true;
    onCleanup(() => { current = false; });
    headerPool.value = null;
    poolHeaderError.value = '';
    poolHeaderLoading.value = false;
    const poolID = activePoolStore.activePoolID;
    if (!showPoolHeader.value || !poolID) return;

    poolHeaderLoading.value = true;
    try {
      const pool = await apiFetch<NonNullable<typeof headerPool.value>>(`/pools/${poolID}`);
      if (current) headerPool.value = pool;
    } catch (error) {
      if (current) {
        poolHeaderError.value = `Fout bij laden van pool: ${error instanceof Error ? error.message : String(error)}`;
      }
    } finally {
      if (current) poolHeaderLoading.value = false;
    }
  },
  { immediate: true }
);

const navItems = [
  { name: 'Adresboek', path: '/addresses', icon: Contact },
  { name: 'Tours', path: '/tours', icon: Calendar },
  { name: 'Renners', path: '/riders', icon: Bike },
  { name: 'Ploegen', path: '/teams', icon: Shield },
  { name: 'Ploegopstellingen', path: '/team-riders', icon: Users },
  { name: 'Etappes', path: '/stages', icon: MapPin },
  { name: 'Standaard Punten', path: '/standard-points', icon: Award },
  { name: 'Pools', path: '/pools', icon: Trophy },
];

const poolNavItems = [
  { name: 'Deelnemers', page: 'participants', icon: UserCheck },
  { name: 'Poolstand', page: 'standings', icon: Trophy },
  { name: 'Puntentoekenning', page: 'point-allocations', icon: Award },
  { name: 'Opties', page: 'options', icon: Sliders },
];
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-slate-50 text-slate-800">
    <!-- Sidebar -->
    <aside class="fixed inset-y-0 left-0 z-30 flex h-screen w-64 flex-col border-r border-slate-200 bg-yellow-200">
      <RouterLink to="/" class="flex items-center space-x-3 border-b border-slate-200 p-5 transition-colors hover:bg-slate-50">
        <div class="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-amber-600">
          <Bike class="h-6 w-6" />
        </div>
        <div>
          <h1 class="text-lg font-bold leading-none tracking-wide text-slate-900">Tourpool</h1>
          <span class="text-xs font-semibold text-amber-600">Beheersysteem</span>
        </div>
      </RouterLink>

      <nav class="flex-1 space-y-1 overflow-y-auto border-b-2 p-2">
        <template v-for="item in navItems" :key="item.path">
          <RouterLink
          :to="item.path"
          class="flex items-center gap-3 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors"
          :class="[
            isNavItemActive(item.path)
              ? 'bg-amber-50 text-red-700 border border-amber-200/80 font-semibold' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
          ]"
        >
          <component :is="item.icon" class="h-4 w-4" />
          <span>{{ item.name }}</span>
          </RouterLink>
          <div v-if="item.path === '/' || item.path === '/addresses' || item.path === '/stages'" class="my-3 border-t border-slate-200"></div>
        </template>
      </nav>

      <div class="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-500">
        <span>API: <span class="font-medium text-emerald-600">Verbonden</span></span>
        <span class="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700">v0.1.0</span>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="ml-64 flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-yellow-300">
      <header
        v-if="showPoolHeader"
        class="mx-4 my-2 shrink-0 rounded-xl border border-b border-yellow-800 bg-yellow-400 px-8 py-4"
        aria-label="Pool"
        aria-live="polite"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <RouterLink to="/pools" class="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900">
            <ArrowLeft class="h-4 w-4" />
            <span>Pools</span>
          </RouterLink>
          <p v-if="poolHeaderLoading" class="text-sm text-slate-500">Pool laden...</p>
          <h2 v-else-if="poolHeaderError" role="alert" class="text-sm text-red-700">{{ poolHeaderError }}</h2>
          <span v-else-if="headerPool" class="font-heading text-2xl font-semibold text-slate-900">
            <template v-if="headerPool.Org">{{ headerPool.Org }} - </template>{{ headerPool.Naam || `Pool #${headerPool.poolID}` }}
          </span>
          <nav class="flex flex-wrap gap-1" aria-label="Poolonderdelen">
            <RouterLink
              v-for="item in poolNavItems"
              :key="item.page"
              :to="`/pools/${route.params.poolID}/${item.page}`"
              class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              :class="route.name === item.page
                ? 'border border-amber-200/80 bg-amber-50 font-semibold text-red-700'
                : 'text-slate-700 hover:bg-yellow-300 hover:text-slate-900'"
            >
              <component :is="item.icon" class="h-4 w-4" />
              <span>{{ item.name }}</span>
            </RouterLink>
          </nav>
        </div>
      </header>
      <main class="h-full min-h-0 flex-1 overflow-hidden bg-yellow-300 px-8 py-4">
        <RouterView v-slot="{ Component }">
          <component :is="Component" class="route-page" />
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style>
.route-page {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
}

.route-page > :first-child {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #fde047;
  padding-bottom: 1rem;
}
</style>
