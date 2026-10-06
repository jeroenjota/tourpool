import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

const storageKey = 'tourpool-active-pool-id';

export const useActivePoolStore = defineStore('activePool', () => {
  const storedPoolID = Number(localStorage.getItem(storageKey));
  const activePoolID = ref<number | null>(Number.isInteger(storedPoolID) && storedPoolID > 0 ? storedPoolID : null);

  const setActivePool = (poolID: number) => {
    activePoolID.value = poolID;
    localStorage.setItem(storageKey, String(poolID));
  };

  const hasActivePool = computed(() => activePoolID.value !== null);

  return { activePoolID, hasActivePool, setActivePool };
});
