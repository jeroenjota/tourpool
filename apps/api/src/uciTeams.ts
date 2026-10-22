import { z } from 'zod';
import { HttpError } from './auth.js';
import { pool } from './db.js';
import { loadUciRanking, selectRankedTeams } from './uciRanking.js';

export const uciTeamsSource = 'https://www.uci.org/riders/road-riders-teams/4uEfOErsvL4hkRJriqkdiw';
const sportingCountryCodes: Record<string, string> = {
  GER: 'DEU', SUI: 'CHE', NED: 'NLD', UAE: 'ARE', DEN: 'DNK', BRN: 'BHR', BRU: 'BRN',
  SLO: 'SVN', CRO: 'HRV', POR: 'PRT', RSA: 'ZAF', LAT: 'LVA',
  GRE: 'GRC', TPE: 'TWN', CHI: 'CHL', CRC: 'CRI', URU: 'URY',
  ESA: 'SLV', GUA: 'GTM', PAR: 'PRY', MON: 'MCO', MRI: 'MUS', MGL: 'MNG'
};
const teamSchema = z.object({
  teamName: z.string().trim().min(1).max(255),
  teamCode: z.string().regex(/^[A-Z0-9]{2,10}$/),
  countryCode: z.string().regex(/^[A-Z]{3}$/),
  categoryName: z.enum(['WTT', 'PRT']),
  url: z.string().regex(/^\/team-details\/\d+$/)
});
const pageSchema = z.object({
  totalItems: z.number().int().positive(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  items: z.array(teamSchema).nonempty()
});

async function get(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new HttpError(502, `UCI ophalen mislukt (HTTP ${response.status}).`);
  return response;
}

export async function loadUciTeams() {
  const html = await (await get(uciTeamsSource)).text();
  const props = html.match(/data-component="RidersModule"\s+data-props="([^"]+)"/)?.[1];
  if (!props) throw new HttpError(502, 'UCI-ploegenlijst heeft een onbekende indeling.');
  const metadata = z.object({
    teams: z.object({ filters: z.array(z.object({
      queryParam: z.string(),
      items: z.array(z.object({ code: z.string(), selected: z.boolean() }))
    })) })
  }).parse(JSON.parse(props.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")));
  const year = metadata.teams.filters.find(filter => filter.queryParam === 'year')
    ?.items.find(item => item.selected)?.code;
  if (!year || !/^\d{4}$/.test(year)) throw new HttpError(502, 'Geen actueel UCI-seizoen gevonden.');
  const teams: z.infer<typeof teamSchema>[] = [];
  for (const category of ['WTT', 'PRT']) {
    let total = 0;
    for (let page = 1; ; page++) {
      if (page > 20) throw new HttpError(502, 'UCI-ploegenlijst bevat te veel pagina’s.');
      const data = pageSchema.parse(await (await get(
        `https://www.uci.org/api/teams/ROA/${year}?page=${page}&category=${category}`
      )).json());
      if (data.page !== page || data.items.some(team => team.categoryName !== category)) {
        throw new HttpError(502, 'UCI levert onverwachte ploegcategorieën of paginering.');
      }
      teams.push(...data.items);
      total += data.items.length;
      if (total === data.totalItems) break;
      if (total > data.totalItems) throw new HttpError(502, 'UCI-ploegenlijst is inconsistent.');
    }
  }
  if (new Set(teams.map(team => team.teamCode)).size !== teams.length) {
    throw new HttpError(502, 'Dubbele ploegcodes in de UCI-lijst.');
  }
  return { year, teams };
}

export async function syncUciTeams() {
  const { year, teams: allTeams } = await loadUciTeams();
  const ranking = await loadUciRanking(year);
  const teams = selectRankedTeams(allTeams, ranking.ranks);
  const riders = await loadUciRiders(teams);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const countries = await connection.query('SELECT code, iso2 FROM tblLanden') as Array<{ code: string; iso2: string }>;
    const existing = await connection.query(
      'SELECT ploegID, naam, landID, ploegCode FROM tblPloegen FOR UPDATE'
    ) as Array<{ ploegID: number; naam: string | null; landID: string | null; ploegCode: string | null }>;
    let added = 0;
    let updated = 0;
    let unchanged = 0;
    const { ids: _riderIDs, ...riderSummary } = await addMissingUciRiders(connection, riders, countries);
    const normalize = (value: string | null) => (value ?? '').trim().toUpperCase();
    const matched = new Set<number>();
    for (const team of teams) {
      const country = countries.filter(item => item.code === (sportingCountryCodes[team.countryCode] ?? team.countryCode));
      if (country.length !== 1) throw new HttpError(502, `UCI-landcode ${team.countryCode} is niet eenduidig bekend.`);
      const candidates = existing.filter(item =>
        normalize(item.ploegCode) === team.teamCode || normalize(item.naam) === normalize(team.teamName)
      );
      if (candidates.length > 1 || (candidates[0] && matched.has(candidates[0].ploegID))) {
        throw new HttpError(409, `Ploeg ${team.teamName} is niet eenduidig te koppelen. Werk de bestaande ploeg eerst handmatig bij.`);
      }
      const current = candidates[0];
      if (!current) {
        await connection.query('INSERT INTO tblPloegen (naam, landID, ploegCode) VALUES (?, ?, ?)',
          [team.teamName, country[0].iso2, team.teamCode]);
        added++;
      } else {
        matched.add(current.ploegID);
        if (current.naam === team.teamName && current.landID === country[0].iso2 && current.ploegCode === team.teamCode) {
          unchanged++;
        } else {
          await connection.query('UPDATE tblPloegen SET naam = ?, landID = ?, ploegCode = ? WHERE ploegID = ?',
            [team.teamName, country[0].iso2, team.teamCode, current.ploegID]);
          updated++;
        }
      }
    }
    await connection.commit();
    return {
      year, rankingDate: ranking.date, added, updated, unchanged,
      total: teams.length, source: uciTeamsSource, riders: riderSummary
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const riderSchema = z.object({
  givenName: z.string().trim().min(1).max(255),
  familyName: z.string().trim().min(1).max(255),
  countryCode: z.string().regex(/^[A-Z]{3}$/),
  url: z.string().regex(/^\/rider-details\/\d+$/)
});
type UciRider = z.infer<typeof riderSchema> & { teamCode?: string };

export async function loadUciRiders(teams: z.infer<typeof teamSchema>[]) {
  const riders = new Map<string, UciRider>();
  for (const team of teams) {
    const html = await (await get(`https://www.uci.org${team.url}`)).text();
    const props = html.match(/data-component="TeamDetailsModule"\s+data-props="([^"]+)"/)?.[1];
    if (!props) throw new HttpError(502, `UCI-renners ontbreken voor ${team.teamName}.`);
    const details = z.object({
      details: z.object({ teamCode: z.string() }),
      riders: z.object({ panels: z.array(z.object({
        label: z.string(), riders: z.array(z.unknown())
      })) })
    }).parse(JSON.parse(props.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")));
    if (details.details.teamCode !== team.teamCode) throw new HttpError(502, 'UCI-ploegcode komt niet overeen.');
    const panels = details.riders.panels.filter(panel => ['Riders', 'Neo', 'Specialists'].includes(panel.label));
    const roster = panels.flatMap(panel => panel.riders.map(rider => riderSchema.parse(rider)));
    if (!roster.length) throw new HttpError(502, `Lege UCI-rennerslijst voor ${team.teamName}.`);
    for (const rider of roster) {
      const existing = riders.get(rider.url);
      if (existing && existing.teamCode !== team.teamCode) throw new HttpError(502, 'Een UCI-renner staat bij meerdere ploegen.');
      riders.set(rider.url, { ...rider, teamCode: team.teamCode });
    }
  }
  return [...riders.values()];
}

export async function addMissingUciRiders(
  connection: Awaited<ReturnType<typeof pool.getConnection>>,
  riders: UciRider[],
  countries: Array<{ code: string; iso2: string }>
) {
  const existing = await connection.query(
    'SELECT rennerID, anaam, tnaam, vnaam, landID FROM tblRenners FOR UPDATE'
  ) as Array<{ rennerID: number; anaam: string | null; tnaam: string | null; vnaam: string | null; landID: string | null }>;
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '');
  let added = 0;
  let unchanged = 0;
  const ids = new Map<string, number>();
  const skipped: string[] = [];
  for (const rider of riders) {
    const country = countries.filter(item => item.code === (sportingCountryCodes[rider.countryCode] ?? rider.countryCode));
    if (country.length !== 1) {
      skipped.push(`${rider.givenName} ${rider.familyName} (onbekend of dubbel land: ${rider.countryCode})`);
      continue;
    }
    const surname = normalize(rider.familyName);
    const firstName = normalize(rider.givenName.split(/\s+/)[0]);
    const candidates = existing.filter(item =>
      [item.anaam ?? '', `${item.tnaam ?? ''} ${item.anaam ?? ''}`, `${item.anaam ?? ''} ${item.tnaam ?? ''}`]
        .some(name => normalize(name) === surname) &&
      normalize((item.vnaam ?? '').trim().split(/\s+/)[0]) === firstName
    );
    if (candidates.length) {
      if (candidates.length === 1 && candidates[0].landID === country[0].iso2) {
        unchanged++;
        ids.set(rider.url, candidates[0].rennerID);
      }
      else skipped.push(`${rider.givenName} ${rider.familyName}`);
      continue;
    }
    const result = await connection.query(
      'INSERT INTO tblRenners (anaam, tnaam, vnaam, landID, gebDatum) VALUES (?, NULL, ?, ?, NULL)',
      [rider.familyName, rider.givenName, country[0].iso2]
    );
    existing.push({ rennerID: Number(result.insertId), anaam: rider.familyName, tnaam: null, vnaam: rider.givenName, landID: country[0].iso2 });
    ids.set(rider.url, Number(result.insertId));
    added++;
  }
  return { added, unchanged, skipped, total: riders.length, ids };
}
