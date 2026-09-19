import { Download, ExternalLink, FileText } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatClientLabel } from '@/lib/utils';
import type { SitfisCardClient } from './SitfisCompanyCard';
import type { SitfisSource, SitfisStructuredReport } from './sitfisParser';

type Props = { client: SitfisCardClient | null; parsed?: SitfisStructuredReport; onClose: () => void; onOpenPdf: () => void; onDownload: () => void };
const text = (value: string | null | undefined) => value || 'Informação não disponível';
const money = (value: number | null) => value == null ? 'Informação não disponível' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const documentLabel = (value: string | null) => {
  const digits = (value || '').replace(/\D/g, '');
  return digits.length === 14 ? `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}` : value || 'CNPJ não informado';
};
function Trace({ source }: { source: SitfisSource }) { return <span className="text-[11px] text-muted-foreground">Fonte: {source.section}{source.page ? ` · página ${source.page}` : ''}</span>; }
function Competencies({ values }: { values: string[] }) {
  const groups = values.reduce<Record<string, string[]>>((acc, value) => {
    const [year, month] = value.split('-');
    if (!acc[year]) acc[year] = [];
    acc[year].push(month);
    return acc;
  }, {});
  if (!values.length) return <span className="text-muted-foreground">Informação não disponível</span>;
  return <div className="space-y-2">{Object.entries(groups).map(([year, months]) => <div key={year} className="flex items-center gap-2"><strong className="w-10 text-xs">{year}</strong><div className="flex flex-wrap gap-1">{months.map(month => <Badge key={`${year}-${month}`} variant="outline" className="rounded-sm">{month}</Badge>)}</div></div>)}</div>;
}

export default function SitfisDetailPanel({ client, parsed, onClose, onOpenPdf, onDownload }: Props) {
  const dataUrl = client?.pdf_base64 ? `data:application/pdf;base64,${client.pdf_base64}` : '';
  return <Sheet open={!!client} onOpenChange={open => !open && onClose()}>
    <SheetContent side="right" className="w-full p-0 sm:max-w-4xl">
      {client && <div className="flex h-full flex-col">
        <SheetHeader className="border-b p-5 pr-12">
          <SheetTitle>{formatClientLabel(client)}</SheetTitle>
          <SheetDescription>{documentLabel(client.document)} · Consulta {client.consulted_at ? new Date(client.consulted_at).toLocaleString('pt-BR') : 'não realizada'}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="space-y-5 p-5">
            {!parsed ? <p className="rounded-sm border bg-muted/30 p-4 text-sm text-muted-foreground">Não foi possível extrair informações estruturadas com segurança. Consulte o relatório original.</p> : <>
              <section><h3 className="mb-2 font-semibold">Declarações omitidas <Badge variant="secondary" className="ml-2">{parsed.omissions.length}</Badge></h3>{parsed.omissions.length ? parsed.omissions.map((item, i) => <div key={i} className="mb-2 rounded-sm border p-3 text-sm"><div className="font-medium">{item.declaration}</div><p className="my-1 text-muted-foreground">{item.reason}</p><div className="my-2"><Competencies values={item.competencies} /></div><Trace source={item.source} /></div>) : <p className="text-sm text-muted-foreground">Nenhuma omissão identificada.</p>}</section>
              <section><h3 className="mb-2 font-semibold">Débitos tributários <Badge variant="secondary" className="ml-2">{parsed.debts.length}</Badge></h3>{parsed.debts.length ? <div className="overflow-x-auto rounded-sm border"><Table><TableHeader><TableRow><TableHead>Tributo</TableHead><TableHead>Competência</TableHead><TableHead>Principal</TableHead><TableHead>Atualizado</TableHead><TableHead>Vencimento</TableHead><TableHead>Órgão</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader><TableBody>{parsed.debts.map((item, i) => <TableRow key={i}><TableCell>{text(item.tax)}<div><Trace source={item.source} /></div></TableCell><TableCell>{text(item.competency)}</TableCell><TableCell>{money(item.principal)}</TableCell><TableCell>{money(item.updated)}</TableCell><TableCell>{text(item.dueDate)}</TableCell><TableCell>{text(item.agency)}</TableCell><TableCell>{text(item.status)}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="text-sm text-muted-foreground">Nenhum débito identificado.</p>}</section>
              <section><h3 className="mb-2 font-semibold">Parcelamentos <Badge variant="secondary" className="ml-2">{parsed.installments.length}</Badge></h3>{parsed.installments.length ? <div className="overflow-x-auto rounded-sm border"><Table><TableHeader><TableRow><TableHead>Modalidade</TableHead><TableHead>Número</TableHead><TableHead>Situação</TableHead><TableHead>Saldo</TableHead><TableHead>Órgão</TableHead></TableRow></TableHeader><TableBody>{parsed.installments.map((item, i) => <TableRow key={i}><TableCell>{text(item.modality)}<div><Trace source={item.source} /></div></TableCell><TableCell>{text(item.number)}</TableCell><TableCell>{text(item.status)}</TableCell><TableCell>{money(item.balance)}</TableCell><TableCell>{text(item.agency)}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="text-sm text-muted-foreground">Nenhum parcelamento identificado.</p>}</section>
              <section><h3 className="mb-2 font-semibold">Processos / exigibilidade suspensa <Badge variant="secondary" className="ml-2">{parsed.suspensions.length}</Badge></h3>{parsed.suspensions.length ? parsed.suspensions.map((item, i) => <div key={i} className="mb-2 grid gap-2 rounded-sm border p-3 text-sm sm:grid-cols-2"><div><span className="text-muted-foreground">Processo:</span> {text(item.identification)}</div><div><span className="text-muted-foreground">Órgão:</span> {text(item.agency)}</div><div><span className="text-muted-foreground">Situação:</span> {text(item.status)}</div><div><span className="text-muted-foreground">Referência:</span> {text(item.reference)}</div><Trace source={item.source} /></div>) : <p className="text-sm text-muted-foreground">Nenhum processo identificado.</p>}</section>
              <section><h3 className="mb-2 font-semibold">Situação na PGFN</h3>{parsed.pgfn.length ? parsed.pgfn.map((item, i) => <div key={i} className="mb-2 rounded-sm border p-3 text-sm"><Badge variant={item.status === 'irregular' ? 'destructive' : 'outline'} className="rounded-sm">{item.status === 'regular' ? 'Regular' : item.status === 'irregular' ? 'Com pendência' : 'Não identificada'}</Badge><p className="my-2 text-muted-foreground">{text(item.description)}</p><Trace source={item.source} /></div>) : <p className="text-sm text-muted-foreground">Informação não disponível.</p>}</section>
            </>}
            <Accordion type="single" collapsible><AccordionItem value="original" className="rounded-sm border px-3"><AccordionTrigger className="hover:no-underline"><span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" />Relatório original</span></AccordionTrigger><AccordionContent><div className="mb-3 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={onOpenPdf}><ExternalLink className="mr-2 h-4 w-4" />Abrir</Button><Button variant="outline" size="sm" onClick={onDownload}><Download className="mr-2 h-4 w-4" />Baixar</Button></div>{dataUrl ? <iframe title="Relatório original da situação fiscal" src={dataUrl} className="h-[65vh] w-full rounded-sm border" /> : <p className="text-sm text-muted-foreground">Relatório não disponível.</p>}</AccordionContent></AccordionItem></Accordion>
          </div>
        </ScrollArea>
      </div>}
    </SheetContent>
  </Sheet>;
}
