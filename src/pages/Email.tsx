import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Mail, Send, Loader2 } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  smtp_email: string | null;
}

export default function Email() {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

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

  const handleSend = async () => {
    if (!departmentId || !to || !subject || !body) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('smtp-send', {
        body: {
          departmentId,
          to,
          subject,
          html: `<div style="font-family: sans-serif; white-space: pre-wrap;">${body}</div>`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'E-mail enviado com sucesso!' });
      setTo('');
      setSubject('');
      setBody('');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">E-mail</h1>
        <p className="text-muted-foreground">Envie e-mails pelo departamento</p>
      </div>

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
    </div>
  );
}
