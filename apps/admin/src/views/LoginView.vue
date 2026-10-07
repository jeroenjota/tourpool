<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import LoginForm from '@tourpool/client/LoginForm.vue';
import { errorMessage } from '@tourpool/client';
const router = useRouter();
const error = ref('');
async function signedIn() {
  try { await router.replace('/'); }
  catch (err) { error.value = errorMessage(err); }
}
</script>
<template>
  <div>
    <p v-if="error" role="alert" class="p-4 text-red-700">{{ error }}</p>
    <LoginForm admin @signed-in="signedIn" />
  </div>
</template>
