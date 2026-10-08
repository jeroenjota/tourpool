<script setup lang="ts">
import { ref } from 'vue';
import { Mail } from '@lucide/vue';
import { apiFetch } from '../services/api';

const sending = ref(false);
const error = ref('');
const success = ref('');

async function sendTestEmail() {
  sending.value = true;
  error.value = '';
  success.value = '';
  try {
    const result = await apiFetch<{ message: string }>('/admin/test-email', { method: 'POST' });
    success.value = result.message;
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
    <header>
      <div class="flex items-center gap-3">
        <Mail class="h-7 w-7 text-amber-700" />
        <h1 class="text-2xl font-bold text-slate-900">E-mail testen</h1>
      </div>
      <p class="mt-2 text-sm text-slate-600">
        Verstuur een testbericht naar het adres dat op de server is ingesteld als
        <code>CONTACT_RECEIVER</code>. SMTP-gegevens worden niet in deze module getoond.
      </p>
    </header>

    <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p v-if="error" class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
        Testmail versturen mislukt: {{ error }}
      </p>
      <p v-if="success" class="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">
        {{ success }}
      </p>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="sending"
        @click="sendTestEmail">
        <Mail class="h-4 w-4" />
        {{ sending ? 'Verzenden...' : 'Verstuur testmail' }}
      </button>
    </div>
  </section>
</template>
