<script setup lang="ts">
import type { Profile } from './index';
const profile = defineModel<Profile>({ required: true });
</script>

<template>
  <label>Voornaam <input v-model="profile.vNaam" autocomplete="given-name" required maxlength="24" /></label>
  <label>Tussenvoegsel <input v-model="profile.tNaam" maxlength="12" /></label>
  <label>Achternaam <input v-model="profile.aNaam" autocomplete="family-name" required maxlength="24" /></label>
  <label>Woonplaats (optioneel) <input v-model="profile.plaats" autocomplete="address-level2" maxlength="24" /></label>
  <label>Telefoon (optioneel) <input v-model="profile.tel" type="tel" autocomplete="tel" maxlength="12" /></label>
</template>
