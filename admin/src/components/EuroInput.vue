<script setup lang="ts">
import { ChevronUp, ChevronDown } from "@lucide/vue";

const props = defineProps<{ id: string; label: string; max: number }>();
const model = defineModel<string>({ required: true });
const formatter = new Intl.NumberFormat("nl-NL", {
  useGrouping: false,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const amount = () => {
  const text = model.value.trim();
  return /^\d+(?:[,.]\d{1,2})?$/.test(text)
    ? Number(text.replace(",", "."))
    : NaN;
};
const canStep = (direction: number) => {
  const value = amount();
  const cents = Math.round(value * 100) + direction * 10;
  return Number.isFinite(value) && value <= props.max &&
    cents >= 0 && cents <= Math.round(props.max * 100);
};
const step = (direction: number) => {
  if (canStep(direction)) {
    model.value = formatter.format((Math.round(amount() * 100) + direction * 10) / 100);
  }
};
const format = () => {
  const value = amount();
  if (Number.isFinite(value) && value <= props.max) {
    model.value = formatter.format(value);
  }
};
</script>

<template>
  <div class="flex min-w-0 items-stretch gap-1">
    <div class="relative min-w-0 flex-1">
      <span aria-hidden="true" class="pointer-events-none absolute left-1 top-2 text-sm text-slate-500">€</span>
      <input
        :id="id"
        v-model="model"
        type="text"
        inputmode="decimal"
        @blur="format"
        class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-3 text-right font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" />
    </div>
    <div class="flex shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200">
      <button
        v-for="direction in [1, -1]"
        :key="direction"
        type="button"
        class="flex flex-1 items-center justify-center bg-slate-50 px-2 text-slate-700 first:border-b first:border-slate-200 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
        :aria-label="`${label}: 10 cent ${direction === 1 ? 'verhogen' : 'verlagen'}`"
        :disabled="!canStep(direction)"
        @click="step(direction)">
        <component :is="direction === 1 ? ChevronUp : ChevronDown" class="h-2 w-1" />
      </button>
    </div>
  </div>
</template>
