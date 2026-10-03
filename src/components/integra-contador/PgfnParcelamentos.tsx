import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ClientCombobox } from '@/components/ClientCombobox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Plus, Search, ChevronDown, Building2, ExternalLink, Copy, Pencil, Trash2, Paperclip,
  FileDown, MessageCircle, CloudOff, PenLine, Eye, CalendarDays,
} from 'lucide-react';
import {
  negociacaoSchema, findDuplicate, isPgfnManual, buildRow, parseMoney, parseIntOrNull,
  PGFN_MANUAL_MODALIDADE, PGFN_SITUACOES, SISPAR_URL,
} from '@/lib/pgfnNegociacao';

type Client = { id: string; company_name: string; sci_code?: string | null; document: string | null };
type Row = {
  id: string; client_id: string; origem: string; modalidade: string; modalidade_label: string | null;
  numero_parcelamento: string | null; situacao: string | null; data_pedido: string | null;
  valor_total: number | null; parcelas_pagas: number | null; parcelas_total: number | null;
  raw_response: any; consulted_at: string;
};
type FormState = {
  id: string | null; client_id: string; numero: string; modalidade: string; situacao: string;
  valor_consolidado: string; parcelas_total: string; parcelas_pagas: string;
  valor_proxima_parcela: string; vencimento_proxima: string; data_adesao: string; observacoes: string;
};

const EMPTY: FormState = { id: null, client_id: '', numero: '', modalidade: '', situacao: '', valor_consolidado: '', parcelas_total: '', parcelas_pagas: '', valor_proxima_parcela: '', vencimento_proxima: '', data_adesao: '', observacoes: '' };
const NI = 'Não informado';
const brl = (v: number | null | undefined) => (v == null ? NI : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const dateBR = (s: string | null | undefined) => (s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : NI);
const fmtCnpj = (d: string | null) => {
  const x = (d || '').replace(/\D/g, '');
  return x.length === 14 ? `${x.slice(0, 2)}.${x.slice(2, 5)}.${x.slice(5, 8)}/${x.slice(8, 12)}-${x.slice(12)}` : d || NI;
};
const toInput = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','));
const canon = (p?: string | null) => {
  let d = (p || '').replace(/\D/g, '');
  if ((d.length === 10 || d.length === 11) && !d.startsWith('55')) d = '55' + d;
  if (d.length === 12 && d.startsWith('55') && ['6', '7', '8', '9'].includes(d[4])) d = d.slice(0, 4) + '9' + d.slice(4);
  return d;
};
const sitTone = (s: string | null) =>
  !s || s === NI ? 'bg-muted text-muted-foreground'
    : /atraso|rescind|cancel/i.test(s) ? 'bg-destructive/15 text-destructive'
      : /suspens/i.test(s) ? 'bg-warning/15 text-warning'
        : /liquidad/i.test(s) ? 'bg-info/15 text-info' : 'bg-success/15 text-success';

const F = ({ id, label, children, err }: { id: string; label: string; children: React.ReactNode; err?: string }) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {err && <p id={`${id}-err`} role="alert" className="text-xs text-destructive">{err}</p>}
    </div>
  );

export default function PgfnParcelamentos() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sit, setSit] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [send, setSend] = useState<{ row: Row; phones: { label: string; phone: string; conv: string | null }[]; sel: number; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachFor, setAttachFor] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const [{ data: c, error: e1 }, { data: r, error: e2 }] = await Promise.all([
        supabase.from('clients').select('id, company_name, sci_code, document').order('company_name'),
        supabase.from('parcelamento_results' as any).select('*').eq('origem', 'PGFN').eq('modalidade', PGFN_MANUAL_MODALIDADE).order('consulted_at', { ascending: false }),
      ]);
      if (e1 || e2) throw e1 || e2;
      setClients((c || []) as Client[]);
      setRows(((r || []) as any as Row[]).filter(isPgfnManual));
    } catch (e: any) {
      setLoadError(e?.message || 'Falha ao carregar');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);

  const groups = useMemo(() => {
    const s = search.trim().toLowerCase();
    const sd = s.replace(/\D/g, '');
    const m = new Map<string, Row[]>();
    rows.forEach(r => {
      const c = clientMap.get(r.client_id);
      if (!c) return;
      if (sit !== 'all' && (r.situacao || NI) !== sit) return;
      if (s) {
        const hay = `${c.company_name} ${c.sci_code || ''} ${r.numero_parcelamento || ''} ${r.modalidade_label || ''}`.toLowerCase();
        const docOk = sd.length >= 3 && ((c.document || '').replace(/\D/g, '').includes(sd) || (r.numero_parcelamento || '').replace(/\D/g, '').includes(sd));
        if (!hay.includes(s) && !docOk) return;
      }
      m.set(r.client_id, [...(m.get(r.client_id) || []), r]);
    });
    return [...m.entries()].map(([id, list]) => ({ client: clientMap.get(id)!, list }))
      .sort((a, b) => a.client.company_name.localeCompare(b.client.company_name));
  }, [rows, clientMap, search, sit]);

  const summary = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const in7 = now.getTime() + 7 * 86400000;
    const vencs = rows.map(r => r.raw_response?.vencimento_proxima).filter(Boolean).map((d: string) => new Date(`${d}T12:00:00`).getTime());
    return {
      empresas: new Set(rows.map(r => r.client_id)).size,
      negociacoes: rows.length,
      atraso: rows.filter(r => /atraso/i.test(r.situacao || '')).length,
      vence7: vencs.filter(t => t >= now.getTime() && t <= in7).length,
      semVenc: rows.filter(r => !r.raw_response?.vencimento_proxima).length,
    };
  }, [rows]);

  function openNew(clientId = '') { setErrors({}); setForm({ ...EMPTY, client_id: clientId }); }
  function openEdit(r: Row) {
    setErrors({});
    const raw = r.raw_response || {};
    setForm({
      id: r.id, client_id: r.client_id, numero: r.numero_parcelamento || '', modalidade: r.modalidade_label || '',
      situacao: r.situacao || '', valor_consolidado: toInput(r.valor_total), parcelas_total: r.parcelas_total?.toString() ?? '',
      parcelas_pagas: r.parcelas_pagas?.toString() ?? '', valor_proxima_parcela: toInput(raw.valor_proxima_parcela),
      vencimento_proxima: raw.vencimento_proxima || '', data_adesao: r.data_pedido?.slice(0, 10) || '', observacoes: raw.observacoes || '',
    });
  }

  async function save() {
    if (!form || !user) return;
    const candidate = {
      client_id: form.client_id, numero: form.numero, modalidade: form.modalidade.trim() || null,
      situacao: form.situacao || null, valor_consolidado: parseMoney(form.valor_consolidado),
      parcelas_total: parseIntOrNull(form.parcelas_total), parcelas_pagas: parseIntOrNull(form.parcelas_pagas),
      valor_proxima_parcela: parseMoney(form.valor_proxima_parcela), vencimento_proxima: form.vencimento_proxima || null,
      data_adesao: form.data_adesao || null, observacoes: form.observacoes.trim() || null,
    };
    const parsed = negociacaoSchema.safeParse(candidate);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      parsed.error.issues.forEach(i => { const k = String(i.path[0]); if (!e[k]) e[k] = i.message; });
      setErrors(e); return;
    }
    setSaving(true); setErrors({});
    try {
      // Acesso à empresa: o mesmo padrão efetivo do projeto (RLS de clients para o usuário autenticado).
      const { data: acc, error: accErr } = await supabase.from('clients').select('id').eq('id', parsed.data.client_id).maybeSingle();
      if (accErr) throw accErr;
      if (!acc) { setErrors({ client_id: 'Você não tem acesso a esta empresa' }); return; }
      // Duplicidade: consulta atual do banco, não só a lista em tela.
      const { data: existing, error: exErr } = await supabase.from('parcelamento_results' as any)
        .select('id, client_id, origem, numero_parcelamento').eq('client_id', parsed.data.client_id).eq('origem', 'PGFN');
      if (exErr) throw exErr;
      if (findDuplicate((existing || []) as any, parsed.data.client_id, parsed.data.numero, form.id)) {
        setErrors({ numero: 'Já existe uma negociação PGFN com este número para esta empresa' }); return;
      }
      const prev = form.id ? rows.find(r => r.id === form.id)?.raw_response : null;
      const row = buildRow(parsed.data, { id: user.id, nome: profile?.full_name || null }, prev);
      const q = form.id
        ? supabase.from('parcelamento_results' as any).update(row as any).eq('id', form.id).eq('origem', 'PGFN').eq('modalidade', PGFN_MANUAL_MODALIDADE)
        : supabase.from('parcelamento_results' as any).insert(row as any);
      const { error } = await q;
      if (error) throw error;
      toast({ title: form.id ? 'Negociação atualizada' : 'Negociação cadastrada', description: 'Registro manual salvo.' });
      setExpanded(p => new Set(p).add(parsed.data.client_id));
      setForm(null);
      await load();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(`del:${toDelete.id}`);
    const { error } = await supabase.from('parcelamento_results' as any).delete().eq('id', toDelete.id).eq('origem', 'PGFN').eq('modalidade', PGFN_MANUAL_MODALIDADE);
    setBusy(null); setToDelete(null);
    if (error) toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Negociação excluída' }); load(); }
  }

  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); toast({ title: `${what} copiado` }); }
    catch { toast({ title: `Não foi possível copiar ${what.toLowerCase()}`, variant: 'destructive' }); }
  }

  function pickPdf(r: Row) { setAttachFor(r); fileRef.current?.click(); }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = '';
    const r = attachFor; setAttachFor(null);
    if (!f || !r) return;
    if (f.type !== 'application/pdf' || f.size > 10 * 1024 * 1024) { toast({ title: 'Envie um PDF de até 10 MB', variant: 'destructive' }); return; }
    setBusy(`att:${r.id}`);
    try {
      const safe = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
      const path = `pgfn/${r.client_id}/${r.id}/${Date.now()}_${safe}`;
      const { error: up } = await supabase.storage.from('documents').upload(path, f, { contentType: 'application/pdf' });
      if (up) throw up;
      const raw = { ...(r.raw_response || {}), guia: { path, nome: f.name, anexado_em: new Date().toISOString(), enviado_em: null } };
      const { error } = await supabase.from('parcelamento_results' as any).update({ raw_response: raw } as any).eq('id', r.id).eq('origem', 'PGFN');
      if (error) throw error;
      toast({ title: 'Guia anexada', description: f.name });
      load();
    } catch (err: any) {
      toast({ title: 'Erro ao anexar guia', description: err?.message, variant: 'destructive' });
    } finally { setBusy(null); }
  }
  async function downloadGuia(r: Row) {
    const g = r.raw_response?.guia; if (!g?.path) return;
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(g.path, 120);
    if (error || !data) { toast({ title: 'Erro ao abrir guia', description: error?.message, variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function openSend(r: Row) {
    const c = clientMap.get(r.client_id);
    setBusy(`send:${r.id}`);
    try {
      const [{ data: convs }, { data: cli }, { data: deps }] = await Promise.all([
        supabase.from('chat_conversations').select('id, name, whatsapp_phone, is_group').eq('client_id', r.client_id).not('whatsapp_phone', 'is', null).limit(10),
        supabase.from('clients').select('contact_name, contact_phone, phone').eq('id', r.client_id).maybeSingle(),
        supabase.from('client_department_contacts').select('contact_name, contact_phone').eq('client_id', r.client_id),
      ]);
      const phones: { label: string; phone: string; conv: string | null }[] = [];
      const seen = new Set<string>();
      const add = (label: string, p: string | null | undefined, conv: string | null) => { const x = canon(p); if (x.length >= 12 && !seen.has(x)) { seen.add(x); phones.push({ label, phone: x, conv }); } };
      (convs || []).filter((x: any) => !x.is_group).forEach((x: any) => add(`${x.name || 'Conversa'} (Chat)`, x.whatsapp_phone, x.id));
      add((cli as any)?.contact_name || 'Contato principal', (cli as any)?.contact_phone, null);
      (deps || []).forEach((d: any) => add(d.contact_name || 'Contato do departamento', d.contact_phone, null));
      add('Telefone da empresa', (cli as any)?.phone, null);
      const raw = r.raw_response || {};
      setSend({
        row: r, phones, sel: 0,
        text: `Olá! Segue a guia da negociação PGFN nº ${r.numero_parcelamento} da empresa ${c?.company_name || ''}${raw.vencimento_proxima ? `, com vencimento em ${dateBR(raw.vencimento_proxima)}` : ''}${raw.valor_proxima_parcela != null ? `, no valor de ${brl(raw.valor_proxima_parcela)}` : ''}. Qualquer dúvida, estamos à disposição.`,
      });
    } finally { setBusy(null); }
  }
  async function confirmSend() {
    if (!send || !user) return;
    const opt = send.phones[send.sel]; const g = send.row.raw_response?.guia;
    if (!opt || !g?.path) return;
    setBusy('sending');
    try {
      let convId = opt.conv;
      if (!convId) {
        const { data: ex } = await supabase.from('chat_conversations').select('id, is_group').eq('whatsapp_phone', opt.phone);
        convId = (ex || []).find((x: any) => !x.is_group)?.id || null;
        if (!convId) {
          const { data: nc, error } = await supabase.from('chat_conversations').insert({ name: clientMap.get(send.row.client_id)?.company_name || opt.label, created_by: user.id, assigned_to: user.id, is_group: false, whatsapp_phone: opt.phone, client_id: send.row.client_id } as any).select('id').single();
          if (error || !nc) throw error || new Error('Falha ao criar conversa');
          await supabase.from('chat_participants').insert([{ conversation_id: nc.id, user_id: user.id }]);
          convId = nc.id;
        }
      }
      // Link temporário (7 dias) do arquivo privado — o bucket continua privado.
      const { data: signed, error: se } = await supabase.storage.from('documents').createSignedUrl(g.path, 7 * 86400);
      if (se || !signed) throw se || new Error('Falha ao gerar link da guia');
      if (send.text.trim()) {
        const { data: d1, error: e1 } = await supabase.functions.invoke('whatsapp-send-text', { body: { conversationId: convId, text: send.text.trim(), senderName: profile?.full_name || undefined, senderId: user.id } });
        if (e1 || (d1 as any)?.error) throw new Error((d1 as any)?.error || e1?.message);
      }
      const { data: d2, error: e2 } = await supabase.functions.invoke('whatsapp-send-media', { body: { conversationId: convId, type: 'document', mediaUrl: signed.signedUrl, fileName: g.nome || 'guia_pgfn.pdf', senderName: profile?.full_name || undefined, senderId: user.id } });
      if (e2 || (d2 as any)?.error) throw new Error((d2 as any)?.error || e2?.message);
      await supabase.from('parcelamento_results' as any).update({ raw_response: { ...send.row.raw_response, guia: { ...g, enviado_em: new Date().toISOString() } } } as any).eq('id', send.row.id).eq('origem', 'PGFN');
      toast({ title: 'Guia enviada no WhatsApp' });
      setSend(null); load();
    } catch (e: any) {
      toast({ title: 'Erro ao enviar', description: String(e?.message || e).slice(0, 200), variant: 'destructive' });
    } finally { setBusy(null); }
  }

  const inp = (k: keyof FormState, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Input id={`pgfn-${k}`} value={form![k] as string} onChange={e => setForm(f => f && { ...f, [k]: e.target.value })}
      aria-invalid={!!errors[k === 'numero' ? 'numero' : k]} aria-describedby={errors[k] ? `pgfn-${k}-err` : undefined} {...extra} />
  );

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={onFile} aria-hidden="true" tabIndex={-1} />

      <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex flex-col md:flex-row md:items-center gap-3">
        <CloudOff className="h-5 w-5 text-warning shrink-0" aria-hidden="true" />
        <div className="flex-1 text-sm">
          <div className="font-semibold text-foreground">Sincronização automática não configurada</div>
          <p className="text-muted-foreground">As negociações abaixo são cadastradas manualmente pela equipe. Nenhum dado é consultado na PGFN. Para emitir a guia, use o SISPAR (PGFN) e anexe o PDF aqui.</p>
        </div>
        <Button onClick={() => openNew()} className="shrink-0"><Plus className="h-4 w-4 mr-2" />Nova negociação</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: 'Empresas com negociação', v: summary.empresas, t: 'bg-info/10 text-info' },
          { l: 'Negociações cadastradas', v: summary.negociacoes, t: 'bg-success/10 text-success' },
          { l: 'Marcadas em atraso', v: summary.atraso, t: 'bg-destructive/10 text-destructive' },
          { l: 'Vencem nos próximos 7 dias', v: summary.vence7, t: 'bg-violet/10 text-violet', sub: summary.semVenc ? `${summary.semVenc} sem vencimento informado` : undefined },
        ].map(k => (
          <div key={k.l} className={`rounded-xl border p-4 ${k.t.split(' ')[0]}`}>
            <div className="text-2xl font-bold text-foreground">{k.v}</div>
            <div className="text-sm text-muted-foreground">{k.l}</div>
            {k.sub && <div className="text-xs text-muted-foreground mt-1">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-3 flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Label htmlFor="pgfn-search" className="sr-only">Buscar negociações PGFN</Label>
          <Input id="pgfn-search" placeholder="Buscar por empresa, CNPJ ou número da negociação..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <Select value={sit} onValueChange={setSit}>
          <SelectTrigger className="md:w-56 h-10" aria-label="Filtrar por situação"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            {PGFN_SITUACOES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center" role="status" aria-label="Carregando"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-3" role="alert">
          <span>Erro ao carregar: {loadError}</span><Button size="sm" variant="outline" onClick={load}>Tentar de novo</Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          {rows.length ? 'Nenhuma negociação encontrada com esses filtros.' : 'Nenhuma negociação PGFN cadastrada ainda.'}
        </div>
      ) : groups.map(({ client, list }) => {
        const open = expanded.has(client.id);
        return (
          <Collapsible key={client.id} open={open} onOpenChange={o => setExpanded(p => { const n = new Set(p); if (o) n.add(client.id); else n.delete(client.id); return n; })} className="rounded-xl border bg-card overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${open ? 'Recolher' : 'Expandir'} ${client.company_name}`}>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                  <span className="h-10 w-10 shrink-0 rounded-full bg-info/15 text-info flex items-center justify-center"><Building2 className="h-5 w-5" aria-hidden="true" /></span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-foreground truncate">{client.sci_code ? `${String(client.sci_code).padStart(5, '0')} • ` : ''}{client.company_name}</span>
                    <span className="block text-xs text-muted-foreground font-mono">{fmtCnpj(client.document)}</span>
                  </span>
                </button>
              </CollapsibleTrigger>
              <div className="flex flex-wrap items-center gap-2 pl-7 md:pl-0">
                <span className="text-sm text-foreground">{list.length} {list.length === 1 ? 'negociação' : 'negociações'}</span>
                <Button size="sm" variant="outline" onClick={() => copy(fmtCnpj(client.document), 'CNPJ')}><Copy className="h-4 w-4 mr-1" />CNPJ</Button>
                <Button size="sm" variant="outline" onClick={() => openNew(client.id)}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
              </div>
            </div>
            <CollapsibleContent>
              <div className="px-3 pb-3 space-y-2">
                {list.map(r => {
                  const raw = r.raw_response || {};
                  return (
                    <div key={r.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sitTone(r.situacao)}`}>{r.situacao || NI}</span>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1"><PenLine className="h-3 w-3" aria-hidden="true" />Cadastro manual</span>
                        <span className="text-xs text-muted-foreground">Atualizado manualmente em {new Date(raw.atualizado_manual_em || r.consulted_at).toLocaleString('pt-BR')}{raw.atualizado_por?.nome ? ` por ${raw.atualizado_por.nome}` : ''}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                        <div><div className="text-xs text-muted-foreground">Nº negociação</div><div className="font-mono font-semibold">{r.numero_parcelamento}</div></div>
                        <div><div className="text-xs text-muted-foreground">Modalidade</div><div className="truncate">{r.modalidade_label || NI}</div></div>
                        <div><div className="text-xs text-muted-foreground">Valor consolidado</div><div className="font-semibold">{brl(r.valor_total)}</div></div>
                        <div><div className="text-xs text-muted-foreground">Parcelas pagas / total</div><div className="font-semibold">{r.parcelas_pagas ?? NI} / {r.parcelas_total ?? NI}</div></div>
                        <div><div className="text-xs text-muted-foreground">Próxima parcela</div><div className="font-semibold">{brl(raw.valor_proxima_parcela)}</div></div>
                        <div><div className="text-xs text-muted-foreground">Vencimento</div><div className="font-semibold inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />{dateBR(raw.vencimento_proxima)}</div></div>
                      </div>
                      {raw.guia?.path && (
                        <div className="text-xs text-muted-foreground">Guia anexada: {raw.guia.nome}{raw.guia.enviado_em ? ` • enviada em ${new Date(raw.guia.enviado_em).toLocaleString('pt-BR')}` : ''}</div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
                        <Button size="sm" asChild className="bg-info text-info-foreground hover:bg-info/90">
                          <a href={SISPAR_URL} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Emitir no Regularize</a>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copy(r.numero_parcelamento || '', 'Número')}><Copy className="h-4 w-4 mr-1" />Copiar nº</Button>
                        <Button size="sm" variant="outline" onClick={() => pickPdf(r)} disabled={busy === `att:${r.id}`}>
                          {busy === `att:${r.id}` ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Paperclip className="h-4 w-4 mr-1" />}{raw.guia?.path ? 'Trocar guia' : 'Anexar guia'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => downloadGuia(r)} disabled={!raw.guia?.path}><FileDown className="h-4 w-4 mr-1" />Ver guia</Button>
                        <Button size="sm" variant="outline" className="text-success" onClick={() => openSend(r)} disabled={!raw.guia?.path || busy === `send:${r.id}`} title={raw.guia?.path ? undefined : 'Anexe a guia primeiro'}>
                          {busy === `send:${r.id}` ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-1" />}Enviar via WhatsApp
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDetail(r)}><Eye className="h-4 w-4 mr-1" />Detalhes</Button>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(r)} aria-label={`Editar negociação ${r.numero_parcelamento}`}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" className="flex-1 text-destructive" onClick={() => setToDelete(r)} aria-label={`Excluir negociação ${r.numero_parcelamento}`}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      <Dialog open={!!form} onOpenChange={o => !o && !saving && setForm(null)}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Editar negociação PGFN' : 'Nova negociação PGFN'}</DialogTitle>
            <DialogDescription>Cadastro manual. Copie os dados do SISPAR/Regularize — este sistema não consulta a PGFN.</DialogDescription>
          </DialogHeader>
          {form && (
            <form className="grid grid-cols-1 sm:grid-cols-2 gap-4" onSubmit={e => { e.preventDefault(); save(); }} noValidate>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Empresa *</Label>
                {form.id ? <div className="text-sm font-medium">{clientMap.get(form.client_id)?.company_name}</div>
                  : <ClientCombobox clients={clients} value={form.client_id} onChange={v => setForm(f => f && { ...f, client_id: v })} showDocument />}
                {errors.client_id && <p role="alert" className="text-xs text-destructive">{errors.client_id}</p>}
              </div>
              <F id="pgfn-numero" label="Número da negociação *" err={errors.numero}>{inp('numero', { required: true, maxLength: 40, autoFocus: !!form.id })}</F>
              <F id="pgfn-modalidade" label="Modalidade" err={errors.modalidade}>{inp('modalidade', { placeholder: 'Ex.: Transação Excepcional', maxLength: 120 })}</F>
              <div className="space-y-1.5">
                <Label htmlFor="pgfn-situacao">Situação</Label>
                <Select value={form.situacao || NI} onValueChange={v => setForm(f => f && { ...f, situacao: v === NI ? '' : v })}>
                  <SelectTrigger id="pgfn-situacao"><SelectValue /></SelectTrigger>
                  <SelectContent>{PGFN_SITUACOES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <F id="pgfn-data_adesao" label="Data de adesão" err={errors.data_adesao}>{inp('data_adesao', { type: 'date' })}</F>
              <F id="pgfn-valor_consolidado" label="Valor consolidado (R$)" err={errors.valor_consolidado}>{inp('valor_consolidado', { inputMode: 'decimal', placeholder: '0,00' })}</F>
              <F id="pgfn-valor_proxima_parcela" label="Valor da próxima parcela (R$)" err={errors.valor_proxima_parcela}>{inp('valor_proxima_parcela', { inputMode: 'decimal', placeholder: '0,00' })}</F>
              <F id="pgfn-parcelas_total" label="Total de parcelas" err={errors.parcelas_total}>{inp('parcelas_total', { inputMode: 'numeric' })}</F>
              <F id="pgfn-parcelas_pagas" label="Parcelas pagas" err={errors.parcelas_pagas}>{inp('parcelas_pagas', { inputMode: 'numeric' })}</F>
              <F id="pgfn-vencimento_proxima" label="Vencimento da próxima parcela" err={errors.vencimento_proxima}>{inp('vencimento_proxima', { type: 'date' })}</F>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="pgfn-obs">Observações</Label>
                <Textarea id="pgfn-obs" rows={3} maxLength={1000} value={form.observacoes} onChange={e => setForm(f => f && { ...f, observacoes: e.target.value })} />
                {errors.observacoes && <p role="alert" className="text-xs text-destructive">{errors.observacoes}</p>}
              </div>
              <DialogFooter className="sm:col-span-2 flex-col sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={() => setForm(null)} disabled={saving}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Negociação PGFN nº {detail?.numero_parcelamento}</DialogTitle><DialogDescription>Origem: cadastro manual. Não é consulta à PGFN.</DialogDescription></DialogHeader>
          {detail && (() => { const raw = detail.raw_response || {}; return (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Empresa', clientMap.get(detail.client_id)?.company_name], ['CNPJ', fmtCnpj(clientMap.get(detail.client_id)?.document || null)],
                ['Modalidade', detail.modalidade_label], ['Situação', detail.situacao], ['Data de adesão', detail.data_pedido ? dateBR(detail.data_pedido) : null],
                ['Valor consolidado', brl(detail.valor_total)], ['Parcelas', `${detail.parcelas_pagas ?? NI} / ${detail.parcelas_total ?? NI}`],
                ['Próxima parcela', brl(raw.valor_proxima_parcela)], ['Vencimento', dateBR(raw.vencimento_proxima)],
                ['Atualizado manualmente', `${new Date(raw.atualizado_manual_em || detail.consulted_at).toLocaleString('pt-BR')}${raw.atualizado_por?.nome ? ` por ${raw.atualizado_por.nome}` : ''}`],
              ].map(([k, v]) => <div key={k as string}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium break-words">{v || NI}</dd></div>)}
              <div className="col-span-2"><dt className="text-xs text-muted-foreground">Observações</dt><dd className="whitespace-pre-wrap">{raw.observacoes || NI}</dd></div>
              <p className="col-span-2 text-xs text-muted-foreground">O valor consolidado é o total negociado na adesão; não representa saldo devedor atual.</p>
            </dl>
          ); })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir negociação {toDelete?.numero_parcelamento}?</AlertDialogTitle>
            <AlertDialogDescription>O registro manual será removido deste sistema. Nada é alterado na PGFN.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!send} onOpenChange={o => !o && busy !== 'sending' && setSend(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Revisar envio da guia PGFN</DialogTitle><DialogDescription>Confira o destinatário e a mensagem antes de enviar.</DialogDescription></DialogHeader>
          {send && (
            <div className="space-y-3">
              <div className="rounded-lg border p-3 text-sm">{send.row.raw_response?.guia?.nome}</div>
              {send.phones.length ? (
                <div className="space-y-1.5">
                  <Label htmlFor="pgfn-dest">Enviar para</Label>
                  <Select value={String(send.sel)} onValueChange={v => setSend({ ...send, sel: Number(v) })}>
                    <SelectTrigger id="pgfn-dest"><SelectValue /></SelectTrigger>
                    <SelectContent>{send.phones.map((p, i) => <SelectItem key={p.phone} value={String(i)}>{p.label} • +{p.phone}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : <p role="alert" className="text-sm text-destructive">Esta empresa não tem nenhum telefone cadastrado.</p>}
              <Label htmlFor="pgfn-msg" className="sr-only">Mensagem</Label>
              <Textarea id="pgfn-msg" rows={5} value={send.text} onChange={e => setSend({ ...send, text: e.target.value })} />
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setSend(null)} disabled={busy === 'sending'}>Cancelar</Button>
                <Button onClick={confirmSend} disabled={busy === 'sending' || !send.phones.length}>{busy === 'sending' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enviar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
