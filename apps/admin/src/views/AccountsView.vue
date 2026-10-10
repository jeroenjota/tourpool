<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { UserCog } from '@lucide/vue';
import { auth, errorMessage, type Role } from '@tourpool/client';
import { apiFetch } from '../services/api';

interface ManagedAccount {
  accountID: number; adrID: number; username: string; email: string; emailVerified: boolean; role: Role;
  vNaam: string | null; tNaam: string | null; aNaam: string | null; poolIDs: number[];
}
interface PoolSummary { poolID: number; Naam: string | null; Org: string | null; tourNaam: string | null }
interface Draft { role: Role; poolIDs: number[] }

const accounts = ref<ManagedAccount[]>([]);
const pools = ref<PoolSummary[]>([]);
const drafts = ref<Record<number, Draft>>({});
const loading = ref(true);
const busyID = ref<number | null>(null);
const error = ref('');
const message = ref('');
const search = ref('');
const roleLabels: Record<Role, string> = { admin: 'Beheerder', poolbeheerder: 'Poolbeheerder', user: 'Deelnemer' };

const fullName = (a: ManagedAccount) => [a.vNaam, a.tNaam, a.aNaam].filter(Boolean).join(' ');
const poolLabel = (p: PoolSummary) => `${p.Org ? `${p.Org} - ` : ''}${p.Naam || `Pool #${p.poolID}`}${p.tourNaam ? ` (${p.tourNaam})` : ''}`;
const filtered = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) return accounts.value;
  return accounts.value.filter(a => `${a.username} ${a.email} ${fullName(a)}`.toLowerCase().includes(term));
});
const isDirty = (a: ManagedAccount) => {
  const draft = drafts.value[a.accountID];
  return draft.role !== a.role
    || (draft.role === 'poolbeheerder' && [...draft.poolIDs].sort().join(',') !== [...a.poolIDs].sort().join(','));
};

async function load() {
  loading.value = true; error.value = '';
  try {
    [accounts.value, pools.value] = await Promise.all([
      apiFetch<ManagedAccount[]>('/accounts/manage'),
      apiFetch<PoolSummary[]>('/pools')
    ]);
    drafts.value = Object.fromEntries(accounts.value.map(a => [a.accountID, { role: a.role, poolIDs: [...a.poolIDs] }]));
  } catch (err) { error.value = errorMessage(err); }
  finally { loading.value = false; }
}

async function save(account: ManagedAccount) {
  const draft = drafts.value[account.accountID];
  if (draft.role === 'poolbeheerder' && draft.poolIDs.length === 0) {
    error.value = `Kies minstens één pool voor poolbeheerder ${account.username}.`; message.value = '';
    return;
  }
  busyID.value = account.accountID; error.value = ''; message.value = '';
  try {
    const result = await apiFetch<{ role: Role; poolIDs: number[] }>(`/accounts/${account.accountID}`, {
      method: 'PUT', body: JSON.stringify({ role: draft.role, poolIDs: draft.role === 'poolbeheerder' ? draft.poolIDs : [] })
    });
    account.role = result.role;
    account.poolIDs = result.poolIDs;
    drafts.value[account.accountID] = { role: result.role, poolIDs: [...result.poolIDs] };
    message.value = `Rechten van ${account.username} opgeslagen.`;
  } catch (err) { error.value = errorMessage(err); }
  finally { busyID.value = null; }
}

async function sendReset(account: ManagedAccount) {
  if (!confirm(`Een link om het wachtwoord opnieuw in te stellen naar ${account.email} sturen?`)) return;
  busyID.value = account.accountID; error.value = ''; message.value = '';
  try {
    const result = await apiFetch<{ message: string }>(`/accounts/${account.accountID}/password-reset`, { method: 'POST' });
    message.value = result.message;
  } catch (err) { error.value = errorMessage(err); }
  finally { busyID.value = null; }
}

onMounted(load);
</script>

<template>
  <section class="space-y-4 p-1 sm:p-2">
    <header>
      <div class="flex items-center gap-3">
        <UserCog class="h-7 w-7 text-amber-700" />
        <h1 class="text-2xl font-bold text-slate-900">Accounts &amp; rechten</h1>
      </div>
      <p class="mt-1 text-sm text-slate-700">
        Een poolbeheerder kan voor de gekoppelde pools deelnemers toevoegen, punten toekennen, opties instellen en standen afdrukken.
      </p>
      <input v-model="search" type="search" placeholder="Zoek op naam, gebruikersnaam of e-mail"
        class="mt-3 w-full max-w-md rounded-lg border border-slate-400 bg-white px-3 py-2 text-sm" />
      <p v-if="error" class="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{{ error }}</p>
      <p v-if="message" class="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{{ message }}</p>
    </header>

    <p v-if="loading" class="text-slate-700">Accounts laden...</p>
    <p v-else-if="!filtered.length" class="text-slate-700">Geen accounts gevonden.</p>
    <ul v-else class="space-y-3">
      <li v-for="account in filtered" :key="account.accountID" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <fieldset :disabled="busyID === account.accountID" class="min-w-0">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold text-slate-900">
                {{ account.username }}
                <span v-if="account.accountID === auth.account?.accountID" class="text-xs font-normal text-slate-500">(jij)</span>
              </p>
              <p class="text-sm text-slate-600">{{ fullName(account) }} · {{ account.email }}</p>
              <p v-if="!account.emailVerified" class="text-xs text-amber-700">E-mailadres nog niet bevestigd</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <label class="text-sm font-medium text-slate-700">Rol
                <select v-model="drafts[account.accountID].role"
                  class="ml-1 rounded-md border border-slate-400 bg-white px-2 py-1.5 text-sm"
                  :disabled="account.accountID === auth.account?.accountID">
                  <option v-for="(label, role) in roleLabels" :key="role" :value="role">{{ label }}</option>
                </select>
              </label>
              <button type="button"
                class="btn text-sm"
                :disabled="!isDirty(account)" @click="save(account)">Opslaan</button>
              <button type="button"
                class="btn text-sm"
                @click="sendReset(account)">Resetlink sturen</button>
            </div>
          </div>
          <div v-if="drafts[account.accountID].role === 'poolbeheerder'" class="mt-3 border-t border-slate-100 pt-3">
            <p class="mb-1 text-sm font-medium text-slate-700">Beheert pools:</p>
            <p v-if="!pools.length" class="text-sm text-slate-500">Er zijn nog geen pools.</p>
            <div class="flex flex-wrap gap-x-4 gap-y-1">
              <label v-for="p in pools" :key="p.poolID" class="flex items-center gap-1.5 text-sm text-slate-700">
                <input v-model="drafts[account.accountID].poolIDs" type="checkbox" :value="p.poolID" />
                {{ poolLabel(p) }}
              </label>
            </div>
          </div>
        </fieldset>
      </li>
    </ul>
  </section>
</template>
