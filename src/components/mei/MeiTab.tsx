import { useEffect, useMemo, useRef, useState } from 'react';
import { Store, Search, ChevronLeft, ChevronRight, Loader2, FileDown, Award, Terminal, Play, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn, formatClientLabel } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MeiLimitTab from './MeiLimitTab';

type Client = { id: string; company_name: string; sci_code: string | null; document: string | null };
type Pay = { client_id: string; status: string; valor_pago: number | null; data_pagamento: string | null; mensagem: string | null };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
type Field = { key: string; label: string; placeholder?: string };
type Svc = { idSistema: string; idServico: string; label: string; tipo: string; fields: Field[]; group: string };

const F_PERIODO: Field = { key: 'periodoApuracao', label: 'Competência (AAAAMM)', placeholder: '202609' };
const F_ANO: Field = { key: 'anoCalendario', label: 'Ano', placeholder: '2026' };
const F_CPF: Field = { key: 'cpf', label: 'CPF (11 dígitos)', placeholder: '12345678901' };
const F_CNPJ: Field = { key: 'cnpjBasico', label: 'CNPJ básico (8 dígitos)' };
const F_PARC_EMITIR: Field = { key: 'parcelaParaEmitir', label: 'Parcela p/ emitir (AAAAMM)', placeholder: '202609' };
const F_NUM_PARC: Field = { key: 'numeroParcelamento', label: 'Nº parcelamento' };
const F_ANOMES: Field = { key: 'anoMesParcela', label: 'Ano/mês parcela (AAAAMM)', placeholder: '202609' };

function parc(sis: string, desc: string, n: number[]): Svc[] {
  const g = `Parcelamento ${desc}`;
  return [
    { idSistema: sis, idServico: `PEDIDOSPARC${n[2]}`, label: 'Pedidos', tipo: 'Consultar', fields: [F_CNPJ], group: g },
    { idSistema: sis, idServico: `PARCELASPARAGERAR${n[1]}`, label: 'Parcelas p/ gerar', tipo: 'Consultar', fields: [F_CNPJ], group: g },
    { idSistema: sis, idServico: `GERARDAS${n[0]}`, label: 'Gerar DAS da parcela', tipo: 'Emitir', fields: [F_CNPJ, F_PARC_EMITIR], group: g },
    { idSistema: sis, idServico: `OBTERPARC${n[3]}`, label: 'Obter parcelamento', tipo: 'Consultar', fields: [F_CNPJ, F_NUM_PARC], group: g },
    { idSistema: sis, idServico: `DETPAGTOPARC${n[4]}`, label: 'Detalhe de pagamento', tipo: 'Consultar', fields: [F_CNPJ, F_NUM_PARC, F_ANOMES], group: g },
  ];
}

const SERVICES: Svc[] = [
  { idSistema: 'PGMEI', idServico: 'GERARDASPDF21', label: 'DAS MEI (PDF)', tipo: 'Emitir', fields: [F_PERIODO], group: 'Guias (PGMEI)' },
  { idSistema: 'PGMEI', idServico: 'GERARDASCODBARRA22', label: 'DAS MEI (código de barras)', tipo: 'Emitir', fields: [F_PERIODO], group: 'Guias (PGMEI)' },
  { idSistema: 'PGMEI', idServico: 'ATUBENEFICIO23', label: 'Atualizar benefício', tipo: 'Emitir', fields: [], group: 'Guias (PGMEI)' },
  { idSistema: 'PGMEI', idServico: 'DIVIDAATIVA24', label: 'Dívida ativa MEI', tipo: 'Consultar', fields: [F_ANO], group: 'Guias (PGMEI)' },
  { idSistema: 'CCMEI', idServico: 'EMITIRCCMEI121', label: 'Emitir certificado CCMEI', tipo: 'Emitir', fields: [], group: 'Certificado (CCMEI)' },
  { idSistema: 'CCMEI', idServico: 'DADOSCCMEI122', label: 'Dados do CCMEI', tipo: 'Consultar', fields: [], group: 'Certificado (CCMEI)' },
  { idSistema: 'CCMEI', idServico: 'CCMEISITCADASTRAL123', label: 'Situação cadastral por CPF', tipo: 'Consultar', fields: [F_CPF], group: 'Certificado (CCMEI)' },
  ...parc('PARCMEI', 'Ordinário MEI', [201, 202, 203, 204, 205]),
  ...parc('PARCMEI-ESP', 'Especial MEI', [211, 212, 213, 214, 215]),
  ...parc('PERTMEI', 'PERT-MEI', [221, 222, 223, 224, 225]),
  ...parc('RELPMEI', 'RELP-MEI', [231, 232, 233, 234, 235]),
];
const GROUPS = [...new Set(SERVICES.map(s => s.group))];
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
function parseDeep(o: any): any {
  if (typeof o === 'string') { try { return parseDeep(JSON.parse(o)); } catch { return o; } }
  if (Array.isArray(o)) return o.map(parseDeep);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, parseDeep(v)]));
  return o;
}
function openPdf(b64: string, filename: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
  window.open(url, '_blank');
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
const fmtCnpj = (d: string | null) => {
  const s = (d || '').replace(/\D/g, '');
  return s.length === 14 ? s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d || '-';
};
const safe = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40);

export default function MeiTab() {
  const { toast } = useToast();
  const now = new Date();
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [panel, setPanel] = useState<Client | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('clients').select('id, company_name, sci_code, document, tax_regime')
        .eq('status', 'active').ilike('tax_regime', 'mei').order('company_name');
      setClients((data || []) as any);
      setLoading(false);
    })();
  }, []);

  const [pays, setPays] = useState<Record<string, Pay>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | 'pago' | 'aberto'>('all');
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await (supabase as any).from('mei_competencias')
        .select('client_id, status, valor_pago, data_pagamento, mensagem').eq('competencia', `${ano}-${mes}-01`);
      if (cancel) return;
      const m: Record<string, Pay> = {};
      for (const r of (data || []) as Pay[]) m[r.client_id] = r;
      setPays(m);
    })();
    return () => { cancel = true; };
  }, [ano, mes]);
  const dueTime = useMemo(() => new Date(Number(ano), Number(mes), 20, 23, 59).getTime(), [ano, mes]);
  const statusOf = (id: string): 'pago' | 'aberto' | 'vencido' =>
    pays[id]?.status === 'pago' ? 'pago' : Date.now() > dueTime ? 'vencido' : 'aberto';

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase(); const qd = q.replace(/\D/g, '');
    return clients.filter(c => !q || c.company_name.toLowerCase().includes(q) || (c.sci_code || '').toLowerCase().includes(q) || (qd && (c.document || '').replace(/\D/g, '').includes(qd)));
  }, [clients, search]);
  const filtered = useMemo(() => statusFilter === 'all' ? searched
    : searched.filter(c => statusFilter === 'pago' ? statusOf(c.id) === 'pago' : statusOf(c.id) !== 'pago'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searched, statusFilter, pays, dueTime]);
  const stats = useMemo(() => {
    let pago = 0, aberto = 0, valor = 0;
    for (const c of searched) {
      if (statusOf(c.id) === 'pago') { pago++; valor += pays[c.id]?.valor_pago || 0; } else aberto++;
    }
    return { total: searched.length, pago, aberto, valor, pct: searched.length ? Math.round((pago / searched.length) * 100) : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched, pays, dueTime]);
  useEffect(() => setPage(0), [statusFilter]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice(page * PAGE, page * PAGE + PAGE);

  const refreshOne = async (c: Client) => {
    const { data, error } = await supabase.functions.invoke('mei-pagamentos', { body: { client_id: c.id, ano, mes } });
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
  const [sync, setSync] = useState({ running: false, done: 0, total: 0 });
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

  async function run(c: Client, svc: Svc, values: Record<string, string>) {
    const { data, error } = await supabase.functions.invoke('integra-contador', {
      body: { client_id: c.id, idSistema: svc.idSistema, idServico: svc.idServico, tipo: svc.tipo, dados: svc.fields.length ? JSON.stringify(values) : '' },
    });
    if (error) throw error;
    return data;
  }
  function errorOf(data: any): string | null {
    if (data?.success) return null;
    const msgs = data?.data?.mensagens || data?.mensagens;
    return msgs?.map((m: any) => m.texto).join('; ') || data?.error || 'Erro na consulta';
  }

  async function quick(c: Client, kind: 'das' | 'ccmei') {
    setBusy(`${c.id}:${kind}`);
    try {
      const svc = SERVICES.find(s => s.idServico === (kind === 'das' ? 'GERARDASPDF21' : 'EMITIRCCMEI121'))!;
      const data = await run(c, svc, { periodoApuracao: `${ano}${mes}` });
      const pdf = walkForPdf(parseDeep(data));
      if (pdf) openPdf(pdf, kind === 'das' ? `DAS_MEI_${ano}${mes}_${safe(c.company_name)}.pdf` : `CCMEI_${safe(c.company_name)}.pdf`);
      else toast({ title: 'Sem PDF', description: errorOf(data) || 'A Receita não retornou o documento.', variant: 'destructive' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2"><Store className="h-7 w-7 text-primary" /> MEI</h1>
        <p className="text-muted-foreground text-sm">Empresas MEI e todos os comandos do Integra Contador</p>
      </div>

      <Tabs defaultValue="guias">
        <TabsList><TabsTrigger value="guias">Guias e Pagamentos</TabsTrigger><TabsTrigger value="limite">Controle de Limite</TabsTrigger></TabsList>
        <TabsContent value="limite" className="mt-4"><MeiLimitTab /></TabsContent>
        <TabsContent value="guias" className="mt-4 space-y-4">
      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, código ou CNPJ" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <div className="flex gap-2">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1).padStart(2, '0')}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{[0, 1, 2, 3, 4, 5].map(d => { const y = String(now.getFullYear() - d); return <SelectItem key={y} value={y}>{y}</SelectItem>; })}</SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={sync.running ? () => { syncCancel.current = true; } : refreshAll} disabled={loading || (!sync.running && searched.length === 0)}>
          <RefreshCw className={cn('h-4 w-4 mr-1', sync.running && 'animate-spin')} />
          {sync.running ? `Cancelar (${sync.done}/${sync.total})` : 'Atualizar situação'}
        </Button>
      </div>

      {sync.running && <Progress value={sync.total ? (sync.done / sync.total) * 100 : 0} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          { key: 'all', label: 'Empresas MEI', value: String(stats.total), sub: `Competência ${mes}/${ano}` },
          { key: 'pago', label: 'Guias pagas', value: String(stats.pago), sub: fmtBRL(stats.valor) || '—' },
          { key: 'aberto', label: 'Em aberto / vencidas', value: String(stats.aberto), sub: Date.now() > dueTime ? 'Vencimento já passou' : 'Ainda no prazo' },
          { key: 'pct', label: '% pagas', value: `${stats.pct}%`, sub: `${stats.pago} de ${stats.total}` },
        ] as const).map(card => {
          const clickable = card.key !== 'pct';
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

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'pago', 'aberto'] as const).map(f => (
          <Button key={f} size="sm" variant={statusFilter === f ? 'default' : 'outline'} onClick={() => setStatusFilter(f)}>
            {f === 'all' ? 'Todas' : f === 'pago' ? 'Pagas' : 'Em aberto'}
          </Button>
        ))}
        <span className="ml-auto text-sm text-muted-foreground">{filtered.length} empresas</span>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Nenhuma empresa MEI ativa encontrada.</div>
        ) : (
          <div className="divide-y">
            {rows.map(c => { const st = statusOf(c.id); const p = pays[c.id]; return (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{formatClientLabel(c)}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{fmtCnpj(c.document)}</span>
                    {st === 'pago' ? (
                      <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/15">
                        Pago{p?.data_pagamento ? ` em ${fmtDate(p.data_pagamento)}` : ''}{p?.valor_pago ? ` • ${fmtBRL(p.valor_pago)}` : ''}
                      </Badge>
                    ) : st === 'vencido' ? (
                      <Badge variant="destructive">Vencida</Badge>
                    ) : (
                      <Badge className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/15">Em aberto</Badge>
                    )}
                    {!p && <span>(não consultado)</span>}
                    {p?.mensagem && st !== 'pago' && (
                      <span className="inline-flex items-center gap-1 text-destructive" title={p.mensagem}>
                        <AlertTriangle className="h-3 w-3" /> Aviso da Receita
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="icon" variant="ghost" aria-label="Atualizar situação" title="Atualizar situação"
                    disabled={!c.document || statusBusy === c.id || sync.running} onClick={() => refreshClick(c)}>
                    <RefreshCw className={cn('h-4 w-4', statusBusy === c.id && 'animate-spin')} />
                  </Button>

                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => quick(c, 'das')}>
                    {busy === `${c.id}:das` ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} DAS {mes}/{ano}
                  </Button>
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => quick(c, 'ccmei')}>
                    {busy === `${c.id}:ccmei` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />} CCMEI
                  </Button>
                  <Button size="sm" onClick={() => setPanel(c)}><Terminal className="h-4 w-4" /> Comandos</Button>
                </div>
              </div>
            ); })}
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="icon" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span>{page + 1} de {pages}</span>
          <Button size="icon" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
        </TabsContent>
      </Tabs>

      {panel && <CommandsDialog client={panel} periodo={`${ano}${mes}`} ano={ano} onClose={() => setPanel(null)} run={run} errorOf={errorOf} />}
    </div>
  );
}

function CommandsDialog({ client, periodo, ano, onClose, run, errorOf }: {
  client: Client; periodo: string; ano: string; onClose: () => void;
  run: (c: Client, s: Svc, v: Record<string, string>) => Promise<any>; errorOf: (d: any) => string | null;
}) {
  const [svcKey, setSvcKey] = useState(SERVICES[0].idServico);
  const svc = SERVICES.find(s => s.idServico === svcKey)!;
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const cnpj = (client.document || '').replace(/\D/g, '').slice(0, 8);
    const d: Record<string, string> = {};
    for (const f of svc.fields) {
      if (f.key === 'cnpjBasico') d[f.key] = cnpj;
      else if (f.key === 'periodoApuracao' || f.key === 'parcelaParaEmitir' || f.key === 'anoMesParcela') d[f.key] = periodo;
      else if (f.key === 'anoCalendario') d[f.key] = ano;
      else d[f.key] = '';
    }
    setValues(d); setResult(null); setErr(null);
  }, [svcKey, client, periodo, ano]);

  const pdf = result ? walkForPdf(result) : null;

  async function execute() {
    if (svc.fields.some(f => !values[f.key]?.trim())) { setErr('Preencha todos os campos.'); return; }
    setLoading(true); setErr(null); setResult(null);
    try {
      const data = await run(client, svc, values);
      const parsed = parseDeep(data);
      setResult(parsed);
      const e = errorOf(data); if (e) setErr(e);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="text-base">Comandos MEI — {formatClientLabel(client)}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-3">
            {GROUPS.map(g => (
              <div key={g}>
                <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">{g}</div>
                <div className="flex flex-wrap gap-1.5">
                  {SERVICES.filter(s => s.group === g).map(s => (
                    <button key={s.idServico} onClick={() => setSvcKey(s.idServico)}
                      className={cn('text-xs px-2.5 py-1 rounded-full border transition-colors',
                        s.idServico === svcKey ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted')}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="text-sm font-medium">{svc.label} <span className="text-xs text-muted-foreground">({svc.idSistema}/{svc.idServico})</span></div>
            {svc.fields.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-2">
                {svc.fields.map(f => (
                  <label key={f.key} className="text-xs space-y-1">
                    <span className="text-muted-foreground">{f.label}</span>
                    <Input value={values[f.key] || ''} placeholder={f.placeholder} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} />
                  </label>
                ))}
              </div>
            )}
            <Button onClick={execute} disabled={loading} className="w-full sm:w-auto">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Executar
            </Button>
          </div>

          {err && <div className="text-sm rounded-md border border-destructive/40 bg-destructive/10 text-destructive p-3">{err}</div>}
          {pdf && (
            <Button variant="outline" onClick={() => openPdf(pdf, `${svc.idServico}_${safe(client.company_name)}.pdf`)}>
              <FileDown className="h-4 w-4" /> Abrir PDF
            </Button>
          )}
          {result && !pdf && (
            <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-80 whitespace-pre-wrap break-all">
              {JSON.stringify(result?.data?.dados ?? result?.data ?? result, null, 2)}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
