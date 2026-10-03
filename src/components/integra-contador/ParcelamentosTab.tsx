import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Building2, CheckCircle2, AlertTriangle, XCircle, CalendarDays, Clock, RefreshCw, ChevronRight, Landmark, ShieldCheck } from 'lucide-react';
import RfbParcelamentos, { type ParcSummary } from './RfbParcelamentos';
import PgfnParcelamentos from './PgfnParcelamentos';

const KPI_TONES = {
  info: 'bg-info/10 border-info/20 [&_.ic]:bg-info/15 [&_.ic]:text-info',
  success: 'bg-success/10 border-success/20 [&_.ic]:bg-success/15 [&_.ic]:text-success',
  warning: 'bg-warning/10 border-warning/20 [&_.ic]:bg-warning/15 [&_.ic]:text-warning',
  danger: 'bg-destructive/10 border-destructive/20 [&_.ic]:bg-destructive/15 [&_.ic]:text-destructive',
  violet: 'bg-violet/10 border-violet/20 [&_.ic]:bg-violet/15 [&_.ic]:text-violet',
} as const;

export default function ParcelamentosTab() {
  const [s, setS] = useState<ParcSummary | null>(null);
  const last = s?.lastBatch ? new Date(s.lastBatch) : null;
  const kpis: { v: number | undefined; l: string; t: keyof typeof KPI_TONES; I: typeof Building2 }[] = [
    { v: s?.monitoradas, l: 'Empresas monitoradas', t: 'info', I: Building2 },
    { v: s?.ativos, l: 'Com parcelamentos ativos', t: 'success', I: CheckCircle2 },
    { v: s?.atraso, l: 'Parcelas em atraso', t: 'warning', I: AlertTriangle },
    { v: s?.rescindidos, l: 'Parcelamentos rescindidos', t: 'danger', I: XCircle },
    { v: s?.vence7, l: 'Vencem nos próximos 7 dias', t: 'violet', I: CalendarDays },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Fiscal</span><ChevronRight className="h-4 w-4" /><span className="text-foreground">Parcelamentos</span>
      </div>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Parcelamentos</h1>
          <p className="text-muted-foreground mt-1">Consulte, acompanhe e emita as parcelas dos parcelamentos da Receita Federal e da PGFN.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border bg-muted/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-info" />
            <div className="text-sm">
              <div className="text-muted-foreground">Última atualização em lote</div>
              <div className="font-semibold text-foreground">{last ? `${last.toLocaleDateString('pt-BR')} às ${last.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '—'}</div>
            </div>
          </div>
          <Button onClick={() => s?.atualizarTodas()} disabled={!s || s.batchRunning} className="bg-info text-info-foreground hover:bg-info/90">
            <RefreshCw className={`h-4 w-4 mr-2 ${s?.batchRunning ? 'animate-spin' : ''}`} />Atualizar todas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpis.map(({ v, l, t, I }) => (
          <div key={l} className={`rounded-xl border p-4 flex items-center gap-4 ${KPI_TONES[t]}`}>
            <span className="ic h-11 w-11 shrink-0 rounded-full flex items-center justify-center"><I className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-foreground">{v ?? '—'}</div>
              <div className="text-sm text-muted-foreground">{l}</div>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="rfb" className="w-full">
        <TabsList className="h-auto bg-transparent p-0 gap-1 border-b w-full justify-start rounded-none">
          <TabsTrigger value="rfb" className="gap-2 rounded-t-lg rounded-b-none border border-b-0 border-transparent px-5 py-2.5 data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-info data-[state=active]:shadow-none">
            <Landmark className="h-4 w-4" />RFB (Receita Federal)
          </TabsTrigger>
          <TabsTrigger value="pgfn" className="gap-2 rounded-t-lg rounded-b-none border border-b-0 border-transparent px-5 py-2.5 data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-info data-[state=active]:shadow-none">
            <ShieldCheck className="h-4 w-4" />PGFN (Dívida Ativa da União)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="rfb" className="mt-4">
          <RfbParcelamentos onSummary={setS} />
        </TabsContent>
        <TabsContent value="pgfn" className="mt-4">
          <PgfnParcelamentos />
        </TabsContent>
      </Tabs>
    </div>
  );
}
