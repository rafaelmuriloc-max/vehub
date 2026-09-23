// Cálculos do módulo de Férias.
// Nada é estimado: os dias vêm sempre do relatório importado do SCI.

export interface VacationPeriodRow {
  id: string;
  employee_id: string;
  client_id: string;
  acquisition_start: string | null;
  acquisition_end: string | null;
  days_right: number | null;
  enjoy_start: string | null;
  enjoy_end: string | null;
  deadline_date: string | null;
  source_file: string | null;
}

export type PeriodStatus = 'overdue' | 'soon' | 'ok' | 'accruing' | 'empty';

export interface PeriodAnalysis {
  period: VacationPeriodRow;
  status: PeriodStatus;
  days: number;
  /** Data que define o vencimento (prazo final ou fim do período de gozo). */
  dueDate: string | null;
  /** Dias até o vencimento; negativo quando já passou. */
  daysLeft: number | null;
}

export interface EmployeeAnalysis {
  employeeId: string;
  clientId: string;
  name: string;
  code: string | null;
  companyName: string;
  overdueDays: number;
  acquiredDays: number;
  accruingDays: number;
  totalDays: number;
  nextDueDate: string | null;
  status: PeriodStatus;
  periods: PeriodAnalysis[];
}

const SOON_DAYS = 60;

export function dayDiff(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

export function todayKeySP(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function dueDateOf(p: VacationPeriodRow): string | null {
  return p.deadline_date ?? p.enjoy_end ?? null;
}

export function analyzePeriod(p: VacationPeriodRow, reference: string, soonDays = SOON_DAYS): PeriodAnalysis {
  const days = p.days_right ?? 0;
  const dueDate = dueDateOf(p);
  const daysLeft = dueDate ? dayDiff(reference, dueDate) : null;
  const accruing = !!p.acquisition_end && dayDiff(reference, p.acquisition_end) > 0;

  let status: PeriodStatus;
  if (days <= 0) status = 'empty';
  else if (accruing) status = 'accruing';
  else if (daysLeft === null) status = 'ok';
  else if (daysLeft < 0) status = 'overdue';
  else if (daysLeft <= soonDays) status = 'soon';
  else status = 'ok';

  return { period: p, status, days, dueDate, daysLeft };
}

const URGENCY: Record<PeriodStatus, number> = { overdue: 5, soon: 4, ok: 3, accruing: 2, empty: 1 };

export function analyzeEmployees(
  periods: VacationPeriodRow[],
  employees: { id: string; client_id: string; full_name: string; employee_code: string | null }[],
  clients: { id: string; company_name: string }[],
  reference: string,
  soonDays = SOON_DAYS,
): EmployeeAnalysis[] {
  const empById = new Map(employees.map(e => [e.id, e]));
  const cliById = new Map(clients.map(c => [c.id, c]));
  const byEmployee = new Map<string, PeriodAnalysis[]>();

  for (const p of periods) {
    if (!empById.has(p.employee_id)) continue;
    const arr = byEmployee.get(p.employee_id) ?? [];
    arr.push(analyzePeriod(p, reference, soonDays));
    byEmployee.set(p.employee_id, arr);
  }

  const out: EmployeeAnalysis[] = [];
  for (const [employeeId, list] of byEmployee) {
    const emp = empById.get(employeeId)!;
    list.sort((a, b) => (a.period.acquisition_start ?? '').localeCompare(b.period.acquisition_start ?? ''));

    let overdueDays = 0, acquiredDays = 0, accruingDays = 0, totalDays = 0;
    let nextDueDate: string | null = null;
    let status: PeriodStatus = 'empty';

    for (const a of list) {
      totalDays += a.days;
      if (a.status === 'overdue') overdueDays += a.days;
      else if (a.status === 'soon' || a.status === 'ok') acquiredDays += a.days;
      else if (a.status === 'accruing') accruingDays += a.days;
      if (URGENCY[a.status] > URGENCY[status]) status = a.status;
      if (a.dueDate && a.days > 0 && (nextDueDate === null || a.dueDate < nextDueDate)) nextDueDate = a.dueDate;
    }

    out.push({
      employeeId,
      clientId: emp.client_id,
      name: emp.full_name,
      code: emp.employee_code,
      companyName: cliById.get(emp.client_id)?.company_name ?? 'Empresa não identificada',
      overdueDays, acquiredDays, accruingDays, totalDays,
      nextDueDate, status, periods: list,
    });
  }

  return out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export interface CompanyTotals {
  clientId: string;
  companyName: string;
  employees: number;
  overdueDays: number;
  acquiredDays: number;
  accruingDays: number;
  totalDays: number;
  employeesOverdue: number;
}

export function totalsByCompany(list: EmployeeAnalysis[]): CompanyTotals[] {
  const map = new Map<string, CompanyTotals>();
  for (const e of list) {
    const t = map.get(e.clientId) ?? {
      clientId: e.clientId, companyName: e.companyName,
      employees: 0, overdueDays: 0, acquiredDays: 0, accruingDays: 0, totalDays: 0, employeesOverdue: 0,
    };
    t.employees += 1;
    t.overdueDays += e.overdueDays;
    t.acquiredDays += e.acquiredDays;
    t.accruingDays += e.accruingDays;
    t.totalDays += e.totalDays;
    if (e.overdueDays > 0) t.employeesOverdue += 1;
    map.set(e.clientId, t);
  }
  return [...map.values()].sort((a, b) => b.overdueDays - a.overdueDays || b.totalDays - a.totalDays);
}

/** Dias com prazo a encerrar em cada um dos próximos N meses. */
export function dueByMonth(list: EmployeeAnalysis[], reference: string, months = 12) {
  const start = new Date(`${reference}T12:00:00`);
  const keys: { key: string; label: string; days: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    keys.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      days: 0,
    });
  }
  const index = new Map(keys.map(k => [k.key, k]));
  for (const e of list) {
    for (const p of e.periods) {
      if (!p.dueDate || p.days <= 0) continue;
      const k = p.dueDate.slice(0, 7);
      const entry = index.get(k);
      if (entry) entry.days += p.days;
    }
  }
  return keys;
}

export const statusLabel: Record<PeriodStatus, string> = {
  overdue: 'Vencida',
  soon: 'A vencer',
  ok: 'No prazo',
  accruing: 'Em formação',
  empty: 'Sem saldo',
};

export const statusClass: Record<PeriodStatus, string> = {
  overdue: 'bg-destructive/10 text-destructive border-destructive/30',
  soon: 'bg-amber-100 text-amber-700 border-amber-200',
  ok: 'bg-green-100 text-green-700 border-green-200',
  accruing: 'bg-blue-100 text-blue-700 border-blue-200',
  empty: 'bg-muted text-muted-foreground',
};

export function fmtDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

export function fmtDays(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
