<script setup lang="ts">
import { KeyRound } from '@lucide/vue';
import AccountSettings from '@tourpool/client/AccountSettings.vue';
import { auth } from '@tourpool/client';
</script>

<template>
  <section class="mx-auto max-w-xl space-y-5 p-4 sm:p-6">
    <header>
      <div class="flex items-center gap-3">
        <KeyRound class="h-7 w-7 text-amber-700" />
        <h1 class="text-2xl font-bold text-slate-900">Mijn account</h1>
      </div>
      <p class="mt-2 text-sm text-slate-600">Ingelogd als {{ auth.account?.username }} ({{ auth.account?.email }}).</p>
    </header>
    <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <AccountSettings />
    </div>
  </section>
</template>
