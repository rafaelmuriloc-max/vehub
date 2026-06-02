import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

const accentMap = {
  default: 'text-foreground',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  danger: 'text-red-400',
};

export function MetricCard({ label, value, hint, icon, accent = 'default', className }: Props) {
  return (
    <Card className={cn('relative overflow-hidden border-border/40 bg-card/60 backdrop-blur p-5 flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
        {icon && <span className="text-muted-foreground/60">{icon}</span>}
      </div>
      <div className={cn('text-4xl xl:text-5xl font-bold tabular-nums leading-none', accentMap[accent])}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}