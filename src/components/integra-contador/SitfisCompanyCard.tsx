import { useState } from 'react';
import { AlertCircle, Building2, CalendarClock, ChevronDown, Download, Eye, FileSearch, Loader2, RefreshCw } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn, formatClientLabel, normalizeTaxRegime } from '@/lib/utils';
import { PENDENCY_LABELS, resolveStatusKey } from './SitfisOverviewPanel';
import type { SitfisStructuredReport } from './sitfisParser';

export type SitfisCardClient = {
  id: string; sci_code?: string | null; company_name: string; document: string | null;
  tax_regime: string | null; sitfis_status: string | null; consulted_at: string | null;
  pdf_base64: string | null; error_message: string | null; pendency_types: string[];
};

type Props = {
  client: SitfisCardClient; selected: boolean; parsed?: SitfisStructuredReport; parsing?: boolean; consulting?: boolean;
  onSelect: () => void; onRequestParse: () => void; onDetails: () => void; onDownload: () => void; onConsult: () => void;
};

const unavailable = <span className="text-muted-foreground">Informação não disponível</span>;
function documentLabel(value: string | null) {
  const d = (value || '').replace(/\D/g, '');
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : value || 'Informação não disponível';
}
function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca consultado';
}
function Status({ status }: { status: string | null }) {
  const key = resolveStatusKey(status);
  const styles: Record<string, string> = {
    regular: 'border-calendar-green/30 bg-calendar-green-soft text-calendar-green', irregular: 'border-destructive/30 bg-calendar-red-soft text-destructive',
    error: 'border-primary/30 bg-calendar-orange-soft text-primary', sem_procuracao: 'border-primary/30 bg-calendar-orange-soft text-primary',
    pending: 'border-border bg-muted text-muted-foreground',
  };
  const labels: Record<string, string> = { regular: 'Regular', irregular: 'Com pendência', error: 'Erro', sem_procuracao: 'Sem procuração', pending: 'Sem consulta' };
  return <Badge variant="outline" className={cn('rounded-sm font-semibold', styles[key])}>{labels[key] || key}</Badge>;
}

export default function SitfisCompanyCard(props: Props) {
  const { client, parsed } = props;
  const [open, setOpen] = useState(false);
  const types = parsed?.occurrenceTypes.length ? parsed.occurrenceTypes : client.pendency_types;
  const count = parsed ? parsed.totalOccurrences : client.sitfis_status === 'irregular' ? client.pendency_types.length : 0;
  const changeOpen = (next: boolean) => { setOpen(next); if (next) props.onRequestParse(); };
  return (
    <Card className="overflow-hidden rounded-md shadow-sm">
      <Collapsible open={open} onOpenChange={changeOpen}>
        <CardContent className="p-0">
          <div className="grid gap-4 p-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
            <Checkbox checked={props.selected} onCheckedChange={props.onSelect} aria-label={`Selecionar ${client.company_name}`} />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-semibold text-foreground">{formatClientLabel(client)}</h3>
                <Status status={client.sitfis_status} />
                <Badge variant="secondary" className="rounded-sm">{count} {count === 1 ? 'ocorrência' : 'ocorrências'}</Badge>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{documentLabel(client.document)}</span>
                <span>{normalizeTaxRegime(client.tax_regime) || 'Regime não informado'}</span>
                <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />{dateTime(client.consulted_at)}</span>
              </div>
              {types.length > 0 && <div className="flex flex-wrap gap-1.5">{types.map(type => <Badge key={type} variant="outline" className="rounded-sm text-[11px]">{PENDENCY_LABELS[type] || type}</Badge>)}</div>}
              {client.error_message && <p className="flex items-center gap-1.5 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5" />{client.error_message}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button variant="outline" size="sm" onClick={props.onDetails} disabled={!client.pdf_base64}><Eye className="mr-2 h-4 w-4" />Ver detalhes</Button>
              <Button variant="outline" size="sm" onClick={props.onDownload} disabled={!client.pdf_base64}><Download className="mr-2 h-4 w-4" />Baixar relatório</Button>
              <Button variant="ghost" size="icon" onClick={props.onConsult} disabled={props.consulting} title="Consultar novamente">{props.consulting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
              <CollapsibleTrigger asChild><Button variant="ghost" size="icon" aria-label={open ? 'Recolher empresa' : 'Expandir empresa'}><ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} /></Button></CollapsibleTrigger>
            </div>
          </div>
          <CollapsibleContent className="border-t bg-muted/20 px-4 py-3">
            {props.parsing ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Estruturando relatório...</div>
              : !client.pdf_base64 ? <div className="py-6 text-center text-sm text-muted-foreground">Relatório não disponível — refaça a consulta.</div>
              : parsed ? <Accordion type="multiple" className="grid gap-2 xl:grid-cols-2">
                  <AccordionItem value="omissoes" className="rounded-sm border px-3"><AccordionTrigger className="py-3 hover:no-underline">Declarações omitidas <Badge variant="secondary">{parsed.omissions.length}</Badge></AccordionTrigger><AccordionContent>{parsed.omissions.length ? parsed.omissions.map((item, i) => <div key={i} className="border-t py-3 text-sm"><strong>{item.declaration}</strong><p className="mt-1 text-muted-foreground">{item.reason}</p><div className="mt-2 flex flex-wrap gap-1">{item.competencies.length ? item.competencies.map(c => <Badge key={c} variant="outline" className="rounded-sm">{c.slice(5)}/{c.slice(0, 4)}</Badge>) : unavailable}</div></div>) : <p className="text-muted-foreground">Nenhuma omissão identificada.</p>}</AccordionContent></AccordionItem>
                  <AccordionItem value="debitos" className="rounded-sm border px-3"><AccordionTrigger className="py-3 hover:no-underline">Débitos tributários <Badge variant="secondary">{parsed.debts.length}</Badge></AccordionTrigger><AccordionContent>{parsed.debts.length ? parsed.debts.map((item, i) => <div key={i} className="border-t py-3 text-sm"><strong>{item.tax || 'Débito não identificado'}</strong><p className="mt-1 text-muted-foreground">Competência: {item.competency || 'Informação não disponível'} · Vencimento: {item.dueDate || 'Informação não disponível'}</p></div>) : <p className="text-muted-foreground">Nenhum débito identificado.</p>}</AccordionContent></AccordionItem>
                  <AccordionItem value="parcelamentos" className="rounded-sm border px-3"><AccordionTrigger className="py-3 hover:no-underline">Parcelamentos <Badge variant="secondary">{parsed.installments.length}</Badge></AccordionTrigger><AccordionContent>{parsed.installments.length ? parsed.installments.map((item, i) => <div key={i} className="border-t py-3 text-sm"><strong>{item.modality || 'Modalidade não disponível'}</strong><p className="mt-1 text-muted-foreground">Situação: {item.status || 'Informação não disponível'} · Nº: {item.number || 'Informação não disponível'}</p></div>) : <p className="text-muted-foreground">Nenhum parcelamento identificado.</p>}</AccordionContent></AccordionItem>
                  <AccordionItem value="suspensoes" className="rounded-sm border px-3"><AccordionTrigger className="py-3 hover:no-underline">Processos / exigibilidade suspensa <Badge variant="secondary">{parsed.suspensions.length}</Badge></AccordionTrigger><AccordionContent>{parsed.suspensions.length ? parsed.suspensions.map((item, i) => <div key={i} className="border-t py-3 text-sm"><strong>{item.status || 'Exigibilidade suspensa'}</strong><p className="mt-1 text-muted-foreground">Processo: {item.identification || 'Informação não disponível'}</p></div>) : <p className="text-muted-foreground">Nenhum processo identificado.</p>}</AccordionContent></AccordionItem>
                  <AccordionItem value="pgfn" className="rounded-sm border px-3 xl:col-span-2"><AccordionTrigger className="py-3 hover:no-underline">Situação na PGFN <Badge variant="secondary">{parsed.pgfn.length}</Badge></AccordionTrigger><AccordionContent>{parsed.pgfn.length ? parsed.pgfn.map((item, i) => <div key={i} className="border-t py-3 text-sm"><Status status={item.status === 'regular' ? 'regular' : item.status === 'irregular' ? 'irregular' : 'pending'} /><p className="mt-2 text-muted-foreground">{item.description || 'Informação não disponível'}</p></div>) : <p className="text-muted-foreground">Informação não disponível.</p>}</AccordionContent></AccordionItem>
                </Accordion>
              : <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><FileSearch className="h-4 w-4" />Não foi possível estruturar o relatório.</div>}
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
