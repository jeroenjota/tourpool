<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router';
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
  Award
} from '@lucide/vue';

const route = useRoute();

const navItems = [
  { name: 'Adresboek', path: '/addresses', icon: Contact },
  { name: 'Tours', path: '/tours', icon: Calendar },
  { name: 'Renners', path: '/riders', icon: Bike },
  { name: 'Ploegen', path: '/teams', icon: Shield },
  { name: 'Ploegopstellingen', path: '/team-riders', icon: Users },
  { name: 'Etappes', path: '/stages', icon: MapPin },
  { name: 'Standaard Punten', path: '/standard-points', icon: Award },
  { name: 'Pools', path: '/pools', icon: Trophy },
  { name: 'Pool Deelnemers', path: '/participants', icon: UserCheck },
  { name: 'Pool Opties', path: '/options', icon: Sliders },
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
            route.path === item.path 
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
    <div class="ml-64 flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
      <main class="h-full min-h-0 flex-1 overflow-hidden bg-yellow-300 px-8">
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
