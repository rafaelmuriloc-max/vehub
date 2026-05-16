import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Learning {
  id: string;
  user_messages: string;
  chosen_department_id: string | null;
  corrected_department_id: string | null;
  outcome: string;
  created_at: string;
  summary: string | null;
}

export function TriageTrainingTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<Learning[]>([]);
  const [deptNames, setDeptNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: learnings }, { data: depts }] = await Promise.all([
      supabase.from('triage_learnings' as any).select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('departments').select('id, name'),
    ]);
    const map: Record<string, string> = {};
    (depts as any[] || []).forEach(d => { map[d.id] = d.name; });
    setDeptNames(map);
    setItems((learnings as any[] || []) as Learning[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const forget = async (id: string) => {
    const { error } = await supabase.from('triage_learnings' as any).delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Exemplo removido' });
    load();
  };

  const total = items.length;
  const confirmed = items.filter(i => i.outcome === 'auto_confirmed').length;
  const corrected = items.filter(i => i.outcome === 'corrected').length;
  const accuracy = total ? Math.round((confirmed / total) * 100) : 0;

  const badgeFor = (outcome: string) => {
    if (outcome === 'auto_confirmed') return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15"><CheckCircle2 className="h-3 w-3 mr-1" />Confirmada</Badge>;
    if (outcome === 'corrected') return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15"><AlertCircle className="h-3 w-3 mr-1" />Corrigida</Badge>;
    return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Rejeitada</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">Triagens registradas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{total}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">Taxa de acerto</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{accuracy}%</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">Correções</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{corrected}</CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aprendizados da Gisele</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cada vez que a Gisele transfere uma conversa, registramos aqui. Após 30 minutos verificamos se a transferência foi mantida. Os últimos exemplos são usados como referência nas próximas triagens.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma triagem registrada ainda.</div>
          ) : (
            <div className="space-y-3">
              {items.map(i => (
                <div key={i.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm flex-1">
                      <div className="text-xs text-muted-foreground mb-1">
                        {new Date(i.created_at).toLocaleString('pt-BR')}
                      </div>
                      <div className="line-clamp-3">{i.user_messages}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => forget(i.id)} title="Esquecer">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {badgeFor(i.outcome)}
                    <span className="text-muted-foreground">Gisele escolheu:</span>
                    <span className="font-medium">{deptNames[i.chosen_department_id || ''] || '—'}</span>
                    {i.corrected_department_id && i.corrected_department_id !== i.chosen_department_id && (
                      <>
                        <span className="text-muted-foreground">→ Correto:</span>
                        <span className="font-medium text-amber-700">{deptNames[i.corrected_department_id] || '—'}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}