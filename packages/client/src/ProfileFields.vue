<script setup lang="ts">
import type { Profile } from './index';
const profile = defineModel<Profile>({ required: true });
</script>

<template>
  <label class="my-3 block font-semibold">Voornaam <input class="block w-full rounded-md border border-slate-500 bg-white p-2.5 font-normal" v-model="profile.vNaam" autocomplete="given-name" required maxlength="24" /></label>
  <label class="my-3 block font-semibold">Tussenvoegsel <input class="block w-full rounded-md border border-slate-500 bg-white p-2.5 font-normal" v-model="profile.tNaam" maxlength="12" /></label>
  <label class="my-3 block font-semibold">Achternaam <input class="block w-full rounded-md border border-slate-500 bg-white p-2.5 font-normal" v-model="profile.aNaam" autocomplete="family-name" required maxlength="24" /></label>
  <label class="my-3 block font-semibold">Woonplaats (optioneel) <input class="block w-full rounded-md border border-slate-500 bg-white p-2.5 font-normal" v-model="profile.plaats" autocomplete="address-level2" maxlength="24" /></label>
  <label class="my-3 block font-semibold">Telefoon (optioneel) <input class="block w-full rounded-md border border-slate-500 bg-white p-2.5 font-normal" v-model="profile.tel" type="tel" autocomplete="tel" maxlength="12" /></label>
</template>
