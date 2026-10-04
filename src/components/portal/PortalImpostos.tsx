import { useEffect, useMemo, useState } from 'react';
import { Eye, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { isTaxDue, competenciaFromDue, groupByTax, paymentFor } from '@/lib/portalDashboard';
import { SectionCard, brl, PayBadge } from './PortalWidgets';

type Guia = { id: string; name: string; due: string; competencia: string; valor: number | null; done: boolean; file_url?: string | null; file_name?: string | null; pdf_b64?: string | null; pay?: any };
const db = supabase as any;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const br = (s: string) => s.slice(0, 10).split('-').reverse().join('/');

export default function PortalImpostos({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const today = new Date();
  const [ano, setAno] = useState(today.getFullYear());
  const [obrig, setObrig] = useState<any[]>([]);
  const [simples, setSimples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const to = ano === today.getFullYear() ? iso(new Date(ano, today.getMonth() + 4, 0)) : `${ano}-12-31`;
    Promise.all([
      db.rpc('portal_due_dates', { _client_id: clientId, _from: `${ano}-01-01`, _to: to }),
      db.rpc('portal_tax_payments', { _client_id: clientId, _from: `${ano - 1}-12-01`, _to: to }),
    ]).then(([a, b]: any) => { setObrig(a.data || []); setSimples(b.data || []); setLoading(false); });
  }, [clientId, ano]);

  const groups = useMemo(() => {
    const list: Guia[] = obrig.filter(o => isTaxDue(o.name)).map(o => ({ id: o.id, name: o.name, due: o.due_date, competencia: competenciaFromDue(o.due_date), valor: null, done: o.status === 'done', file_url: o.file_url, file_name: o.file_name }));
    list.forEach(g => { const p = paymentFor(g, simples); if (p) { g.pay = p; if (p.valor != null) g.valor = Number(p.valor); if (p.pdf_b64) g.pdf_b64 = p.pdf_b64; } });
    simples.forEach(s => { if (s.fonte !== 'SN' || !s.data_vencimento || s.data_vencimento < `${ano}-01-01` || list.some(g => g.pay?.fonte === 'SN' && g.pay.competencia === s.competencia)) return; const [y, m] = s.competencia.split('-');
      list.push({ id: 'sn' + s.competencia, name: 'DAS', due: s.data_vencimento, competencia: `${m}/${y}`, valor: s.valor != null ? Number(s.valor) : null, done: false, pdf_b64: s.pdf_b64, pay: { ...s, state: (s.status || '').startsWith('pag') ? 'paga' : (s.status || '').startsWith('venc') ? 'vencida' : 'aberto' } }); });
    return groupByTax(list);
  }, [obrig, simples]);

  async function open(g: Guia, download: boolean) {
    if (g.pdf_b64) {
      const bin = atob(g.pdf_b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
      if (download) { const a = document.createElement('a'); a.href = url; a.download = `DAS_${g.competencia}.pdf`; a.click(); } else window.open(url, '_blank', 'noopener');
      return;
    }
    if (!g.file_url) return;
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(g.file_url, 120, download ? { download: g.file_name || true } : undefined);
    if (error || !data) return toast({ title: 'Não foi possível abrir', description: 'Arquivo indisponível. Fale com o escritório.', variant: 'destructive' });
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  const anos = Array.from({ length: 4 }, (_, i) => today.getFullYear() - i);
  const hoje = iso(today);
  const status = (g: Guia) => (g.file_url || g.pdf_b64) || g.done ? { l: 'Guia disponível', c: 'bg-portal-blue-soft text-portal-blue' } : g.due < hoje ? { l: 'Vencida', c: 'bg-destructive/10 text-destructive' } : { l: 'Em preparação', c: 'bg-warning/10 text-warning' };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-portal-ink">Impostos</h1>
        <Select value={String(ano)} onValueChange={v => setAno(Number(v))}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent></Select>
      </div>
      {loading ? <SectionCard><p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p></SectionCard>
        : groups.length === 0 ? <SectionCard><p className="py-6 text-center text-sm text-muted-foreground">Nenhuma guia de imposto em {ano}.</p></SectionCard>
        : (
          <Tabs defaultValue={groups[0].key} key={groups.map(g => g.key).join()}>
            <TabsList className="flex w-full overflow-x-auto justify-start h-auto [&>button]:shrink-0 [&>button]:min-h-10">
              {groups.map(g => <TabsTrigger key={g.key} value={g.key}>{g.label} <span className="ml-1 text-xs text-muted-foreground">{g.items.length}</span></TabsTrigger>)}
            </TabsList>
            {groups.map(gr => (
              <TabsContent key={gr.key} value={gr.key} className="mt-3">
                <SectionCard className="divide-y divide-border/70">
                  {gr.items.map(g => { const s = status(g); const has = !!(g.file_url || g.pdf_b64); return (
                    <div key={g.id} className="flex items-center gap-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-portal-ink truncate">Competência {g.competencia}</p>
                        <p className="text-xs text-muted-foreground">Vence {br(g.due)}</p>
                        <PayBadge pay={g.pay} />{!(g.pay && s.l === 'Vencida') && <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', s.c)}>{s.l}</span>}
                      </div>
                      <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{g.valor != null ? brl(g.valor) : '—'}</span>
                      {has && <span className="flex shrink-0 gap-1">
                        <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Visualizar guia" onClick={() => open(g, false)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Baixar guia" onClick={() => open(g, true)}><Download className="h-4 w-4" /></Button>
                      </span>}
                    </div>); })}
                </SectionCard>
              </TabsContent>
            ))}
          </Tabs>
        )}
    </div>
  );
}
