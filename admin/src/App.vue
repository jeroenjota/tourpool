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
  LayoutDashboard,
  UserCheck
} from '@lucide/vue';

const route = useRoute();

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Adresboek', path: '/addresses', icon: Contact },
  { name: 'Renners', path: '/riders', icon: Bike },
  { name: 'Ploegen', path: '/teams', icon: Shield },
  { name: 'Tours', path: '/tours', icon: Calendar },
  { name: 'Ploegopstellingen', path: '/team-riders', icon: Users },
  { name: 'Etappes', path: '/stages', icon: MapPin },
  { name: 'Pools', path: '/pools', icon: Trophy },
  { name: 'Pool Deelnemers', path: '/participants', icon: UserCheck },
  { name: 'Pool Opties', path: '/options', icon: Sliders },
];
</script>

<template>
  <div class="flex min-h-screen bg-slate-50 text-slate-800">
    <!-- Sidebar -->
    <aside class="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div class="flex items-center space-x-3 border-b border-slate-200 p-5">
        <div class="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-amber-600">
          <Bike class="h-6 w-6" />
        </div>
        <div>
          <h1 class="text-lg font-bold leading-none tracking-wide text-slate-900">Tourpool Admin</h1>
          <span class="text-xs font-semibold text-amber-600">Beheersysteem</span>
        </div>
      </div>

      <nav class="flex-1 space-y-1 overflow-y-auto p-3">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors"
          :class="[
            route.path === item.path 
              ? 'bg-amber-50 text-amber-700 border border-amber-200/80 font-semibold' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
          ]"
        >
          <component :is="item.icon" class="h-4 w-4" />
          <span>{{ item.name }}</span>
        </RouterLink>
      </nav>

      <div class="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-500">
        <span>API: <span class="font-medium text-emerald-600">Verbonden</span></span>
        <span class="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700">v0.1.0</span>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header class="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
        <h2 class="text-lg font-bold capitalize text-slate-900">
          {{ navItems.find(i => i.path === route.path)?.name || 'Tourpool' }}
        </h2>
        <div class="flex items-center gap-3 text-xs text-slate-600">
          <span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 font-medium">
            <span class="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
            MariaDB Active
          </span>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto bg-slate-50 p-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>
