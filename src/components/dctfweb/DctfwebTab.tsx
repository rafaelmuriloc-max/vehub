import { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { FileCheck, Loader2, Receipt, FileText, Banknote, Search, ChevronLeft, ChevronRight, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatClientLabel } from '@/lib/utils';

type Client = { id: string; company_name: string; sci_code: string | null; document: string | null };
type Action = 'recibo' | 'declaracao' | 'guia';
type Pay = { client_id: string; status: string; valor_pago: number | null; data_pagamento: string | null; mensagem: string | null; enviada?: boolean | null };
type Filter = 'all' | 'enviada' | 'nao_enviada' | 'pago' | 'aberto';

const ACTIONS: Record<Action, { label: string; idServico: string; tipo: string; icon: any }> = {
  recibo: { label: 'Recibo', idServico: 'CONSRECIBO32', tipo: 'Consultar', icon: Receipt },
  declaracao: { label: 'Declaração', idServico: 'CONSDECCOMPLETA33', tipo: 'Consultar', icon: FileText },
  guia: { label: 'Guia', idServico: 'GERARGUIA31', tipo: 'Emitir', icon: Banknote },
};
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const PAGE = 15;

function walkForPdf(o: any): string | null {
  if (!o || typeof o !== 'object') return null;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' && v.length > 100 && (k.toLowerCase() === 'pdf' || v.startsWith('JVBERi0'))) return v;
    if (typeof v === 'object') { const f = walkForPdf(v); if (f) return f; }
  }
  return null;
}

function openPdf(b64: string, filename: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
  window.open(url, '_blank');
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function DctfwebTab() {
  const { toast } = useToast();
  const prev = new Date(); prev.setDate(1); prev.setMonth(prev.getMonth() - 1);
  const [mes, setMes] = useState(String(prev.getMonth() + 1).padStart(2, '0'));
  const [ano, setAno] = useState(String(prev.getFullYear()));
  const [categoria, setCategoria] = useState('GERAL_MENSAL');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<{ id: string; action: Action } | null>(null);

  // Empresas ativas com obrigação de Folha de Pagamento Mensal ou Folha Pró-labore.
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setPage(0);
    (async () => {
      const refMonth = `${ano}-${categoria === 'GERAL_MENSAL' ? mes : '12'}-01`;
      const { data: obs } = await supabase.from('obligations').select('id, name')
        .or('name.ilike.%folha de pagamento%,name.ilike.%folha pr%labore%');
      const ids = (obs || []).map((o: any) => o.id);
      if (ids.length === 0) { if (!cancel) { setClients([]); setLoading(false); } return; }
      const map = new Map<string, Client>();
      const add = (c: any) => { if (c && c.status === 'active') map.set(c.id, { id: c.id, company_name: c.company_name, sci_code: c.sci_code, document: c.document }); };
      const { data: links } = await supabase.from('client_department_obligations')
        .select('client_id, clients(id, company_name, sci_code, document, status)').in('obligation_id', ids);
      for (const r of (links || []) as any[]) add(r.clients);
      if (map.size === 0) {
        const { data } = await supabase.from('obligation_instances')
          .select('client_id, clients(id, company_name, sci_code, document, status)')
          .in('obligation_id', ids).is('deleted_at', null).eq('reference_month', refMonth);
        for (const r of (data || []) as any[]) add(r.clients);
      }
      if (!cancel) {
        setClients([...map.values()].sort((a, b) => a.company_name.localeCompare(b.company_name)));
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [ano, mes, categoria]);

  const [pays, setPays] = useState<Record<string, Pay>>({});
  const [statusFilter, setStatusFilter] = useState<Filter>('all');
  useEffect(() => {
    let cancel = false;
    (async () => {
      const comp = `${ano}-${categoria === 'GERAL_MENSAL' ? mes : '12'}-01`;
      const { data } = await (supabase as any).from('dctfweb_competencias')
        .select('client_id, status, valor_pago, data_pagamento, mensagem, enviada').eq('competencia', comp).eq('categoria', categoria);
      if (cancel) return;
      const m: Record<string, Pay> = {};
      for (const r of (data || []) as Pay[]) m[r.client_id] = r;
      setPays(m);
    })();
    return () => { cancel = true; };
  }, [ano, mes, categoria]);

  const dueTime = useMemo(() => {
    const y = Number(ano), m = Number(mes);
    return categoria === '13_SALARIO' ? new Date(y, 11, 20, 23, 59).getTime() : new Date(y, m, 20, 23, 59).getTime();
  }, [ano, mes, categoria]);
  const envioOf = (id: string): 'enviada' | 'nao_enviada' | 'nao_consultado' => {
    const p = pays[id];
    if (!p) return 'nao_consultado';
    return p.enviada === false ? 'nao_enviada' : 'enviada';
  };
  const statusOf = (id: string): 'pago' | 'aberto' | 'vencido' => {
    const p = pays[id];
    if (p?.status === 'pago') return 'pago';
    return Date.now() > dueTime ? 'vencido' : 'aberto';
  };

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    if (!q) return clients;
    return clients.filter(c => c.company_name.toLowerCase().includes(q) || (c.sci_code || '').toLowerCase().includes(q)
      || (c.document || '').toLowerCase().includes(q) || (!!qd && (c.document || '').replace(/\D/g, '').includes(qd)));
  }, [clients, search]);
  const filtered = useMemo(() => searched.filter(c => {
    const env = envioOf(c.id);
    switch (statusFilter) {
      case 'enviada': return env === 'enviada';
      case 'nao_enviada': return env !== 'enviada';
      case 'pago': return env === 'enviada' && statusOf(c.id) === 'pago';
      case 'aberto': return env === 'enviada' && statusOf(c.id) !== 'pago';
      default: return true;
    }
  }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searched, statusFilter, pays, dueTime]);
  const stats = useMemo(() => {
    let enviada = 0, nao = 0, pago = 0, aberto = 0, valor = 0;
    for (const c of searched) {
      if (envioOf(c.id) !== 'enviada') { nao++; continue; }
      enviada++;
      if (statusOf(c.id) === 'pago') { pago++; valor += pays[c.id]?.valor_pago || 0; } else aberto++;
    }
    return { total: searched.length, enviada, nao, pago, aberto, valor };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched, pays, dueTime]);
  const guiaList = filtered.filter(c => c.document && envioOf(c.id) === 'enviada');
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  useEffect(() => setPage(0), [search, statusFilter]);

  const years = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i));

  const fetchPdf = async (c: Client, action: Action): Promise<string> => {
    const a = ACTIONS[action];
    const dados: Record<string, unknown> = { categoria, anoPA: ano };
    if (categoria !== 'GERAL_ANUAL' && categoria !== '13_SALARIO') dados.mesPA = mes;
    const { data, error } = await supabase.functions.invoke('integra-contador', {
      body: { client_id: c.id, idSistema: 'DCTFWEB', idServico: a.idServico, tipo: a.tipo, dados: JSON.stringify(dados) },
    });
    if (error) throw error;
    const msgs = (data?.data?.mensagens || data?.mensagens || []) as Array<{ texto: string }>;
    const raw = data?.data?.dados ?? data?.dados;
    const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : raw;
    const pdf = (typeof parsed === 'string' && parsed.startsWith('JVBERi0') ? parsed : null) || walkForPdf(parsed) || walkForPdf(data?.data);
    if (!pdf) throw new Error(msgs.map(m => m.texto).join('; ') || data?.error || 'A Receita não retornou o documento.');
    return pdf;
  };
  const safeName = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '_').slice(0, 40);

  const run = async (c: Client, action: Action) => {
    const a = ACTIONS[action];
    setBusy({ id: c.id, action });
    try {
      const pdf = await fetchPdf(c, action);
      openPdf(pdf, `DCTFWeb_${safeName(a.label)}_${ano}${mes}_${safeName(c.company_name)}.pdf`);
    } catch (e) {
      toast({ title: `${a.label} indisponível`, description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const [bulk, setBulk] = useState<{ open: boolean; running: boolean; done: number; total: number; ok: number; fails: { name: string; msg: string }[] }>({ open: false, running: false, done: 0, total: 0, ok: 0, fails: [] });
  const cancelRef = useRef(false);

  const runBulk = async () => {
    const list = guiaList;
    if (!list.length) return;
    cancelRef.current = false;
    setBulk({ open: true, running: true, done: 0, total: list.length, ok: 0, fails: [] });
    const zip = new JSZip();
    let ok = 0;
    const fails: { name: string; msg: string }[] = [];
    for (let i = 0; i < list.length; i++) {
      if (cancelRef.current) break;
      const c = list[i];
      try {
        let pdf: string;
        try { pdf = await fetchPdf(c, 'guia'); }
        catch (e) {
          if (/fetch|network|failed to send/i.test((e as Error).message)) { await sleep(1500); pdf = await fetchPdf(c, 'guia'); }
          else throw e;
        }
        zip.file(`Guia_${c.sci_code || 'sem_codigo'}_${safeName(c.company_name)}.pdf`, pdf, { base64: true });
        ok++;
      } catch (e) {
        fails.push({ name: formatClientLabel(c as any), msg: (e as Error).message });
      }
      setBulk(b => ({ ...b, done: i + 1, ok, fails: [...fails] }));
      await sleep(500);
    }
    if (ok > 0) {
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `DCTFWeb_Guias_${ano}${mes}.zip`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
    setBulk(b => ({ ...b, running: false }));
  };

  const refreshOne = async (c: Client) => {
    const { data, error } = await supabase.functions.invoke('dctfweb-pagamentos', { body: { client_id: c.id, ano, mes, categoria } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    setPays(p => ({ ...p, [c.id]: data as Pay }));
    return data as Pay;
  };
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const refreshClick = async (c: Client) => {
    setStatusBusy(c.id);
    try {
      const p = await refreshOne(c);
      if (p.mensagem && p.status !== 'pago') toast({ title: 'Aviso da Receita', description: p.mensagem });
    } catch (e) { toast({ title: 'Falha ao atualizar', description: (e as Error).message, variant: 'destructive' }); }
    finally { setStatusBusy(null); }
  };
  const [sync, setSync] = useState<{ running: boolean; done: number; total: number }>({ running: false, done: 0, total: 0 });
  const syncCancel = useRef(false);
  const refreshAll = async () => {
    const list = filtered.filter(c => c.document);
    syncCancel.current = false;
    setSync({ running: true, done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      if (syncCancel.current) break;
      try { await refreshOne(list[i]); }
      catch { await sleep(1500); try { await refreshOne(list[i]); } catch { /* segue */ } }
      setSync(s => ({ ...s, done: i + 1 }));
      await sleep(500);
    }
    setSync(s => ({ ...s, running: false }));
  };

  const fmtBRL = (v: number | null) => v == null ? '' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d: string | null) => d ? d.split('-').reverse().join('/') : '';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0">
          <FileCheck className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">DCTFWeb</h1>
          <p className="text-muted-foreground">Recibo, declaração completa e guia por empresa</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por empresa, código SCI ou CNPJ..." className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Select value={mes} onValueChange={setMes} disabled={categoria !== 'GERAL_MENSAL'}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1).padStart(2, '0')}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="GERAL_MENSAL">Geral Mensal</SelectItem>
              <SelectItem value="13_SALARIO">13º Salário</SelectItem>
              <SelectItem value="GERAL_ANUAL">Geral Anual</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={sync.running ? () => { syncCancel.current = true; } : refreshAll} disabled={loading || (!sync.running && searched.length === 0)}>
            <RefreshCw className={cn('h-4 w-4 mr-1', sync.running && 'animate-spin')} />
            {sync.running ? `Cancelar (${sync.done}/${sync.total})` : 'Atualizar situação'}
          </Button>
          <Button onClick={runBulk} disabled={loading || bulk.running || guiaList.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Baixar todas as guias ({guiaList.length})
          </Button>
        </div>
      </div>

      {sync.running && <Progress value={sync.total ? (sync.done / sync.total) * 100 : 0} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {([
          { key: 'all', label: 'Empresas com folha', value: String(stats.total), sub: 'Folha mensal ou pró-labore' },
          { key: 'enviada', label: 'Enviadas', value: String(stats.enviada), sub: 'Confirmado na Receita' },
          { key: 'nao_enviada', label: 'Não enviadas', value: String(stats.nao), sub: 'Inclui não consultadas' },
          { key: 'pago', label: 'Guias pagas', value: String(stats.pago), sub: fmtBRL(stats.valor) || '—' },
          { key: 'aberto', label: 'Em aberto / vencidas', value: String(stats.aberto), sub: Date.now() > dueTime ? 'Vencimento já passou' : 'Ainda no prazo' },
        ] as const).map(card => {
          const clickable = true;
          const active = clickable && statusFilter === card.key;
          return (
            <button key={card.key} type="button" disabled={!clickable}
              onClick={() => clickable && setStatusFilter(card.key as any)}
              className={cn('rounded-xl border bg-card p-4 text-left transition-colors', clickable && 'hover:bg-muted', active && 'border-primary ring-1 ring-primary')}>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground truncate">{card.sub}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {([['all', 'Todas'], ['enviada', 'Enviadas'], ['nao_enviada', 'Não enviadas'], ['pago', 'Pagas'], ['aberto', 'Em aberto']] as const).map(([f, l]) => (
          <Button key={f} size="sm" variant={statusFilter === f ? 'default' : 'outline'} onClick={() => setStatusFilter(f)}>
            {l}
          </Button>
        ))}
      </div>

      <div className="rounded-xl border bg-card divide-y">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada.</p>
        ) : rows.map(c => {
          const st = statusOf(c.id);
          const p = pays[c.id];
          const env = envioOf(c.id);
          return (
          <div key={c.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-medium">{formatClientLabel(c as any)}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{c.document || 'Sem CNPJ'}</span>
                {env === 'nao_enviada' ? (
                  <Badge variant="outline" className="border-muted-foreground/40">Não enviado</Badge>
                ) : env === 'nao_consultado' ? (
                  <Badge variant="outline">Não consultado</Badge>
                ) : st !== 'pago' && p?.enviada == null ? (
                  <Badge variant="outline" className="border-warning/40 text-warning">Envio não verificado</Badge>
                ) : st === 'pago' ? (
                  <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/15">
                    Pago{p?.data_pagamento ? ` em ${fmtDate(p.data_pagamento)}` : ''}{p?.valor_pago ? ` • ${fmtBRL(p.valor_pago)}` : ''}
                  </Badge>
                ) : st === 'vencido' ? (
                  <Badge variant="destructive">Vencida</Badge>
                ) : (
                  <Badge className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/15">Em aberto</Badge>
                )}
                {p?.mensagem && st !== 'pago' && (
                  <span className="inline-flex items-center gap-1 text-destructive" title={p.mensagem}>
                    <AlertTriangle className="h-3 w-3" /> Aviso da Receita
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="icon" variant="ghost" aria-label="Atualizar situação" title="Atualizar situação"
                disabled={!c.document || statusBusy === c.id || sync.running} onClick={() => refreshClick(c)}>
                <RefreshCw className={cn('h-4 w-4', statusBusy === c.id && 'animate-spin')} />
              </Button>
              {env === 'enviada' && (Object.keys(ACTIONS) as Action[]).map(k => {
                const A = ACTIONS[k];
                const isBusy = busy?.id === c.id && busy.action === k;
                return (
                  <Button key={k} size="sm" variant={k === 'guia' ? 'default' : 'outline'} disabled={busy?.id === c.id || !c.document} onClick={() => run(c, k)}>
                    {isBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <A.icon className="h-4 w-4 mr-1" />}
                    {A.label}
                  </Button>
                );
              })}
            </div>
          </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length} empresas</span>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <span>Página {page + 1} de {pages}</span>
          <Button size="icon" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <Dialog open={bulk.open} onOpenChange={o => { if (!bulk.running) setBulk(b => ({ ...b, open: o })); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Guias DCTFWeb em lote</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Progress value={bulk.total ? (bulk.done / bulk.total) * 100 : 0} />
            <p className="text-sm text-muted-foreground">
              {bulk.done} de {bulk.total} • {bulk.ok} guias geradas • {bulk.fails.length} falhas
              {!bulk.running && bulk.ok > 0 && ' — arquivo ZIP baixado.'}
            </p>
            {bulk.fails.length > 0 && (
              <div className="max-h-60 overflow-y-auto rounded-md border divide-y text-xs">
                {bulk.fails.map((f, i) => (
                  <div key={i} className="p-2"><p className="font-medium">{f.name}</p><p className="text-muted-foreground">{f.msg}</p></div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            {bulk.running
              ? <Button variant="outline" onClick={() => { cancelRef.current = true; }}>Cancelar</Button>
              : <Button onClick={() => setBulk(b => ({ ...b, open: false }))}>Fechar</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
