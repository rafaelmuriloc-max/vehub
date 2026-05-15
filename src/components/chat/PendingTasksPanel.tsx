import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Calendar, Building2, User as UserIcon, ListTodo } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  phone: string | null;
  onClose: () => void;
  onCountChange?: (n: number) => void;
}

interface TaskRow {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | string;
  due_date: string | null;
  client_id: string | null;
  clients: { company_name: string } | null;
  task_assignments: { profiles: { full_name: string | null } | null }[];
}

const priorityLabel: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const priorityVariant: Record<string, 'secondary' | 'default' | 'destructive'> = {
  low: 'secondary',
  medium: 'default',
  high: 'destructive',
};

export function PendingTasksPanel({ phone, onClose, onCountChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!phone) {
          if (!cancelled) { setTasks([]); onCountChange?.(0); }
          return;
        }
        const digits = phone.replace(/\D/g, '');
        const search = digits.length > 4 ? digits.slice(-8) : digits;
        if (!search) {
          if (!cancelled) { setTasks([]); onCountChange?.(0); }
          return;
        }
        const { data: contacts } = await supabase
          .from('client_department_contacts')
          .select('client_id, contact_phone');
        const ids = [...new Set((contacts || [])
          .filter((c: any) => c.contact_phone && c.contact_phone.replace(/\D/g, '').includes(search))
          .map((c: any) => c.client_id))] as string[];
        if (ids.length === 0) {
          if (!cancelled) { setTasks([]); onCountChange?.(0); }
          return;
        }
        const { data } = await supabase
          .from('tasks')
          .select('id,title,priority,due_date,client_id,clients(company_name),task_assignments(profiles:profiles!task_assignments_user_id_fkey(full_name))')
          .in('client_id', ids)
          .eq('status', 'todo')
          .order('due_date', { ascending: true, nullsFirst: false });
        if (!cancelled) {
          const rows = (data as any as TaskRow[]) || [];
          setTasks(rows);
          onCountChange?.(rows.length);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [phone, onCountChange]);

  return (
    <>
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Tarefas pendentes</h2>
          {tasks.length > 0 && (
            <Badge variant="secondary" className="ml-1">{tasks.length}</Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-2">
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-6">Carregando…</p>
          )}
          {!loading && tasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma tarefa "A Fazer" para as empresas vinculadas a este contato.
            </p>
          )}
          {!loading && tasks.map((t) => {
            const responsibles = (t.task_assignments || [])
              .map(a => a.profiles?.full_name)
              .filter(Boolean) as string[];
            const due = t.due_date ? format(new Date(t.due_date + 'T00:00:00'), "dd 'de' MMM", { locale: ptBR }) : null;
            return (
              <a
                key={t.id}
                href={`/tasks?id=${t.id}`}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border bg-card text-card-foreground p-3 hover:border-primary/40 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium leading-snug line-clamp-2">{t.title}</h3>
                  <Badge variant={priorityVariant[t.priority] || 'secondary'} className="shrink-0 text-[10px]">
                    {priorityLabel[t.priority] || t.priority}
                  </Badge>
                </div>
                {t.clients?.company_name && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    <span className="truncate">{t.clients.company_name}</span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  {due ? (
                    <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{due}</span>
                  ) : <span />}
                  {responsibles.length > 0 && (
                    <span className="flex items-center gap-1.5 truncate">
                      <UserIcon className="h-3 w-3" />
                      <span className="truncate">{responsibles.join(', ')}</span>
                    </span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      </ScrollArea>
    </>
  );
}