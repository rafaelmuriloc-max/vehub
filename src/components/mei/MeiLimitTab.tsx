import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, Download, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, formatClientLabel } from '@/lib/utils';
import { limiteAnual, faixaDe, projecao, somarPorMes, MEI_LIMITE_ANUAL, type Faixa } from '@/lib/meiLimit';

type Client = { id: string; company_name: string; sci_code: string | null; document: string | null; opening_date: string | null; foundation_date: string | null };
type Nota = { client_id: string; issue_date: string | null; total_value: number | null; invoice_number: string | null; tipo: 'NF-e' | 'NFC-e' };

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtCnpj = (d: string | null) => { const s = (d || '').replace(/\D/g, ''); return s.length === 14 ? s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d || '-'; };
const fmtDate = (d: string | null) => d ? d.slice(0, 10).split('-').reverse().join('/') : 'Não informada';
const FAIXA: Record<Faixa, { label: string; cls: string }> = {
  normal: { label: 'Normal', cls: 'bg-success/15 text-success border-success/30' },
  alerta: { label: 'Em alerta', cls: 'bg-warning/15 text-warning border-warning/30' },
  excesso: { label: 'Excesso até 20%', cls: 'bg-primary/15 text-primary border-primary/30' },
  grave: { label: 'Excesso acima de 20%', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
};

async function fetchAll(table: 'nfe_invoices' | 'nfce_invoices', ids: string[], ano: number) {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    for (let from = 0; ; from += 1000) {
      let q = (supabase as any).from(table).select('client_id, issue_date, total_value, invoice_number, status')
        .in('client_id', chunk).gte('issue_date', `${ano}-01-01`).lt('issue_date', `${ano + 1}-01-01`)
        .eq('direction', 'saida').range(from, from + 999);
      const { data, error } = await q;
      if (error) throw error;
      out.push(...(data || []).filter((r: any) => (r.status || '').toLowerCase() !== 'cancelada'));
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}

export default function MeiLimitTab() {
  const thisYear = new Date().getFullYear();
  const [ano, setAno] = useState(thisYear);
  const [clients, setClients] = useState<Client[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<'all' | 'normal' | 'alerta' | 'excedido'>('all');
  const [det, setDet] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const { data, error } = await supabase.from('clients').select('id, company_name, sci_code, document, opening_date, foundation_date')
          .eq('status', 'active').ilike('tax_regime', 'mei').order('company_name');
        if (error) throw error;
        const cs = (data || []) as Client[];
        const ids = cs.map(c => c.id);
        const [nfe, nfce] = ids.length ? await Promise.all([fetchAll('nfe_invoices', ids, ano), fetchAll('nfce_invoices', ids, ano)]) : [[], []];
        if (cancel) return;
        setClients(cs);
        setNotas([...nfe.map((n: any) => ({ ...n, tipo: 'NF-e' as const })), ...nfce.map((n: any) => ({ ...n, tipo: 'NFC-e' as const }))]);
      } catch (e) { if (!cancel) setErr((e as Error).message); }
      finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [ano]);

  const linhas = useMemo(() => {
    const by: Record<string, Nota[]> = {};
    for (const n of notas) (by[n.client_id] ||= []).push(n);
    return clients.map(c => {
      const abertura = c.opening_date || c.foundation_date;
      const limite = limiteAnual(ano, abertura);
      const meses = somarPorMes(by[c.id] || [], ano);
      const total = meses.reduce((a, b) => a + b, 0);
      return { c, abertura, limite, proporcional: limite !== MEI_LIMITE_ANUAL, meses, total, notas: by[c.id] || [],
        faixa: faixaDe(total, limite), proj: projecao(meses, ano), saldo: limite - total, pct: limite ? (total / limite) * 100 : 0 };
    });
  }, [clients, notas, ano]);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase(); const qd = q.replace(/\D/g, '');
    return linhas.filter(l => {
      if (q && !(l.c.company_name.toLowerCase().includes(q) || (l.c.sci_code || '').toLowerCase().includes(q) || (qd && (l.c.document || '').replace(/\D/g, '').includes(qd)))) return false;
      if (filtro === 'normal') return l.faixa === 'normal';
      if (filtro === 'alerta') return l.faixa === 'alerta';
      if (filtro === 'excedido') return l.faixa === 'excesso' || l.faixa === 'grave';
      return true;
    }).sort((a, b) => b.pct - a.pct);
  }, [linhas, search, filtro]);

  const kpi = useMemo(() => ({
    total: linhas.length,
    normal: linhas.filter(l => l.faixa === 'normal').length,
    alerta: linhas.filter(l => l.faixa === 'alerta').length,
    exced: linhas.filter(l => l.faixa === 'excesso' || l.faixa === 'grave').length,
    valor: linhas.reduce((a, l) => a + l.total, 0),
  }), [linhas]);

  const exportCsv = () => {
    const head = ['Codigo', 'Empresa', 'CNPJ', 'Abertura', 'Limite', 'Faturado', '%', 'Saldo', 'Projecao', 'Situacao', ...MESES];
    const rows = filtradas.map(l => [l.c.sci_code || '', l.c.company_name, fmtCnpj(l.c.document), fmtDate(l.abertura), l.limite.toFixed(2), l.total.toFixed(2),
      l.pct.toFixed(1), l.saldo.toFixed(2), l.proj.toFixed(2), FAIXA[l.faixa].label, ...l.meses.map(m => m.toFixed(2))]);
    const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = `limite_mei_${ano}.csv`; a.click();
  };

  const sel = linhas.find(l => l.c.id === det);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Buscar empresa" className="pl-9" placeholder="Buscar por nome, código ou CNPJ" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
          <SelectTrigger className="w-full md:w-28" aria-label="Ano"><SelectValue /></SelectTrigger>
          <SelectContent>{[0, 1, 2, 3].map(d => <SelectItem key={d} value={String(thisYear - d)}>{thisYear - d}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filtro} onValueChange={v => setFiltro(v as any)}>
          <SelectTrigger className="w-full md:w-40" aria-label="Situação do limite"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem><SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="alerta">Em alerta</SelectItem><SelectItem value="excedido">Excedido</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv} disabled={!filtradas.length}><Download className="h-4 w-4" /> Exportar</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[['MEIs monitorados', kpi.total], ['Normal', kpi.normal], ['Em alerta (≥80%)', kpi.alerta], ['Excedidos', kpi.exced], ['Faturamento no ano', brl(kpi.valor)]].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold text-foreground truncate">{v}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Faturamento somado das NF-e de saída e NFC-e não canceladas importadas no sistema. Notas de serviço não entram.</p>

      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          : err ? <div className="p-6 text-sm text-destructive">{err}</div>
          : !filtradas.length ? <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada.</div>
          : <div className="divide-y">{filtradas.map(l => (
            <div key={l.c.id} className="p-3 flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="lg:w-72 min-w-0">
                <div className="font-medium truncate">{formatClientLabel(l.c)}</div>
                <div className="text-xs text-muted-foreground">{fmtCnpj(l.c.document)} • Abertura {fmtDate(l.abertura)}{l.proporcional && ' (limite proporcional)'}</div>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-xs"><span>{brl(l.total)} de {brl(l.limite)}</span><span className="font-medium">{l.pct.toFixed(0)}%</span></div>
                <Progress value={Math.min(100, l.pct)} className={cn('h-2', l.faixa !== 'normal' && '[&>div]:bg-destructive', l.faixa === 'alerta' && '[&>div]:bg-warning')} />
                <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                  <span>Saldo: {l.saldo >= 0 ? brl(l.saldo) : `excedeu ${brl(-l.saldo)}`}</span>
                  <span>Projeção do ano: {brl(l.proj)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={FAIXA[l.faixa].cls}>{FAIXA[l.faixa].label}</Badge>
                <Button size="sm" variant="outline" onClick={() => setDet(l.c.id)}><Eye className="h-4 w-4" /> Ver meses e notas</Button>
              </div>
            </div>))}</div>}
      </div>

      {sel && (
        <Dialog open onOpenChange={o => !o && setDet(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-base">{formatClientLabel(sel.c)} — {ano}</DialogTitle></DialogHeader>
            {sel.faixa === 'excesso' && <p className="text-sm rounded-md border border-primary/30 bg-primary/10 p-3">Excedeu até 20%: desenquadramento a partir de janeiro do ano seguinte e DAS complementar sobre o excesso.</p>}
            {sel.faixa === 'grave' && <p className="text-sm rounded-md border border-destructive/30 bg-destructive/10 text-destructive p-3">Excedeu mais de 20%: desenquadramento retroativo a janeiro, com migração para o Simples Nacional.</p>}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {sel.meses.map((v, i) => (
                <div key={i} className="rounded-md border p-2"><p className="text-xs text-muted-foreground">{MESES[i]}/{String(ano).slice(2)}</p><p className="text-sm font-medium">{brl(v)}</p></div>
              ))}
            </div>
            <div className="text-sm font-medium">Notas ({sel.notas.length})</div>
            <div className="divide-y rounded-md border text-sm">
              {sel.notas.length === 0 && <p className="p-3 text-muted-foreground">Nenhuma nota no ano.</p>}
              {[...sel.notas].sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || '')).map((n, i) => (
                <div key={i} className="flex justify-between p-2"><span>{n.tipo} {n.invoice_number || '-'} • {fmtDate(n.issue_date)}</span><span>{brl(Number(n.total_value) || 0)}</span></div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
