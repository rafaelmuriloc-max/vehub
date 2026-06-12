import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MetricCard } from './MetricCard';
import { Card } from '@/components/ui/card';
import { Users, UserPlus, UserMinus } from 'lucide-react';

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  return { start, end };
}

export function ClientsPanel() {
  const { data } = useQuery({
    queryKey: ['dashboard-clients'],
    refetchInterval: 30000,
    queryFn: async () => {
      const { start, end } = monthRange();
      const [active, inactive, novos, churn, suspended] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('without_monthly_fee', false),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'inactive').eq('without_monthly_fee', false),
        supabase.from('clients').select('id', { count: 'exact', head: true }).gte('start_date', start).lt('start_date', end).eq('without_monthly_fee', false),
        supabase.from('clients').select('id', { count: 'exact', head: true }).gte('end_date', start).lt('end_date', end).eq('without_monthly_fee', false),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('services_suspended', true),
      ]);
      return {
        active: active.count ?? 0,
        inactive: inactive.count ?? 0,
        novos: novos.count ?? 0,
        churn: churn.count ?? 0,
        suspended: suspended.count ?? 0,
      };
    },
  });

  const net = (data?.novos ?? 0) - (data?.churn ?? 0);

  return (
    <Card className="bg-card/40 border-border/40 p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">Clientes</h2>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard
          label="Ativos"
          value={data?.active ?? '—'}
          accent="success"
          icon={<Users className="h-4 w-4" />}
          hint={<span><strong className="text-amber-400">{data?.suspended ?? 0}</strong> suspensos</span>}
        />
        <MetricCard label="Inativos" value={data?.inactive ?? '—'} icon={<Users className="h-4 w-4" />} />
        <MetricCard
          label="Novos no mês"
          value={`+${data?.novos ?? 0}`}
          accent="success"
          icon={<UserPlus className="h-4 w-4" />}
        />
        <MetricCard
          label="Churn no mês"
          value={`-${data?.churn ?? 0}`}
          accent={(data?.churn ?? 0) > 0 ? 'danger' : 'default'}
          icon={<UserMinus className="h-4 w-4" />}
          hint={<span>Saldo: <strong className={net >= 0 ? 'text-emerald-400' : 'text-red-400'}>{net >= 0 ? '+' : ''}{net}</strong></span>}
        />
      </div>
    </Card>
  );
}