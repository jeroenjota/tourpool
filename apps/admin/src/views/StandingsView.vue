<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { Award, BarChart3, Calculator, FileText, RefreshCw } from '@lucide/vue';
import { apiFetch } from '../services/api';
import { loadPrintFonts } from '../services/printFonts';
import { useActivePoolStore } from '../stores/activePool';

interface Pool {
  poolID: number;
  tourID: number;
  Naam: string;
  Org?: string | null;
}

interface Participant {
  deelnID: number;
  poolID: number;
  roepnaam?: string | null;
  vNaam?: string | null;
  tNaam?: string | null;
  aNaam?: string | null;
}

interface Stage {
  tour: number | string;
  etappeNr?: number | null;
  datum?: string | null;
  Start?: string | null;
  Finish?: string | null;
}

interface StageResult {
  tourID: number;
  etappeNr: number;
}

interface ParticipantPoints {
  deelnemID: number;
  etappeNr: number;
  ritPnt?: number | string | null;
  geelPnt?: number | string | null;
  groenPnt?: number | string | null;
  bolPnt?: number | string | null;
  witPnt?: number | string | null;
  etapPnt?: number | string | null;
  etapPlaats?: number | string | null;
  etapGeld?: number | string | null;
  ttlPnt?: number | string | null;
  ttlPlaats?: number | string | null;
  ttlGeld?: number | string | null;
}

const activePoolStore = useActivePoolStore();
const pools = ref<Pool[]>([]);
const participants = ref<Participant[]>([]);
const stages = ref<Stage[]>([]);
const stageResults = ref<StageResult[]>([]);
const points = ref<ParticipantPoints[]>([]);
const allocationTypes = ref<Set<string>>(new Set());
const allocationPoints = ref<Map<string, number>>(new Map());
const selectedStageNumber = ref<number | null>(null);
const loading = ref(false);
const loadingPoints = ref(false);
const errorMessage = ref('');
let requestVersion = 0;
let pointsRequestVersion = 0;

const activePool = computed(() =>
  pools.value.find(pool => pool.poolID === activePoolStore.activePoolID) ?? null
);

const latestResultStage = computed(() =>
  stageResults.value.reduce<number | null>(
    (latest, result) => Math.max(latest ?? 0, result.etappeNr),
    null
  )
);

const availableStages = computed(() =>
  stages.value
    .filter((stage): stage is Stage & { etappeNr: number } =>
      stage.etappeNr != null &&
      latestResultStage.value !== null &&
      stage.etappeNr <= latestResultStage.value
    )
    .sort((a, b) => a.etappeNr - b.etappeNr)
);

const participantRows = computed(() => {
  const pointsByParticipant = new Map(
    points.value.map(point => [point.deelnemID, point])
  );
  return participants.value.map(participant => {
    const score = pointsByParticipant.get(participant.deelnID);
    const name = [participant.vNaam, participant.tNaam, participant.aNaam]
      .filter(Boolean)
      .join(' ');
    return {
      deelnID: participant.deelnID,
      roepnaam: participant.roepnaam?.trim() || name || `Deelnemer #${participant.deelnID}`,
      ritPunten: Number(score?.ritPnt ?? 0),
      geelPunten: Number(score?.geelPnt ?? 0),
      groenPunten: Number(score?.groenPnt ?? 0),
      bolPunten: Number(score?.bolPnt ?? 0),
      witPunten: Number(score?.witPnt ?? 0),
      jerseyPunten: {
        geel: Number(score?.geelPnt ?? 0),
        groen: Number(score?.groenPnt ?? 0),
        bol: Number(score?.bolPnt ?? 0),
        wit: Number(score?.witPnt ?? 0)
      } as Record<string, number>,
      etappePunten: Number(score?.etapPnt ?? 0),
      etappePlaats: Number(score?.etapPlaats ?? 0),
      etappeGeld: Number(score?.etapGeld ?? 0),
      totaalPunten: Number(score?.ttlPnt ?? 0),
      totaalPlaats: Number(score?.ttlPlaats ?? 0),
      totaalGeld: Number(score?.ttlGeld ?? 0)
    };
  }).sort((a, b) =>
    (a.totaalPlaats || Number.MAX_SAFE_INTEGER) - (b.totaalPlaats || Number.MAX_SAFE_INTEGER) ||
    b.totaalPunten - a.totaalPunten ||
    a.roepnaam.localeCompare(b.roepnaam, 'nl', { sensitivity: 'base' })
  );
});

const currencyFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const formatMoney = (amount: number) => {
  const normalizedAmount = Number(amount.toPrecision(15));
  const truncatedAmount = Math.floor(normalizedAmount * 100) / 100;
  return currencyFormatter.format(truncatedAmount);
};

const fetchStagePoints = async (stageNumber: number | null, version = requestVersion) => {
  const pointsVersion = ++pointsRequestVersion;
  points.value = [];
  errorMessage.value = '';
  if (!stageNumber || !activePoolStore.activePoolID) {
    loadingPoints.value = false;
    return;
  }

  loadingPoints.value = true;
  try {
    const result = await apiFetch<ParticipantPoints[]>(`/participant-points?etappeNr=${stageNumber}`);
    if (version === requestVersion && pointsVersion === pointsRequestVersion) points.value = result;
  } catch (error) {
    if (version === requestVersion && pointsVersion === pointsRequestVersion) {
      errorMessage.value = `Fout bij laden van de punten: ${error instanceof Error ? error.message : String(error)}`;
    }
  } finally {
    if (pointsVersion === pointsRequestVersion) loadingPoints.value = false;
  }
};

const loadActivePool = async (poolID: number) => {
  const version = ++requestVersion;
  loading.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  points.value = [];

  try {
    if (pools.value.length === 0) pools.value = await apiFetch<Pool[]>('/pools');
    const pool = pools.value.find(item => item.poolID === poolID);
    if (!pool) {
      participants.value = [];
      stages.value = [];
      stageResults.value = [];
      selectedStageNumber.value = null;
      return;
    }

    const [participantData, stageData, resultData, allocationData] = await Promise.all([
      apiFetch<Participant[]>(`/participants?poolID=${poolID}`),
      apiFetch<Stage[]>(`/stages?tour=${pool.tourID}`),
      apiFetch<StageResult[]>(`/stage-results?tourID=${pool.tourID}`),
      apiFetch<Array<{ uitslagtype?: string | null; plaats?: number | null; Punten?: number | null }>>(`/point-allocations?poolID=${poolID}`)
    ]);
    if (version !== requestVersion) return;

    allocationTypes.value = new Set(
      allocationData.map(allocation => allocation.uitslagtype?.toLowerCase()).filter((type): type is string => !!type)
    );

    allocationPoints.value = new Map(
      allocationData
        .filter(allocation => allocation.uitslagtype && allocation.plaats != null)
        .map(allocation => [
          `${allocation.uitslagtype!.toLowerCase()}-${allocation.plaats}`,
          Number(allocation.Punten ?? 0)
        ])
    );

    participants.value = participantData;
    stages.value = stageData;
    stageResults.value = resultData;
    if (!availableStages.value.some(stage => stage.etappeNr === selectedStageNumber.value)) {
      selectedStageNumber.value = availableStages.value.at(-1)?.etappeNr ?? null;
    }
    await fetchStagePoints(selectedStageNumber.value, version);
  } catch (error) {
    if (version === requestVersion) {
      errorMessage.value = `Fout bij laden van de poolstand: ${error instanceof Error ? error.message : String(error)}`;
    }
  } finally {
    if (version === requestVersion) loading.value = false;
  }
};

const refresh = () => {
  if (activePoolStore.activePoolID) void loadActivePool(activePoolStore.activePoolID);
};

const recalculating = ref(false);
const successMessage = ref('');

const recalculateAllStages = async () => {
  const pool = activePool.value;
  if (!pool) return;
  if (!confirm(`Alle etappe-uitslagen van pool "${pool.Naam || pool.poolID}" opnieuw doorrekenen?`)) return;
  recalculating.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    await apiFetch(`/stage-results/recalculate/${pool.poolID}`, { method: 'POST' });
    await loadActivePool(pool.poolID);
    successMessage.value = 'Alle etappes zijn opnieuw doorgerekend.';
  } catch (error) {
    errorMessage.value = `Fout bij doorrekenen: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    recalculating.value = false;
  }
};

const chartPoints = ref<ParticipantPoints[]>([]);
const preparingChart = ref(false);

const stagePalette = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2',
  '#7f7f7f', '#bcbd22', '#17becf', '#393b79', '#e6550d', '#31a354', '#843c39',
  '#7b4173', '#3182bd', '#fd8d3c', '#74c476', '#ad494a', '#a55194', '#6baed6'
];

const stageColor = (index: number) =>
  stagePalette[index] ?? `hsl(${(index * 137.508) % 360} 65% 45%)`;

const textColorFor = (hex: string) => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return '#ffffff';
  const [r, g, b] = match.slice(1).map(part => parseInt(part, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#172033' : '#ffffff';
};

const chartStages = computed(() =>
  availableStages.value
    .filter(stage => selectedStageNumber.value != null && stage.etappeNr <= selectedStageNumber.value)
    .map((stage, index) => ({ etappeNr: stage.etappeNr, color: stageColor(index) }))
);

const chartRows = computed(() => {
  const stageNumbers = new Set(chartStages.value.map(stage => stage.etappeNr));
  const pointsByParticipant = new Map<number, Map<number, number>>();
  for (const point of chartPoints.value) {
    if (!stageNumbers.has(point.etappeNr)) continue;
    const stagePoints = pointsByParticipant.get(point.deelnemID) ?? new Map<number, number>();
    stagePoints.set(point.etappeNr, Math.max(Number(point.etapPnt ?? 0), 0));
    pointsByParticipant.set(point.deelnemID, stagePoints);
  }

  return participants.value
    .map(participant => {
      const stagePoints = pointsByParticipant.get(participant.deelnID);
      const segments = chartStages.value.map(stage => ({
        ...stage,
        points: stagePoints?.get(stage.etappeNr) ?? 0
      }));
      const name = [participant.vNaam, participant.tNaam, participant.aNaam].filter(Boolean).join(' ');
      return {
        deelnID: participant.deelnID,
        roepnaam: participant.roepnaam?.trim() || name || `Deelnemer #${participant.deelnID}`,
        segments,
        total: segments.reduce((sum, segment) => sum + segment.points, 0)
      };
    })
    .sort((a, b) => a.roepnaam.localeCompare(b.roepnaam, 'nl', { sensitivity: 'base' }));
});

const niceStep = (rawStep: number) => {
  if (rawStep <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].find(factor => factor * magnitude >= rawStep) ?? 10;
  return step * magnitude;
};

const chartMaxPerPage = 24;

// Alle maten in mm (A4 landscape minus marges).
const chart = computed(() => {
  const width = 281;
  const height = 170;
  const left = 12;
  const right = 2;
  const top = 6;
  const longestName = Math.max(...chartRows.value.map(row => row.roepnaam.length), 4);
  const labelHeight = Math.min(Math.max(longestName * 1.75 + 3, 15), 45);
  const axisY = height - labelHeight;
  const plotHeight = axisY - top;
  const plotWidth = width - left - right;
  const maxTotal = Math.max(...chartRows.value.map(row => row.total), 1);
  const step = niceStep(maxTotal / 8);
  const yMax = Math.ceil(maxTotal / step) * step;
  const rowCount = Math.max(chartRows.value.length, 1);
  const pageCount = Math.ceil(rowCount / chartMaxPerPage);
  const perPage = pageCount > 1 ? chartMaxPerPage : rowCount;
  const slot = plotWidth / perPage;
  const barWidth = slot;
  const scale = (points: number) => (points / yMax) * plotHeight;

  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, index) => {
    const value = index * step;
    return { value, y: axisY - scale(value) };
  });

  const bars = chartRows.value.map((row, rowIndex) => {
    const index = rowIndex % perPage;
    const center = left + slot * index + slot / 2;
    const x = center - barWidth / 2;
    let currentY = axisY;
    const segments = row.segments
      .filter(segment => segment.points > 0)
      .map(segment => {
        const segmentHeight = scale(segment.points);
        currentY -= segmentHeight;
        return {
          ...segment,
          y: currentY,
          height: segmentHeight,
          textColor: textColorFor(segment.color),
          showLabel: segmentHeight >= 2.8 && barWidth >= 4.5
        };
      });
    return { ...row, center, x, segments, topY: currentY };
  });

  const pages = Array.from({ length: pageCount }, (_, page) =>
    bars.slice(page * perPage, (page + 1) * perPage)
  );

  return { width, height, left, right, axisY, ticks, pages, barWidth };
});

const printPointsChart = async () => {
  if (!activePool.value || !selectedStageNumber.value) return;

  preparingChart.value = true;
  errorMessage.value = '';
  try {
    chartPoints.value = await apiFetch<ParticipantPoints[]>('/participant-points');
  } catch (error) {
    errorMessage.value = `Fout bij laden van de grafiekgegevens: ${error instanceof Error ? error.message : String(error)}`;
    return;
  } finally {
    preparingChart.value = false;
  }
  printMode.value = 'chart';
  await nextTick();

  // Liggend formaat alleen tijdens deze afdruk; voorkomt conflict met de staande PDF's.
  const printHeight = chart.value.pages.length * 194 - 2;
  await printWithPageStyle(
    'chart',
    `
    @page { size: A4 landscape; margin: 8mm; }
    @media print {
      html, body { height: ${printHeight}mm !important; overflow: hidden !important; }
    }
  `,
    `${activePool.value.Naam || `Pool ${activePool.value.poolID}`} - etappepunten t-m etappe ${selectedStageNumber.value}`
  );
};

type CategoryKey = 'rit' | 'geel' | 'groen' | 'bol' | 'wit';

const allResultCategories: Array<{
  key: CategoryKey;
  label: string;
  field: keyof ParticipantPoints;
  allocationType: string | null;
}> = [
  { key: 'rit', label: 'Etappe', field: 'ritPnt', allocationType: null },
  { key: 'geel', label: 'Geel', field: 'geelPnt', allocationType: 'klasgeel' },
  { key: 'groen', label: 'Groen', field: 'groenPnt', allocationType: 'klasgroen' },
  { key: 'bol', label: 'Berg', field: 'bolPnt', allocationType: 'klasbol' },
  { key: 'wit', label: 'Wit', field: 'witPnt', allocationType: 'klaswit' }
];

// Truikolommen alleen tonen als de pool punten voor dat klassement toekent.
const resultCategories = computed(() =>
  allResultCategories.filter(category =>
    category.allocationType === null || allocationTypes.value.has(category.allocationType)
  )
);
const jerseyCategories = computed(() => resultCategories.value.filter(category => category.key !== 'rit'));

interface StageRiderResult {
  uitslagType: string;
  plaats: number;
  rennerID: number;
  anaam?: string | null;
  vnaam?: string | null;
  tnaam?: string | null;
  ploegCode?: string | null;
}

interface PoolOptionLimits {
  AantalEtapPlaatsen?: number | null;
  AantalKlasGeel?: number | null;
  AantalKlasGroen?: number | null;
  AantalKlasBol?: number | null;
  AantalKlasWit?: number | null;
}

const printMode = ref<'chart' | 'result' | null>(null);
const resultPoints = ref<ParticipantPoints[]>([]);
const stageRiderResults = ref<StageRiderResult[]>([]);
const resultOptions = ref<PoolOptionLimits | null>(null);
const preparingResult = ref(false);

const jerseyInfo: Record<Exclude<CategoryKey, 'rit'>, { label: string; limitField: keyof PoolOptionLimits }> = {
  geel: { label: 'Gele trui', limitField: 'AantalKlasGeel' },
  groen: { label: 'Groene trui', limitField: 'AantalKlasGroen' },
  bol: { label: 'Bolletjestrui', limitField: 'AantalKlasBol' },
  wit: { label: 'Witte trui', limitField: 'AantalKlasWit' }
};

const formatRiderName = (rider: StageRiderResult) => {
  const firstNames = [rider.vnaam?.trim(), rider.tnaam?.trim()].filter(Boolean).join(' ');
  return [rider.anaam?.trim(), firstNames].filter(Boolean).join(', ') || `Renner #${rider.rennerID}`;
};

const ridersFor = (type: string, limit: number) =>
  stageRiderResults.value
    .filter(result => result.uitslagType.toLowerCase() === type && result.plaats <= limit)
    .sort((a, b) => a.plaats - b.plaats)
    .map(result => ({
      ...result,
      naam: formatRiderName(result),
      punten: allocationPoints.value.get(`${type === 'rit' ? 'rit' : `klas${type}`}-${result.plaats}`) ?? null
    }));

const stageTopRiders = computed(() =>
  ridersFor('rit', Number(resultOptions.value?.AantalEtapPlaatsen ?? 0))
);

const jerseyStandings = computed(() =>
  jerseyCategories.value
    .map(category => {
      const key = category.key as Exclude<CategoryKey, 'rit'>;
      const info = jerseyInfo[key];
      return {
        key,
        label: info.label,
        riders: ridersFor(key, Number(resultOptions.value?.[info.limitField] ?? 0))
      };
    })
    .filter(jersey => jersey.riders.length > 0)
);

// Gedeelde plaatsen bij gelijke score: 1, 2, 2, 4.
const rankDescending = (scores: Array<{ deelnID: number; score: number }>) => {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const ranks = new Map<number, number>();
  sorted.forEach((item, index) => {
    const previous = sorted[index - 1];
    ranks.set(item.deelnID, previous && previous.score === item.score ? ranks.get(previous.deelnID)! : index + 1);
  });
  return ranks;
};

const participantName = (participant: Participant) => {
  const name = [participant.vNaam, participant.tNaam, participant.aNaam].filter(Boolean).join(' ');
  return participant.roepnaam?.trim() || name || `Deelnemer #${participant.deelnID}`;
};

const compareNames = (a: { roepnaam: string }, b: { roepnaam: string }) =>
  a.roepnaam.localeCompare(b.roepnaam, 'nl', { sensitivity: 'base' });

const stageResultRows = computed(() => {
  const stageNumber = selectedStageNumber.value;
  const pointsByParticipant = new Map(
    resultPoints.value
      .filter(point => point.etappeNr === stageNumber)
      .map(point => [point.deelnemID, point])
  );
  return participants.value
    .map(participant => {
      const score = pointsByParticipant.get(participant.deelnID);
      return {
        deelnID: participant.deelnID,
        roepnaam: participantName(participant),
        categories: Object.fromEntries(
          allResultCategories.map(category => [category.key, Number(score?.[category.field] ?? 0)])
        ) as Record<CategoryKey, number>,
        punten: Number(score?.etapPnt ?? 0),
        plaats: Number(score?.etapPlaats ?? 0),
        geld: Number(score?.etapGeld ?? 0)
      };
    })
    .sort((a, b) =>
      b.punten - a.punten ||
      (a.plaats || Number.MAX_SAFE_INTEGER) - (b.plaats || Number.MAX_SAFE_INTEGER) ||
      compareNames(a, b)
    );
});

const overallResultRows = computed(() => {
  const stageNumber = selectedStageNumber.value ?? 0;
  const participantIDs = new Set(participants.value.map(participant => participant.deelnID));
  const totals = new Map<number, Record<CategoryKey, number> & { punten: number }>();
  const latest = new Map<number, ParticipantPoints>();

  for (const point of resultPoints.value) {
    if (!participantIDs.has(point.deelnemID) || point.etappeNr > stageNumber) continue;
    const total = totals.get(point.deelnemID) ?? { rit: 0, geel: 0, groen: 0, bol: 0, wit: 0, punten: 0 };
    for (const category of allResultCategories) total[category.key] += Number(point[category.field] ?? 0);
    total.punten += Number(point.etapPnt ?? 0);
    totals.set(point.deelnemID, total);
    if (point.etappeNr === stageNumber) latest.set(point.deelnemID, point);
  }

  const rows = participants.value.map(participant => {
    const total = totals.get(participant.deelnID) ?? { rit: 0, geel: 0, groen: 0, bol: 0, wit: 0, punten: 0 };
    const stagePoint = latest.get(participant.deelnID);
    return {
      deelnID: participant.deelnID,
      roepnaam: participantName(participant),
      totals: total,
      geld: Number(stagePoint?.ttlGeld ?? 0)
    };
  });

  const categoryRanks = Object.fromEntries(
    allResultCategories.map(category => [
      category.key,
      rankDescending(rows.map(row => ({ deelnID: row.deelnID, score: row.totals[category.key] })))
    ])
  ) as Record<CategoryKey, Map<number, number>>;
  const totalRanks = rankDescending(rows.map(row => ({ deelnID: row.deelnID, score: row.totals.punten })));

  return rows
    .map(row => ({
      ...row,
      plaats: totalRanks.get(row.deelnID) ?? 0,
      ranks: Object.fromEntries(
        allResultCategories.map(category => [category.key, categoryRanks[category.key].get(row.deelnID) ?? 0])
      ) as Record<CategoryKey, number>
    }))
    .sort((a, b) => a.plaats - b.plaats || compareNames(a, b));
});

// Vaste rijhoogtes (mm) in de print-CSS maken deze capaciteitsberekening betrouwbaar.
const resultLayout = {
  pageHeight: 281,
  header: 13,
  topRow: 4.6,
  topTitle: 7,
  topGap: 5,
  tableHead: 6,
  tableRow: 5.4,
  sectionGap: 6,
  sectionTitle: 7
};

const resultTopHeight = computed(() => {
  const topLines = Math.max(
    stageTopRiders.value.length,
    jerseyStandings.value.reduce((sum, jersey) => sum + jersey.riders.length, 0),
    1
  );
  return resultLayout.topTitle + topLines * resultLayout.topRow + resultLayout.topGap;
});

const stageResultPages = computed(() =>
  paginateColumns(stageResultRows.value, resultTopHeight.value).map((columns, index) => ({ showTop: index === 0, columns }))
);

const rowsPerColumn = (available: number) =>
  Math.max(Math.floor((available - resultLayout.tableHead) / resultLayout.tableRow), 1);

// Verdeelt rijen over pagina's met twee kolommen (eerst van boven naar beneden, dan naar rechts).
const paginateColumns = <T,>(rows: T[], firstPageOffset = 0) => {
  const firstPageRows = rowsPerColumn(resultLayout.pageHeight - resultLayout.header - firstPageOffset);
  const fullPageRows = rowsPerColumn(resultLayout.pageHeight - resultLayout.header);
  const pages: T[][][] = [];
  let offset = 0;
  do {
    const perColumn = pages.length === 0 ? firstPageRows : fullPageRows;
    const pageRows = rows.slice(offset, offset + perColumn * 2);
    offset += pageRows.length;
    // Laatste pagina gelijk verdelen; anders eerst de linkerkolom vullen.
    const leftCount = offset >= rows.length ? Math.ceil(pageRows.length / 2) : perColumn;
    pages.push([pageRows.slice(0, leftCount), pageRows.slice(leftCount)]);
  } while (offset < rows.length);
  return pages;
};

const overallResultPages = computed(() => paginateColumns(overallResultRows.value));

// Past het algemeen klassement volledig onder de etappe-uitslag op de laatste etappepagina?
const overallFitsUnderStage = computed(() => {
  const pages = stageResultPages.value;
  const lastPage = pages[pages.length - 1];
  const used =
    resultLayout.header +
    (lastPage.showTop ? resultTopHeight.value : 0) +
    resultLayout.tableHead +
    Math.max(...lastPage.columns.map(column => column.length)) * resultLayout.tableRow;
  const needed =
    resultLayout.sectionGap +
    resultLayout.sectionTitle +
    resultLayout.tableHead +
    Math.ceil(overallResultRows.value.length / 2) * resultLayout.tableRow;
  return used + needed <= resultLayout.pageHeight;
});

const inlineOverallColumns = computed(() => {
  const rows = overallResultRows.value;
  const leftCount = Math.ceil(rows.length / 2);
  return [rows.slice(0, leftCount), rows.slice(leftCount)];
});

const separateOverallPages = computed(() => (overallFitsUnderStage.value ? [] : overallResultPages.value));
const resultPageCount = computed(() => stageResultPages.value.length + separateOverallPages.value.length);

const selectedStageTitle = computed(() => {
  const stage = stages.value.find(item => item.etappeNr === selectedStageNumber.value);
  const details = [
    stage?.datum
      ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long' }).format(new Date(stage.datum))
      : null,
    [stage?.Start, stage?.Finish].filter(Boolean).join(' – ') || null
  ].filter(Boolean).join(', ');
  return `Etappe ${selectedStageNumber.value}${details ? ` (${details})` : ''}`;
});

const printWithPageStyle = async (mode: 'chart' | 'result', pageCss: string, title: string) => {
  printMode.value = mode;
  await loadPrintFonts();
  const pageStyle = document.createElement('style');
  pageStyle.textContent = pageCss;
  document.head.appendChild(pageStyle);
  const originalTitle = document.title;
  document.title = title;
  window.addEventListener('afterprint', () => {
    document.title = originalTitle;
    pageStyle.remove();
    printMode.value = null;
  }, { once: true });
  window.print();
};

const printStageResult = async () => {
  if (!activePool.value || !selectedStageNumber.value) return;

  preparingResult.value = true;
  errorMessage.value = '';
  try {
    const [pointsData, riderResults, options] = await Promise.all([
      apiFetch<ParticipantPoints[]>('/participant-points'),
      apiFetch<StageRiderResult[]>(`/stage-results?tourID=${activePool.value.tourID}&etappeNr=${selectedStageNumber.value}`),
      apiFetch<PoolOptionLimits>(`/options/${activePool.value.poolID}`).catch(() => null)
    ]);
    resultPoints.value = pointsData;
    stageRiderResults.value = riderResults;
    resultOptions.value = options;
  } catch (error) {
    errorMessage.value = `Fout bij laden van de uitslaggegevens: ${error instanceof Error ? error.message : String(error)}`;
    return;
  } finally {
    preparingResult.value = false;
  }
  printMode.value = 'result';
  await nextTick();

  const printHeight = resultPageCount.value * 283 - 2;
  await printWithPageStyle(
    'result',
    `
    @page { size: A4 portrait; margin: 7mm; }
    @media print {
      html, body { height: ${printHeight}mm !important; overflow: hidden !important; }
    }
  `,
    `${activePool.value.Naam || `Pool ${activePool.value.poolID}`} - uitslag etappe ${selectedStageNumber.value}`
  );
};

watch(() => activePoolStore.activePoolID, poolID => {
  if (poolID) void loadActivePool(poolID);
  else {
    participants.value = [];
    stages.value = [];
    stageResults.value = [];
    points.value = [];
    selectedStageNumber.value = null;
  }
});

watch(selectedStageNumber, stageNumber => {
  if (stageNumber && !loading.value) void fetchStagePoints(stageNumber);
  else points.value = [];
});

onMounted(async () => {
  try {
    pools.value = await apiFetch<Pool[]>('/pools');
    const activePoolExists = pools.value.some(pool => pool.poolID === activePoolStore.activePoolID);
    if (!activePoolExists && pools.value[0]) {
      activePoolStore.setActivePool(pools.value[0].poolID);
    } else if (activePoolStore.activePoolID) {
      await loadActivePool(activePoolStore.activePoolID);
    }
  } catch (error) {
    errorMessage.value = `Fout bij laden van pools: ${error instanceof Error ? error.message : String(error)}`;
  }
});
</script>

<template>
  <div class="h-full space-y-4 overflow-y-auto">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-slate-900">Poolstand</h2>
        <p class="text-xs text-slate-600">
          {{ activePool?.Naam || 'Selecteer een actieve pool' }}
          <span v-if="selectedStageNumber">· Stand na etappe {{ selectedStageNumber }}</span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <label for="standings-stage" class="text-sm font-medium text-slate-700">Etappe</label>
        <select
          id="standings-stage"
          v-model.number="selectedStageNumber"
          :disabled="loading || availableStages.length === 0"
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none disabled:opacity-50"
        >
          <option v-for="stage in availableStages" :key="stage.etappeNr" :value="stage.etappeNr">
            Etappe {{ stage.etappeNr }}
          </option>
        </select>
        <button
          type="button"
          @click="printPointsChart"
          :disabled="loading || preparingChart || !selectedStageNumber || participants.length === 0"
          class="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          title="Grafiek met gestapelde etappepunten per deelnemer als PDF afdrukken"
        >
          <BarChart3 class="h-4 w-4" />
          <span>PDF grafiek</span>
        </button>
        <button
          type="button"
          @click="printStageResult"
          :disabled="loading || preparingResult || !selectedStageNumber || participants.length === 0"
          class="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          title="Etappeuitslag en algemeen klassement als PDF afdrukken"
        >
          <FileText class="h-4 w-4" />
          <span>PDF uitslag</span>
        </button>
        <button
          type="button"
          @click="recalculateAllStages"
          :disabled="loading || recalculating || !activePool"
          class="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          title="Punten, totalen en prijzengeld van alle etappes opnieuw berekenen"
        >
          <Calculator class="h-4 w-4" :class="{ 'animate-pulse': recalculating }" />
          <span>{{ recalculating ? 'Doorrekenen…' : 'Herbereken' }}</span>
        </button>
        <button
          type="button"
          @click="refresh"
          :disabled="loading || loadingPoints"
          class="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          title="Stand verversen"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading || loadingPoints }" />
        </button>
      </div>
    </div>

    <div v-if="successMessage" role="status" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
      {{ successMessage }}
    </div>

    <div v-if="errorMessage" role="alert" class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
      {{ errorMessage }}
    </div>

    <div v-if="!activePool && !loading" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
      Maak of selecteer eerst een actieve pool via Pools.
    </div>
    <div v-else-if="!loading && stages.length === 0" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
      Er zijn nog geen etappes beschikbaar voor deze pool.
    </div>
    <div v-else-if="!loading && latestResultStage === null" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
      Er zijn nog geen etappeuitslagen ingevoerd.
    </div>
    <div v-else-if="!loading && participants.length === 0" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
      Er zijn nog geen deelnemers in deze pool.
    </div>
    <div v-else class="shadow-xs overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1120px] border-collapse text-left text-sm">
          <thead class="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" class="px-4 py-3">Plaats</th>
              <th scope="col" class="px-4 py-3">Roepnaam</th>
              <th scope="col" class="px-4 py-3 text-right">RitPnt</th>
              <th v-for="category in jerseyCategories" :key="category.key" scope="col" class="px-4 py-3 text-right">
                {{ category.field }}
              </th>
              <th scope="col" class="px-4 py-3 text-right">EtapPnt (plaats)</th>
              <th scope="col" class="px-4 py-3 text-right">Totaal punten</th>
              <th scope="col" class="px-4 py-3 text-right">Etappe geld</th>
              <th scope="col" class="px-4 py-3 text-right">Totaal geld</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loading || loadingPoints">
              <td :colspan="7 + jerseyCategories.length" class="px-4 py-10 text-center text-slate-500">Stand laden...</td>
            </tr>
            <tr v-else-if="!selectedStageNumber">
              <td :colspan="7 + jerseyCategories.length" class="px-4 py-10 text-center text-slate-500">Selecteer een etappe.</td>
            </tr>
            <tr v-else v-for="(row, index) in participantRows" :key="row.deelnID" class="hover:bg-slate-50">
              <td class="px-4 py-3 font-mono font-semibold text-slate-700">
                {{ row.totaalPlaats || index + 1 }}
              </td>
              <th scope="row" class="px-4 py-3 font-semibold text-slate-900">{{ row.roepnaam }}</th>
              <td class="px-4 py-3 text-right font-mono">{{ row.ritPunten }}</td>
              <td v-for="category in jerseyCategories" :key="category.key" class="px-4 py-3 text-right font-mono">
                {{ row.jerseyPunten[category.key] }}
              </td>
              <td class="px-4 py-3 text-right font-mono">{{ row.etappePunten }} ({{ row.etappePlaats }})</td>
              <td class="px-4 py-3 text-right font-mono font-semibold">{{ row.totaalPunten }}</td>
              <td class="px-4 py-3 text-right font-mono">{{ formatMoney(row.etappeGeld) }}</td>
              <td class="px-4 py-3 text-right font-mono font-semibold text-emerald-700">{{ formatMoney(row.totaalGeld) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <Award class="h-4 w-4" />
        De plaats is gebaseerd op de totaalstand na de geselecteerde etappe.
      </div>
    </div>

    <section v-if="printMode === 'chart' && activePool && chartRows.length > 0" class="points-chart-report" aria-hidden="true">
      <div v-for="(pageBars, pageIndex) in chart.pages" :key="pageIndex" class="points-chart-page">
      <header class="points-chart-header" :class="{ 'points-chart-blank': pageIndex > 0 }">
        <strong>
          <template v-if="activePool.Org?.trim()">{{ activePool.Org.trim() }}, </template>{{ activePool.Naam || `Pool #${activePool.poolID}` }}
        </strong>
        <span>Etappepunten per deelnemer t/m etappe {{ selectedStageNumber }}</span>
      </header>
      <div class="points-chart-legend" :class="{ 'points-chart-blank': pageIndex > 0 }">
        <span v-for="stage in chartStages" :key="stage.etappeNr">
          <i :style="{ backgroundColor: stage.color }"></i>Etappe {{ stage.etappeNr }}
        </span>
      </div>
      <svg
        class="points-chart-svg"
        :viewBox="`0 0 ${chart.width} ${chart.height}`"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g v-for="tick in chart.ticks" :key="tick.value">
          <line
            :x1="chart.left"
            :x2="chart.width - chart.right"
            :y1="tick.y"
            :y2="tick.y"
            :stroke="tick.value === 0 ? '#334155' : '#e2e8f0'"
            :stroke-width="tick.value === 0 ? 0.3 : 0.2"
          />
          <text :x="chart.left - 1.5" :y="tick.y + 0.9" text-anchor="end" font-size="2.6" fill="#475569">
            {{ tick.value }}
          </text>
        </g>
        <g v-for="bar in pageBars" :key="bar.deelnID">
          <g v-for="segment in bar.segments" :key="segment.etappeNr">
            <rect
              :x="bar.x"
              :y="segment.y"
              :width="chart.barWidth"
              :height="segment.height"
              :fill="segment.color"
              stroke="#ffffff"
              stroke-width="0.15"
            />
            <text
              v-if="segment.showLabel"
              :x="bar.center"
              :y="segment.y + segment.height / 2 + 0.75"
              text-anchor="middle"
              font-size="2.1"
              :fill="segment.textColor"
            >
              {{ segment.points }}
            </text>
          </g>
          <text
            :x="bar.center"
            :y="bar.topY - 1"
            text-anchor="middle"
            font-size="2.6"
            font-weight="700"
            fill="#172033"
          >
            {{ bar.total }}
          </text>
          <text
            :transform="`translate(${bar.center + 0.9} ${chart.axisY + 1.5}) rotate(-90)`"
            text-anchor="end"
            font-size="2.8"
            fill="#172033"
          >
            {{ bar.roepnaam }}
          </text>
        </g>
      </svg>
      </div>
    </section>

    <section v-if="printMode === 'result' && activePool" class="result-report" aria-hidden="true">
      <div
        v-for="(page, pageIndex) in stageResultPages"
        :key="`stage-${pageIndex}`"
        class="result-page"
        :class="{ 'result-page-last': overallFitsUnderStage && pageIndex === stageResultPages.length - 1 }"
      >
        <header class="result-header">
          <strong>
            <template v-if="activePool.Org?.trim()">{{ activePool.Org.trim() }}, </template>{{ activePool.Naam || `Pool #${activePool.poolID}` }}
          </strong>
          <span>Uitslag {{ selectedStageTitle }}</span>
          <small>{{ pageIndex + 1 }}/{{ resultPageCount }}</small>
        </header>

        <div v-if="page.showTop" class="result-top">
          <section>
            <h3>Etappe-uitslag</h3>
            <table class="result-riders">
              <tbody>
                <tr v-for="rider in stageTopRiders" :key="rider.plaats">
                  <td class="result-rider-place">{{ rider.plaats }}.</td>
                  <td class="result-rider-name">
                    {{ rider.naam }}<span v-if="rider.ploegCode" class="result-rider-team"> ({{ rider.ploegCode }})</span>
                  </td>
                  <td class="result-rider-points">{{ rider.punten != null ? `${rider.punten} pnt` : '' }}</td>
                </tr>
                <tr v-if="stageTopRiders.length === 0">
                  <td class="result-rider-name">Geen uitslag ingevoerd.</td>
                </tr>
              </tbody>
            </table>
          </section>
          <section>
            <h3>Stand truien</h3>
            <table class="result-riders">
              <tbody>
                <template v-for="jersey in jerseyStandings" :key="jersey.key">
                  <tr
                    v-for="(rider, riderIndex) in jersey.riders"
                    :key="`${jersey.key}-${rider.plaats}`"
                    :class="{ 'result-jersey-start': riderIndex === 0 }"
                  >
                    <td class="result-jersey-label">
                      <template v-if="riderIndex === 0">
                        <i class="result-jersey-dot" :class="`result-jersey-${jersey.key}`"></i>{{ jersey.label }}
                      </template>
                    </td>
                    <td class="result-rider-place">{{ rider.plaats }}.</td>
                    <td class="result-rider-name">
                      {{ rider.naam }}<span v-if="rider.ploegCode" class="result-rider-team"> ({{ rider.ploegCode }})</span>
                    </td>
                    <td class="result-rider-points">{{ rider.punten != null ? `${rider.punten} pnt` : '' }}</td>
                  </tr>
                </template>
                <tr v-if="jerseyStandings.length === 0">
                  <td class="result-rider-name">Geen truistanden ingevoerd.</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        <div class="result-columns">
          <table v-for="(columnRows, columnIndex) in page.columns" :key="columnIndex" class="result-table result-table-compact">
            <thead>
              <tr>
                <th class="result-place">Pl.</th>
                <th class="result-name">Deelnemer</th>
                <th v-for="category in resultCategories" :key="category.key">{{ category.label }}</th>
                <th>Etap</th>
                <th>€</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in columnRows" :key="row.deelnID">
                <td class="result-place">{{ row.plaats || '–' }}</td>
                <td class="result-name">{{ row.roepnaam }}</td>
                <td v-for="category in resultCategories" :key="category.key">{{ row.categories[category.key] }}</td>
                <td class="result-strong">{{ row.punten }}</td>
                <td class="result-money" :class="{ 'result-strong': row.geld > 0 }">{{ row.geld > 0 ? formatMoney(row.geld) : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <template v-if="overallFitsUnderStage && pageIndex === stageResultPages.length - 1">
          <h3 class="result-section-title">Algemeen klassement na etappe {{ selectedStageNumber }}</h3>
          <div class="result-columns">
            <table v-for="(columnRows, columnIndex) in inlineOverallColumns" :key="columnIndex" class="result-table result-table-compact result-table-overall">
              <thead>
                <tr>
                  <th class="result-place">Pl.</th>
                  <th class="result-name">Deelnemer</th>
                  <th v-for="category in resultCategories" :key="category.key">{{ category.label }}</th>
                  <th>Totaal</th>
                  <th>€</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in columnRows" :key="row.deelnID">
                  <td class="result-place">{{ row.plaats }}</td>
                  <td class="result-name">{{ row.roepnaam }}</td>
                  <td v-for="category in resultCategories" :key="category.key">
                    {{ row.totals[category.key] }}<span class="result-rank"> ({{ row.ranks[category.key] }})</span>
                  </td>
                  <td class="result-strong">{{ row.totals.punten }}</td>
                  <td class="result-money" :class="{ 'result-strong': row.geld > 0 }">{{ row.geld > 0 ? formatMoney(row.geld) : '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>

      <div
        v-for="(pageColumns, pageIndex) in separateOverallPages"
        :key="`overall-${pageIndex}`"
        class="result-page"
        :class="{ 'result-page-last': pageIndex === separateOverallPages.length - 1 }"
      >
        <header class="result-header">
          <strong>
            <template v-if="activePool.Org?.trim()">{{ activePool.Org.trim() }}, </template>{{ activePool.Naam || `Pool #${activePool.poolID}` }}
          </strong>
          <span>Algemeen klassement na etappe {{ selectedStageNumber }}</span>
          <small>{{ stageResultPages.length + pageIndex + 1 }}/{{ resultPageCount }}</small>
        </header>
        <div class="result-columns">
          <table v-for="(columnRows, columnIndex) in pageColumns" :key="columnIndex" class="result-table result-table-compact result-table-overall">
            <thead>
              <tr>
                <th class="result-place">Pl.</th>
                <th class="result-name">Deelnemer</th>
                <th v-for="category in resultCategories" :key="category.key">{{ category.label }}</th>
                <th>Totaal</th>
                <th>€</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in columnRows" :key="row.deelnID">
                <td class="result-place">{{ row.plaats }}</td>
                <td class="result-name">{{ row.roepnaam }}</td>
                <td v-for="category in resultCategories" :key="category.key">
                  {{ row.totals[category.key] }}<span class="result-rank"> ({{ row.ranks[category.key] }})</span>
                </td>
                <td class="result-strong">{{ row.totals.punten }}</td>
                <td class="result-money" :class="{ 'result-strong': row.geld > 0 }">{{ row.geld > 0 ? formatMoney(row.geld) : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>

<style>
.points-chart-report,
.result-report {
  display: none;
}

@media print {
  html,
  body {
    margin: 0 !important;
  }

  body * {
    visibility: hidden !important;
  }

  .points-chart-report,
  .points-chart-report *,
  .result-report,
  .result-report * {
    visibility: visible !important;
  }

  .result-report {
    position: absolute;
    inset: 0;
    display: block !important;
    width: 196mm;
    color: #172033;
    font-family: var(--pdf-body-font);
  }

  .result-page {
    width: 196mm;
    height: 281mm;
    overflow: hidden;
    break-inside: avoid;
    break-after: page;
  }

  .result-page-last {
    break-after: auto;
  }

  .result-header {
    font-family: var(--pdf-heading-font);
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: end;
    gap: 3mm;
    padding-bottom: 1mm;
    margin-bottom: 2mm;
    border-bottom: 0.3mm solid #64748b;
  }

  .result-header strong {
    font-size: 11pt;
  }

  .result-header span {
    font-size: 14pt;
    font-weight: 700;
    text-align: center;
  }

  .result-header small {
    font-size: 8pt;
    text-align: right;
  }

  .result-table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
    font-size: 9pt;
  }

  .result-table th,
  .result-table td {
    height: 6mm;
    padding: 0 1.5mm;
    border-bottom: 0.2mm solid #cbd5e1;
    text-align: right;
    white-space: nowrap;
  }

  .result-table th {
    border-bottom: 0.3mm solid #334155;
    font-size: 8pt;
    text-transform: uppercase;
  }

  .result-table th:not(.result-name),
  .result-table td:not(.result-name):not(.result-money) {
    text-align: center;
  }

  .result-table td.result-money {
    text-align: right;
  }

  .result-table tbody tr:nth-child(even) td {
    background-color: #f1f5f9;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .result-table .result-place {
    width: 9mm;
    text-align: right;
  }

  .result-table .result-name {
    width: 100%;
    text-align: left;
    font-weight: 600;
  }

  .result-strong {
    font-weight: 700;
  }

  .result-top {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6mm;
    margin-bottom: 5mm;
  }

  .result-section-title {
    height: 7mm;
    margin: 6mm 0 0;
    font-family: var(--pdf-heading-font);
    font-size: 12pt;
    font-weight: 700;
    line-height: 6.5mm;
  }

  .result-top h3 {
    height: 7mm;
    margin: 0;
    border-bottom: 0.3mm solid #334155;
    font-family: var(--pdf-heading-font);
    font-size: 12pt;
    font-weight: 700;
    line-height: 6.5mm;
  }

  .result-riders {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
  }

  .result-riders td {
    height: 4.6mm;
    padding: 0 1mm;
    white-space: nowrap;
  }

  .result-riders .result-jersey-start td {
    border-top: 0.2mm solid #cbd5e1;
  }

  .result-riders tr:first-child td {
    border-top: 0;
  }

  .result-rider-place {
    width: 6mm;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .result-rider-name {
    width: 100%;
    max-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-rider-team {
    color: #64748b;
    font-size: 7.5pt;
  }

  .result-rider-points {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  .result-jersey-label {
    width: 26mm;
    font-weight: 700;
  }

  .result-jersey-dot {
    display: inline-block;
    width: 2.6mm;
    height: 2.6mm;
    margin-right: 1.2mm;
    border: 0.2mm solid #64748b;
    border-radius: 50%;
    vertical-align: -0.3mm;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .result-jersey-geel { background: #facc15; }
  .result-jersey-groen { background: #16a34a; }
  .result-jersey-bol { background: radial-gradient(circle, #dc2626 35%, #ffffff 40%); }
  .result-jersey-wit { background: #ffffff; }

  .result-columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 4mm;
  }

  .result-table-compact {
    font-size: 8pt;
  }

  .result-table-compact th,
  .result-table-compact td {
    height: 5.4mm;
    padding: 0 0.9mm;
  }

  .result-table-compact th {
    height: 6mm;
    font-size: 6.5pt;
  }

  .result-table-compact .result-place {
    width: 6mm;
  }

  .result-table-compact .result-name {
    width: 19mm;
    max-width: 19mm;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-rank {
    color: #64748b;
    font-size: 7.5pt;
  }

  .result-table-compact .result-rank {
    font-size: 6.5pt;
  }

  .points-chart-report {
    position: absolute;
    inset: 0;
    display: block !important;
    width: 281mm;
    color: #172033;
    font-family: var(--pdf-body-font);
  }

  .points-chart-page {
    display: flex;
    width: 281mm;
    height: 192mm;
    flex-direction: column;
    overflow: hidden;
    break-inside: avoid;
    break-after: page;
  }

  .points-chart-page:last-child {
    break-after: auto;
  }

  .points-chart-header {
    font-family: var(--pdf-heading-font);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5mm;
    padding-bottom: 1mm;
    border-bottom: 0.3mm solid #64748b;
    text-align: center;
  }

  .points-chart-header strong {
    font-size: 13pt;
  }

  .points-chart-header span {
    font-size: 10pt;
    font-weight: 600;
  }

  .points-chart-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1mm 3mm;
    margin: 2mm 0 1mm;
    font-size: 7pt;
  }

  .points-chart-report .points-chart-blank * {
    visibility: hidden !important;
  }

  .points-chart-legend span {
    display: inline-flex;
    align-items: center;
    gap: 1mm;
  }

  .points-chart-legend i {
    display: inline-block;
    width: 3mm;
    height: 3mm;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .points-chart-svg {
    width: 281mm;
    height: 170mm;
    font-family: var(--pdf-body-font);
  }
}
</style>
