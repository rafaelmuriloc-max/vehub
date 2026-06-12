import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export function BillPaymentDialog({ open, onOpenChange, entry, onPaid }: { open: boolean; onOpenChange: (b: boolean) => void; entry: any | null; onPaid: () => void }) {
  const [barCode, setBarCode] = useState('');
  const [pix, setPix] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function submit(mode: 'boleto' | 'pix') {
    if (!entry) return;
    setLoading(true);
    const body: any = { entry_id: entry.id, scheduled_date: scheduledDate || entry.due_date };
    if (mode === 'boleto') body.bar_code = barCode;
    else body.pix_qr_code = pix;
    const { data, error } = await supabase.functions.invoke('asaas-bill-pay', { body });
    setLoading(false);
    if (error || data?.error) toast({ title: 'Erro', description: error?.message || data?.error, variant: 'destructive' });
    else { toast({ title: 'Pagamento enviado ao Asaas' }); onOpenChange(false); onPaid(); setBarCode(''); setPix(''); }
  }

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Pagar via Asaas — {entry.description}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Valor: R$ {Number(entry.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        <Tabs defaultValue="boleto">
          <TabsList className="grid grid-cols-2"><TabsTrigger value="boleto">Boleto</TabsTrigger><TabsTrigger value="pix">PIX</TabsTrigger></TabsList>
          <TabsContent value="boleto" className="space-y-3">
            <div><Label>Linha digitável / código de barras *</Label><Input value={barCode} onChange={e => setBarCode(e.target.value)} placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" /></div>
            <div><Label>Data de agendamento</Label><Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} /></div>
            <Button onClick={() => submit('boleto')} disabled={!barCode || loading} className="w-full">{loading ? 'Enviando...' : 'Pagar Boleto'}</Button>
          </TabsContent>
          <TabsContent value="pix" className="space-y-3">
            <div><Label>Chave PIX / QR Code *</Label><Input value={pix} onChange={e => setPix(e.target.value)} placeholder="Cole a chave PIX ou QR Code copia-cola" /></div>
            <Button onClick={() => submit('pix')} disabled={!pix || loading} className="w-full">{loading ? 'Enviando...' : 'Pagar PIX'}</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}