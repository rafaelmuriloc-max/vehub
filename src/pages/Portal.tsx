import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { LogOut, FileDown, Megaphone } from 'lucide-react';
import { modulesFor } from '@/lib/portal';
import { limiteAnual, faixaDe, somarPorMes } from '@/lib/meiLimit';

type Company = { id: string; company_name: string; document: string | null; tax_regime: string | null; opening_date: string | null };
type Nota = { id: string; invoice_number: string | null; issue_date: string | null; total_value: number | null; status: string | null; emitter_name: string | null; kind: 'NF-e' | 'NFC-e' };

const db = supabase as any;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const isCancelled = (s: string | null) => (s || '').toLowerCase().includes('cancel');

function walkForPdf(o: any): string | null {
  if (typeof o === 'string') { try { return walkForPdf(JSON.parse(o)); } catch { return o.startsWith('JVBERi0') ? o : null; } }
  if (!o || typeof o !== 'object') return null;
  for (const v of Object.values(o)) { const f = walkForPdf(v); if (f) return f; }
  return null;
}
function openPdf(b64: string, name: string) {
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function loadNotas(clientId: string, direction: 'saida' | 'entrada', ano: number): Promise<Nota[]> {
  const from = `${ano}-01-01`, to = `${ano}-12-31T23:59:59`;
  const [nfe, nfce] = await Promise.all([
    db.from('nfe_invoices').select('id, invoice_number, issue_date, total_value, status, emitter_name').eq('client_id', clientId).eq('direction', direction).gte('issue_date', from).lte('issue_date', to).order('issue_date', { ascending: false }).limit(1000),
    db.from('nfce_invoices').select('id, invoice_number, issue_date, total_value, status, emitter_name').eq('client_id', clientId).eq('direction', direction).gte('issue_date', from).lte('issue_date', to).order('issue_date', { ascending: false }).limit(1000),
  ]);
  return [
    ...((nfe.data as any[]) || []).map(n => ({ ...n, kind: 'NF-e' as const })),
    ...((nfce.data as any[]) || []).map(n => ({ ...n, kind: 'NFC-e' as const })),
  ].sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || ''));
}

function NotasList({ notas, showEmitter }: { notas: Nota[]; showEmitter?: boolean }) {
  if (!notas.length) return <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma nota neste ano.</p>;
  return (
    <div className="divide-y divide-border">
      {notas.slice(0, 200).map(n => (
        <div key={n.kind + n.id} className="flex items-start sm:items-center gap-3 py-3 sm:py-2 text-sm">
          <Badge variant="outline" className="shrink-0">{n.kind}</Badge>
          <div className="flex-1 min-w-0">
            <p className="break-words sm:truncate">Nº {n.invoice_number || '—'}{showEmitter && n.emitter_name ? ` · ${n.emitter_name}` : ''}</p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{n.issue_date ? n.issue_date.slice(0, 10).split('-').reverse().join('/') : '—'}{isCancelled(n.status) ? ' · Cancelada' : ''}</p>
              <span className="font-medium tabular-nums sm:hidden">{brl(Number(n.total_value) || 0)}</span>
            </div>
          </div>
          <span className="font-medium tabular-nums hidden sm:inline shrink-0">{brl(Number(n.total_value) || 0)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Portal() {
  const { user, loading, isClient, profile, signOut } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [ano, setAno] = useState(new Date().getFullYear());
  const [emitidas, setEmitidas] = useState<Nota[]>([]);
  const [recebidas, setRecebidas] = useState<Nota[]>([]);
  const [avisos, setAvisos] = useState<any[]>([]);
  const [simples, setSimples] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));

  useEffect(() => {
    if (!user || !isClient) return;
    (async () => {
      const { data: links } = await db.rpc('portal_my_clients');
      const ids = ((links as any[]) || []).map(l => (typeof l === 'string' ? l : l.portal_my_clients));
      if (!ids.length) return;
      const { data } = await supabase.from('clients').select('id, company_name, document, tax_regime, opening_date').in('id', ids).order('company_name');
      setCompanies((data as Company[]) || []);
      setActiveId(prev => prev || (data as any[])?.[0]?.id || '');
      const { data: a } = await db.from('portal_announcements').select('*').order('created_at', { ascending: false }).limit(50);
      setAvisos((a as any[]) || []);
    })();
  }, [user, isClient]);

  const company = companies.find(c => c.id === activeId);
  const modules = modulesFor(company?.tax_regime);

  useEffect(() => {
    if (!activeId) return;
    loadNotas(activeId, 'saida', ano).then(setEmitidas);
    loadNotas(activeId, 'entrada', ano).then(setRecebidas);
    db.from('simples_nacional_competencias').select('id, competencia, valor_das, data_vencimento, status, das_pdf_base64').eq('client_id', activeId).eq('ano', ano).order('competencia', { ascending: false }).then(({ data }: any) => setSimples(data || []));
  }, [activeId, ano]);

  const meses = useMemo(() => somarPorMes(emitidas.filter(n => !isCancelled(n.status)), ano), [emitidas, ano]);
  const total = meses.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...meses);
  const myAvisos = avisos.filter(a => a.audience === 'all' || (a.audience === 'client' && a.client_id === activeId) || (a.audience === 'regime' && a.tax_regime === company?.tax_regime));

  if (loading) return <div className="flex min-h-[100dvh] items-center justify-center"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (profile?.must_change_password) return <Navigate to="/change-password" replace />;
  if (!isClient) return <Navigate to="/" replace />;

  async function emitir(kind: 'das' | 'ccmei') {
    if (!company) return;
    setBusy(kind);
    try {
      const body = kind === 'das'
        ? { client_id: company.id, idSistema: 'PGMEI', idServico: 'GERARDASPDF21', tipo: 'Emitir', dados: JSON.stringify({ periodoApuracao: `${ano}${mes}` }) }
        : { client_id: company.id, idSistema: 'CCMEI', idServico: 'EMITIRCCMEI121', tipo: 'Emitir', dados: '' };
      const { data, error } = await supabase.functions.invoke('integra-contador', { body });
      if (error) throw error;
      const pdf = walkForPdf(data);
      if (pdf) openPdf(pdf, kind === 'das' ? `DAS_${ano}${mes}.pdf` : 'CCMEI.pdf');
      else toast({ title: 'Documento indisponível', description: data?.error || data?.mensagens?.map((m: any) => m.texto).join('; ') || 'A Receita não retornou o PDF.', variant: 'destructive' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  }

  const limite = limiteAnual(ano, company?.opening_date ?? null);
  const faixa = faixaDe(total, limite);

  return (
    <div className="min-h-[100dvh] bg-background overflow-x-hidden">
      <header className="sticky top-0 z-20 bg-secondary text-secondary-foreground" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto max-w-4xl flex items-center gap-3 px-4 h-14">
          <span className="font-bold tracking-tight">Velocitä</span>
          <span className="text-xs text-secondary-foreground/60 hidden sm:inline">Área do Cliente</span>
          <Button variant="ghost" size="sm" aria-label="Sair" className="ml-auto h-11 sm:h-9 text-secondary-foreground hover:bg-secondary-foreground/10" onClick={signOut}><LogOut className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Sair</span></Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-3 sm:p-4 space-y-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        {companies.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma empresa vinculada ao seu acesso. Fale com o escritório.</CardContent></Card>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2 min-w-0">
              {companies.length > 1 ? (
                <Select value={activeId} onValueChange={setActiveId}>
                  <SelectTrigger className="h-11 sm:h-10 w-full sm:flex-1 min-w-0 [&>span]:truncate" aria-label="Empresa"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)]">{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                </Select>
              ) : <h1 className="text-lg font-semibold sm:flex-1 break-words min-w-0">{company?.company_name}</h1>}
              <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
                <SelectTrigger className="h-11 sm:h-10 w-full sm:w-28" aria-label="Ano"><SelectValue /></SelectTrigger>
                <SelectContent>{[0, 1, 2, 3].map(d => { const y = new Date().getFullYear() - d; return <SelectItem key={y} value={String(y)}>{y}</SelectItem>; })}</SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground -mt-2 break-words">{company?.document} · {company?.tax_regime || 'Regime não informado'}</p>

            <Tabs defaultValue="faturamento">
              <div className="sticky z-10 -mx-3 px-3 sm:mx-0 sm:px-0 py-1 bg-background" style={{ top: 'calc(3.5rem + env(safe-area-inset-top))' }}>
              <TabsList className="flex w-full overflow-x-auto justify-start h-auto [&>button]:shrink-0 [&>button]:min-h-10">
                <TabsTrigger value="faturamento">Faturamento</TabsTrigger>
                <TabsTrigger value="emitidas">Emitidas</TabsTrigger>
                <TabsTrigger value="recebidas">Recebidas</TabsTrigger>
                {(modules.includes('das_mei') || modules.includes('das_simples')) && <TabsTrigger value="guias">Guias</TabsTrigger>}
                <TabsTrigger value="avisos">Avisos{myAvisos.length ? ` (${myAvisos.length})` : ''}</TabsTrigger>
              </TabsList>
              </div>

              <TabsContent value="faturamento" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Card className="min-w-0"><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">Faturado em {ano}</p><p className="text-base sm:text-xl font-bold tabular-nums break-all">{brl(total)}</p></CardContent></Card>
                  <Card className="min-w-0"><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">Notas emitidas</p><p className="text-base sm:text-xl font-bold">{emitidas.filter(n => !isCancelled(n.status)).length}</p></CardContent></Card>
                </div>
                {modules.includes('limite') && (
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm"><span>Limite MEI {ano}</span><span className="tabular-nums">{brl(total)} de {brl(limite)}</span></div>
                      <div className="h-3 rounded-full bg-muted overflow-hidden"><div className={`h-full ${faixa === 'normal' ? 'bg-primary' : 'bg-destructive'}`} style={{ width: `${Math.min(100, limite ? (total / limite) * 100 : 100)}%` }} /></div>
                      <p className="text-xs text-muted-foreground">{faixa === 'normal' ? `Disponível: ${brl(Math.max(0, limite - total))}` : faixa === 'alerta' ? 'Atenção: acima de 80% do limite. Fale com o escritório.' : 'Limite ultrapassado. Fale com o escritório.'}</p>
                    </CardContent>
                  </Card>
                )}
                <Card>
                  <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2"><CardTitle className="text-base">Por mês</CardTitle></CardHeader>
                  <CardContent className="space-y-1 p-3 pt-0 sm:p-6 sm:pt-0">
                    {meses.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] sm:text-xs">
                        <span className="w-7 sm:w-8 shrink-0 text-muted-foreground">{MONTHS[i]}</span>
                        <div className="flex-1 min-w-0 h-4 bg-muted rounded"><div className="h-full bg-primary rounded" style={{ width: `${(v / max) * 100}%` }} /></div>
                        <span className="w-20 sm:w-24 shrink-0 text-right tabular-nums">{brl(v)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="emitidas" className="mt-4"><Card><CardContent className="p-3 sm:p-4"><NotasList notas={emitidas} /></CardContent></Card></TabsContent>
              <TabsContent value="recebidas" className="mt-4"><Card><CardContent className="p-3 sm:p-4"><NotasList notas={recebidas} showEmitter /></CardContent></Card></TabsContent>

              <TabsContent value="guias" className="mt-4 space-y-4">
                {modules.includes('das_mei') && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">DAS MEI e CCMEI</CardTitle></CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-2">
                      <Select value={mes} onValueChange={setMes}>
                        <SelectTrigger className="h-11 sm:h-10 w-full sm:w-28" aria-label="Mês"><SelectValue /></SelectTrigger>
                        <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1).padStart(2, '0')}>{m}/{ano}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button className="h-11 sm:h-10 w-full sm:w-auto" onClick={() => emitir('das')} disabled={!!busy}><FileDown className="h-4 w-4 mr-1" />{busy === 'das' ? 'Gerando...' : 'Emitir DAS'}</Button>
                      <Button className="h-11 sm:h-10 w-full sm:w-auto" variant="outline" onClick={() => emitir('ccmei')} disabled={!!busy}><FileDown className="h-4 w-4 mr-1" />{busy === 'ccmei' ? 'Gerando...' : 'Emitir CCMEI'}</Button>
                    </CardContent>
                  </Card>
                )}
                {modules.includes('das_simples') && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">DAS do Simples Nacional</CardTitle></CardHeader>
                    <CardContent className="divide-y divide-border">
                      {simples.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma guia disponibilizada pelo escritório em {ano}.</p>}
                      {simples.map(s => (
                        <div key={s.id} className="flex items-center gap-2 sm:gap-3 py-2 text-sm">
                          <div className="flex-1 min-w-0"><p className="truncate">{s.competencia}</p><p className="text-xs text-muted-foreground break-words">{s.data_vencimento ? `Vence ${s.data_vencimento.split('-').reverse().join('/')}` : ''} · {s.status}</p></div>
                          <span className="tabular-nums shrink-0">{s.valor_das != null ? brl(Number(s.valor_das)) : '—'}</span>
                          {s.das_pdf_base64 && <Button size="icon" variant="ghost" className="h-11 w-11 sm:h-10 sm:w-10 shrink-0" aria-label="Baixar DAS" onClick={() => openPdf(s.das_pdf_base64, `DAS_${s.competencia}.pdf`)}><FileDown className="h-4 w-4" /></Button>}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="avisos" className="mt-4 space-y-2">
                {myAvisos.length === 0 && <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum aviso no momento.</CardContent></Card>}
                {myAvisos.map(a => (
                  <Card key={a.id}><CardContent className="p-3 sm:p-4 flex gap-3">
                    <Megaphone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0"><p className="font-medium break-words">{a.title}</p><p className="text-sm text-muted-foreground whitespace-pre-line break-words [overflow-wrap:anywhere]">{a.body}</p><p className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleDateString('pt-BR')}</p></div>
                  </CardContent></Card>
                ))}
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
