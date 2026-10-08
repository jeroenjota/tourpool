<script setup lang="ts">
import { ref } from 'vue';
import { apiFetch, ApiError, auth, emptyProfile, errorMessage, login, logout } from './index';
import ProfileFields from './ProfileFields.vue';
const props = defineProps<{ admin?: boolean }>();
const emit = defineEmits<{ signedIn: [] }>();
const registering = ref(false);
const identifier = ref('');
const password = ref('');
const profile = ref(emptyProfile());
const website = ref('');
const busy = ref(false);
const error = ref('');
const message = ref('');
async function submit() {
  busy.value = true; error.value = ''; message.value = '';
  try {
    if (registering.value) {
      const { username, email, ...profileFields } = profile.value;
      await apiFetch('/auth/register', {
        method: 'POST', body: JSON.stringify({
          username, email, password: password.value, profile: profileFields, website: website.value
        })
      });
      identifier.value = email;
      registering.value = false;
      password.value = '';
      website.value = '';
      message.value = 'Controleer je e-mail en bevestig je adres voordat je inlogt.';
    } else {
      await login(identifier.value, password.value);
      if (props.admin && auth.account?.role !== 'admin') {
        await logout();
        throw new Error('Dit account is geen beheerder. Log in via de deelnemersapp.');
      }
      password.value = '';
      emit('signedIn');
    }
  } catch (err) {
    if (registering.value && err instanceof ApiError && err.status === 503) {
      identifier.value = profile.value.email;
      registering.value = false;
      password.value = '';
    }
    error.value = errorMessage(err);
  }
  finally { busy.value = false; }
}
async function resendVerification() {
  busy.value = true; error.value = ''; message.value = '';
  try {
    const result = await apiFetch<{ message: string }>('/auth/resend-verification', {
      method: 'POST', body: JSON.stringify({ email: identifier.value })
    });
    message.value = result.message;
  } catch (err) { error.value = errorMessage(err); }
  finally { busy.value = false; }
}
</script>

<template>
  <form class="mx-auto my-12 max-w-md rounded-xl border border-yellow-700 bg-yellow-100 p-6 text-slate-800" @submit.prevent="submit">
    <h1 class="mb-4 text-2xl font-bold">{{ registering ? 'Account aanmaken' : admin ? 'Tourpool beheer - Inloggen' : 'Jota\'s Tourpool - Inloggen' }}</h1>
    <p v-if="error" class="text-red-700" role="alert">{{ error }}</p>
    <p v-if="message" class="text-green-800" role="status">{{ message }}</p>
    <fieldset :disabled="busy" class="min-w-0">
      <label v-if="registering" class="sr-only" aria-hidden="true">
        Website <input v-model="website" name="website" tabindex="-1" autocomplete="off" />
      </label>
      <ProfileFields v-if="registering" v-model="profile" registration />
      <label v-else class="my-3 block font-semibold">Gebruikersnaam of e-mailadres <input class="block w-full rounded-md border border-slate-500 bg-white p-2.5 font-normal" v-model="identifier" autocomplete="username" required maxlength="64" /></label>
      <label class="my-3 block font-semibold">Wachtwoord <input class="block w-full rounded-md border border-slate-500 bg-white p-2.5 font-normal" v-model="password" type="password" :autocomplete="registering ? 'new-password' : 'current-password'" :minlength="registering ? 12 : 1" maxlength="128" required /></label>
      <p v-if="registering">Gebruik minimaal 12 tekens.</p>
      <button class="mr-2 mt-2 cursor-pointer rounded-md border border-yellow-700 bg-yellow-400 px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50" type="submit">{{ busy ? 'Even geduld...' : registering ? 'Registreren' : 'Inloggen' }}</button>
      <button v-if="!admin && !registering && identifier.includes('@')" class="mr-2 mt-2 cursor-pointer rounded-md border border-yellow-700 bg-yellow-400 px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50" type="button" @click="resendVerification">
        Nieuwe bevestigingsmail aanvragen
      </button>
      <button v-if="!admin" class="mr-2 mt-2 cursor-pointer rounded-md border border-yellow-700 bg-yellow-400 px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50" type="button" @click="registering = !registering; error = ''; message = ''">
        {{ registering ? 'Ik heb al een account' : 'Nieuw account aanmaken' }}
      </button>
    </fieldset>
  </form>
</template>
