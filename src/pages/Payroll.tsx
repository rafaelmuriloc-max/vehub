import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Check, FolderSync, ChevronsUpDown, Loader2, UserMinus, UserPlus, Users, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn, formatClientLabel } from '@/lib/utils';

interface Client { id: string; company_name: string; document: string | null; sci_code: string | null; status: string | null }
interface Summary {
  client_id: string; competence: string;
  qty_total: number; gross: number; discounts: number; net: number;
  inss_value: number; fgts_value: number; inss_base: number; fgts_base: number;
  active_count: number; admitted_count: number; dismissed_count: number;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const monthLabel = (c: string) => `${c.slice(5, 7)}/${c.slice(0, 4)}`;
type RankKey = 'gross' | 'active_count' | 'charges';

export default function Payroll() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [rows, setRows] = useState<Summary[]>([]);
  const [clientId, setClientId] = useState<string>('all');
  const [month, setMonth] = useState<string>('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rankBy, setRankBy] = useState<RankKey>('gross');

  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    {
      const [c, s] = await Promise.all([
        supabase.from('clients').select('id, company_name, document, sci_code, status').order('company_name'),
        supabase.from('payroll_summaries' as any).select('client_id, competence, qty_total, gross, discounts, net, inss_value, fgts_value, inss_base, fgts_base, active_count, admitted_count, dismissed_count').limit(10000),
      ]);
      const act = ((c.data ?? []) as Client[]).filter((x) => x.status === 'active');
      const ids = new Set(act.map((x) => x.id));
      const data = ((s.data ?? []) as unknown as Summary[])
        .filter((r) => ids.has(r.client_id))
        .map((r) => ({ ...r, gross: +r.gross, discounts: +r.discounts, net: +r.net, inss_value: +r.inss_value, fgts_value: +r.fgts_value, inss_base: +r.inss_base, fgts_base: +r.fgts_base }));
      setClients(act);
      setRows(data);
      const months = [...new Set(data.map((r) => r.competence))].sort();
      setMonth(months[months.length - 1] ?? '');
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function syncPayroll() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('employee-folder-sync', { body: { only: 'folha' } });
      if (error) throw error;
      if (data?.ok === false) {
        throw new Error(data.error === 'Nenhuma pasta configurada'
          ? 'Nenhuma pasta definida. Defina a pasta pelo botão Funcionários, na página Pessoal.'
          : data.error);
      }
      const st = data?.stats ?? {};
      const meses = (st.meses ?? []).map((m: string) => monthLabel(m)).join(', ');
      toast({
        title: 'Resumo da folha sincronizado',
        description: `${st.arquivos ?? 0} arquivo(s) lido(s)${meses ? ` (${meses})` : ''}, ${st.empresas_gravadas ?? 0} empresa(s) gravada(s)${(st.sem_empresa ?? 0) > 0 ? `, ${st.sem_empresa} sem empresa cadastrada` : ''}.`,
      });
      await load();
    } catch (e) {
      toast({ title: 'Erro na sincronização', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  }

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const months = useMemo(() => [...new Set(rows.map((r) => r.competence))].sort(), [rows]);
  const scoped = useMemo(() => (clientId === 'all' ? rows : rows.filter((r) => r.client_id === clientId)), [rows, clientId]);
  const current = useMemo(() => scoped.filter((r) => r.competence === month), [scoped, month]);

  const totals = useMemo(() => current.reduce((a, r) => ({
    gross: a.gross + r.gross, discounts: a.discounts + r.discounts, net: a.net + r.net,
    inss: a.inss + r.inss_value, fgts: a.fgts + r.fgts_value,
    active: a.active + r.active_count, admitted: a.admitted + r.admitted_count, dismissed: a.dismissed + r.dismissed_count,
  }), { gross: 0, discounts: 0, net: 0, inss: 0, fgts: 0, active: 0, admitted: 0, dismissed: 0 }), [current]);

  const evolution = useMemo(() => months.map((m) => {
    const list = scoped.filter((r) => r.competence === m);
    const sum = (f: (r: Summary) => number) => list.reduce((a, r) => a + f(r), 0);
    return {
      mes: monthLabel(m),
      Proventos: +sum((r) => r.gross).toFixed(2),
      Líquido: +sum((r) => r.net).toFixed(2),
      Encargos: +sum((r) => r.inss_value + r.fgts_value).toFixed(2),
      Colaboradores: sum((r) => r.active_count),
    };
  }), [months, scoped]);

  const ranking = useMemo(() => {
    const val = (r: Summary) => rankBy === 'gross' ? r.gross : rankBy === 'active_count' ? r.active_count : r.inss_value + r.fgts_value;
    return rows.filter((r) => r.competence === month)
      .map((r) => ({ id: r.client_id, name: formatClientLabel(clientById.get(r.client_id)), value: val(r), r }))
      .sort((a, b) => b.value - a.value).slice(0, 15);
  }, [rows, month, rankBy, clientById]);

  const cards = [
    { label: 'Proventos', value: brl(totals.gross), Icon: Wallet },
    { label: 'Descontos', value: brl(totals.discounts), Icon: Wallet },
    { label: 'Líquido', value: brl(totals.net), Icon: Wallet },
    { label: 'INSS (GPS)', value: brl(totals.inss), Icon: Wallet },
    { label: 'FGTS', value: brl(totals.fgts), Icon: Wallet },
    { label: 'Colaboradores ativos', value: totals.active.toLocaleString('pt-BR'), Icon: Users },
    { label: 'Admitidos', value: totals.admitted.toLocaleString('pt-BR'), Icon: UserPlus },
    { label: 'Demitidos', value: totals.dismissed.toLocaleString('pt-BR'), Icon: UserMinus },
  ];

  const selectedClient = clientId === 'all' ? null : clientById.get(clientId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Button variant="ghost" size="icon" onClick={() => navigate('/personnel')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Folha</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Análise do resumo da folha de pagamento dos clientes</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-72 justify-between">
                <span className="truncate">{selectedClient ? formatClientLabel(selectedClient) : 'Todas as empresas'}</span>
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command>
                <CommandInput placeholder="Nome, CNPJ ou código..." />
                <CommandList>
                  <CommandEmpty>Nenhuma empresa.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="todas as empresas" onSelect={() => { setClientId('all'); setPickerOpen(false); }}>
                      <Check className={cn('h-4 w-4 mr-2', clientId === 'all' ? 'opacity-100' : 'opacity-0')} />Todas as empresas
                    </CommandItem>
                    {clients.map((c) => (
                      <CommandItem key={c.id} value={`${c.sci_code ?? ''} ${c.company_name} ${c.document ?? ''}`} onSelect={() => { setClientId(c.id); setPickerOpen(false); }}>
                        <Check className={cn('h-4 w-4 mr-2', clientId === c.id ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate">{formatClientLabel(c)}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Select value={month} onValueChange={setMonth} disabled={!months.length}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>{[...months].reverse().map((m) => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={syncPayroll} disabled={syncing} className="w-full sm:w-auto">
            {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FolderSync className="h-4 w-4 mr-1" />}Sincronizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !rows.length ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum resumo da folha importado ainda. Na página Pessoal, use "Sincronizar" e escolha "Folha".
        </CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map(({ label, value, Icon }) => (
              <Card key={label} className="p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span><Icon className="h-4 w-4 text-primary" /></div>
                <div className="text-lg sm:text-2xl font-bold mt-1 tabular-nums">{value}</div>
              </Card>
            ))}
          </div>
          {!current.length && <p className="text-sm text-muted-foreground">Informação não disponível para esta empresa em {monthLabel(month)}.</p>}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Evolução mensal</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" fontSize={12} />
                  <YAxis yAxisId="v" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <YAxis yAxisId="q" orientation="right" fontSize={11} />
                  <Tooltip formatter={(v: number, n: string) => (n === 'Colaboradores' ? v : brl(v))} />
                  <Legend />
                  <Bar yAxisId="v" dataKey="Proventos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="v" dataKey="Líquido" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="v" dataKey="Encargos" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="q" dataKey="Colaboradores" stroke="hsl(var(--foreground))" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
              {months.length < 2 && <p className="text-xs text-muted-foreground -mt-6">A evolução aparece conforme novos meses forem sincronizados.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Ranking de empresas · {monthLabel(month)}</CardTitle>
              <Select value={rankBy} onValueChange={(v) => setRankBy(v as RankKey)}>
                <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gross">Maior folha</SelectItem>
                  <SelectItem value="active_count">Mais colaboradores</SelectItem>
                  <SelectItem value="charges">Mais encargos</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="h-80 hidden md:block">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ranking} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" fontSize={11} tickFormatter={(v) => rankBy === 'active_count' ? v : `${Math.round(v / 1000)}k`} />
                    <YAxis type="category" dataKey="name" width={240} fontSize={11} />
                    <Tooltip formatter={(v: number) => (rankBy === 'active_count' ? v : brl(v))} />
                    <Bar dataKey="value" name="Valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} cursor="pointer"
                      onClick={(d: { id?: string }) => d?.id && setClientId(d.id)} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>#</TableHead><TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Ativos</TableHead>
                  <TableHead className="text-right">Proventos</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Líquido</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Encargos</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {ranking.map((x, i) => (
                    <TableRow key={x.id} className="cursor-pointer" onClick={() => setClientId(x.id)}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{x.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{x.r.active_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(x.r.gross)}</TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">{brl(x.r.net)}</TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">{brl(x.r.inss_value + x.r.fgts_value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
