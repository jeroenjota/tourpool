import { z } from 'zod';
import { HttpError } from './auth.js';

async function read(path: string, body?: URLSearchParams) {
  const response = await fetch(`https://dataride.uci.ch/iframe/${path}`, {
    ...(body ? { method: 'POST', body } : {}),
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new HttpError(502, `UCI-ranking ophalen mislukt (HTTP ${response.status}).`);
  return response.json();
}

export async function loadUciRanking(year: string) {
  const seasons = z.array(z.object({ Id: z.number().int(), Year: z.number().int() }))
    .parse(await read('GetDisciplineSeasons/?disciplineId=10'));
  const season = seasons.find(item => item.Year === Number(year));
  if (!season) throw new HttpError(502, `Geen UCI-rankingseizoen ${year} beschikbaar.`);
  const groups = z.array(z.object({ Rankings: z.array(z.object({
    Id: z.number().int(), MomentId: z.number().int(), CategoryId: z.number().int(),
    RankingTypeId: z.number().int()
  })) })).parse(await read('RankingsDiscipline/10', new URLSearchParams({
    'filter[filters][0][field]': 'SeasonId',
    'filter[filters][0][value]': String(season.Id)
  })));
  const ranking = groups.flatMap(group => group.Rankings)
    .find(item => item.Id === 238 && item.CategoryId === 22 && item.RankingTypeId === 2);
  if (!ranking) throw new HttpError(502, 'Actuele UCI World Ranking voor mannenploegen ontbreekt.');
  const params = new URLSearchParams({
    rankingId: '238', disciplineId: '10', rankingTypeId: '2',
    page: '1', pageSize: '500', skip: '0', take: '500'
  });
  for (const [index, [field, value]] of [
    ['RaceTypeId', 0], ['CategoryId', 22], ['SeasonId', season.Id], ['MomentId', ranking.MomentId]
  ].entries()) {
    params.set(`filter[filters][${index}][field]`, String(field));
    params.set(`filter[filters][${index}][value]`, String(value));
  }
  const result = z.object({
    total: z.number().int().positive(),
    data: z.array(z.object({
      TeamCode: z.string().min(1), Rank: z.number().int().positive(),
      ComputationDate: z.string().regex(/^\/Date\(\d+\)\/$/)
    })).nonempty()
  }).parse(await read('ObjectRankings/', params));
  if (result.total !== result.data.length ||
      new Set(result.data.map(item => item.TeamCode)).size !== result.data.length) {
    throw new HttpError(502, 'UCI World Ranking is onvolledig of bevat dubbele ploegcodes.');
  }
  return {
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' })
      .format(new Date(Number(result.data[0].ComputationDate.match(/\d+/)![0]))),
    ranks: new Map(result.data.map(item => [item.TeamCode, item.Rank]))
  };
}

export function selectRankedTeams<T extends { teamCode: string; categoryName: 'WTT' | 'PRT' }>(
  teams: T[], ranks: Map<string, number>
) {
  if (teams.some(team => !ranks.has(team.teamCode))) {
    throw new HttpError(502, 'Niet alle actuele profploegen zijn teruggevonden in de UCI World Ranking.');
  }
  const sorted = [...teams].sort((a, b) =>
    ranks.get(a.teamCode)! - ranks.get(b.teamCode)! || a.teamCode.localeCompare(b.teamCode)
  );
  const world = sorted.filter(team => team.categoryName === 'WTT').slice(0, 18);
  const pro = sorted.filter(team => team.categoryName === 'PRT').slice(0, 5);
  if (world.length !== 18 || pro.length !== 5) throw new HttpError(502, 'UCI-selectie bevat niet 18 WorldTeams en 5 ProTeams.');
  return [...world, ...pro];
}
