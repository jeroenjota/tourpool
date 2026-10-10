<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { apiFetch } from '../services/api';
import { Building2, Edit2, Plus, RefreshCw, Trash2, X } from '@lucide/vue';

interface Organisation {
  orgID?: number;
  naam: string;
  straat: string | null;
  huisnummer: string | null;
  postcode: string | null;
  plaats: string | null;
  email: string | null;
  tel: string | null;
  poolCount?: number;
}

const organisations = ref<Organisation[]>([]);
const loading = ref(true);
const saving = ref(false);
const editing = ref<Organisation | null>(null);
const error = ref('');

const fields = [
  { key: 'straat', label: 'Straat', class: 'col-span-2 md:col-span-3' },
  { key: 'huisnummer', label: 'Huisnr.', class: 'col-span-1' },
  { key: 'postcode', label: 'Postcode', class: 'col-span-1' },
  { key: 'plaats', label: 'Plaats', class: 'col-span-2 md:col-span-3' },
  { key: 'tel', label: 'Telefoon', class: 'col-span-2' },
  { key: 'email', label: 'E-mail', class: 'col-span-2' }
] as const;

const address = (org: Organisation) => [
  [org.straat, org.huisnummer].filter(Boolean).join(' '),
  [org.postcode, org.plaats].filter(Boolean).join(' ')
].filter(Boolean).join(', ');

const fetchOrganisations = async () => {
  loading.value = true;
  try {
    organisations.value = await apiFetch<Organisation[]>('/organisations');
  } catch (err) {
    alert(`Fout bij laden: ${err instanceof Error ? err.message : err}`);
  } finally {
    loading.value = false;
  }
};

const openCreate = () => {
  error.value = '';
  editing.value = { naam: '', straat: '', huisnummer: '', postcode: '', plaats: '', email: '', tel: '' };
};

const openEdit = (org: Organisation) => {
  error.value = '';
  editing.value = { ...org };
};

const save = async () => {
  if (!editing.value) return;
  if (!editing.value.naam.trim()) {
    error.value = 'Vul de naam van de organisatie in.';
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    const { orgID, poolCount: _poolCount, ...body } = editing.value;
    await apiFetch(orgID ? `/organisations/${orgID}` : '/organisations', {
      method: orgID ? 'PUT' : 'POST',
      body: JSON.stringify(body)
    });
    editing.value = null;
    await fetchOrganisations();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    saving.value = false;
  }
};

const remove = async (org: Organisation) => {
  const warning = org.poolCount
    ? `\n\n${org.poolCount} pool(s) gebruiken deze organisatie; die houden de naam, maar verliezen het inleveradres.`
    : '';
  if (!confirm(`Organisatie "${org.naam}" verwijderen?${warning}`)) return;
  try {
    await apiFetch(`/organisations/${org.orgID}`, { method: 'DELETE' });
    await fetchOrganisations();
  } catch (err) {
    alert(`Fout bij verwijderen: ${err instanceof Error ? err.message : err}`);
  }
};

onMounted(fetchOrganisations);
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900 md:text-3xl">Organisaties</h2>
        <p class="text-xs text-slate-500">
          Organisatoren van pools en het adres waar deelnemers hun formulier inleveren en betalen
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button
          @click="fetchOrganisations"
          class="shadow-xs rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50"
          title="Verversen">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
        </button>
        <button @click="openCreate" class="btn flex items-center gap-2 text-sm">
          <Plus class="h-4 w-4" />
          <span>Nieuwe organisatie</span>
        </button>
      </div>
    </div>

    <p v-if="!loading && !organisations.length" class="text-sm text-slate-600">
      Er zijn nog geen organisaties.
    </p>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="org in organisations"
        :key="org.orgID"
        class="shadow-xs flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5">
        <div class="space-y-1 text-sm text-slate-700">
          <h3 class="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Building2 class="h-5 w-5 text-amber-600" />
            {{ org.naam }}
          </h3>
          <p v-if="address(org)">{{ address(org) }}</p>
          <p v-else class="italic text-rose-700">Geen inleveradres ingevuld</p>
          <p v-if="org.tel">Tel. {{ org.tel }}</p>
          <p v-if="org.email">{{ org.email }}</p>
          <p class="pt-1 text-xs text-slate-500">
            {{ org.poolCount ? `${org.poolCount} pool${org.poolCount === 1 ? '' : 's'}` : 'Niet gekoppeld aan een pool' }}
          </p>
        </div>
        <div class="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            @click="openEdit(org)"
            :aria-label="`${org.naam} bewerken`"
            class="rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <Edit2 class="h-4 w-4" />
          </button>
          <button
            @click="remove(org)"
            :aria-label="`${org.naam} verwijderen`"
            class="rounded p-1.5 text-rose-600 transition hover:bg-rose-50 hover:text-rose-700">
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      </article>
    </div>

    <div v-if="editing" class="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        @submit.prevent="save"
        class="w-full max-w-xl space-y-5 rounded-2xl border-4 border-slate-500 bg-yellow-100 p-6 shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 pb-4">
          <h3 class="text-lg font-bold text-slate-900">
            {{ editing.orgID ? `${editing.naam || 'Organisatie'} bewerken` : 'Nieuwe organisatie' }}
          </h3>
          <button type="button" @click="editing = null" aria-label="Sluiten" class="text-slate-400 hover:text-slate-700">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
          <label class="col-span-2 text-sm font-semibold text-slate-700 md:col-span-4">
            Naam *
            <input
              v-model="editing.naam"
              required
              class="mt-1 w-full rounded-lg border border-slate-500 bg-white px-2 py-1.5 text-base font-normal"
              placeholder="bv. Café de Laurierboom" />
          </label>
          <label v-for="field in fields" :key="field.key" class="text-sm font-semibold text-slate-700" :class="field.class">
            {{ field.label }}
            <input
              v-model="editing[field.key]"
              :type="field.key === 'email' ? 'email' : field.key === 'tel' ? 'tel' : 'text'"
              class="mt-1 w-full rounded-lg border border-slate-500 bg-white px-2 py-1.5 text-base font-normal" />
          </label>
        </div>
        <p v-if="editing.poolCount" class="text-xs text-slate-600">
          Wijzigingen gelden voor alle {{ editing.poolCount }} pool(s) van deze organisatie.
        </p>
        <p v-if="error" class="text-sm font-semibold text-rose-700">{{ error }}</p>

        <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button type="button" @click="editing = null" class="btn text-sm">Annuleren</button>
          <button type="submit" :disabled="saving" class="btn text-sm">{{ saving ? 'Opslaan...' : 'Opslaan' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>
