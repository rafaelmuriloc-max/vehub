import { format, parseISO, subDays, isWeekend } from 'date-fns';

/**
 * Calculates Easter Sunday for a given year using Meeus/Jones/Butcher algorithm.
 */
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export interface HolidayInfo {
  date: string; // YYYY-MM-DD
  name: string;
}

/**
 * Returns all Brazilian national holidays for a given year.
 */
export function getHolidayList(year: number): HolidayInfo[] {
  const easter = getEasterDate(year);
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  return [
    { date: `${year}-01-01`, name: 'Ano Novo' },
    { date: fmt(addDays(easter, -47)), name: 'Carnaval' },
    { date: fmt(addDays(easter, -2)), name: 'Sexta-feira Santa' },
    { date: fmt(easter), name: 'Páscoa' },
    { date: `${year}-04-21`, name: 'Tiradentes' },
    { date: `${year}-05-01`, name: 'Dia do Trabalho' },
    { date: fmt(addDays(easter, 60)), name: 'Corpus Christi' },
    { date: `${year}-09-07`, name: 'Independência' },
    { date: `${year}-10-12`, name: 'N.S. Aparecida' },
    { date: `${year}-11-02`, name: 'Finados' },
    { date: `${year}-11-15`, name: 'Proclamação da República' },
    { date: `${year}-12-25`, name: 'Natal' },
  ];
}

/**
 * Returns a Set of holiday date strings (YYYY-MM-DD) for a given year.
 */
export function getHolidays(year: number): Set<string> {
  return new Set(getHolidayList(year).map(h => h.date));
}

/**
 * Returns a Map of date string -> holiday name for a given year.
 */
export function getHolidayMap(year: number): Map<string, string> {
  return new Map(getHolidayList(year).map(h => [h.date, h.name]));
}

/**
 * Checks if a date string is a business day (not weekend, not holiday).
 */
export function isBusinessDay(dateStr: string, holidays: Set<string>): boolean {
  const date = parseISO(dateStr);
  return !isWeekend(date) && !holidays.has(dateStr);
}

/**
 * Returns the previous business day if the given date falls on a weekend or holiday.
 * Keeps going back until a business day is found.
 */
export function previousBusinessDay(dateStr: string, holidays: Set<string>): string {
  let date = parseISO(dateStr);
  while (isWeekend(date) || holidays.has(format(date, 'yyyy-MM-dd'))) {
    date = subDays(date, 1);
  }
  return format(date, 'yyyy-MM-dd');
}
