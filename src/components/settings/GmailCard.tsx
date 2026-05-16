import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Mail, RefreshCw, Loader2 } from 'lucide-react';

export function GmailCard({ admin }: { admin: boolean }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('gmail_connected_email, gmail_last_sync_at')
      .limit(1).maybeSingle();
    setEmail((data as any)?.gmail_connected_email || null);
    setLastSync((data as any)?.gmail_last_sync_at || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmail-sync', { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: 'Sincronização concluída',
        description: `${data?.inserted ?? 0} novas mensagens importadas.`,
      });
      load();
    } catch (e: any) {
      toast({ title: 'Erro na sincronização', description: e.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> E-mail Central (Gmail)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Conta única do escritório para receber e enviar e-mails. Toda a equipe acessa esta caixa
          centralizada na página <strong>E-mail</strong>.
        </p>

        {email ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="bg-green-600 hover:bg-green-700 text-white">
                Conectado
              </Badge>
              <span className="font-medium text-sm">{email}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Última sincronização: {lastSync ? new Date(lastSync).toLocaleString('pt-BR') : 'nunca'}
            </p>
            {admin && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={syncing} onClick={sync}>
                  {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Sincronizar agora
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Para trocar a conta conectada, peça ao desenvolvedor para reconectar via painel Lovable.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">Nenhuma conta Gmail conectada.</p>
            {admin && (
              <Button variant="outline" size="sm" disabled={syncing} onClick={sync}>
                {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Verificar / Sincronizar
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              A conta Gmail do escritório é vinculada via Lovable. Após conectar, clique em "Sincronizar"
              para importar as últimas mensagens.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}