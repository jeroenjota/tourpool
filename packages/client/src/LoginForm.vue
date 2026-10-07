<script setup lang="ts">
import { ref } from 'vue';
import { apiFetch, auth, emptyProfile, errorMessage, login, logout } from './index';
import ProfileFields from './ProfileFields.vue';
const props = defineProps<{ admin?: boolean }>();
const emit = defineEmits<{ signedIn: [] }>();
const registering = ref(false);
const email = ref('');
const password = ref('');
const profile = ref(emptyProfile());
const busy = ref(false);
const error = ref('');
const message = ref('');
async function submit() {
  busy.value = true; error.value = ''; message.value = '';
  try {
    if (registering.value) {
      await apiFetch('/auth/register', {
        method: 'POST', body: JSON.stringify({ email: email.value, password: password.value, profile: profile.value })
      });
      registering.value = false;
      password.value = '';
      message.value = 'Account aangemaakt. Log nu in.';
    } else {
      await login(email.value, password.value);
      if (props.admin && auth.account?.role !== 'admin') {
        await logout();
        throw new Error('Dit account is geen beheerder. Log in via de deelnemersapp.');
      }
      password.value = '';
      emit('signedIn');
    }
  } catch (err) { error.value = errorMessage(err); }
  finally { busy.value = false; }
}
</script>

<template>
  <form class="auth-form" @submit.prevent="submit">
    <h1>{{ registering ? 'Account aanmaken' : admin ? 'Tourpool beheer - Inloggen' : 'Tourpool - Inloggen' }}</h1>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="message" role="status">{{ message }}</p>
    <fieldset :disabled="busy">
      <ProfileFields v-if="registering" v-model="profile" />
      <label>E-mailadres <input v-model="email" type="email" autocomplete="username" required maxlength="64" /></label>
      <label>Wachtwoord <input v-model="password" type="password" :autocomplete="registering ? 'new-password' : 'current-password'" :minlength="registering ? 12 : 1" maxlength="128" required /></label>
      <p v-if="registering">Gebruik minimaal 12 tekens.</p>
      <button type="submit">{{ busy ? 'Even geduld...' : registering ? 'Registreren' : 'Inloggen' }}</button>
      <button v-if="!admin" type="button" @click="registering = !registering; error = ''; message = ''">
        {{ registering ? 'Ik heb al een account' : 'Nieuw account aanmaken' }}
      </button>
    </fieldset>
  </form>
</template>

<style scoped>
.auth-form { max-width: 28rem; margin: 3rem auto; padding: 1.5rem; background: #fef9c3; border: 1px solid #a16207; border-radius: .75rem; color: #1e293b; }
h1 { font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; }
fieldset { border: 0; padding: 0; }
.auth-form :deep(label) { display: block; margin: .75rem 0; font-weight: 600; }
.auth-form :deep(input) { box-sizing: border-box; display: block; width: 100%; padding: .6rem; border: 1px solid #64748b; border-radius: .4rem; background: white; font-weight: normal; }
button { padding: .6rem 1rem; margin: .5rem .5rem 0 0; border: 1px solid #a16207; border-radius: .4rem; background: #facc15; cursor: pointer; }
[role=alert] { color: #b91c1c; }
[role=status] { color: #166534; }
</style>
