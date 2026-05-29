import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileDown, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';

type Competencia = {
  id: string;
  client_id: string;
  competencia: string;
  valor_das: number | null;
  numero_das: string | null;
  numero_declaracao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string;
  das_pdf_base64: string | null;
  declaracao_pdf_base64: string | null;
  comprovante_pdf_base64: string | null;
};

const MES_NOMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatBRL(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function periodoAAAAMM(year: number, month: number): string {
  return `${year}${String(month).padStart(2, '0')}`;
}

function openBase64Pdf(base64: string, filename: string) {
  const dataUrl = `data:application/pdf;base64,${base64}`;
  const win = window.open(dataUrl, '_blank');
  if (!win) {
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
}

function walkForPdf(o: any): string | null {
  if (!o || typeof o !== 'object') return null;
  for (const [k, v] of Object.entries(o)) {
    if (k === 'pdf' && typeof v === 'string' && (v as string).length > 100) return v as string;
    if (typeof v === 'string' && (v as string).startsWith('JVBERi0') && (v as string).length > 100) return v as string;
    if (typeof v === 'object') { const f = walkForPdf(v); if (f) return f; }
  }
  return null;
}

type Props = {
  clientId: string;
  year: number;
  month: number;
  competencia: Competencia | null;
  onChanged?: () => void;
};

type Action = 'gerar_guia' | 'recalcular' | 'ultima_declaracao' | 'comprovante';

export default function CompetenciaRow({ clientId, year, month, competencia, onChanged }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<Action | null>(null);

  const periodo = periodoAAAAMM(year, month);
  const mesNome = MES_NOMES[month - 1];
  const status = competencia?.status ?? 'aberto';
  const isPago = status === 'pago';
  const isSemMov = status === 'sem_movimento';

  async function runAction(action: Action) {
    setBusy(action);
    try {
      let body: any;
      switch (action) {
        case 'gerar_guia':
          body = { idSistema: 'PGDASD', idServico: 'GERARDAS12', tipo: 'Emitir', dados: JSON.stringify({ periodoApuracao: periodo }) };
          break;
        case 'recalcular':
          // Recalcula = gera DAS novamente; transmissão completa exige form de declaração
          body = { idSistema: 'PGDASD', idServico: 'GERARDAS12', tipo: 'Emitir', dados: JSON.stringify({ periodoApuracao: periodo }) };
          break;
        case 'ultima_declaracao':
          body = { idSistema: 'PGDASD', idServico: 'CONSULTIMADECREC14', tipo: 'Consultar', dados: JSON.stringify({ periodoApuracao: periodo }) };
          break;
        case 'comprovante':
          if (!competencia?.numero_das) {
            toast({ title: 'Sem número do DAS', description: 'Não foi possível localizar o número do DAS pago.', variant: 'destructive' });
            return;
          }
          body = { idSistema: 'PGDASD', idServico: 'CONSEXTRATO16', tipo: 'Consultar', dados: JSON.stringify({ numeroDas: competencia.numero_das }) };
          break;
      }

      const { data, error } = await supabase.functions.invoke('integra-contador', {
        body: { client_id: clientId, ...body },
      });
      if (error) throw error;
      if (data?.success === false && data?.status !== 304) {
        const msgs = data?.data?.mensagens;
        const errMsg = msgs?.map((m: any) => m.texto).join('; ') || data?.error || 'Erro desconhecido';
        throw new Error(errMsg);
      }

      // Extrair PDF
      const dadosRaw = data?.data?.dados ?? data?.dados;
      const dados = typeof dadosRaw === 'string' ? (() => { try { return JSON.parse(dadosRaw); } catch { return null; } })() : dadosRaw;
      const arr = Array.isArray(dados) ? dados[0] : dados;
      const pdf = walkForPdf(dados) || walkForPdf(data?.data);

      if (pdf) {
        const filename =
          action === 'gerar_guia' || action === 'recalcular' ? `DAS_${periodo}.pdf` :
          action === 'ultima_declaracao' ? `Declaracao_${periodo}.pdf` :
          `Comprovante_${periodo}.pdf`;
        openBase64Pdf(pdf, filename);

        // Persistir na tabela
        const updates: any = { last_synced_at: new Date().toISOString() };
        if (action === 'gerar_guia' || action === 'recalcular') {
          updates.das_pdf_base64 = pdf;
          updates.valor_das = arr?.valorTotalDocumento ?? arr?.valor ?? null;
          updates.numero_das = arr?.numeroDocumento ?? arr?.numeroDas ?? competencia?.numero_das ?? null;
          updates.data_vencimento = arr?.dataVencimento ?? competencia?.data_vencimento ?? null;
        } else if (action === 'ultima_declaracao') {
          updates.declaracao_pdf_base64 = pdf;
          updates.numero_declaracao = arr?.numeroDeclaracao ?? competencia?.numero_declaracao ?? null;
        } else if (action === 'comprovante') {
          updates.comprovante_pdf_base64 = pdf;
        }

        await supabase.from('simples_nacional_competencias' as any).upsert({
          client_id: clientId,
          competencia: `${year}-${String(month).padStart(2, '0')}-01`,
          ano: year,
          ...updates,
        }, { onConflict: 'client_id,competencia' });
        onChanged?.();
      } else {
        toast({ title: 'Sem PDF', description: 'A resposta não trouxe arquivo PDF.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[80px_140px_130px_1fr] gap-2 md:gap-3 items-center px-3 py-2 rounded-md bg-background border">
      <div className="font-semibold text-sm text-foreground">{mesNome}/{year}</div>
      <div className="text-sm tabular-nums">{formatBRL(competencia?.valor_das)}</div>
      <div>
        {isPago ? (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Pago
          </Badge>
        ) : isSemMov ? (
          <Badge variant="secondary">Sem movimento</Badge>
        ) : (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
            Em aberto
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 justify-start md:justify-end">
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => runAction('gerar_guia')}>
          {busy === 'gerar_guia' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileDown className="h-3 w-3 mr-1" />}
          Gerar guia
        </Button>
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => runAction('recalcular')}>
          {busy === 'recalcular' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Recalcular
        </Button>
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => runAction('ultima_declaracao')}>
          {busy === 'ultima_declaracao' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
          Declaração
        </Button>
        {isPago && (
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => runAction('comprovante')}>
            {busy === 'comprovante' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
            Comprovante
          </Button>
        )}
      </div>
    </div>
  );
}
