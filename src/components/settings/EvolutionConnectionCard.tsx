import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, QrCode, LogOut, RefreshCw, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { EvolutionQrDialog } from './EvolutionQrDialog';

type State = 'open' | 'connecting' | 'close' | 'unknown';

const STATE_LABEL: Record<State, string> = {
  open: 'Conectado',
  connecting: 'Conectando',
  close: 'Desconectado',
  unknown: 'Desconhecido',
};

export function EvolutionConnectionCard() {
  const [state, setState] = useState<State>('unknown');
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  async function fetchState() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('evolution-connection-state');
    setLoading(false);
    if (error) {
      toast.error('Falha ao consultar status');
      return;
    }
    if (data?.ok) {
      setState((data.state as State) || 'unknown');
      setNotFound(Boolean(data.notFound));
    } else if (data?.error) {
      toast.error(data.error);
    }
  }

  useEffect(() => { fetchState(); }, []);

  async function handleLogout() {
    if (!confirm('Desconectar o WhatsApp da Evolution API?')) return;
    setActing('logout');
    const { data } = await supabase.functions.invoke('evolution-logout');
    setActing(null);
    if (data?.ok) { toast.success('Desconectado'); fetchState(); }
    else toast.error(data?.error || 'Falha ao desconectar');
  }

  async function handleRestart() {
    if (!confirm('Reiniciar a instância?')) return;
    setActing('restart');
    const { data } = await supabase.functions.invoke('evolution-restart');
    setActing(null);
    if (data?.ok) { toast.success('Instância reiniciada'); setTimeout(fetchState, 1500); }
    else toast.error(data?.error || 'Falha ao reiniciar');
  }

  async function handleDeleteInstance() {
    if (!confirm('Isso apaga a instância e a sessão atual na Evolution API. Você precisará criar uma nova e escanear o QR Code novamente. Continuar?')) return;
    setActing('delete');
    const { data } = await supabase.functions.invoke('evolution-instance-delete');
    setActing(null);
    if (data?.ok) { toast.success('Instância excluída'); setState('close'); setNotFound(true); }
    else toast.error(data?.error || 'Falha ao excluir instância');
  }

  async function handleCreateInstance() {
    setActing('create');
    const { data } = await supabase.functions.invoke('evolution-instance-create');
    setActing(null);
    if (data?.ok) {
      toast.success('Instância criada. Escaneie o QR Code.');
      setNotFound(false);
      setQrOpen(true);
    } else {
      toast.error(data?.error || 'Falha ao criar instância');
    }
  }

  const variant = state === 'open' ? 'default' : state === 'connecting' ? 'secondary' : 'destructive';

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Conexão WhatsApp (Evolution API)</CardTitle>
              <CardDescription>Gerencie a conexão da instância e gere um novo QR Code quando necessário.</CardDescription>
            </div>
            <Badge variant={variant as any}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              {notFound ? 'Instância inexistente' : STATE_LABEL[state]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {notFound && (
            <p className="text-sm text-muted-foreground">
              A instância não existe na Evolution API. Clique em "Criar nova instância" para configurar.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
          <Button onClick={() => setQrOpen(true)} disabled={state === 'open' || notFound}>
            <QrCode className="h-4 w-4 mr-2" />
            Gerar novo QR Code
          </Button>
          <Button variant="outline" onClick={fetchState} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar status
          </Button>
          <Button variant="outline" onClick={handleRestart} disabled={acting === 'restart' || notFound}>
            {acting === 'restart' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
            Reiniciar
          </Button>
          <Button variant="destructive" onClick={handleLogout} disabled={acting === 'logout' || state !== 'open'}>
            {acting === 'logout' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogOut className="h-4 w-4 mr-2" />}
            Desconectar
          </Button>
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium">Zona de manutenção</p>
            <p className="text-xs text-muted-foreground">
              Use estas ações se a conexão estiver corrompida e o QR Code não funcionar.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleCreateInstance}
                disabled={acting === 'create' || (state === 'open' && !notFound)}
              >
                {acting === 'create' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Criar nova instância
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteInstance}
                disabled={acting === 'delete' || notFound}
              >
                {acting === 'delete' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Excluir instância
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <EvolutionQrDialog
        open={qrOpen}
        onOpenChange={(o) => { setQrOpen(o); if (!o) fetchState(); }}
        onConnected={() => { setState('open'); setQrOpen(false); toast.success('WhatsApp conectado!'); }}
      />
    </>
  );
}