import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Download, Send, Calculator, FileText, ExternalLink, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientIds: string[];
  onSend: (file: File, mensagem: string) => void | Promise<void>;
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
  const [mensagem, setMensagem] = useState('');

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
      const comp = tipo === 'simples' || categoria === 'GERAL_MENSAL' ? `${mes}/${ano}` : `${categoria === '13_SALARIO' ? '13º salário ' : 'anual '}${ano}`;
      const desc = tipo === 'simples' ? 'do Simples Nacional (DAS)' : 'da DCTFWeb (DARF previdenciário)';
      setMensagem(`Olá! Segue a guia ${desc} da competência ${comp} da empresa ${client.company_name}, recalculada com juros e multa até hoje. Qualquer dúvida, estamos à disposição.`);
    } catch (e) {
      toast({ title: 'Guia indisponível', description: (e as Error).message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const showMes = tipo === 'simples' || categoria === 'GERAL_MENSAL';
  const sizeKb = pdf ? Math.max(1, Math.round(pdf.file.size / 1024)) : 0;
  const Label = ({ children }: { children: React.ReactNode }) => (
    <span className="text-xs font-medium text-muted-foreground">{children}</span>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 p-0 w-full max-w-full h-[100dvh] max-h-[100dvh] rounded-none sm:h-auto sm:max-h-[90dvh] sm:max-w-xl sm:rounded-lg overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 pt-5 pb-3 border-b text-left shrink-0">
          <DialogTitle className="flex items-center gap-2 pr-6"><Calculator className="h-5 w-5 text-primary" /> Recalcular guia</DialogTitle>
          <DialogDescription>A Receita emite a guia atualizada com juros e multa até hoje.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Dados da guia</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 space-y-1">
                <Label>Empresa</Label>
                <Select value={clientId} onValueChange={(v) => { setClientId(v); setPdf(null); }}>
                  <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label className={`col-span-2 space-y-1 ${tipo === 'dctfweb' ? 'sm:col-span-1' : ''}`}>
                <Label>Tipo de guia</Label>
                <Select value={tipo} onValueChange={(v) => { setTipo(v as Tipo); setPdf(null); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples">Simples Nacional (DAS)</SelectItem>
                    <SelectItem value="dctfweb">DCTFWeb (DARF previdenciário)</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              {tipo === 'dctfweb' && (
                <label className="col-span-2 sm:col-span-1 space-y-1">
                  <Label>Categoria</Label>
                  <Select value={categoria} onValueChange={(v) => { setCategoria(v); setPdf(null); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GERAL_MENSAL">Geral Mensal</SelectItem>
                      <SelectItem value="13_SALARIO">13º Salário</SelectItem>
                      <SelectItem value="GERAL_ANUAL">Geral Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              )}
              {showMes && (
                <label className="space-y-1">
                  <Label>Mês</Label>
                  <Select value={mes} onValueChange={(v) => { setMes(v); setPdf(null); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
              )}
              <label className={`space-y-1 ${showMes ? '' : 'col-span-2'}`}>
                <Label>Ano</Label>
                <Select value={ano} onValueChange={(v) => { setAno(v); setPdf(null); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            </div>
          </section>

          {pdf && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Guia gerada</h3>
              <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{tipo === 'simples' ? 'DAS – Simples Nacional' : 'DARF – DCTFWeb'} • {showMes ? `${mes}/${ano}` : ano}</p>
                  <p className="text-xs text-muted-foreground truncate">{client?.company_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{pdf.file.name} • {sizeKb} KB</p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => window.open(pdf.url, '_blank')}>
                  <ExternalLink className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Abrir guia</span>
                </Button>
              </div>
              <label className="block space-y-1">
                <div className="flex items-center justify-between">
                  <Label>Mensagem para o cliente</Label>
                  <span className="text-xs text-muted-foreground">{mensagem.length} caracteres</span>
                </div>
                <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={4} className="resize-none" placeholder="Mensagem para o cliente (opcional)" />
              </label>
            </section>
          )}
        </div>

        <div className="shrink-0 border-t bg-background px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {pdf ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button variant="outline" onClick={() => { const a = document.createElement('a'); a.href = pdf.url; a.download = pdf.file.name; a.click(); }}>
                  <Download className="h-4 w-4 mr-2" /> Baixar
                </Button>
                <Button variant="outline" onClick={gerar} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />} Gerar de novo
                </Button>
              </div>
              <Button className="w-full sm:w-auto" onClick={() => { onSend(pdf.file, mensagem); onOpenChange(false); }}>
                <Send className="h-4 w-4 mr-2" /> Enviar no chat
              </Button>
            </div>
          ) : (
            <Button className="w-full sm:w-auto sm:float-right" onClick={gerar} disabled={busy || !client}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />} {busy ? 'Gerando…' : 'Gerar guia'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
