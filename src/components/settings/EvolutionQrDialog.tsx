import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
}

export function EvolutionQrDialog({ open, onOpenChange, onConnected }: Props) {
  const [loading, setLoading] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [pairing, setPairing] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const pollRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  function clearTimers() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function generate() {
    setLoading(true);
    setQr(null); setPairing(null);
    const { data, error } = await supabase.functions.invoke('evolution-connect');
    setLoading(false);
    if (error || !data?.ok) {
      toast.error(data?.error || 'Falha ao gerar QR Code');
      return;
    }
    setQr(data.base64 || null);
    setPairing(data.pairingCode || null);
    setSecondsLeft(60);
    startPolling();
  }

  function startPolling() {
    clearTimers();
    pollRef.current = window.setInterval(async () => {
      const { data } = await supabase.functions.invoke('evolution-connection-state');
      if (data?.ok && data.state === 'open') {
        clearTimers();
        onConnected();
      }
    }, 3000);
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearTimers(); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    if (open) generate();
    else { clearTimers(); setQr(null); setPairing(null); }
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const qrSrc = qr ? (qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp</DialogTitle>
          <DialogDescription>
            Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho e escaneie o QR Code abaixo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-4">
          {loading && <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />}
          {!loading && qrSrc && (
            <img src={qrSrc} alt="QR Code" className="w-64 h-64 border rounded" />
          )}
          {!loading && !qrSrc && (
            <p className="text-sm text-muted-foreground">Nenhum QR Code disponível.</p>
          )}
          {pairing && (
            <p className="text-sm">
              Código de pareamento: <span className="font-mono font-semibold">{pairing}</span>
            </p>
          )}
          {qrSrc && secondsLeft > 0 && (
            <p className="text-xs text-muted-foreground">Expira em {secondsLeft}s</p>
          )}
          {qrSrc && secondsLeft === 0 && (
            <p className="text-xs text-destructive">QR Code expirou. Gere um novo.</p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={generate} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Gerar novo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}