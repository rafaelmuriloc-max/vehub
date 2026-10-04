import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Bell, CalendarDays, ChevronDown, FileDown, FileText, Home, KeyRound, LogOut, Megaphone, User, Users, BarChart3, Receipt } from 'lucide-react';
import logoVelocita from '@/assets/logo_velocita.jpeg.asset.json';
import PortalPersonnel from '@/components/portal/PortalPersonnel';
import { modulesFor } from '@/lib/portal';
import { limiteAnual, faixaDe } from '@/lib/meiLimit';
import { pctChange } from '@/lib/portalDashboard';
import { cn } from '@/lib/utils';
import { brl, MONTHS, DueItem, DocItem, SectionCard, KpiCard, Trend, FiscalCalendar, RevenueChart, RecentDocuments, UpcomingDues } from '@/components/portal/PortalWidgets';

type Company = { id: string; company_name: string; document: string | null; tax_regime: string | null; opening_date: string | null };
type Nota = { id: string; invoice_number: string | null; issue_date: string | null; total_value: number | null; status: string | null; emitter_name: string | null; kind: 'NF-e' | 'NFC-e' | 'NFS-e' };
type View = 'dashboard' | 'calendario' | 'documentos' | 'notas' | 'pessoal' | 'perfil';

const db = supabase as any;
const isCancelled = (s: string | null) => (s || '').toLowerCase().includes('cancel');
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const iso = (d: Date) => `${ym(d)}-${String(d.getDate()).padStart(2, '0')}`;

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

async function loadNotas(clientId: string, direction: 'saida' | 'entrada', from: string): Promise<Nota[]> {
  const q = (t: string) => db.from(t).select('id, invoice_number, issue_date, total_value, status, emitter_name').eq('client_id', clientId).eq('direction', direction).gte('issue_date', from).order('issue_date', { ascending: false }).limit(1000);
  const [nfe, nfce] = await Promise.all([q('nfe_invoices'), q('nfce_invoices')]);
  return [
    ...((nfe.data as any[]) || []).map(n => ({ ...n, kind: 'NF-e' as const })),
    ...((nfce.data as any[]) || []).map(n => ({ ...n, kind: 'NFC-e' as const })),
  ].sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || ''));
}

function NotasList({ notas, showEmitter }: { notas: Nota[]; showEmitter?: boolean }) {
  if (!notas.length) return <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma nota encontrada.</p>;
  return (
    <div className="divide-y divide-border">
      {notas.slice(0, 200).map(n => (
        <div key={n.kind + n.id} className="flex items-start sm:items-center gap-3 py-3 sm:py-2 text-sm">
          <Badge variant="outline" className="shrink-0">{n.kind}</Badge>
          <div className="flex-1 min-w-0">
            <p className="break-words sm:truncate">Nº {n.invoice_number || '—'}{(showEmitter || n.kind === 'NFS-e') && n.emitter_name ? ` · ${n.emitter_name}` : ''}</p>
            <p className="text-xs text-muted-foreground">{n.issue_date ? n.issue_date.slice(0, 10).split('-').reverse().join('/') : '—'}{isCancelled(n.status) ? ' · Cancelada' : ''}</p>
          </div>
          <span className="font-medium tabular-nums shrink-0">{brl(Number(n.total_value) || 0)}</span>
        </div>
      ))}
    </div>
  );
}

type Periodo = 'mes' | 'mes_passado' | '3m' | 'ano' | 'custom';
function periodRange(p: Periodo, de?: Date, ate?: Date): [string, string] | null {
  const t = new Date(); const y = t.getFullYear(), m = t.getMonth();
  if (p === 'mes') return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];
  if (p === 'mes_passado') return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
  if (p === '3m') return [iso(new Date(y, m - 2, 1)), iso(new Date(y, m + 1, 0))];
  if (p === 'ano') return [iso(new Date(y, 0, 1)), iso(new Date(y, 11, 31))];
  if (!de || !ate || de > ate) return null;
  return [iso(de), iso(ate)];
}

function DateField({ label, value, onChange }: { label: string; value?: Date; onChange: (d?: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('h-11 w-full sm:w-44 justify-start font-normal', !value && 'text-muted-foreground')} aria-label={label}>
          <CalendarDays className="h-4 w-4 mr-2" />{label}: {value ? format(value, 'dd/MM/yyyy') : 'escolher'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

function NotasView({ clientId }: { clientId: string }) {
  const [tab, setTab] = useState<'emitidas' | 'recebidas'>('emitidas');
  const [q, setQ] = useState('');
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [de, setDe] = useState<Date | undefined>();
  const [ate, setAte] = useState<Date | undefined>();
  const [base, setBase] = useState<Nota[]>([]);
  const [loadingN, setLoadingN] = useState(false);
  const range = periodRange(periodo, de, ate);
  const rKey = range?.join('|') ?? '';
  useEffect(() => {
    if (!range) { setBase([]); return; }
    let alive = true; setLoadingN(true);
    const sel = (t: string) => db.from(t).select('id, invoice_number, issue_date, total_value, status, emitter_name').eq('client_id', clientId).eq('direction', tab === 'emitidas' ? 'saida' : 'entrada').gte('issue_date', range[0]).lte('issue_date', range[1] + 'T23:59:59').order('issue_date', { ascending: false }).limit(1000);
    const dir = tab === 'emitidas' ? 'saida' : 'entrada';
    Promise.all([sel('nfe_invoices'), sel('nfce_invoices'), db.rpc('portal_nfse', { _client_id: clientId, _from: range[0], _to: range[1] })]).then(([a, b, s]: any[]) => {
      if (!alive) return;
      const nfse = ((s.data as any[]) || []).filter(n => n.direction === dir).map(n => ({ id: n.id, invoice_number: n.invoice_number, issue_date: n.issue_date, total_value: n.gross_value, status: n.status, emitter_name: n.counterpart_name || n.counterpart_cnpj, kind: 'NFS-e' as const }));
      setBase([...(a.data || []).map((n: any) => ({ ...n, kind: 'NF-e' })), ...(b.data || []).map((n: any) => ({ ...n, kind: 'NFC-e' })), ...nfse].sort((x, y) => (y.issue_date || '').localeCompare(x.issue_date || '')));
      setLoadingN(false);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, tab, rKey]);
  const [tipo, setTipo] = useState<'todas' | 'produtos' | 'servicos'>('todas');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const byTipo = tipo === 'todas' ? base : base.filter(n => (n.kind === 'NFS-e') === (tipo === 'servicos'));
    return s ? byTipo.filter(n => String(n.invoice_number || '').toLowerCase().includes(s) || (n.emitter_name || '').toLowerCase().includes(s)) : byTipo;
  }, [base, q, tipo]);
  const validas = list.filter(n => !isCancelled(n.status));
  const total = validas.reduce((a, n) => a + (Number(n.total_value) || 0), 0);
  return (
    <Tabs value={tab} onValueChange={v => setTab(v as any)}>
      <TabsList className="grid w-full grid-cols-2 h-auto [&>button]:min-h-10">
        <TabsTrigger value="emitidas">Emitidas</TabsTrigger>
        <TabsTrigger value="recebidas">Recebidas</TabsTrigger>
      </TabsList>
      <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap gap-2">
        <Select value={periodo} onValueChange={v => setPeriodo(v as Periodo)}>
          <SelectTrigger className="h-11 w-full sm:w-48" aria-label="Período"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Este mês</SelectItem>
            <SelectItem value="mes_passado">Mês passado</SelectItem>
            <SelectItem value="3m">Últimos 3 meses</SelectItem>
            <SelectItem value="ano">Este ano</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tipo} onValueChange={v => setTipo(v as any)}>
          <SelectTrigger className="h-11 w-full sm:w-40" aria-label="Tipo de nota"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="produtos">Produtos</SelectItem>
            <SelectItem value="servicos">Serviços</SelectItem>
          </SelectContent>
        </Select>
        {periodo === 'custom' && <>
          <DateField label="De" value={de} onChange={setDe} />
          <DateField label="Até" value={ate} onChange={setAte} />
        </>}
      </div>
      {periodo === 'custom' && de && ate && de > ate && <p className="mt-2 text-sm text-destructive">A data "De" deve ser anterior ou igual à data "Até".</p>}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
        <SectionCard><p className="text-xs text-muted-foreground">Notas válidas</p><p className="text-xl font-bold tabular-nums">{validas.length}</p></SectionCard>
        <SectionCard><p className="text-xs text-muted-foreground">Valor total</p><p className="text-xl font-bold tabular-nums break-words">{brl(total)}</p></SectionCard>
      </div>
      <Input className="mt-3 h-11" placeholder={tab === 'recebidas' ? 'Buscar por número ou emitente' : 'Buscar por número ou destinatário'} value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar notas" />
      <SectionCard className="mt-3">{loadingN ? <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p> : !range ? <p className="text-sm text-muted-foreground py-6 text-center">Escolha as datas De e Até.</p> : <NotasList notas={list} showEmitter={tab === 'recebidas'} />}</SectionCard>
    </Tabs>
  );
}

export default function Portal() {
  const { user, loading, isClient, profile, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [view, setView] = useState<View>('dashboard');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeId, setActiveId] = useState('');
  const [emitidas, setEmitidas] = useState<Nota[]>([]);
  const [recebidas, setRecebidas] = useState<Nota[]>([]);
  const [avisos, setAvisos] = useState<any[]>([]);
  const [simples, setSimples] = useState<any[]>([]);
  const [obrig, setObrig] = useState<any[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [range, setRange] = useState<6 | 12>(6);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const today = useMemo(() => new Date(), []);
  const ano = today.getFullYear();

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
    const from = iso(new Date(today.getFullYear() - 2, today.getMonth(), 1));
    loadNotas(activeId, 'saida', from).then(setEmitidas);
    loadNotas(activeId, 'entrada', from).then(setRecebidas);
    db.from('simples_nacional_competencias').select('id, competencia, valor_das, data_vencimento, status, das_pdf_base64').eq('client_id', activeId).gte('ano', ano - 1).order('competencia', { ascending: false }).then(({ data }: any) => setSimples(data || []));
    db.rpc('portal_due_dates', { _client_id: activeId, _from: iso(new Date(today.getFullYear(), today.getMonth() - 3, 1)), _to: iso(new Date(today.getFullYear(), today.getMonth() + 4, 0)) }).then(({ data }: any) => setObrig(data || []));
    db.rpc('portal_documents', { _client_id: activeId }).then(({ data }: any) => setDocs(((data as any[]) || []).map(d => ({ id: d.id, label: d.label, area: d.area, ref: d.reference_month, file_url: d.file_url, file_name: d.file_name || d.file_url?.split('/').pop() || 'arquivo', created_at: d.created_at }))));
  }, [activeId, today, ano]);

  const validas = useMemo(() => emitidas.filter(n => !isCancelled(n.status)), [emitidas]);
  const porMes = useMemo(() => { const m = new Map<string, number>(); validas.forEach(n => { if (!n.issue_date) return; const k = n.issue_date.slice(0, 7); m.set(k, (m.get(k) || 0) + (Number(n.total_value) || 0)); }); return m; }, [validas]);
  const monthSum = (offset: number) => porMes.get(ym(new Date(today.getFullYear(), today.getMonth() + offset, 1))) || 0;
  const chart = Array.from({ length: range }, (_, i) => { const off = i - range + 1; const d = new Date(today.getFullYear(), today.getMonth() + off, 1); return { label: MONTHS[d.getMonth()], value: monthSum(off) }; });
  const periodTotal = chart.reduce((a, b) => a + b.value, 0);
  const prevYearTotal = Array.from({ length: range }, (_, i) => monthSum(i - range + 1 - 12)).reduce((a, b) => a + b, 0);
  const totalAno = Array.from({ length: today.getMonth() + 1 }, (_, i) => monthSum(-i)).reduce((a, b) => a + b, 0);

  const dues: DueItem[] = useMemo(() => {
    const list: DueItem[] = obrig.map((o: any) => ({ id: o.id, name: o.name, due: o.due_date, competencia: o.reference_month ? `Competência ${o.reference_month.slice(5, 7)}/${o.reference_month.slice(0, 4)}` : '', valor: null, done: o.status === 'done' } as any));
    simples.forEach((s: any) => { if (s.data_vencimento) list.push({ id: 'sn' + s.id, name: 'DAS', due: s.data_vencimento, competencia: `Simples Nacional · ${s.competencia}`, valor: s.valor_das != null ? Number(s.valor_das) : null }); });
    return list.sort((a, b) => a.due.localeCompare(b.due));
  }, [obrig, simples]);
  const in30 = iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30));
  const upcoming = dues.filter(d => d.due >= iso(today) && d.due <= in30 && !(d as any).done);
  const pendentesMes = obrig.filter((o: any) => o.status !== 'done' && o.reference_month && o.due_date?.slice(0, 7) === ym(today)).length;

  const myAvisos = avisos.filter(a => a.audience === 'all' || (a.audience === 'client' && a.client_id === activeId) || (a.audience === 'regime' && a.tax_regime === company?.tax_regime));
  const initials = (profile?.full_name || user?.email || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s: string) => s[0]?.toUpperCase()).join('');

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

  async function openDoc(d: DocItem, download: boolean) {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(d.file_url, 120, download ? { download: d.file_name } : undefined);
    if (error || !data) return toast({ title: 'Não foi possível abrir', description: 'Arquivo indisponível. Fale com o escritório.', variant: 'destructive' });
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  const limite = limiteAnual(ano, company?.opening_date ?? null);
  const faixa = faixaDe(totalAno, limite);
  const NAV: { key: View; label: string; icon: any }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: Home }, { key: 'calendario', label: 'Calendário', icon: CalendarDays },
    { key: 'documentos', label: 'Documentos', icon: FileText }, { key: 'notas', label: 'Notas', icon: Receipt }, { key: 'pessoal', label: 'Pessoal', icon: Users }, { key: 'perfil', label: 'Perfil', icon: User },
  ];

  const meiBlock = modules.includes('das_mei') && (
    <SectionCard className="space-y-3">
      <h2 className="text-lg font-bold text-portal-ink">MEI</h2>
      <div className="space-y-1">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm"><span>Limite anual {ano}</span><span className="tabular-nums">{brl(totalAno)} de {brl(limite)}</span></div>
        <div className="h-3 rounded-full bg-muted overflow-hidden"><div className={cn('h-full', faixa === 'normal' ? 'bg-portal-blue' : 'bg-destructive')} style={{ width: `${Math.min(100, limite ? (totalAno / limite) * 100 : 100)}%` }} /></div>
        <p className="text-xs text-muted-foreground">{faixa === 'normal' ? `Disponível: ${brl(Math.max(0, limite - totalAno))}` : faixa === 'alerta' ? 'Atenção: acima de 80% do limite. Fale com o escritório.' : 'Limite ultrapassado. Fale com o escritório.'}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="h-11 sm:h-10 w-full sm:w-32" aria-label="Mês do DAS"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1).padStart(2, '0')}>{m}/{ano}</SelectItem>)}</SelectContent>
        </Select>
        <Button className="h-11 sm:h-10 bg-portal-blue hover:bg-portal-blue-strong text-primary-foreground" onClick={() => emitir('das')} disabled={!!busy}><FileDown className="h-4 w-4 mr-1" />{busy === 'das' ? 'Gerando...' : 'Emitir DAS'}</Button>
        <Button className="h-11 sm:h-10" variant="outline" onClick={() => emitir('ccmei')} disabled={!!busy}><FileDown className="h-4 w-4 mr-1" />{busy === 'ccmei' ? 'Gerando...' : 'Emitir CCMEI'}</Button>
      </div>
    </SectionCard>
  );

  return (
    <div className="min-h-[100dvh] bg-portal-bg overflow-x-hidden text-portal-ink">
      <header className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border/50 shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto max-w-5xl flex flex-wrap md:flex-nowrap items-center gap-x-2 gap-y-2 sm:gap-x-3 px-3 sm:px-4 py-2">
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <img src={logoVelocita.url} alt="Velocitä" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
            <span className="leading-tight min-w-0"><span className="block font-bold text-base sm:text-lg truncate">Velocitä</span><span className="block text-[11px] sm:text-xs text-muted-foreground truncate">Portal do Cliente</span></span>
          </div>
          {companies.length > 0 && (
            <Select value={activeId} onValueChange={setActiveId} disabled={companies.length < 2}>
              <SelectTrigger className={cn('order-last md:order-none basis-full md:basis-auto h-11 w-full md:flex-1 md:max-w-sm min-w-0 bg-portal-bg md:bg-card items-center [&>span]:line-clamp-none disabled:opacity-100 disabled:cursor-default', companies.length < 2 && '[&>svg]:hidden')} aria-label="Empresa">
                <span className="min-w-0 flex-1 text-left text-sm font-semibold truncate">{company?.company_name}</span>
              </SelectTrigger>
              <SelectContent className="max-w-[calc(100vw-2rem)]">{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-11 w-11 shrink-0 ml-auto" aria-label="Avisos">
                <Bell className="h-5 w-5" />
                {myAvisos.length > 0 && <span className="absolute top-1.5 right-1.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">{myAvisos.length}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 max-w-[calc(100vw-1.5rem)] max-h-96 overflow-y-auto p-0">
              <p className="px-4 py-3 font-semibold border-b">Avisos da contabilidade</p>
              {myAvisos.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum aviso no momento.</p>}
              {myAvisos.map(a => <div key={a.id} className="px-4 py-3 border-b last:border-0"><p className="text-sm font-medium break-words">{a.title}</p><p className="text-xs text-muted-foreground whitespace-pre-line [overflow-wrap:anywhere]">{a.body}</p></div>)}
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-blue" aria-label="Menu do usuário">
                <span className="h-10 w-10 rounded-full bg-portal-ink text-primary-foreground flex items-center justify-center text-sm font-semibold">{initials}</span>
                <ChevronDown className="h-4 w-4 hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="max-w-[220px] truncate">{profile?.full_name || user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/change-password')}><KeyRound className="h-4 w-4 mr-2" />Trocar senha</DropdownMenuItem>
              <DropdownMenuItem onClick={signOut}><LogOut className="h-4 w-4 mr-2" />Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <nav className="hidden md:flex mx-auto max-w-5xl px-4 gap-1">
          {NAV.map(n => <button key={n.key} onClick={() => setView(n.key)} className={cn('flex items-center gap-2 px-3 py-2 text-sm border-b-2 -mb-px', view === n.key ? 'border-portal-blue text-portal-blue font-semibold' : 'border-transparent text-muted-foreground hover:text-portal-ink')}><n.icon className="h-4 w-4" />{n.label}</button>)}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl p-3 sm:p-4 space-y-4 pb-28 md:pb-8">
        {companies.length === 0 ? (
          <SectionCard><p className="py-8 text-center text-muted-foreground">Nenhuma empresa vinculada ao seu acesso. Fale com o escritório.</p></SectionCard>
        ) : view === 'dashboard' ? (
          <>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <KpiCard onClick={() => setView('calendario')} icon={<CalendarDays className="h-6 w-6" />} iconClass="bg-portal-blue-soft text-portal-blue" title="Próximos vencimentos" value={upcoming.length} hint="Nos próximos 30 dias" />
              <KpiCard onClick={() => setView('calendario')} icon={<FileText className="h-6 w-6" />} iconClass="bg-warning/10 text-warning" title="Documentos pendentes" value={pendentesMes} hint="Aguardando envio" />
              <KpiCard onClick={() => setView('notas')} icon={<BarChart3 className="h-6 w-6" />} iconClass="bg-success/10 text-success" title="Faturamento do mês" value={brl(monthSum(0))} hint={<><Trend pct={pctChange(monthSum(0), monthSum(-1))} /> <span className="hidden sm:inline">em relação ao mês anterior</span></>} />
            </div>
            {meiBlock}
            <FiscalCalendar items={dues} month={calMonth} onMonth={setCalMonth} />
            <RevenueChart data={chart} total={periodTotal} pct={pctChange(periodTotal, prevYearTotal)} range={range} onRange={setRange} />
            <RecentDocuments docs={docs} onOpen={openDoc} onSeeAll={() => setView('documentos')} />
            <UpcomingDues items={upcoming} onSeeAll={() => setView('calendario')} />
          </>
        ) : view === 'calendario' ? (
          <>
            <FiscalCalendar items={dues} month={calMonth} onMonth={setCalMonth} />
            <UpcomingDues items={upcoming} limit={50} />
          </>
        ) : view === 'documentos' ? (
          <Tabs defaultValue="docs">
            <TabsList className="flex w-full overflow-x-auto justify-start h-auto [&>button]:shrink-0 [&>button]:min-h-10">
              <TabsTrigger value="docs">Documentos</TabsTrigger>
              {modules.includes('das_simples') && <TabsTrigger value="guias">Guias DAS</TabsTrigger>}
            </TabsList>
            <TabsContent value="docs" className="mt-4"><RecentDocuments docs={docs} onOpen={openDoc} limit={200} /></TabsContent>
            <TabsContent value="guias" className="mt-4">
              <SectionCard className="divide-y divide-border/70">
                {simples.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma guia disponibilizada pelo escritório.</p>}
                {simples.map(s => (
                  <div key={s.id} className="flex items-center gap-2 sm:gap-3 py-2 text-sm">
                    <div className="flex-1 min-w-0"><p className="truncate font-medium">{s.competencia}</p><p className="text-xs text-muted-foreground">{s.data_vencimento ? `Vence ${s.data_vencimento.split('-').reverse().join('/')}` : ''} · {s.status}</p></div>
                    <span className="tabular-nums shrink-0">{s.valor_das != null ? brl(Number(s.valor_das)) : '—'}</span>
                    {s.das_pdf_base64 && <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0" aria-label="Baixar DAS" onClick={() => openPdf(s.das_pdf_base64, `DAS_${s.competencia}.pdf`)}><FileDown className="h-4 w-4" /></Button>}
                  </div>
                ))}
              </SectionCard>
            </TabsContent>
          </Tabs>
        ) : view === 'notas' ? (
          activeId ? <NotasView clientId={activeId} /> : null
        ) : view === 'pessoal' ? (
          activeId ? <PortalPersonnel clientId={activeId} /> : null
        ) : (
          <>
            <SectionCard className="flex items-center gap-4">
              <span className="h-14 w-14 rounded-full bg-portal-ink text-primary-foreground flex items-center justify-center text-lg font-semibold shrink-0">{initials}</span>
              <div className="min-w-0"><p className="font-semibold break-words">{profile?.full_name || 'Cliente'}</p><p className="text-sm text-muted-foreground break-all">{user.email}</p></div>
            </SectionCard>
            <SectionCard className="space-y-2">
              <p className="font-semibold">Empresas</p>
              {companies.map(c => <p key={c.id} className="text-sm break-words">{c.company_name} <span className="text-muted-foreground">· {c.document} · {c.tax_regime || 'Regime não informado'}</span></p>)}
            </SectionCard>
            <SectionCard className="space-y-2">
              <p className="font-semibold">Avisos da contabilidade</p>
              {myAvisos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum aviso no momento.</p>}
              {myAvisos.map(a => <div key={a.id} className="flex gap-3 py-2"><Megaphone className="h-5 w-5 text-portal-blue shrink-0" /><div className="min-w-0"><p className="font-medium break-words">{a.title}</p><p className="text-sm text-muted-foreground whitespace-pre-line [overflow-wrap:anywhere]">{a.body}</p></div></div>)}
            </SectionCard>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" className="h-11" onClick={() => navigate('/change-password')}><KeyRound className="h-4 w-4 mr-2" />Trocar senha</Button>
              <Button variant="outline" className="h-11" onClick={signOut}><LogOut className="h-4 w-4 mr-2" />Sair</Button>
            </div>
          </>
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-card border-t border-border/60 grid grid-cols-6" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV.map(n => (
          <button key={n.key} onClick={() => { setView(n.key); window.scrollTo({ top: 0 }); }} className={cn('flex flex-col items-center gap-0.5 py-2 min-h-14 text-[10px] min-w-0', view === n.key ? 'text-portal-blue font-semibold' : 'text-muted-foreground')} aria-current={view === n.key ? 'page' : undefined}>
            <n.icon className="h-5 w-5" /><span className="truncate max-w-full">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
