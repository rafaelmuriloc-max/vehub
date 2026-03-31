import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Mail, Send, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Department {
  id: string;
  name: string;
  smtp_email: string | null;
}

interface EmailLog {
  id: string;
  department_id: string;
  recipient_email: string;
  subject: string;
  client_id: string | null;
  obligation_id: string | null;
  reference_month: string | null;
  status: string;
  sent_at: string;
  opened_at: string | null;
}

const PAGE_SIZE = 15;

export default function Email() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  // Enviados state
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [clientsMap, setClientsMap] = useState<Record<string, string>>({});
  const [obligationsMap, setObligationsMap] = useState<Record<string, string>>({});
  const [logsPage, setLogsPage] = useState(0);
  const [logsTotal, setLogsTotal] = useState(0);

  useEffect(() => {
    const fetchDepts = async () => {
      const { data } = await supabase
        .from('departments')
        .select('id, name, smtp_email')
        .order('name');
      if (data) {
        setDepartments(
          (data as unknown as Department[]).filter(d => d.smtp_email)
        );
      }
    };
    fetchDepts();
  }, []);

  const loadLogs = useCallback(async () => {
    const from = logsPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count } = await supabase
      .from('email_logs' as any)
      .select('*', { count: 'exact' })
      .order('sent_at', { ascending: false })
      .range(from, to);

    if (data) {
      const typedData = data as unknown as EmailLog[];
      setLogs(typedData);
      setLogsTotal(count || 0);

      // Load client names
      const clientIds = [...new Set(typedData.filter(l => l.client_id).map(l => l.client_id!))];
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from('clients')
          .select('id, company_name')
          .in('id', clientIds);
        if (clients) {
          const map: Record<string, string> = {};
          clients.forEach(c => { map[c.id] = c.company_name; });
          setClientsMap(map);
        }
      }

      // Load obligation names
      const oblIds = [...new Set(typedData.filter(l => l.obligation_id).map(l => l.obligation_id!))];
      if (oblIds.length > 0) {
        const { data: obls } = await supabase
          .from('obligations')
          .select('id, name')
          .in('id', oblIds);
        if (obls) {
          const map: Record<string, string> = {};
          obls.forEach(o => { map[o.id] = o.name; });
          setObligationsMap(map);
        }
      }
    }
  }, [logsPage]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleSend = async () => {
    if (!departmentId || !to || !subject || !body) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const htmlContent = `<div style="font-family: sans-serif; white-space: pre-wrap;">${body}</div>`;

      // Insert log first to get the id for tracking pixel
      const { data: logData } = await supabase.from('email_logs').insert({
        department_id: departmentId,
        recipient_email: to,
        subject,
        body_html: htmlContent,
        status: 'sent',
      }).select('id').single();

      const trackingPixel = logData?.id
        ? `<img src="https://ismgjjvarzzfsbdpthot.supabase.co/functions/v1/email-track?id=${logData.id}" width="1" height="1" style="display:none" />`
        : '';
      const htmlWithPixel = htmlContent + trackingPixel;

      const { data, error } = await supabase.functions.invoke('smtp-send', {
        body: { departmentId, to, subject, html: htmlWithPixel, senderName: profile?.full_name || undefined },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'E-mail enviado com sucesso!' });
      setTo('');
      setSubject('');
      setBody('');
      loadLogs();
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar e-mail',
        description: err.message || 'Verifique as credenciais SMTP do departamento',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const totalPages = Math.ceil(logsTotal / PAGE_SIZE);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatCompetencia = (refMonth: string | null) => {
    if (!refMonth) return '—';
    const d = new Date(refMonth + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">E-mail</h1>
        <p className="text-muted-foreground">Envie e-mails e visualize os enviados</p>
      </div>

      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose">Compor</TabsTrigger>
          <TabsTrigger value="sent">
            Enviados
            {logsTotal > 0 && (
              <Badge variant="secondary" className="ml-2">{logsTotal}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Compor E-mail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Departamento remetente</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({d.smtp_email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {departments.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Nenhum departamento com SMTP configurado. Configure em Cadastro → Meu Escritório → Departamentos.
                  </p>
                )}
              </div>

              <div>
                <Label>Destinatário</Label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                />
              </div>

              <div>
                <Label>Assunto</Label>
                <Input
                  placeholder="Assunto do e-mail"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>

              <div>
                <Label>Corpo</Label>
                <Textarea
                  placeholder="Escreva o conteúdo do e-mail..."
                  className="min-h-[200px]"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                />
              </div>

              <Button
                onClick={handleSend}
                disabled={sending || !departmentId || !to || !subject || !body}
                className="w-full"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {sending ? 'Enviando...' : 'Enviar E-mail'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sent">
          <Card>
            <CardHeader>
              <CardTitle>E-mails Enviados</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum e-mail enviado ainda.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Hora</TableHead>
                        <TableHead>Destinatário</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Obrigação</TableHead>
                        <TableHead>Competência</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aberto em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell>{formatDate(log.sent_at)}</TableCell>
                          <TableCell>{formatTime(log.sent_at)}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{log.recipient_email}</TableCell>
                          <TableCell>{log.client_id ? (clientsMap[log.client_id] || '—') : '—'}</TableCell>
                          <TableCell>{log.obligation_id ? (obligationsMap[log.obligation_id] || '—') : '—'}</TableCell>
                          <TableCell>{formatCompetencia(log.reference_month)}</TableCell>
                          <TableCell>
                          <Badge
                              variant={log.status === 'opened' ? 'default' : log.status === 'sent' ? 'default' : 'destructive'}
                              className={
                                log.status === 'opened' ? 'bg-blue-600 hover:bg-blue-700' :
                                log.status === 'sent' ? 'bg-green-600 hover:bg-green-700' : ''
                              }
                            >
                              {log.status === 'opened' ? 'Aberto' : log.status === 'sent' ? 'Enviado' : 'Falhou'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.opened_at ? (
                              <span className="text-xs">
                                {new Date(log.opened_at).toLocaleDateString('pt-BR')} {new Date(log.opened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Página {logsPage + 1} de {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={logsPage === 0}
                          onClick={() => setLogsPage(p => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={logsPage >= totalPages - 1}
                          onClick={() => setLogsPage(p => p + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
