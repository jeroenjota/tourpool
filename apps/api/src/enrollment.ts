import { HttpError } from './auth.js';
import { z } from 'zod';

export const enrollmentDateSchema = z.union([
  z.string().date(),
  z.string().datetime(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/)
]).transform(value => value.slice(0, 10)).pipe(z.string().date());

export interface EnrollmentPool {
  poolID: number;
  tourID: number;
  Naam: string | null;
  Org: string | null;
  orgStraat?: string | null;
  orgHuisnummer?: string | null;
  orgPostcode?: string | null;
  orgPlaats?: string | null;
  orgEmail?: string | null;
  orgTel?: string | null;
  tourNaam: string;
  tourStart: string | null;
  registrationStart: string | null;
  registrationEnd: string | null;
  PloegRennerAantal: number | null;
  PloegReserveAantal: number | null;
  inleg: number | string | null;
}

// DATETIME values have no timezone; enrollment dates are Dutch local time.
export function dutchDateTime(value: string): number {
  const target = Date.parse(`${value}Z`);
  if (!Number.isFinite(target)) throw new Error('Ongeldige inschrijfdatum in de database');
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const local = formatter.format(new Date(instant)).replace(' ', 'T');
    const difference = target - Date.parse(`${local}Z`);
    if (difference === 0) return instant;
    instant += difference;
  }
  throw new Error('Niet-bestaand Nederlands tijdstip in de inschrijfperiode');
}

export function enrollmentStatus(p: EnrollmentPool, now = Date.now()) {
  if (!p.tourStart) return { editable: false, closesAt: null, reason: 'De tour heeft nog geen startdatum.' };
  const tourStart = dutchDateTime(`${p.tourStart.slice(0, 10)}T00:00:00`);
  // The final enrollment day is inclusive; advance the calendar date before
  // converting midnight to Dutch time, since DST days need not last 24 hours.
  let end = tourStart;
  if (p.registrationEnd) {
    const nextDay = new Date(`${p.registrationEnd.slice(0, 10)}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    end = dutchDateTime(`${nextDay.toISOString().slice(0, 10)}T00:00:00`);
  }
  const deadline = Math.min(tourStart, end);
  const closesAt = new Date(deadline).toISOString();
  if (now >= deadline) return { editable: false, closesAt, reason: 'De inschrijving is gesloten of de tour is begonnen.' };
  if (p.registrationStart && now < dutchDateTime(`${p.registrationStart.slice(0, 10)}T00:00:00`)) {
    return { editable: false, closesAt, reason: 'De inschrijving is nog niet geopend.' };
  }
  return { editable: true, closesAt, reason: '' };
}

export function assertEnrollmentOpen(p: EnrollmentPool) {
  const status = enrollmentStatus(p);
  if (!status.editable) throw new HttpError(403, status.reason);
}

export function validateRiders(p: EnrollmentPool, riders: number[], available: number[], complete = false) {
  const total = p.PloegRennerAantal;
  const reserve = p.PloegReserveAantal;
  if (total == null || reserve == null || total < 1 || total > 25 || reserve < 0 || reserve > total) {
    throw new HttpError(409, 'De ploeginstellingen voor deze pool zijn niet geldig. Neem contact op met de organisatie.');
  }
  if (riders.length > total || (complete && riders.length !== total)) {
    throw new HttpError(400, `Kies ${total} renners, inclusief ${reserve} reserves.`);
  }
  if (new Set(riders).size !== riders.length) throw new HttpError(400, 'Een renner mag maar eenmaal in je ploeg staan.');
  if (riders.some(id => !available.includes(id))) {
    throw new HttpError(400, 'Een gekozen renner behoort niet tot deze tour.');
  }
}
