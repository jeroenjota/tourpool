<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { apiFetch } from "../services/api";
import { Save, Check } from "@lucide/vue";
import { useActivePoolStore } from "../stores/activePool";
import EuroInput from "../components/EuroInput.vue";

interface OptionItem {
  poolID: number;
  inleg: number;
  PloegRennerAantal: number;
  PloegReserveAantal: number;
  AantalEtapPlaatsen: number;
  AantalKlasGeel: number;
  AantalKlasGroen: number;
  AantalKlasBol: number;
  AantalKlasWit: number;
  AantalEindKlasGeel: number;
  AantalEindKlasGroen: number;
  AantalEindKlasBol: number;
  AantalEindKlasWit: number;
  geldEtappeHoog: number | null;
  geldEtappeTotaal: number | null;
  geldEtappeLaagTTL: number | null;
  PrijsNr1Percentage: number;
  PrijsNr2Percentage: number;
  PrijsNr3Percentage: number;
  PrijsNr4Percentage: number;
  PrijsNrLaatstBedrag: number;
}

const options = ref<OptionItem | null>(null);
const loading = ref(true);
const saving = ref(false);
const activePoolStore = useActivePoolStore();
const stagePrizeFields = [
  { key: "geldEtappeHoog", label: "Hoogste dagscore" },
  { key: "geldEtappeTotaal", label: "Hoogste in totaal" },
  { key: "geldEtappeLaagTTL", label: "Laagste in totaal" },
] as const;

type StagePrizeKey = (typeof stagePrizeFields)[number]["key"];
const stagePrizeInputs = ref<Record<StagePrizeKey, string>>({
  geldEtappeHoog: "",
  geldEtappeTotaal: "",
  geldEtappeLaagTTL: "",
});
const redLanternInput = ref("");
const inlegInput = ref("");

const euroAmountFormatter = new Intl.NumberFormat("nl-NL", {
  useGrouping: false,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const parseStagePrize = (value: string) => {
  const text = value.trim();
  return /^\d+(?:[,.]\d{1,2})?$/.test(text)
    ? Number(text.replace(",", "."))
    : NaN;
};

const prizePercentages = ref({
  p1: 0,
  p2: 0,
  p3: 0,
  p4: 0,
});

const normalizeToPercent = (val?: number | null) => {
  if (val == null || isNaN(val)) return 0;
  const amount = Number(val);
  return amount <= 1 && amount > 0 ? Math.round(amount * 10000) / 100 : amount;
};

const normalizeToDecimal = (val?: number | null) => {
  if (val == null || isNaN(val)) return 0;
  return val > 1 ? Number((val / 100).toFixed(4)) : Number(val.toFixed(4));
};

const totalPercentage = computed(() => {
  return Number(
    (
      Number(prizePercentages.value.p1 || 0) +
      Number(prizePercentages.value.p2 || 0) +
      Number(prizePercentages.value.p3 || 0) +
      Number(prizePercentages.value.p4 || 0)
    ).toFixed(2),
  );
});

const fetchOptions = async () => {
  loading.value = true;
  try {
    if (!activePoolStore.activePoolID) {
      const pools = await apiFetch<{ poolID: number }[]>("/pools");
      if (pools[0]) activePoolStore.setActivePool(pools[0].poolID);
    }

    options.value = activePoolStore.activePoolID
      ? await apiFetch<OptionItem>(
          `/options/${activePoolStore.activePoolID}`,
        ).catch(() => null)
      : null;
    if (options.value) {
      options.value.inleg = Number(options.value.inleg);
      options.value.PrijsNrLaatstBedrag = Number(
        options.value.PrijsNrLaatstBedrag,
      );
      redLanternInput.value = euroAmountFormatter.format(
        options.value.PrijsNrLaatstBedrag,
      );
      inlegInput.value = euroAmountFormatter.format(options.value.inleg);
      for (const { key } of stagePrizeFields) {
        if (options.value[key] != null)
          options.value[key] = Number(options.value[key]);
        stagePrizeInputs.value[key] =
          options.value[key] == null
            ? ""
            : euroAmountFormatter.format(options.value[key]);
      }
      prizePercentages.value = {
        p1: normalizeToPercent(options.value.PrijsNr1Percentage),
        p2: normalizeToPercent(options.value.PrijsNr2Percentage),
        p3: normalizeToPercent(options.value.PrijsNr3Percentage),
        p4: normalizeToPercent(options.value.PrijsNr4Percentage),
      };
    }
  } catch (err) {
    console.error("Error fetching options:", err);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchOptions);

const isPercentageValid = computed(() => {
  return totalPercentage.value <= 100;
});

const saveOptions = async () => {
  if (!options.value) return;

  for (const key of [
    "AantalKlasGeel", "AantalKlasGroen", "AantalKlasBol", "AantalKlasWit",
    "AantalEindKlasGeel", "AantalEindKlasGroen", "AantalEindKlasBol", "AantalEindKlasWit",
  ] as const) {
    if (!Number.isInteger(options.value[key]) || options.value[key] < 0 || options.value[key] > 10) {
      alert("Meetellende aantallen bij de truien: vul een geheel getal van 0 tot en met 10 in.");
      return;
    }
  }

  if (
    !Number.isInteger(options.value.PloegRennerAantal) ||
    options.value.PloegRennerAantal > 25
  ) {
    alert("Ploeg totaal: vul een geheel aantal van maximaal 25 renners in.");
    return;
  }

  const inlegAmount = parseStagePrize(inlegInput.value);
  if (!Number.isFinite(inlegAmount) || inlegAmount > 999999.99) {
    alert(
      "Inleg: vul een bedrag van 0 tot en met 999999,99 euro in met maximaal twee decimalen.",
    );
    return;
  }
  options.value.inleg = inlegAmount;

  const redLanternAmount = parseStagePrize(redLanternInput.value);
  if (!Number.isFinite(redLanternAmount) || redLanternAmount > 999999.99) {
    alert(
      "Rode Lantaarn: vul een bedrag van 0 tot en met 999999,99 euro in met maximaal twee decimalen.",
    );
    return;
  }
  options.value.PrijsNrLaatstBedrag = redLanternAmount;

  for (const { key, label } of stagePrizeFields) {
    const amount =
      stagePrizeInputs.value[key].trim() === "" && options.value[key] === null
        ? null
        : parseStagePrize(stagePrizeInputs.value[key]);
    if (
      amount !== null &&
      (typeof amount !== "number" ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > 99.99 ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001)
    ) {
      alert(
        `${label}: vul een bedrag van 0 tot en met 99,99 euro in met maximaal twee decimalen.`,
      );
      return;
    }
    options.value[key] = amount;
  }

  if (!isPercentageValid.value) {
    alert(
      `De totale prijsverdeling mag niet meer dan 100% zijn (momenteel ${totalPercentage.value}%).`,
    );
    return;
  }

  saving.value = true;
  try {
    const payload = {
      ...options.value,
      PrijsNr1Percentage: normalizeToDecimal(prizePercentages.value.p1),
      PrijsNr2Percentage: normalizeToDecimal(prizePercentages.value.p2),
      PrijsNr3Percentage: normalizeToDecimal(prizePercentages.value.p3),
      PrijsNr4Percentage: normalizeToDecimal(prizePercentages.value.p4),
    };

    await apiFetch(`/options/${options.value.poolID}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    alert("Pool opties succesvol opgeslagen!");
    await fetchOptions();
  } catch (err) {
    alert(`Fout bij opslaan: ${err instanceof Error ? err.message : err}`);
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-2">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900">
          Pool Opties & Reglement
        </h2>
        <p class="text-xs text-slate-500">
          Instellingen voor inleg, ploeggroottes, etappeprijzen en
          prijspercentages (tblOpties)
        </p>
      </div>
      <button
        v-if="options"
        @click="saveOptions"
        :disabled="saving || !isPercentageValid"
        class="btn flex items-center gap-2 text-sm">
        <Save class="h-4 w-4" />
        <span>{{ saving ? "Opslaan..." : "Wijzigingen opslaan" }}</span>
      </button>
    </div>

    <div
      v-if="loading"
      class="shadow-xs rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">
      Opties laden...
    </div>

    <div
      v-else-if="options"
      class="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
      <!-- 1. Algemeen & Inleg -->
      <div
        class="shadow-xs space-y-4 rounded-xl border border-slate-200 bg-white px-4 py-2">
        <div class="border-slate-00 border-b pb-1">
          <h3 class="text-base font-semibold text-slate-900">Algemeen</h3>
        </div>
        <div class="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
          <div class="option-fields money-fields">
            <div>
              <label
                for="pool-inleg"
                class="text-xs font-semibold text-slate-700"
                >Inleg</label
              >

              <EuroInput
                id="pool-inleg"
                v-model="inlegInput"
                label="Inleg"
                :max="100" />
            </div>
          </div>
        </div>
        <div
          class="grid grid-cols-[minmax(0,4fr)_minmax(0,3fr)] items-center gap-1">
          <div class="option-fields money-fields">
            <div>
              <label
                for="pool-rider-count"
                class="text-xs font-semibold text-slate-700"
                >Ploeg totaal</label
              >
              <input
                id="pool-rider-count"
                v-model.number="options.PloegRennerAantal"
                type="number"
                max="25"
                step="1"
                class="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" />
            </div>
          </div>
          <div class="flex items-center gap-1">
            <label
              for="pool-reserve-count"
              class="text-xs font-semibold text-slate-700"
              >waarvan reserve</label
            >
            <input
              id="pool-reserve-count"
              v-model.number="options.PloegReserveAantal"
              type="number"
              class="w-16 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none" />
          </div>
        </div>
        <hr>
        <div
          class="prize-columns grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-4">
          <div class="space-y-3">
            <h4 class="flex h-6 items-center text-sm font-semibold text-slate-900">
              Vaste geldprijzen
            </h4>
            <div class="option-fields money-fields space-y-2">
              <div v-for="field in stagePrizeFields" :key="field.key">
                <label
                  :for="field.key"
                  class="text-xs font-semibold text-slate-700"
                  >{{ field.label }}</label
                >
                <EuroInput
                  :id="field.key"
                  v-model="stagePrizeInputs[field.key]"
                  :label="field.label"
                  :max="99.99" />
              </div>
              <div>
                <label
                  for="red-lantern"
                  class="text-xs font-semibold text-slate-700"
                  >Rode Lantaarn</label
                >
                <EuroInput
                  id="red-lantern"
                  v-model="redLanternInput"
                  label="Rode Lantaarn"
                  :max="999999.99" />
              </div>
            </div>
          </div>
          <div class="space-y-3">
            <h4 class="flex h-6 items-center text-sm font-semibold text-slate-900">
              Percentages
              <span class="px-2.5 py-0.5">
                <Check
                  v-if="totalPercentage === 100"
                  class="h-4 w-4 text-emerald-700"
                  aria-label="100%" />
                <span
                  v-else
                  class="rounded-full border align-middle font-mono text-xs font-semibold transition-colors"
                  :class="[
                    !isPercentageValid
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200',
                  ]">
                  {{ totalPercentage }}%
                </span>
              </span>
            </h4>
            <div class="option-fields percentage-fields space-y-2">
              <div>
                <label class="mb-1 block text-xs font-semibold text-slate-700"
                  >1e Prijs</label
                >
                <div class="relative">
                  <input
                    v-model.number="prizePercentages.p1"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none"
                    placeholder="50" />
                  <span
                    class="absolute right-3 top-2 text-xs font-bold text-slate-400"
                    >%</span
                  >
                </div>
              </div>
              <div>
                <label class="mb-1 block text-xs font-semibold text-slate-700"
                  >2e Prijs</label
                >
                <div class="relative">
                  <input
                    v-model.number="prizePercentages.p2"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none"
                    placeholder="35" />
                  <span
                    class="absolute right-3 top-2 text-xs font-bold text-slate-400"
                    >%</span
                  >
                </div>
              </div>
              <div>
                <label class="mb-1 block text-xs font-semibold text-slate-700"
                  >3e Prijs</label
                >
                <div class="relative">
                  <input
                    v-model.number="prizePercentages.p3"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none"
                    placeholder="15" />
                  <span
                    class="absolute right-3 top-2 text-xs font-bold text-slate-400"
                    >%</span
                  >
                </div>
              </div>
              <div>
                <label class="mb-1 block text-xs font-semibold text-slate-700"
                  >4e Prijs</label
                >
                <div class="relative">
                  <input
                    v-model.number="prizePercentages.p4"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 font-mono text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none"
                    placeholder="0" />
                  <span
                    class="absolute right-3 top-2 text-xs font-bold text-slate-400"
                    >%</span
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!--  Meetellende plaatsen na elke etappe -->
      <div
        class="shadow-xs space-y-4 rounded-xl border border-slate-200 bg-white px-4 py-2">
        <div class="pb1 border-b border-slate-700 pb-1">
          <h3 class="text-base font-semibold text-slate-900">
            Aantallen meetellen
          </h3>

        </div>
        <div>
          <h4  class="text-base font-semibold text-slate-900">
            Na etappe
          </h4>

        </div>
        <div class="option-fields counting-fields stage-count grid grid-cols-2 gap-2">
          <div class="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
            <label class="mb-1 block text-xs font-semibold text-slate-800"
              >🏁 Daguitslag</label
            >
            <input
              v-model.number="options.AantalEtapPlaatsen"
              type="number"
              class="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 font-mono text-sm text-slate-900 focus:border-amber-500 focus:outline-none" />
          </div>
        </div>

        <div class="option-fields counting-fields jersey-counts grid grid-cols-2 gap-2">
          <div class="rounded-lg border border-amber-200 bg-amber-50/60 p-2">
            <label class="mb-1 block text-xs font-semibold text-amber-800"
              >🟡 Gele trui</label
            >
            <input
              v-model.number="options.AantalKlasGeel"
              type="number"
              min="0"
              max="10"
              step="1"
              class="w-full rounded-md border border-amber-200 bg-white px-3 py-1.5 font-mono text-sm text-amber-900 focus:border-amber-500 focus:outline-none" />
          </div>

          <div class="rounded-lg border border-rose-200 bg-rose-50/60 p-2">
            <label class="mb-1 block text-xs font-semibold text-rose-800"
              >🔴 Bolletjestrui</label
            >
            <input
              v-model.number="options.AantalKlasBol"
              type="number"
              min="0"
              max="10"
              step="1"
              class="w-full rounded-md border border-rose-200 bg-white px-3 py-1.5 font-mono text-sm text-rose-900 focus:border-rose-500 focus:outline-none" />
          </div>

          <div
            class="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2">
            <label class="mb-1 block text-xs font-semibold text-emerald-800"
              >🟢 Groene trui</label
            >
            <input
              v-model.number="options.AantalKlasGroen"
              type="number"
              min="0"
              max="10"
              step="1"
              class="w-full rounded-md border border-emerald-200 bg-white px-3 py-1.5 font-mono text-sm text-emerald-900 focus:border-emerald-500 focus:outline-none" />
          </div>

          <div class="rounded-lg border border-slate-300 bg-slate-100/70 p-2">
            <label class="mb-1 block text-xs font-semibold text-slate-800"
              >⚪ Witte trui</label
            >
            <input
              v-model.number="options.AantalKlasWit"
              type="number"
              min="0"
              max="10"
              step="1"
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm text-slate-900 focus:border-slate-500 focus:outline-none" />
          </div>
        </div>
        <div class="border-t border-slate-700 pb-1 pt-3">
          <h3 class="text-base font-semibold text-slate-900">
            Eindstand
          </h3>
        </div>
        <div class="option-fields counting-fields jersey-counts grid grid-cols-2 gap-2">
          <div class="rounded-lg border border-amber-200 bg-amber-50/60 p-2">
            <label class="mb-1 block text-xs font-semibold text-amber-800"
              >🟡 Gele trui</label
            >
            <input
              v-model.number="options.AantalEindKlasGeel"
              type="number"
              min="0"
              max="10"
              step="1"
              class="w-full rounded-md border border-amber-200 bg-white px-3 py-1.5 font-mono text-sm text-amber-900 focus:border-amber-500 focus:outline-none" />
          </div>

          <div class="rounded-lg border border-rose-200 bg-rose-50/60 p-2">
            <label class="mb-1 block text-xs font-semibold text-rose-800"
              >🔴 Bolletjestrui</label
            >
            <input
              v-model.number="options.AantalEindKlasBol"
              type="number"
              min="0"
              max="10"
              step="1"
              class="w-full rounded-md border border-rose-200 bg-white px-3 py-1.5 font-mono text-sm text-rose-900 focus:border-rose-500 focus:outline-none" />
          </div>

          <div
            class="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2">
            <label class="mb-1 block text-xs font-semibold text-emerald-800"
              >🟢 Groene trui</label
            >
            <input
              v-model.number="options.AantalEindKlasGroen"
              type="number"
              min="0"
              max="10"
              step="1"
              class="w-full rounded-md border border-emerald-200 bg-white px-3 py-1.5 font-mono text-sm text-emerald-900 focus:border-emerald-500 focus:outline-none" />
          </div>

          <div class="rounded-lg border border-slate-300 bg-slate-100/70 p-2">
            <label class="mb-1 block text-xs font-semibold text-slate-800"
              >⚪ Witte trui</label
            >
            <input
              v-model.number="options.AantalEindKlasWit"
              type="number"
              min="0"
              max="10"
              step="1"
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm text-slate-900 focus:border-slate-500 focus:outline-none" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.jersey-counts > div,
.stage-count > div {
  min-width: 0;
}

.counting-fields > div {
  padding-block: 1px;
}

input[type="number"] {
  text-align: center;
}

.option-fields > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 0.25rem 0.75rem;
}

.option-fields > div > label {
  grid-column: 1;
  margin-bottom: 0;
}

.option-fields > div > input,
.option-fields > div > div {
  grid-column: 2;
  min-width: 0;
}

.option-fields > div > span {
  grid-column: 1 / -1;
}

.money-fields > div {
  grid-template-columns: minmax(0, 1fr) minmax(4rem, 1fr);
}

.percentage-fields > div {
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: 0.375rem;
}

.option-fields.jersey-counts > div,
.option-fields.stage-count > div {
  grid-template-columns: minmax(0, 1fr) 3.5rem;
}
</style>
