import { ReactNode } from 'react';
import { Building2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export type RiskTone = 'overdue' | 'today' | 'tomorrow' | 'soon' | 'neutral' | 'done' | 'late' | 'hold';

const TRACK: Record<RiskTone, string> = {
  overdue: 'bg-red-500',
  today: 'bg-amber-500',
  tomorrow: 'bg-amber-400',
  soon: 'bg-primary/70',
  neutral: 'bg-border',
  done: 'bg-emerald-500',
  late: 'bg-orange-500',
  hold: 'bg-amber-400',
};

const DATE_TONE: Record<RiskTone, string> = {
  overdue: 'text-red-600 dark:text-red-400',
  today: 'text-amber-600 dark:text-amber-400',
  tomorrow: 'text-amber-600 dark:text-amber-400',
  soon: 'text-foreground',
  neutral: 'text-foreground',
  done: 'text-emerald-600 dark:text-emerald-400',
  late: 'text-orange-600 dark:text-orange-400',
  hold: 'text-amber-600 dark:text-amber-400',
};

/** Classifica o risco de uma data de vencimento (YYYY-MM-DD) em relação a hoje. */
export function getDueRisk(dateISO: string): { tone: RiskTone; label: string | null } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dateISO}T00:00:00`);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { tone: 'overdue', label: `${Math.abs(days)}d atrás` };
  if (days === 0) return { tone: 'today', label: 'Hoje' };
  if (days === 1) return { tone: 'tomorrow', label: 'Amanhã' };
  if (days <= 7) return { tone: 'soon', label: `${days} dias` };
  return { tone: 'neutral', label: `${days} dias` };
}

export function ObligationRowHeader({ showProgress = true }: { showProgress?: boolean }) {
  return (
    <div className="hidden md:flex items-center gap-3 pl-4 pr-3 py-1.5 bg-muted/50 border-y border-border/70 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      <span className="w-4 shrink-0" />
      <span className="w-16 shrink-0">Venc.</span>
      <span className="flex-1 min-w-0">Obrigação / Empresa</span>
      <span className="hidden lg:block w-32 shrink-0">Departamento</span>
      {showProgress && <span className="hidden lg:block w-24 shrink-0 text-center">Progresso</span>}
      <span className="w-[104px] shrink-0 text-right">Ações</span>
    </div>
  );
}

interface ObligationRowProps {
  date: string;
  title: string;
  client: string;
  dept: string;
  tone: RiskTone;
  dueLabel?: string | null;
  typeBadge?: ReactNode;
  progress?: { completed: number; total: number; percent: number };
  selected?: boolean;
  onToggleSelect?: () => void;
  onClick?: () => void;
  actions?: ReactNode;
  footer?: ReactNode;
}

export function ObligationRow({
  date, title, client, dept, tone, dueLabel, typeBadge, progress,
  selected, onToggleSelect, onClick, actions, footer,
}: ObligationRowProps) {
  const dayMonth = date.split('-').reverse().slice(0, 2).join('/');
  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col gap-1 pl-4 pr-3 py-2 border-b border-border/60 cursor-pointer transition-colors hover:bg-muted/40 ${selected ? 'bg-primary/5' : ''}`}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${TRACK[tone]}`} aria-hidden />
      <div className="flex items-center gap-3">
        {onToggleSelect ? (
          <Checkbox
            checked={!!selected}
            onCheckedChange={onToggleSelect}
            onClick={e => e.stopPropagation()}
            className="shrink-0"
          />
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <div className="w-16 shrink-0 leading-tight">
          <div className={`text-sm font-semibold tabular-nums font-display ${DATE_TONE[tone]}`}>{dayMonth}</div>
          {dueLabel && (
            <div className={`text-[10px] font-medium uppercase tracking-wide ${DATE_TONE[tone]} opacity-80`}>{dueLabel}</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-foreground truncate font-display">{title}</span>
            {typeBadge}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            <Building2 className="h-3 w-3 inline mr-1 -mt-0.5" />{client}
          </p>
        </div>

        <div className="hidden lg:block w-32 shrink-0">
          <Badge variant="outline" className="text-[10px] font-medium truncate max-w-full">{dept}</Badge>
        </div>

        <div className="hidden lg:flex w-24 shrink-0 flex-col items-center gap-1">
          {progress && progress.total > 0 ? (
            <>
              <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                {progress.completed}/{progress.total} ativid.
              </span>
              <span className="w-16 h-1 rounded-full bg-muted overflow-hidden">
                <span className="block h-full bg-primary" style={{ width: `${progress.percent}%` }} />
              </span>
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground/60">—</span>
          )}
        </div>

        <div className="w-[104px] shrink-0 flex items-center justify-end gap-0.5 opacity-70 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {actions}
        </div>
      </div>
      {footer}
    </div>
  );
}
