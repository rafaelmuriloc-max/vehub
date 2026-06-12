import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function DreTab() {
  const today = new Date();
  const [startDate, setStartDate] = useState(new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]);
  const [entries, setEntries] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);

  useEffect(() => { load(); }, [startDate, endDate]);
  async function load() {
    const [e, c] = await Promise.all([
      supabase.from('financial_entries').select('*').gte('due_date', startDate).lte('due_date', endDate),
      supabase.from('financial_categories').select('*'),
    ]);
    setEntries(e.data || []); setCats(c.data || []);
  }

  const dre = useMemo(() => {
    const byCat = (type: 'receivable' | 'payable') => {
      const map = new Map<string, number>();
      entries.filter(e => e.type === type).forEach(e => {
        const name = cats.find(c => c.id === e.category_id)?.name || 'Sem categoria';
        map.set(name, (map.get(name) || 0) + Number(e.amount));
      });
      return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    };
    const receitas = byCat('receivable');
    const despesas = byCat('payable');
    const totalR = receitas.reduce((s, [, v]) => s + v, 0);
    const totalD = despesas.reduce((s, [, v]) => s + v, 0);
    return { receitas, despesas, totalR, totalD, resultado: totalR - totalD };
  }, [entries, cats]);

  // Mensal
  const monthly = useMemo(() => {
    const map = new Map<string, { receitas: number; despesas: number }>();
    entries.forEach(e => {
      const m = e.due_date.slice(0, 7);
      if (!map.has(m)) map.set(m, { receitas: 0, despesas: 0 });
      const o = map.get(m)!;
      if (e.type === 'receivable') o.receitas += Number(e.amount);
      else o.despesas += Number(e.amount);
    });
    return Array.from(map.entries()).sort().map(([month, v]) => ({ month, ...v, resultado: v.receitas - v.despesas }));
  }, [entries]);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Período</CardTitle></CardHeader>
        <CardContent className="flex gap-4">
          <div><Label>Início</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div><Label>Fim</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Demonstrativo do Resultado</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell colSpan={2} className="bg-emerald-50 font-semibold">Receitas</TableCell></TableRow>
              {dre.receitas.map(([name, v]) => <TableRow key={'r' + name}><TableCell className="pl-8">{name}</TableCell><TableCell className="text-right text-emerald-600">{fmt(v)}</TableCell></TableRow>)}
              <TableRow className="font-medium"><TableCell>Total Receitas</TableCell><TableCell className="text-right text-emerald-600">{fmt(dre.totalR)}</TableCell></TableRow>
              <TableRow><TableCell colSpan={2} className="bg-red-50 font-semibold">Despesas</TableCell></TableRow>
              {dre.despesas.map(([name, v]) => <TableRow key={'d' + name}><TableCell className="pl-8">{name}</TableCell><TableCell className="text-right text-red-600">{fmt(v)}</TableCell></TableRow>)}
              <TableRow className="font-medium"><TableCell>Total Despesas</TableCell><TableCell className="text-right text-red-600">{fmt(dre.totalD)}</TableCell></TableRow>
              <TableRow className="font-bold text-base bg-muted/50"><TableCell>Resultado</TableCell><TableCell className={`text-right ${dre.resultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(dre.resultado)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Resultado Mensal</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Bar dataKey="receitas" fill="hsl(var(--chart-1))" name="Receitas" />
              <Bar dataKey="despesas" fill="hsl(var(--destructive))" name="Despesas" />
              <Bar dataKey="resultado" fill="hsl(var(--chart-3))" name="Resultado" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}