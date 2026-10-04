import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { limiteAnual, faixaDe, projecao, somarPorMes, MEI_LIMITE_ANUAL, type Faixa } from '@/lib/meiLimit';

type Nota = { client_id: string; issue_date: string | null; total_value: number | null; invoice_number: string | null; tipo: 'NF-e' | 'NFC-e' | 'NFS-e' };
export type MeiLimit = { abertura: string | null; limite: number; proporcional: boolean; meses: number[]; total: number; notas: Nota[]; faixa: Faixa; proj: number; saldo: number; pct: number };

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string | null) => d ? d.slice(0, 10).split('-').reverse().join('/') : 'Não informada';
export const FAIXA: Record<Faixa, { label: string; cls: string }> = {
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
      const { data, error } = await (supabase as any).from(table).select('client_id, issue_date, total_value, invoice_number, status')
        .in('client_id', chunk).gte('issue_date', `${ano}-01-01`).lt('issue_date', `${ano + 1}-01-01`)
        .eq('direction', 'saida').range(from, from + 999);
      if (error) throw error;
      out.push(...(data || []).filter((r: any) => (r.status || '').toLowerCase() !== 'cancelada'));
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}

async function fetchNfse(ids: string[], ano: number) {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await (supabase as any).from('invoices').select('client_id, issue_date, gross_value, invoice_number, status, issuer_cnpj')
        .in('client_id', ids.slice(i, i + 100)).gte('issue_date', `${ano}-01-01`).lt('issue_date', `${ano + 1}-01-01`).range(from, from + 999);
      if (error) throw error;
      out.push(...(data || []).filter((r: any) => !(r.status || '').toLowerCase().includes('cancel')));
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}

/** Faturamento anual (NF-e saída + NFC-e não canceladas) e situação do limite por empresa MEI. */
export function useMeiLimits(clientIds: string[], ano: number) {
  const [map, setMap] = useState<Record<string, MeiLimit>>({});
  const [loading, setLoading] = useState(false);
  const key = clientIds.join(',');
  useEffect(() => {
    if (!clientIds.length) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data: cs } = await supabase.from('clients').select('id, opening_date, foundation_date, document').in('id', clientIds);
        const [nfe, nfce, nfse] = await Promise.all([fetchAll('nfe_invoices', clientIds, ano), fetchAll('nfce_invoices', clientIds, ano), fetchNfse(clientIds, ano)]);
        const doc: Record<string, string> = {}; for (const c of (cs || []) as any[]) doc[c.id] = (c.document || '').replace(/\D/g, '');
        const nfseEmit = nfse.filter((n: any) => doc[n.client_id] && (n.issuer_cnpj || '').replace(/\D/g, '') === doc[n.client_id]);
        const by: Record<string, Nota[]> = {};
        [...nfe.map((n: any) => ({ ...n, tipo: 'NF-e' })), ...nfce.map((n: any) => ({ ...n, tipo: 'NFC-e' })), ...nfseEmit.map((n: any) => ({ ...n, total_value: n.gross_value, tipo: 'NFS-e' }))].forEach((n: Nota) => (by[n.client_id] ||= []).push(n));
        const m: Record<string, MeiLimit> = {};
        for (const c of (cs || []) as any[]) {
          const abertura = c.opening_date || c.foundation_date;
          const limite = limiteAnual(ano, abertura);
          const meses = somarPorMes(by[c.id] || [], ano);
          const total = meses.reduce((a, b) => a + b, 0);
          m[c.id] = { abertura, limite, proporcional: limite !== MEI_LIMITE_ANUAL, meses, total, notas: by[c.id] || [], faixa: faixaDe(total, limite), proj: projecao(meses, ano), saldo: limite - total, pct: limite ? (total / limite) * 100 : 0 };
        }
        if (!cancel) setMap(m);
      } finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ano]);
  return { limits: map, loading };
}

export function MeiLimitBar({ l, onDetail }: { l?: MeiLimit; onDetail: () => void }) {
  if (!l) return null;
  return (
    <div className="mt-1.5 max-w-md space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground truncate">Limite: {brl(l.total)} de {brl(l.limite)} · {l.pct.toFixed(0)}%{l.proporcional && ' (proporcional)'}</span>
        <Badge variant="outline" className={cn('shrink-0', FAIXA[l.faixa].cls)}>{FAIXA[l.faixa].label}</Badge>
      </div>
      <Progress value={Math.min(100, l.pct)} className={cn('h-1.5', l.faixa !== 'normal' && '[&>div]:bg-destructive', l.faixa === 'alerta' && '[&>div]:bg-warning')} />
      <button type="button" className="text-xs text-primary hover:underline" onClick={onDetail}>Ver meses e notas</button>
    </div>
  );
}

export function MeiLimitDialog({ name, ano, l, onClose }: { name: string; ano: number; l: MeiLimit; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-base">{name} — {ano}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Abertura {fmtDate(l.abertura)} · Saldo {l.saldo >= 0 ? brl(l.saldo) : `excedeu ${brl(-l.saldo)}`} · Projeção {brl(l.proj)}</p>
        {l.faixa === 'excesso' && <p className="text-sm rounded-md border border-primary/30 bg-primary/10 p-3">Excedeu até 20%: desenquadramento a partir de janeiro do ano seguinte e DAS complementar sobre o excesso.</p>}
        {l.faixa === 'grave' && <p className="text-sm rounded-md border border-destructive/30 bg-destructive/10 text-destructive p-3">Excedeu mais de 20%: desenquadramento retroativo a janeiro, com migração para o Simples Nacional.</p>}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {l.meses.map((v, i) => <div key={i} className="rounded-md border p-2"><p className="text-xs text-muted-foreground">{MESES[i]}/{String(ano).slice(2)}</p><p className="text-sm font-medium">{brl(v)}</p></div>)}
        </div>
        <div className="text-sm font-medium">Notas ({l.notas.length})</div>
        <div className="divide-y rounded-md border text-sm">
          {l.notas.length === 0 && <p className="p-3 text-muted-foreground">Nenhuma nota no ano.</p>}
          {[...l.notas].sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || '')).map((n, i) => (
            <div key={i} className="flex justify-between p-2"><span>{n.tipo} {n.invoice_number || '-'} • {fmtDate(n.issue_date)}</span><span>{brl(Number(n.total_value) || 0)}</span></div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
