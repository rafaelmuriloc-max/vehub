import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, RefreshCw, ChevronRight, Search, Calculator } from 'lucide-react';
import CompetenciaRow from './CompetenciaRow';
import ReprocessChainDialog from './ReprocessChainDialog';
import { FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import PgdasdDeclaracaoForm from '@/components/integra-contador/PgdasdDeclaracaoForm';
import { ScrollArea } from '@/components/ui/scroll-area';

type Client = {
  id: string;
  company_name: string;
  document: string | null;
};

type Competencia = {
  id: string;
  client_id: string;
  competencia: string;
  ano: number;
  rbt12: number | null;
  rba_acumulado_ano: number | null;
  valor_das: number | null;
  numero_das: string | null;
  numero_declaracao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string;
  das_pdf_base64: string | null;
  declaracao_pdf_base64: string | null;
  comprovante_pdf_base64: string | null;
  last_synced_at: string | null;
};

function formatCnpj(raw?: string | null): string {
  if (!raw) return '—';
  const d = raw.replace(/\D/g, '');
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatBRL(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(v: string | null | undefined): string {
  if (!v) return '—';
  try {
    const d = new Date(v);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return v; }
}

const SUBLIMITE_1 = 3_600_000;
const SUBLIMITE_2 = 4_800_000;

function pctColor(pct: number): string {
  if (pct < 80) return 'bg-emerald-500';
  if (pct < 100) return 'bg-amber-500';
  return 'bg-destructive';
}

export default function SimplesNacionalTab() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [reprocessOpen, setReprocessOpen] = useState(false);
  const [declOpen, setDeclOpen] = useState(false);
  const [declClient, setDeclClient] = useState<Client | null>(null);
  const [declLoading, setDeclLoading] = useState(false);

  async function handleDeclaracao(dadosJson: string) {
    if (!declClient) return;
    setDeclLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('integra-contador', {
        body: {
          client_id: declClient.id,
          idSistema: 'PGDASD',
          idServico: 'TRANSDECLARACAO11',
          tipo: 'Declarar',
          versaoSistema: '1.0',
          dados: dadosJson,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: 'Declaração transmitida', description: 'PGDAS-D enviado com sucesso.' });
        setDeclOpen(false);
        await loadData();
      } else {
        const msg = data?.data?.mensagens?.[0]?.texto || data?.error || 'Erro desconhecido';
        toast({ title: 'Erro na transmissão', description: msg, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setDeclLoading(false);
    }
  }

  async function loadData() {
    setLoading(true);
    const [clientsRes, compsRes] = await Promise.all([
      supabase.from('clients')
        .select('id, company_name, document')
        .in('tax_regime', ['simples_nacional', 'Simples Nacional'])
        .eq('status', 'active')
        .order('company_name'),
      supabase.from('simples_nacional_competencias' as any)
        .select('*')
        .eq('ano', year)
        .order('competencia'),
    ]);
    if (clientsRes.error) toast({ title: 'Erro ao carregar clientes', description: clientsRes.error.message, variant: 'destructive' });
    if (compsRes.error) toast({ title: 'Erro ao carregar competências', description: compsRes.error.message, variant: 'destructive' });
    setClients((clientsRes.data as Client[]) || []);
    setCompetencias((compsRes.data as unknown as Competencia[]) || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [year]);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return clients;
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const tokens = normalize(q).split(/\s+/).filter(Boolean);
    const digits = q.replace(/\D/g, '');
    return clients.filter(c => {
      const name = normalize(c.company_name || '');
      const nameMatch = tokens.every(t => name.includes(t));
      const docMatch = digits.length > 0 &&
        (c.document || '').replace(/\D/g, '').includes(digits);
      return nameMatch || docMatch;
    });
  }, [clients, search]);

  const byClient = useMemo(() => {
    const map = new Map<string, Competencia[]>();
    for (const c of competencias) {
      const arr = map.get(c.client_id) ?? [];
      arr.push(c);
      map.set(c.client_id, arr);
    }
    return map;
  }, [competencias]);

  const lastSync = useMemo(() => {
    let max: string | null = null;
    for (const c of competencias) {
      if (c.last_synced_at && (!max || c.last_synced_at > max)) max = c.last_synced_at;
    }
    return max;
  }, [competencias]);

  async function handleSync(clientId?: string) {
    if (!isAdmin) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('simples-nacional-sync', {
        body: { year, ...(clientId ? { client_id: clientId } : {}) },
      });
      if (error) throw error;
      toast({ title: 'Sincronização concluída', description: `${data?.count ?? 0} competências processadas.` });
      await loadData();
    } catch (err: any) {
      toast({ title: 'Erro ao sincronizar', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  }

  function rowMetrics(clientId: string) {
    const list = byClient.get(clientId) ?? [];
    // RBT12 = pega o mais recente disponível
    let rbt12: number | null = null;
    let rba: number | null = null;
    let lastDate = '';
    for (const c of list) {
      if (c.rbt12 !== null && c.competencia > lastDate) { rbt12 = c.rbt12; lastDate = c.competencia; }
      if (c.rba_acumulado_ano !== null && (rba === null || c.rba_acumulado_ano > rba)) rba = c.rba_acumulado_ano;
    }
    const pct1 = rba !== null ? (rba / SUBLIMITE_1) * 100 : null;
    const pct2 = rba !== null ? (rba / SUBLIMITE_2) * 100 : null;
    return { rbt12, rba, pct1, pct2 };
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Calculator className="h-7 w-7 text-primary" />
          Simples Nacional
        </h1>
        <p className="text-muted-foreground mt-1">
          Controle de RBT12, sublimites e DAS por competência das empresas optantes.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Input
          type="number"
          min={2020}
          max={2099}
          value={year}
          onChange={e => setYear(Number(e.target.value) || new Date().getFullYear())}
          className="w-28"
        />
        {lastSync && (
          <Badge variant="secondary" className="text-xs whitespace-nowrap">
            Última sync: {formatDate(lastSync)}
          </Badge>
        )}
        {isAdmin && (
          <Button onClick={() => handleSync()} disabled={syncing} size="sm">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <RefreshCw className="h-4 w-4 sm:mr-2" />}
            <span className="hidden sm:inline">Sincronizar agora</span>
          </Button>
        )}
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setReprocessOpen(true)}>
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Reprocessar fluxo</span>
          </Button>
        )}
      </div>
      <ReprocessChainDialog open={reprocessOpen} onOpenChange={setReprocessOpen} />

      <Card className="overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_180px_140px_180px_180px_40px] gap-3 px-4 py-3 bg-muted/40 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Empresa</div>
          <div>CNPJ</div>
          <div className="text-right">RBT12</div>
          <div>Sublimite 3,6Mi</div>
          <div>Sublimite 4,8Mi</div>
          <div></div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhuma empresa do Simples Nacional encontrada.</div>
        ) : filtered.map(client => {
          const { rbt12, pct1, pct2 } = rowMetrics(client.id);
          const isOpen = expanded === client.id;
          const comps = byClient.get(client.id) ?? [];
          return (
            <div key={client.id} className="border-b last:border-b-0">
              <button
                onClick={() => setExpanded(isOpen ? null : client.id)}
                className="w-full grid md:grid-cols-[1fr_180px_140px_180px_180px_40px] grid-cols-1 gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left"
              >
                <div className="font-medium text-foreground truncate">{client.company_name}</div>
                <div className="text-sm text-muted-foreground font-mono">{formatCnpj(client.document)}</div>
                <div className="text-sm text-right tabular-nums">{formatBRL(rbt12)}</div>
                <div className="flex items-center gap-2">
                  {pct1 !== null ? (
                    <>
                      <div className="h-2 flex-1 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full ${pctColor(pct1)} transition-all`} style={{ width: `${Math.min(pct1, 100)}%` }} />
                      </div>
                      <span className="text-xs tabular-nums w-12 text-right">{pct1.toFixed(1)}%</span>
                    </>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </div>
                <div className="flex items-center gap-2">
                  {pct2 !== null ? (
                    <>
                      <div className="h-2 flex-1 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full ${pctColor(pct2)} transition-all`} style={{ width: `${Math.min(pct2, 100)}%` }} />
                      </div>
                      <span className="text-xs tabular-nums w-12 text-right">{pct2.toFixed(1)}%</span>
                    </>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </div>
                <div className="flex justify-end">
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {isOpen && (
                <div className="bg-muted/20 border-t px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-foreground">Competências de {year}</div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setDeclClient(client); setDeclOpen(true); }}>
                          <FileText className="h-3 w-3 mr-1" />
                          Gerar Declaração Mensal
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleSync(client.id)} disabled={syncing}>
                          {syncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                          Atualizar esta empresa
                        </Button>
                      </div>
                    )}
                  </div>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                    const competKey = `${year}-${String(month).padStart(2, '0')}-01`;
                    const comp = comps.find(c => c.competencia === competKey) ?? null;
                    return (
                      <CompetenciaRow
                        key={month}
                        clientId={client.id}
                        year={year}
                        month={month}
                        competencia={comp}
                        onChanged={loadData}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </Card>

      <Dialog open={declOpen} onOpenChange={setDeclOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Entregar Declaração Mensal — PGDAS-D</DialogTitle>
            <DialogDescription>
              {declClient?.company_name} • {formatCnpj(declClient?.document)}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-2">
            {declClient && (
              <PgdasdDeclaracaoForm
                cnpjContribuinte={(declClient.document || '').replace(/\D/g, '')}
                onSubmit={handleDeclaracao}
                loading={declLoading}
                disabled={!isAdmin}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
