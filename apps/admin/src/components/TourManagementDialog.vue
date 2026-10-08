<script setup lang="ts">
import { onMounted, ref, useId } from "vue";
import { X } from "@lucide/vue";

defineProps<{ title: string; busy?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement | null>(null);
const titleID = useId();
onMounted(() => dialog.value?.showModal());
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="titleID"
    class="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-6xl overflow-y-auto rounded-2xl bg-amber-300 p-6 shadow-xl backdrop:bg-slate-900/40"
    @cancel.prevent="!busy && emit('close')">
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-4">
        <h2 :id="titleID" class="text-xl font-bold">{{ title }}</h2>
        <button type="button" aria-label="Sluiten" :disabled="busy" @click="emit('close')">
          <X class="h-5 w-5" />
        </button>
      </div>
      <slot />
    </div>
  </dialog>
</template>
