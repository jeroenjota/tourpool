<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { apiFetch, ApiError, auth, emptyProfile, errorMessage, isStaff, login, logout } from './index';
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
const mode = ref<'login' | 'forgot' | 'reset'>('login');
const resetToken = ref('');
const confirmPassword = ref('');
onMounted(() => {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('reset');
  if (!token) return;
  resetToken.value = token;
  mode.value = 'reset';
  url.searchParams.delete('reset');
  window.history.replaceState(window.history.state, '', url);
});
function switchMode(next: 'login' | 'forgot') {
  mode.value = next; registering.value = false; error.value = ''; message.value = ''; password.value = '';
}
async function requestReset() {
  busy.value = true; error.value = ''; message.value = '';
  try {
    const result = await apiFetch<{ message: string }>('/auth/forgot-password', {
      method: 'POST', body: JSON.stringify({ identifier: identifier.value })
    });
    message.value = result.message;
  } catch (err) { error.value = errorMessage(err); }
  finally { busy.value = false; }
}
async function resetPassword() {
  error.value = ''; message.value = '';
  if (password.value !== confirmPassword.value) { error.value = 'De wachtwoorden zijn niet gelijk.'; return; }
  busy.value = true;
  try {
    await apiFetch('/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ token: resetToken.value, password: password.value })
    });
    mode.value = 'login'; resetToken.value = ''; password.value = ''; confirmPassword.value = '';
    message.value = 'Je wachtwoord is gewijzigd. Je kunt nu inloggen.';
  } catch (err) { error.value = errorMessage(err); }
  finally { busy.value = false; }
}
async function submit() {
  if (mode.value === 'forgot') return requestReset();
  if (mode.value === 'reset') return resetPassword();
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
      if (props.admin && !isStaff(auth.account)) {
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
const inputClass = 'block w-full rounded-md border border-slate-500 bg-white p-2.5 font-normal';
const buttonClass = 'btn mr-2 mt-2';
const title = computed(() => {
  if (mode.value === 'forgot') return 'Wachtwoord vergeten';
  if (mode.value === 'reset') return 'Nieuw wachtwoord instellen';
  if (registering.value) return 'Account aanmaken';
  return props.admin ? 'Tourpool beheer - Inloggen' : 'Jota\'s Tourpool - Inloggen';
});
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
    <h1 class="mb-4 text-2xl font-bold">{{ title }}</h1>
    <p v-if="error" class="text-red-700" role="alert">{{ error }}</p>
    <p v-if="message" class="text-green-800" role="status">{{ message }}</p>
    <fieldset v-if="mode === 'forgot'" :disabled="busy" class="min-w-0">
      <p>Vul je gebruikersnaam of e-mailadres in. Je krijgt dan een e-mail met een link om een nieuw wachtwoord in te stellen.</p>
      <label class="my-3 block font-semibold">Gebruikersnaam of e-mailadres <input :class="inputClass" v-model="identifier" autocomplete="username" required maxlength="64" /></label>
      <button :class="buttonClass" type="submit">{{ busy ? 'Even geduld...' : 'Resetlink versturen' }}</button>
      <button :class="buttonClass" type="button" @click="switchMode('login')">Terug naar inloggen</button>
    </fieldset>
    <fieldset v-else-if="mode === 'reset'" :disabled="busy" class="min-w-0">
      <label class="my-3 block font-semibold">Nieuw wachtwoord <input :class="inputClass" v-model="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /></label>
      <label class="my-3 block font-semibold">Herhaal nieuw wachtwoord <input :class="inputClass" v-model="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /></label>
      <p>Gebruik minimaal 12 tekens.</p>
      <button :class="buttonClass" type="submit">{{ busy ? 'Even geduld...' : 'Wachtwoord instellen' }}</button>
      <button :class="buttonClass" type="button" @click="switchMode('login')">Annuleren</button>
    </fieldset>
    <fieldset v-else :disabled="busy" class="min-w-0">
      <label v-if="registering" class="sr-only" aria-hidden="true">
        Website <input v-model="website" name="website" tabindex="-1" autocomplete="off" />
      </label>
      <ProfileFields v-if="registering" v-model="profile" registration />
      <label v-else class="my-3 block font-semibold">Gebruikersnaam of e-mailadres <input :class="inputClass" v-model="identifier" autocomplete="username" required maxlength="64" /></label>
      <label class="my-3 block font-semibold">Wachtwoord <input :class="inputClass" v-model="password" type="password" :autocomplete="registering ? 'new-password' : 'current-password'" :minlength="registering ? 12 : 1" maxlength="128" required /></label>
      <p v-if="registering">Gebruik minimaal 12 tekens.</p>
      <button :class="buttonClass" type="submit">{{ busy ? 'Even geduld...' : registering ? 'Registreren' : 'Inloggen' }}</button>
      <button v-if="!admin && !registering && identifier.includes('@')" :class="buttonClass" type="button" @click="resendVerification">
        Nieuwe bevestigingsmail aanvragen
      </button>
      <button v-if="!admin" :class="buttonClass" type="button" @click="registering = !registering; error = ''; message = ''">
        {{ registering ? 'Ik heb al een account' : 'Nieuw account aanmaken' }}
      </button>
      <button v-if="!registering" class="mt-3 block cursor-pointer text-sm text-slate-700 underline" type="button" @click="switchMode('forgot')">
        Wachtwoord vergeten?
      </button>
    </fieldset>
  </form>
</template>
