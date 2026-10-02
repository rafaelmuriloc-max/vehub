import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download, Send, Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientIds: string[];
  onSend: (file: File) => void;
}

type Tipo = 'simples' | 'dctfweb';
const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

function walkForPdf(o: any): string | null {
  if (!o || typeof o !== 'object') return null;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' && v.length > 100 && (k.toLowerCase() === 'pdf' || v.startsWith('JVBERi0'))) return v;
    if (typeof v === 'object') { const f = walkForPdf(v); if (f) return f; }
  }
  return null;
}
const safeName = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '_').slice(0, 40);

export function RecalcGuiaDialog({ open, onOpenChange, clientIds, onSend }: Props) {
  const { toast } = useToast();
  const prev = new Date(); prev.setDate(1); prev.setMonth(prev.getMonth() - 1);
  const [clients, setClients] = useState<{ id: string; company_name: string; tax_regime: string | null }[]>([]);
  const [clientId, setClientId] = useState('');
  const [tipo, setTipo] = useState<Tipo>('simples');
  const [mes, setMes] = useState(String(prev.getMonth() + 1).padStart(2, '0'));
  const [ano, setAno] = useState(String(prev.getFullYear()));
  const [categoria, setCategoria] = useState('GERAL_MENSAL');
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<{ url: string; file: File } | null>(null);

  const key = clientIds.join(',');
  useEffect(() => {
    if (!open || !clientIds.length) return;
    setPdf(null);
    supabase.from('clients').select('id, company_name, tax_regime').in('id', clientIds).order('company_name')
      .then(({ data }) => {
        const list = (data || []) as any[];
        setClients(list);
        const first = list[0];
        if (first) { setClientId(first.id); setTipo(first.tax_regime === 'Simples Nacional' ? 'simples' : 'dctfweb'); }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);

  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i)), []);
  const client = clients.find(c => c.id === clientId);

  const gerar = async () => {
    if (!client) return;
    setBusy(true); setPdf(null);
    try {
      let body: Record<string, unknown>;
      if (tipo === 'simples') {
        body = { client_id: client.id, idSistema: 'PGDASD', idServico: 'GERARDAS12', tipo: 'Emitir', dados: JSON.stringify({ periodoApuracao: `${ano}${mes}` }) };
      } else {
        const dados: Record<string, unknown> = { categoria, anoPA: ano };
        if (categoria === 'GERAL_MENSAL') dados.mesPA = mes;
        body = { client_id: client.id, idSistema: 'DCTFWEB', idServico: 'GERARGUIA31', tipo: 'Emitir', dados: JSON.stringify(dados) };
      }
      const { data, error } = await supabase.functions.invoke('integra-contador', { body });
      if (error) throw error;
      const msgs = (data?.data?.mensagens || data?.mensagens || []) as Array<{ texto: string }>;
      const raw = data?.data?.dados ?? data?.dados;
      const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : raw;
      const b64 = (typeof parsed === 'string' && parsed.startsWith('JVBERi0') ? parsed : null) || walkForPdf(parsed) || walkForPdf(data?.data);
      if (!b64) throw new Error(msgs.map(m => m.texto).join('; ') || data?.error || 'A Receita não retornou a guia.');
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const name = `Guia_${tipo === 'simples' ? 'DAS' : 'DCTFWeb'}_${ano}${mes}_${safeName(client.company_name)}.pdf`;
      const file = new File([arr], name, { type: 'application/pdf' });
      setPdf({ url: URL.createObjectURL(file), file });
    } catch (e) {
      toast({ title: 'Guia indisponível', description: (e as Error).message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Recalcular guia</DialogTitle>
          <DialogDescription>A Receita emite a guia atualizada com juros e multa até hoje.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Select value={clientId} onValueChange={(v) => { setClientId(v); setPdf(null); }}>
              <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Select value={tipo} onValueChange={(v) => { setTipo(v as Tipo); setPdf(null); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="simples">Simples Nacional (DAS)</SelectItem>
              <SelectItem value="dctfweb">DCTFWeb (DARF previdenciário)</SelectItem>
            </SelectContent>
          </Select>
          {tipo === 'dctfweb' ? (
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GERAL_MENSAL">Geral Mensal</SelectItem>
                <SelectItem value="13_SALARIO">13º Salário</SelectItem>
                <SelectItem value="GERAL_ANUAL">Geral Anual</SelectItem>
              </SelectContent>
            </Select>
          ) : <div className="hidden sm:block" />}
          {(tipo === 'simples' || categoria === 'GERAL_MENSAL') && (
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {pdf && <iframe src={pdf.url} title="Guia" className="w-full h-[50dvh] rounded border" />}
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {pdf ? (
            <>
              <Button variant="outline" onClick={() => { const a = document.createElement('a'); a.href = pdf.url; a.download = pdf.file.name; a.click(); }}>
                <Download className="h-4 w-4 mr-2" /> Baixar
              </Button>
              <Button variant="outline" onClick={gerar} disabled={busy}>Gerar de novo</Button>
              <Button onClick={() => { onSend(pdf.file); onOpenChange(false); }}>
                <Send className="h-4 w-4 mr-2" /> Enviar no chat
              </Button>
            </>
          ) : (
            <Button onClick={gerar} disabled={busy || !client}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />} Gerar guia
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
