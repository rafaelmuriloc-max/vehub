import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Loader2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { cicloFaturamento, custoAcumulado, faixaAtual, normalizeTipo, precoUnitario, TipoCobranca } from '@/lib/serproPricing';

type Row = { id: string; client_id: string | null; id_sistema: string; id_servico: string; tipo: string; status_http: number | null; sucesso: boolean; cobrada: boolean; created_at: string; clients?: { company_name: string } | null };

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const TIPOS: TipoCobranca[] = ['Consultar', 'Emitir', 'Declarar'];
const TIPO_LABEL: Record<TipoCobranca, string> = { Consultar: 'Consulta', Emitir: 'Emissão', Declarar: 'Declaração' };
const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2, 200 70% 50%))', 'hsl(var(--chart-3, 150 60% 45%))', 'hsl(var(--chart-4, 45 90% 55%))', 'hsl(var(--chart-5, 280 60% 60%))', 'hsl(var(--muted-foreground))'];

export default function UsageCostTab() {
  const [offset, setOffset] = useState(0);
  const ciclo = useMemo(() => cicloFaturamento(new Date(), offset), [offset]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const all: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('integra_contador_usage' as any)
          .select('id, client_id, id_sistema, id_servico, tipo, status_http, sucesso, cobrada, created_at, clients(company_name)')
          .gte('created_at', ciclo.inicio.toISOString()).lte('created_at', ciclo.fim.toISOString())
          .order('created_at').range(from, from + 999);
        if (error || !data) break;
        all.push(...(data as any));
        if (data.length < 1000) break;
      }
      if (alive) { setRows(all); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [ciclo]);

  useEffect(() => {
    if (offset !== 0) return;
    const ch = supabase.channel('ic-usage')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'integra_contador_usage' }, (p) => {
        setRows((r) => [...r, p.new as Row]);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [offset]);

  const [firstLog, setFirstLog] = useState<Date | null>(null);
  const [estimado, setEstimado] = useState<{ consultas: number; emissoes: number } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: f } = await supabase.from('integra_contador_usage' as any).select('created_at').order('created_at').limit(1);
      const first = (f as any)?.[0]?.created_at ? new Date((f as any)[0].created_at) : null;
      if (!alive) return;
      setFirstLog(first);
      setEstimado(null);
      if (!first || first <= ciclo.inicio) return;
      const ini = ciclo.inicio.toISOString();
      const fim = (first < ciclo.fim ? first : ciclo.fim).toISOString();
      const cnt = async (table: string, col: string, extra?: (q: any) => any) => {
        let q: any = supabase.from(table as any).select('id', { count: 'exact', head: true }).gte(col, ini).lt(col, fim);
        if (extra) q = extra(q);
        const { count } = await q;
        return count ?? 0;
      };
      const [sit, dctf, mei, parc, sn, snDas] = await Promise.all([
        cnt('sitfis_results', 'consulted_at'),
        cnt('dctfweb_competencias', 'updated_at'),
        cnt('mei_competencias', 'updated_at'),
        cnt('parcelamento_results', 'consulted_at'),
        cnt('simples_nacional_competencias', 'updated_at'),
        cnt('simples_nacional_competencias', 'updated_at', (q) => q.not('das_pdf_base64', 'is', null)),
      ]);
      if (alive) setEstimado({ consultas: sit + dctf + mei + parc + sn, emissoes: snDas });
    })();
    return () => { alive = false; };
  }, [ciclo]);
  const estimadoValor = estimado ? custoAcumulado('Consultar', estimado.consultas) + custoAcumulado('Emitir', estimado.emissoes) : 0;

  const stats = useMemo(() => {
    const count: Record<TipoCobranca, number> = { Consultar: 0, Emitir: 0, Declarar: 0 };
    const daily = new Map<string, { dia: string; req: number; custo: number }>();
    const bySys = new Map<string, number>();
    const byClient = new Map<string, { nome: string; req: number; custo: number }>();
    let erros = 0;
    for (const r of rows) {
      if ((r.status_http ?? 0) >= 400) erros++;
      if (!r.cobrada) continue;
      const t = normalizeTipo(r.tipo);
      count[t]++;
      const c = precoUnitario(t, count[t]);
      const dia = r.created_at.slice(0, 10);
      const d = daily.get(dia) ?? { dia, req: 0, custo: 0 };
      d.req++; d.custo += c; daily.set(dia, d);
      bySys.set(r.id_sistema, (bySys.get(r.id_sistema) ?? 0) + c);
      const k = r.client_id ?? '—';
      const cl = byClient.get(k) ?? { nome: r.clients?.company_name ?? (r.client_id ? r.client_id.slice(0, 8) : 'Sem empresa'), req: 0, custo: 0 };
      cl.req++; cl.custo += c; byClient.set(k, cl);
    }
    const total = TIPOS.reduce((s, t) => s + custoAcumulado(t, count[t]), 0);
    const cobradas = TIPOS.reduce((s, t) => s + count[t], 0);
    const now = new Date();
    const fimRef = offset === 0 ? now : ciclo.fim;
    const diasPassados = Math.max(1, (fimRef.getTime() - ciclo.inicio.getTime()) / 86400000);
    const diasTotais = (ciclo.fim.getTime() - ciclo.inicio.getTime()) / 86400000;
    const proj: Record<TipoCobranca, number> = { Consultar: 0, Emitir: 0, Declarar: 0 };
    TIPOS.forEach((t) => (proj[t] = Math.round((count[t] / diasPassados) * diasTotais)));
    const projecao = offset === 0 ? TIPOS.reduce((s, t) => s + custoAcumulado(t, proj[t]), 0) : total;
    return {
      count, total, cobradas, erros, projecao, naoCobradas: rows.filter((r) => !r.cobrada && (r.status_http ?? 0) < 400).length,
      daily: [...daily.values()].map((d) => ({ ...d, dia: d.dia.slice(8, 10) + '/' + d.dia.slice(5, 7), custo: +d.custo.toFixed(2) })),
      bySys: [...bySys.entries()].map(([name, value]) => ({ name, value: +value.toFixed(2) })).sort((a, b) => b.value - a.value),
      top: [...byClient.values()].sort((a, b) => b.custo - a.custo).slice(0, 10),
    };
  }, [rows, ciclo, offset]);

  function exportCsv() {
    const head = 'data,empresa,sistema,servico,tipo,status,cobrada\n';
    const body = rows.map((r) => [r.created_at, `"${r.clients?.company_name ?? ''}"`, r.id_sistema, r.id_servico, r.tipo, r.status_http ?? '', r.cobrada ? 'sim' : 'nao'].join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([head + body], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `integra_contador_${ciclo.fim.toISOString().slice(0, 7)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Custos do Integra Contador</h2>
          <p className="text-sm text-muted-foreground">Ciclo {ciclo.label}{offset === 0 && ' • ao vivo'}</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(offset)} onValueChange={(v) => setOffset(Number(v))}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0, -1, -2, -3, -4, -5].map((o) => (
                <SelectItem key={o} value={String(o)}>{o === 0 ? 'Ciclo atual' : cicloFaturamento(new Date(), o).label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4 mr-2" />CSV</Button>
        </div>
      </div>

      {loading ? <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <>
          {firstLog && firstLog > ciclo.inicio && firstLog < ciclo.fim && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              Registro iniciado em {firstLog.toLocaleDateString('pt-BR')} às {firstLog.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
              {estimado && (estimado.consultas + estimado.emissoes) > 0 && (
                <> Estimado antes do registro: <b>{estimado.consultas.toLocaleString('pt-BR')}</b> consultas e <b>{estimado.emissoes.toLocaleString('pt-BR')}</b> emissões, cerca de <b>{brl(estimadoValor)}</b> (não entra no valor medido).</>
              )}
            </div>
          )}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Kpi label="Fatura medida" value={brl(stats.total)} />
            <Kpi label="Medido + estimado" value={brl(stats.total + estimadoValor)} />
            <Kpi label={offset === 0 ? 'Projeção no dia 20' : 'Fatura do ciclo'} value={brl(stats.projecao)} />
            <Kpi label="Chamadas registradas" value={rows.length.toLocaleString('pt-BR')} />
            <Kpi label="Requisições cobradas" value={stats.cobradas.toLocaleString('pt-BR')} />
            <Kpi label="Não cobradas / reaproveitadas" value={stats.naoCobradas.toLocaleString('pt-BR')} />
            <Kpi label="Com erro" value={stats.erros.toLocaleString('pt-BR')} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {TIPOS.map((t) => {
              const q = stats.count[t]; const f = faixaAtual(t, q);
              const pct = f.ate === Infinity ? 100 : ((q - f.inicio) / (f.ate - f.inicio)) * 100;
              return (
                <Card key={t} className="p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="font-medium">{TIPO_LABEL[t]}</span><span>{brl(custoAcumulado(t, q))}</span></div>
                  <div className="text-2xl font-bold tabular-nums">{q.toLocaleString('pt-BR')}</div>
                  <Progress value={pct} />
                  <p className="text-xs text-muted-foreground">Faixa {f.faixa} • {brl(f.preco)}/req{f.faltam != null && ` • faltam ${f.faltam.toLocaleString('pt-BR')} para a próxima`}</p>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="p-4 lg:col-span-2">
              <p className="text-sm font-medium mb-2">Gasto por dia</p>
              <div className="h-64"><ResponsiveContainer>
                <BarChart data={stats.daily}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="dia" fontSize={11} /><YAxis fontSize={11} />
                  <Tooltip formatter={(v: any, n) => n === 'custo' ? brl(v) : v} /><Bar dataKey="custo" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart>
              </ResponsiveContainer></div>
            </Card>
            <Card className="p-4">
              <p className="text-sm font-medium mb-2">Por módulo</p>
              <div className="h-64"><ResponsiveContainer>
                <PieChart><Pie data={stats.bySys} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                  {stats.bySys.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
                  <Tooltip formatter={(v: any) => brl(v)} /></PieChart>
              </ResponsiveContainer></div>
            </Card>
          </div>

          <Card className="p-4">
            <p className="text-sm font-medium mb-2">Empresas que mais consomem</p>
            {stats.top.length === 0 ? <p className="text-sm text-muted-foreground">Sem chamadas neste ciclo.</p> : (
              <div className="divide-y">
                {stats.top.map((c, i) => (
                  <div key={i} className="flex justify-between py-2 text-sm"><span className="truncate">{c.nome}</span><span className="tabular-nums text-muted-foreground shrink-0 ml-2">{c.req} req • {brl(c.custo)}</span></div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-xl font-bold tabular-nums mt-1">{value}</p></Card>;
}
