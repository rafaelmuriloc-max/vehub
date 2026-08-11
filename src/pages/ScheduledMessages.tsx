import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Pause, Play, Send, Search, Paperclip, History, X } from 'lucide-react';

type Department = { id: string; name: string };
type Client = { id: string; company_name: string; document: string | null; tax_regime: string | null; payroll_type: string | null; address: string | null; status: string };
type ScheduledMsg = any;

const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const weekdayNames = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const taxRegimeOptions = [
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
  { value: 'mei', label: 'MEI' },
];

const emptyForm = {
  id: '' as string | null,
  name: '',
  department_id: '',
  recurrence: 'monthly',
  weekly_day: '1',
  monthly_day: '5',
  annual_month: '1',
  custom_months: [] as number[],
  send_time: '09:00',
  anticipate_weekend: true,
  assignment_mode: 'manual',
  segment_payroll_filter: '',
  segment_tax_regimes: [] as string[],
  segment_city: '',
  message_body: '',
  attachment_url: '' as string | null,
  attachment_name: '' as string | null,
  attachment_mime: '' as string | null,
  start_date: '',
  end_date: '',
  active: true,
};

function recurrenceLabel(r: ScheduledMsg): string {
  switch (r.recurrence) {
    case 'daily': return 'Diária';
    case 'weekly': return `Semanal · ${weekdayNames[r.weekly_day ?? 0]}`;
    case 'monthly': return `Mensal · dia ${r.monthly_day}`;
    case 'quarterly': return `Trimestral · dia ${r.monthly_day}`;
    case 'yearly': return `Anual · ${monthNames[(r.annual_month ?? 1) - 1]} dia ${r.monthly_day}`;
    case 'custom_months': return `Meses ${(r.custom_months || []).join(',')} · dia ${r.monthly_day}`;
    default: return r.recurrence;
  }
}

export default function ScheduledMessages() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<ScheduledMsg[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [manualSelected, setManualSelected] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [runs, setRuns] = useState<any[]>([]);

  const load = async () => {
    const [d, c, s] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('clients').select('id, sci_code, company_name, document, tax_regime, payroll_type, address, status').eq('status', 'active').order('company_name'),
      supabase.from('scheduled_messages').select('*').order('created_at', { ascending: false }),
    ]);
    setDepartments((d.data as any) || []);
    setClients((c.data as any) || []);
    setItems((s.data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const reset = () => {
    setForm({ ...emptyForm, department_id: departments[0]?.id || '' });
    setManualSelected([]);
    setClientSearch('');
  };

  const openCreate = () => { reset(); setOpen(true); };

  const openEdit = async (s: ScheduledMsg) => {
    const seg = s.segment_filters || {};
    setForm({
      id: s.id,
      name: s.name,
      department_id: s.department_id,
      recurrence: s.recurrence,
      weekly_day: String(s.weekly_day ?? 1),
      monthly_day: String(s.monthly_day ?? 5),
      annual_month: String(s.annual_month ?? 1),
      custom_months: s.custom_months || [],
      send_time: (s.send_time || '09:00').slice(0, 5),
      anticipate_weekend: !!s.anticipate_weekend,
      assignment_mode: s.assignment_mode,
      segment_payroll_filter: seg.payroll_type || '',
      segment_tax_regimes: seg.tax_regimes || [],
      segment_city: seg.city || '',
      message_body: s.message_body || '',
      attachment_url: s.attachment_url,
      attachment_name: s.attachment_name,
      attachment_mime: s.attachment_mime,
      start_date: s.start_date || '',
      end_date: s.end_date || '',
      active: !!s.active,
    });
    const { data } = await supabase.from('scheduled_message_clients').select('client_id').eq('scheduled_message_id', s.id);
    setManualSelected((data || []).map((r: any) => r.client_id));
    setOpen(true);
  };

  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase();
    return clients.filter(c => !q || c.company_name.toLowerCase().includes(q) || (c.document || '').toLowerCase().includes(q));
  }, [clients, clientSearch]);

  const segmentPreview = useMemo(() => {
    if (form.assignment_mode !== 'segment') return clients;
    let list = clients;
    if (form.segment_payroll_filter === 'all') list = list.filter(c => c.payroll_type);
    else if (form.segment_payroll_filter) list = list.filter(c => c.payroll_type === form.segment_payroll_filter);
    if (form.segment_tax_regimes.length) list = list.filter(c => form.segment_tax_regimes.includes(c.tax_regime || ''));
    if (form.segment_city) list = list.filter(c => (c.address || '').toLowerCase().includes(form.segment_city.toLowerCase()));
    return list;
  }, [form, clients]);

  const onAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttaching(true);
    try {
      const safe = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `scheduled/${crypto.randomUUID()}_${safe}`;
      const { error: upErr } = await supabase.storage.from('chat-media').upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('chat-media').getPublicUrl(path);
      setForm(f => ({ ...f, attachment_url: data.publicUrl, attachment_name: file.name, attachment_mime: file.type || null }));
      toast({ title: 'Anexo carregado' });
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setAttaching(false);
      e.target.value = '';
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.department_id || !form.message_body.trim()) {
      toast({ title: 'Preencha nome, departamento e mensagem', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const segment_filters = form.assignment_mode === 'segment' ? {
        payroll_type: form.segment_payroll_filter || null,
        tax_regimes: form.segment_tax_regimes,
        city: form.segment_city || null,
      } : {};
      const payload: any = {
        name: form.name,
        department_id: form.department_id,
        recurrence: form.recurrence,
        weekly_day: form.recurrence === 'weekly' ? Number(form.weekly_day) : null,
        monthly_day: ['monthly','quarterly','yearly','custom_months'].includes(form.recurrence) ? Number(form.monthly_day) : null,
        annual_month: form.recurrence === 'yearly' ? Number(form.annual_month) : null,
        custom_months: form.recurrence === 'custom_months' ? form.custom_months : [],
        send_time: form.send_time,
        anticipate_weekend: form.anticipate_weekend,
        assignment_mode: form.assignment_mode,
        segment_filters,
        message_body: form.message_body,
        attachment_url: form.attachment_url || null,
        attachment_name: form.attachment_name || null,
        attachment_mime: form.attachment_mime || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        active: form.active,
      };
      let id = form.id;
      if (id) {
        const { error } = await supabase.from('scheduled_messages').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { data, error } = await supabase.from('scheduled_messages').insert({ ...payload, created_by: u.user?.id }).select('id').single();
        if (error) throw error;
        id = data!.id;
      }
      // Sync manual clients
      if (id) {
        await supabase.from('scheduled_message_clients').delete().eq('scheduled_message_id', id);
        if (form.assignment_mode === 'manual' && manualSelected.length) {
          await supabase.from('scheduled_message_clients').insert(manualSelected.map(cid => ({ scheduled_message_id: id, client_id: cid })));
        }
      }
      toast({ title: form.id ? 'Agendamento atualizado' : 'Agendamento criado' });
      setOpen(false);
      load();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: ScheduledMsg) => {
    await supabase.from('scheduled_messages').update({ active: !s.active }).eq('id', s.id);
    load();
  };

  const remove = async (s: ScheduledMsg) => {
    if (!confirm(`Excluir o agendamento "${s.name}"?`)) return;
    await supabase.from('scheduled_messages').delete().eq('id', s.id);
    load();
  };

  const runNow = async (s: ScheduledMsg) => {
    toast({ title: 'Disparando agora…' });
    const { data, error } = await supabase.functions.invoke('scheduled-messages-runner', { body: { id: s.id }, method: 'POST' });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Execução iniciada', description: JSON.stringify((data as any)?.results?.[0] || {}) });
      load();
    }
  };

  const openHistory = async (id: string) => {
    setHistoryId(id);
    const { data } = await supabase.from('scheduled_message_runs').select('*').eq('scheduled_message_id', id).order('run_at', { ascending: false }).limit(20);
    setRuns(data || []);
  };

  if (!isAdmin) {
    return <div className="p-6">Acesso restrito a administradores.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mensagens Agendadas</h1>
          <p className="text-sm text-muted-foreground">Envie mensagens automáticas no WhatsApp dos clientes em datas e horários definidos.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Novo agendamento</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Agendamentos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Periodicidade</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Última execução</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum agendamento criado.</TableCell></TableRow>
              )}
              {items.map(s => {
                const dept = departments.find(d => d.id === s.department_id);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{dept?.name || '-'}</TableCell>
                    <TableCell className="text-sm">{recurrenceLabel(s)}</TableCell>
                    <TableCell>{(s.send_time || '').slice(0,5)} <span className="text-xs text-muted-foreground">(São Paulo)</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.last_run_at ? new Date(s.last_run_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'}</TableCell>
                    <TableCell>
                      {s.active ? <Badge>Ativo</Badge> : <Badge variant="secondary">Pausado</Badge>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => runNow(s)} title="Disparar agora"><Send className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => openHistory(s.id)} title="Histórico"><History className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => toggleActive(s)} title={s.active ? 'Pausar' : 'Ativar'}>{s.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* === Dialog === */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Editar' : 'Novo'} agendamento</DialogTitle></DialogHeader>
          <Tabs defaultValue="config" className="w-full">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="config">Configuração</TabsTrigger>
              <TabsTrigger value="clients">Clientes</TabsTrigger>
              <TabsTrigger value="message">Mensagem</TabsTrigger>
              <TabsTrigger value="review">Revisão</TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 col-span-2">
                  <Label>Nome do agendamento</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Lembrete envio de notas" />
                </div>
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select value={form.department_id} onValueChange={v => setForm({ ...form, department_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Periodicidade</Label>
                  <Select value={form.recurrence} onValueChange={v => setForm({ ...form, recurrence: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diária</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                      <SelectItem value="custom_months">Escolher meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.recurrence === 'weekly' && (
                  <div className="space-y-2">
                    <Label>Dia da semana</Label>
                    <Select value={form.weekly_day} onValueChange={v => setForm({ ...form, weekly_day: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {weekdayNames.map((w, i) => <SelectItem key={i} value={String(i)}>{w}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {['monthly','quarterly','yearly','custom_months'].includes(form.recurrence) && (
                  <div className="space-y-2">
                    <Label>Dia do mês</Label>
                    <Input type="number" min={1} max={31} value={form.monthly_day} onChange={e => setForm({ ...form, monthly_day: e.target.value })} />
                  </div>
                )}
                {form.recurrence === 'yearly' && (
                  <div className="space-y-2">
                    <Label>Mês</Label>
                    <Select value={form.annual_month} onValueChange={v => setForm({ ...form, annual_month: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {monthNames.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {form.recurrence === 'custom_months' && (
                  <div className="space-y-2 col-span-2">
                    <Label>Meses</Label>
                    <div className="flex flex-wrap gap-2">
                      {monthNames.map((m, i) => {
                        const month = i + 1;
                        const checked = form.custom_months.includes(month);
                        return (
                          <label key={month} className="flex items-center gap-1.5 border rounded-md px-2 py-1 text-sm cursor-pointer">
                            <Checkbox checked={checked} onCheckedChange={v => {
                              setForm({ ...form, custom_months: v ? [...form.custom_months, month] : form.custom_months.filter(x => x !== month) });
                            }} />
                            {m.slice(0,3)}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Hora (fuso de São Paulo)</Label>
                  <Input type="time" value={form.send_time} onChange={e => setForm({ ...form, send_time: e.target.value })} />
                  <p className="text-xs text-muted-foreground">O disparo respeita o horário de Brasília (America/Sao_Paulo).</p>
                </div>
                <div className="flex items-end gap-2">
                  <Switch checked={form.anticipate_weekend} onCheckedChange={v => setForm({ ...form, anticipate_weekend: v })} id="ant" />
                  <Label htmlFor="ant" className="cursor-pointer">Antecipar quando cair em fim de semana/feriado</Label>
                </div>

                <div className="space-y-2">
                  <Label>Início (opcional)</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Fim (opcional)</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                </div>

                <div className="flex items-center gap-2 col-span-2">
                  <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} id="active" />
                  <Label htmlFor="active">Agendamento ativo</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="clients" className="space-y-4 pt-4">
              <Select value={form.assignment_mode} onValueChange={v => setForm({ ...form, assignment_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas ativas</SelectItem>
                  <SelectItem value="segment">Por segmento (filtros)</SelectItem>
                  <SelectItem value="manual">Seleção manual</SelectItem>
                </SelectContent>
              </Select>

              {form.assignment_mode === 'all' && (
                <p className="text-sm text-muted-foreground">{clients.length} empresa(s) ativa(s) serão notificadas.</p>
              )}

              {form.assignment_mode === 'segment' && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="seg_payroll" checked={!!form.segment_payroll_filter} onCheckedChange={v => setForm({ ...form, segment_payroll_filter: v ? 'all' : '' })} />
                    <Label htmlFor="seg_payroll">Empresas com Folha de Pagamento</Label>
                  </div>
                  {!!form.segment_payroll_filter && (
                    <Select value={form.segment_payroll_filter} onValueChange={v => setForm({ ...form, segment_payroll_filter: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as folhas</SelectItem>
                        <SelectItem value="normal">Folha Normal</SelectItem>
                        <SelectItem value="pro_labore">Só Pró-labore</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <div className="space-y-2">
                    <Label>Regime Tributário</Label>
                    <div className="flex flex-wrap gap-2">
                      {taxRegimeOptions.map(opt => (
                        <div key={opt.value} className="flex items-center space-x-1.5">
                          <Checkbox id={`regime_${opt.value}`} checked={form.segment_tax_regimes.includes(opt.value)} onCheckedChange={v => {
                            setForm({ ...form, segment_tax_regimes: v ? [...form.segment_tax_regimes, opt.value] : form.segment_tax_regimes.filter(r => r !== opt.value) });
                          }} />
                          <Label htmlFor={`regime_${opt.value}`} className="text-sm">{opt.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade (contido no endereço)</Label>
                    <Input placeholder="Ex: Florianópolis" value={form.segment_city} onChange={e => setForm({ ...form, segment_city: e.target.value })} />
                  </div>
                  <p className="text-sm font-medium text-primary">{segmentPreview.length} empresa(s) correspondem aos filtros</p>
                </div>
              )}

              {form.assignment_mode === 'manual' && (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por nome ou CNPJ..." className="pl-9" value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{manualSelected.length} selecionada(s)</p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setManualSelected(filteredClients.map(c => c.id))}>Selecionar todas</Button>
                      <Button size="sm" variant="outline" onClick={() => setManualSelected([])}>Limpar</Button>
                    </div>
                  </div>
                  <ScrollArea className="h-64">
                    <div className="space-y-1">
                      {filteredClients.map(c => (
                        <div key={c.id} className="flex items-center space-x-2 py-1 px-1 rounded hover:bg-muted/50">
                          <Checkbox id={`cli_${c.id}`} checked={manualSelected.includes(c.id)} onCheckedChange={v => {
                            setManualSelected(v ? [...manualSelected, c.id] : manualSelected.filter(id => id !== c.id));
                          }} />
                          <Label htmlFor={`cli_${c.id}`} className="text-sm flex-1 cursor-pointer">
                            {c.company_name}
                            {c.document && <span className="text-muted-foreground ml-1">({c.document})</span>}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </TabsContent>

            <TabsContent value="message" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea rows={8} value={form.message_body} onChange={e => setForm({ ...form, message_body: e.target.value })} placeholder="Olá {{cliente}}, lembrete do departamento {{departamento}} em {{data}}." />
                <p className="text-xs text-muted-foreground">Variáveis disponíveis: <code>{'{{cliente}}'}</code>, <code>{'{{departamento}}'}</code>, <code>{'{{data}}'}</code></p>
              </div>
              <div className="space-y-2">
                <Label>Anexo (opcional)</Label>
                {form.attachment_url ? (
                  <div className="flex items-center gap-2 border rounded-md p-2">
                    <Paperclip className="h-4 w-4" />
                    <a href={form.attachment_url} target="_blank" rel="noreferrer" className="text-sm flex-1 truncate underline">{form.attachment_name}</a>
                    <Button size="icon" variant="ghost" onClick={() => setForm({ ...form, attachment_url: null, attachment_name: null, attachment_mime: null })}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <Input type="file" onChange={onAttach} disabled={attaching} />
                )}
              </div>
            </TabsContent>

            <TabsContent value="review" className="space-y-3 pt-4 text-sm">
              <div><b>Departamento:</b> {departments.find(d => d.id === form.department_id)?.name || '—'}</div>
              <div><b>Periodicidade:</b> {recurrenceLabel({ ...form, weekly_day: Number(form.weekly_day), monthly_day: Number(form.monthly_day), annual_month: Number(form.annual_month) })}</div>
              <div><b>Hora:</b> {form.send_time} (BRT) · Antecipa fds/feriado: {form.anticipate_weekend ? 'Sim' : 'Não'}</div>
              <div><b>Clientes elegíveis:</b> {form.assignment_mode === 'all' ? clients.length : form.assignment_mode === 'segment' ? segmentPreview.length : manualSelected.length}</div>
              <div><b>Mensagem:</b><div className="whitespace-pre-wrap border rounded p-2 mt-1 bg-muted/30">{form.message_body || '—'}</div></div>
              {form.attachment_url && <div><b>Anexo:</b> {form.attachment_name}</div>}
              <p className="text-xs text-muted-foreground">O envio usa o telefone do contato do departamento (ou o contato principal do cliente como fallback). Clientes sem telefone são ignorados.</p>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Histórico === */}
      <Dialog open={!!historyId} onOpenChange={v => { if (!v) setHistoryId(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Histórico de execuções</DialogTitle></DialogHeader>
          <ScrollArea className="h-96">
            {runs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma execução ainda.</p>}
            <div className="space-y-2">
              {runs.map(r => (
                <div key={r.id} className="border rounded p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{new Date(r.run_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
                    <span className="text-muted-foreground">
                      ✅ {r.status_summary?.sent || 0} · ⚠️ {r.status_summary?.skipped || 0} · ❌ {r.status_summary?.failed || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}