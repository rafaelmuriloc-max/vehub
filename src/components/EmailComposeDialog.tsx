import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Send, Loader2, Paperclip } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  smtp_email: string | null;
}

interface EmailAttachment {
  fileUrl: string;
  fileName: string;
}

interface EmailComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientEmail?: string;
  /** Variables available for interpolation */
  variables?: Record<string, string>;
  onSent?: () => void;
  /** Pre-filled values from activity configuration */
  prefillDepartmentId?: string;
  prefillSubject?: string;
  prefillBody?: string;
  /** Attachments to include */
  attachments?: EmailAttachment[];
}

const VARIABLE_OPTIONS = [
  { key: '[Nome_da_Empresa]', label: 'Nome da Empresa' },
  { key: '[Competencia]', label: 'Competência' },
  { key: '[Nome_da_Obrigação]', label: 'Nome da Obrigação' },
  { key: '[Vencimento]', label: 'Vencimento' },
];

export default function EmailComposeDialog({
  open,
  onOpenChange,
  recipientEmail = '',
  variables = {},
  onSent,
  prefillDepartmentId,
  prefillSubject,
  prefillBody,
  attachments = [],
}: EmailComposeDialogProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [to, setTo] = useState(recipientEmail);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setTo(recipientEmail);
      if (prefillDepartmentId) setDepartmentId(prefillDepartmentId);
      if (prefillSubject) setSubject(prefillSubject);
      if (prefillBody) setBody(prefillBody);
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
    }
  }, [open, recipientEmail, prefillDepartmentId, prefillSubject, prefillBody]);

  function insertVariable(variable: string, target: 'subject' | 'body') {
    if (target === 'subject') {
      setSubject(prev => prev + variable);
    } else {
      setBody(prev => prev + variable);
    }
  }

  function replaceVariables(text: string): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      result = result.split(key).join(value);
    }
    return result;
  }

  const handleSend = async () => {
    if (!departmentId || !to || !subject || !body) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const finalSubject = replaceVariables(subject);
      const finalBody = replaceVariables(body);
      const htmlContent = `<div style="font-family: sans-serif; white-space: pre-wrap;">${finalBody}</div>`;

      // Insert log first for tracking pixel
      const { data: logData } = await supabase.from('email_logs').insert({
        department_id: departmentId,
        recipient_email: to,
        subject: finalSubject,
        body_html: htmlContent,
        status: 'sent',
      }).select('id').single();

      const trackingPixel = logData?.id
        ? `<img src="https://ismgjjvarzzfsbdpthot.supabase.co/functions/v1/email-track?id=${logData.id}" width="1" height="1" style="display:none" />`
        : '';

      const { data, error } = await supabase.functions.invoke('smtp-send', {
        body: {
          departmentId,
          to,
          subject: finalSubject,
          html: htmlContent + trackingPixel,
          attachments: attachments.length > 0 ? attachments : undefined,
          senderName: profile?.full_name || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'E-mail enviado com sucesso!' });
      setSubject('');
      setBody('');
      onOpenChange(false);
      onSent?.();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enviar E-mail
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
                Nenhum departamento com SMTP configurado.
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
            <div className="flex flex-wrap gap-1 mt-1">
              {VARIABLE_OPTIONS.map(v => (
                <Badge
                  key={v.key}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 text-xs"
                  onClick={() => insertVariable(v.key, 'subject')}
                >
                  {v.key}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label>Corpo do e-mail</Label>
            <Textarea
              placeholder="Escreva o conteúdo do e-mail..."
              className="min-h-[180px]"
              value={body}
              onChange={e => setBody(e.target.value)}
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {VARIABLE_OPTIONS.map(v => (
                <Badge
                  key={v.key}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 text-xs"
                  onClick={() => insertVariable(v.key, 'body')}
                >
                  {v.key}
                </Badge>
              ))}
            </div>
          </div>

          {attachments.length > 0 && (
            <div>
              <Label className="flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> Anexos ({attachments.length})</Label>
              <div className="mt-1 space-y-1">
                {attachments.map((att, idx) => (
                  <div key={idx} className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 flex items-center gap-1">
                    <Paperclip className="h-3 w-3 shrink-0" />
                    {att.fileName}
                  </div>
                ))}
              </div>
            </div>
          )}

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
        </div>
      </DialogContent>
    </Dialog>
  );
}
