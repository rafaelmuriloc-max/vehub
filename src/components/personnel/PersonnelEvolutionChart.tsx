import { useEffect, useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompact = (v: number) => 'R$ ' + new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

type Row = { client_id: string; competence: string; qty_employees: number | null; gross: number | null };

export function PersonnelEvolutionChart({ clientIds }: { clientIds: string[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const key = clientIds.slice().sort().join(',');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const all: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('payroll_summaries')
          .select('client_id, competence, qty_employees, gross').order('competence').range(from, from + 999);
        if (error || !data?.length) break;
        all.push(...(data as Row[]));
        if (data.length < 1000) break;
      }
      if (alive) { setRows(all); setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const data = useMemo(() => {
    const ids = new Set(key.split(','));
    const map = new Map<string, { funcionarios: number; salarios: number; empresas: number }>();
    for (const r of rows) {
      if (!ids.has(r.client_id)) continue;
      const k = r.competence.slice(0, 7);
      const m = map.get(k) ?? { funcionarios: 0, salarios: 0, empresas: 0 };
      m.funcionarios += Number(r.qty_employees ?? 0);
      m.salarios += Number(r.gross ?? 0);
      m.empresas += 1;
      map.set(k, m);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
      mes: `${MES[Number(k.slice(5)) - 1]}/${k.slice(2, 4)}`, ...v,
    }));
  }, [rows, key]);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Evolução de funcionários e salários</CardTitle>
        <CardDescription>Considera só as empresas com relatório de folha sincronizado.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground py-10 text-center">Carregando...</p>
          : !data.length ? <p className="text-sm text-muted-foreground py-10 text-center">Sincronize a Folha para ver a evolução.</p>
          : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="q" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <YAxis yAxisId="v" orientation="right" tick={{ fontSize: 12 }} tickFormatter={brlCompact} width={70} />
                  <Tooltip
                    formatter={(v: number, name: string) => name === 'Salários' ? brl(v) : v.toLocaleString('pt-BR')}
                    labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.empresas ?? 0} empresa(s)`}
                  />
                  <Legend />
                  <Bar yAxisId="q" dataKey="funcionarios" name="Funcionários" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="v" dataKey="salarios" name="Salários" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
