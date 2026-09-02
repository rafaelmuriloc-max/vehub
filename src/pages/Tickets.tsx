import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, MessageCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatClientLabel } from '@/lib/utils';

type TicketRow = {
  id: string;
  ticket_number: number;
  conversation_id: string | null;
  client_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  department_id: string | null;
  assigned_to: string | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  wait_seconds: number | null;
  handle_seconds: number | null;
  messages_count: number;
  subject: string | null;
  summary: string | null;
  category: string | null;
  summary_status: string;
};

function fmtDate(v?: string | null) {
  if (!v) return '—';
  return new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(seconds?: number | null) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h${(m % 60).toString().padStart(2, '0')}`;
}

const PERIODS = [
  { value: 'today', label: 'Hoje' },
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: 'all', label: 'Todo o período' },
];

export default function Tickets() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [period, setPeriod] = useState('7');
  const [status, setStatus] = useState('all');
  const [agent, setAgent] = useState('all');
  const [dept, setDept] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<TicketRow | null>(null);
  const [generating, setGenerating] = useState(false);
  const pageSize = 25;

  const sinceIso = useMemo(() => {
    if (period === 'all') return null;
    const d = new Date();
    if (period === 'today') d.setHours(0, 0, 0, 0);
    else d.setDate(d.getDate() - Number(period));
    return d.toISOString();
  }, [period]);

  const { data: meta } = useQuery({
    queryKey: ['tickets-meta'],
    queryFn: async () => {
      const [profs, depts, clients] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, tag_color'),
        supabase.from('departments').select('id, name'),
        supabase.from('clients').select('id, sci_code, company_name'),
      ]);
      return {
        profiles: profs.data ?? [],
        departments: depts.data ?? [],
        clients: clients.data ?? [],
      };
    },
  });

  const profileMap = useMemo(() => {
    const m: Record<string, { name: string; color: string | null }> = {};
    (meta?.profiles ?? []).forEach((p: any) => {
      m[p.user_id] = { name: p.full_name ?? 'Atendente', color: p.tag_color ?? null };
    });
    return m;
  }, [meta]);

  const deptMap = useMemo(() => {
    const m: Record<string, string> = {};
    (meta?.departments ?? []).forEach((d: any) => { m[d.id] = d.name; });
    return m;
  }, [meta]);

  const clientMap = useMemo(() => {
    const m: Record<string, string> = {};
    (meta?.clients ?? []).forEach((c: any) => { m[c.id] = formatClientLabel(c); });
    return m;
  }, [meta]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['tickets', period, status, agent, dept, search, page],
    queryFn: async () => {
      let q = supabase
        .from('support_tickets')
        .select('*', { count: 'exact' })
        .order('opened_at', { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (sinceIso) q = q.gte('opened_at', sinceIso);
      if (status !== 'all') q = q.eq('status', status);
      if (agent !== 'all') q = q.eq('assigned_to', agent);
      if (dept !== 'all') q = q.eq('department_id', dept);
      if (search.trim()) {
        const term = `%${search.trim()}%`;
        q = q.or(`contact_name.ilike.${term},contact_phone.ilike.${term},subject.ilike.${term},summary.ilike.${term}`);
      }

      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as TicketRow[], count: count ?? 0 };
    },
  });

  const generateToday = async () => {
    setGenerating(true);
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase.functions.invoke('ticket-summarize', {
        body: { backfill: true, since: start.toISOString() },
      });
      if (error) throw error;
      toast({
        title: 'Chamados atualizados',
        description: `${data?.created ?? 0} criados · ${data?.summarized ?? 0} resumidos`,
      });
      refetch();
    } catch (e: any) {
      toast({ title: 'Erro ao gerar chamados', description: e?.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const total = data?.count ?? 0;
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Chamados</h1>
            <p className="text-xs text-muted-foreground">{total} chamado(s) no filtro atual</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <Button size="sm" onClick={generateToday} disabled={generating}>
            <Sparkles className="h-4 w-4 mr-2" /> {generating ? 'Gerando...' : 'Gerar chamados de hoje'}
          </Button>
        </div>
      </div>

      <Card className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <Input
          placeholder="Buscar por contato, telefone ou assunto"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="xl:col-span-2"
        />
        <Select value={period} onValueChange={(v) => { setPeriod(v); setPage(0); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            <SelectItem value="open">Abertos</SelectItem>
            <SelectItem value="closed">Encerrados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agent} onValueChange={(v) => { setAgent(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            {(meta?.profiles ?? []).map((p: any) => (
              <SelectItem key={p.user_id} value={p.user_id}>{p.full_name ?? 'Atendente'}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dept} onValueChange={(v) => { setDept(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os departamentos</SelectItem>
            {(meta?.departments ?? []).map((d: any) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Abertura</th>
                <th className="px-3 py-2 text-left">Contato</th>
                <th className="px-3 py-2 text-left hidden md:table-cell">Empresa</th>
                <th className="px-3 py-2 text-left hidden lg:table-cell">Assunto</th>
                <th className="px-3 py-2 text-left hidden xl:table-cell">Responsável</th>
                <th className="px-3 py-2 text-left">Situação</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhum chamado encontrado.</td></tr>
              )}
              {rows.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setDetail(t)}
                  className="border-t border-border/40 hover:bg-muted/40 cursor-pointer"
                >
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{t.ticket_number}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(t.opened_at)}</td>
                  <td className="px-3 py-2 truncate max-w-[180px]">{t.contact_name || t.contact_phone || '—'}</td>
                  <td className="px-3 py-2 hidden md:table-cell truncate max-w-[220px]">{t.client_id ? clientMap[t.client_id] ?? '—' : '—'}</td>
                  <td className="px-3 py-2 hidden lg:table-cell truncate max-w-[280px]">
                    {t.subject || (t.summary_status === 'pending' ? <span className="text-muted-foreground">Resumo pendente</span> : '—')}
                  </td>
                  <td className="px-3 py-2 hidden xl:table-cell truncate max-w-[160px]">
                    {t.assigned_to ? profileMap[t.assigned_to]?.name ?? '—' : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={t.status === 'open' ? 'default' : 'secondary'}>
                      {t.status === 'open' ? 'Aberto' : 'Encerrado'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > pageSize && (
          <div className="flex items-center justify-between p-3 border-t border-border/40 text-sm">
            <span className="text-muted-foreground">Página {page + 1} de {Math.ceil(total / pageSize)}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chamado #{detail?.ticket_number}</DialogTitle>
            <DialogDescription>{detail?.subject || 'Sem assunto registrado'}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Contato</p><p>{detail.contact_name || detail.contact_phone || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Empresa</p><p>{detail.client_id ? clientMap[detail.client_id] ?? '—' : '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Departamento</p><p>{detail.department_id ? deptMap[detail.department_id] ?? '—' : '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Responsável</p><p>{detail.assigned_to ? profileMap[detail.assigned_to]?.name ?? '—' : '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Abertura</p><p>{fmtDate(detail.opened_at)}</p></div>
                <div><p className="text-xs text-muted-foreground">Encerramento</p><p>{fmtDate(detail.closed_at)}</p></div>
                <div><p className="text-xs text-muted-foreground">Tempo de espera</p><p>{fmtDuration(detail.wait_seconds)}</p></div>
                <div><p className="text-xs text-muted-foreground">Duração</p><p>{fmtDuration(detail.handle_seconds)}</p></div>
                <div><p className="text-xs text-muted-foreground">Mensagens</p><p>{detail.messages_count}</p></div>
                <div><p className="text-xs text-muted-foreground">Categoria</p><p>{detail.category || '—'}</p></div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Resumo do atendimento</p>
                <p className="whitespace-pre-wrap leading-relaxed">
                  {detail.summary || (detail.summary_status === 'pending' ? 'Resumo ainda não gerado.' : 'Sem resumo.')}
                </p>
              </div>
              {detail.conversation_id && (
                <Button variant="outline" className="w-full" onClick={() => navigate(`/chat?conversation=${detail.conversation_id}`)}>
                  <MessageCircle className="h-4 w-4 mr-2" /> Abrir conversa no chat
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
