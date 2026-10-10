<script setup lang="ts">
import type { Profile } from './index';
defineProps<{ registration?: boolean }>();
const profile = defineModel<Profile>({ required: true });
</script>

<template>
  <div class="grid w-full grid-cols-12 gap-x-3">
    <label class="col-span-4 my-1 block min-w-0 font-semibold">Gebruikersnaam <input class="block w-full min-w-0 rounded-md border border-slate-500 bg-white p-1 font-normal" v-model="profile.username" autocomplete="username" required minlength="3" maxlength="32" pattern="[A-Za-z0-9._\-]+" /></label>
    <label class="col-span-8 my-1 block min-w-0 font-semibold">E-mailadres <input class="block w-full min-w-0 rounded-md border border-slate-500 bg-white p-1 font-normal" v-model="profile.email" type="email" autocomplete="email" required maxlength="64" :readonly="!registration" /></label>
    <label class="col-span-4 my-1 block min-w-0 font-semibold">Voornaam <input class="block w-full min-w-0 rounded-md border border-slate-500 bg-white p-1 font-normal" v-model="profile.vNaam" autocomplete="given-name" required maxlength="24" /></label>
    <label class="col-span-3 my-1 block min-w-0 font-semibold">Voorv<input class="block w-full min-w-0 rounded-md border border-slate-500 bg-white p-1 font-normal" v-model="profile.tNaam" maxlength="12" /></label>
    <label class="col-span-5 my-1 block min-w-0 font-semibold">Achternaam <input class="block w-full min-w-0 rounded-md border border-slate-500 bg-white p-1 font-normal" v-model="profile.aNaam" autocomplete="family-name" required maxlength="24" /></label>
    <label class="col-span-8 my-1 block min-w-0 font-semibold">Woonplaats (optioneel) <input class="block w-full min-w-0 rounded-md border border-slate-500 bg-white p-1 font-normal" v-model="profile.plaats" autocomplete="address-level2" maxlength="24" /></label>
    <label class="col-span-4 my-1 block min-w-0 font-semibold">Telefoon<input class="block w-full min-w-0 rounded-md border border-slate-500 bg-white p-1 font-normal" v-model="profile.tel" type="tel" maxlength="12" /></label>
  </div>

</template>
