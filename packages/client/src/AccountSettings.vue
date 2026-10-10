<script setup lang="ts">
import { ref } from 'vue';
import { auth, changePassword, changeUsername, errorMessage } from './index';
const props = withDefaults(defineProps<{ showUsername?: boolean }>(), { showUsername: true });
const username = ref(auth.account?.username ?? '');
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const busy = ref(false);
const error = ref('');
const message = ref('');
const input = 'block w-full min-w-0 rounded-md border border-slate-500 bg-white p-1.5 font-normal';
const button = 'btn mt-2';

async function run(action: () => Promise<void>, success: string) {
  busy.value = true; error.value = ''; message.value = '';
  try { await action(); message.value = success; }
  catch (err) { error.value = errorMessage(err); }
  finally { busy.value = false; }
}
const saveUsername = () => run(() => changeUsername(username.value.trim()), 'Gebruikersnaam gewijzigd.');
function savePassword() {
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'De nieuwe wachtwoorden zijn niet gelijk.'; message.value = '';
    return;
  }
  return run(async () => {
    await changePassword(currentPassword.value, newPassword.value);
    currentPassword.value = ''; newPassword.value = ''; confirmPassword.value = '';
  }, 'Wachtwoord gewijzigd. Andere apparaten zijn uitgelogd.');
}
</script>

<template>
  <div class="text-slate-800">
    <p v-if="error" class="text-red-700" role="alert">{{ error }}</p>
    <p v-if="message" class="text-green-800" role="status">{{ message }}</p>
    <fieldset :disabled="busy" class="min-w-0">
      <form v-if="props.showUsername" class="mb-4" @submit.prevent="saveUsername">
        <h3 class="font-bold">Gebruikersnaam</h3>
        <label class="my-1 block font-semibold">Nieuwe gebruikersnaam
          <input :class="input" v-model="username" autocomplete="username" required minlength="3" maxlength="32" pattern="[A-Za-z0-9._\-]+" />
        </label>
        <button :class="button" type="submit">Gebruikersnaam opslaan</button>
      </form>
      <form @submit.prevent="savePassword">
        <h3 class="font-bold">Wachtwoord wijzigen</h3>
        <label class="my-1 block font-semibold">Huidig wachtwoord
          <input :class="input" v-model="currentPassword" type="password" autocomplete="current-password" required maxlength="128" />
        </label>
        <label class="my-1 block font-semibold">Nieuw wachtwoord (minimaal 12 tekens)
          <input :class="input" v-model="newPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="128" />
        </label>
        <label class="my-1 block font-semibold">Herhaal nieuw wachtwoord
          <input :class="input" v-model="confirmPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="128" />
        </label>
        <button :class="button" type="submit">Wachtwoord opslaan</button>
      </form>
    </fieldset>
  </div>
</template>
