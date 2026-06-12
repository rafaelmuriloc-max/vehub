import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, Copy, X, RefreshCw } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  RECEIVED: 'bg-emerald-100 text-emerald-800',
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
  OVERDUE: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-200 text-gray-700',
  REFUNDED: 'bg-orange-100 text-orange-800',
};

export function AsaasChargesTab() {
  const [charges, setCharges] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    const { data } = await supabase.from('asaas_charges').select('*, clients(company_name)').order('created_at', { ascending: false }).limit(200);
    setCharges(data || []); setLoading(false);
  }

  async function cancel(asaas_charge_id: string) {
    if (!confirm('Cancelar cobrança no Asaas?')) return;
    const { data, error } = await supabase.functions.invoke('asaas-charge-cancel', { body: { asaas_charge_id } });
    if (error || data?.error) toast({ title: 'Erro', description: error?.message || data?.error, variant: 'destructive' });
    else { toast({ title: 'Cobrança cancelada' }); load(); }
  }

  const filtered = charges.filter(c => !search || c.clients?.company_name?.toLowerCase().includes(search.toLowerCase()) || c.asaas_charge_id?.includes(search));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2">
        <Input placeholder="Buscar por cliente ou ID..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />
        <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Cliente</TableHead><TableHead>Tipo</TableHead><TableHead>Valor</TableHead>
            <TableHead>Vencimento</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell></TableRow> :
              filtered.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.clients?.company_name || '—'}</TableCell>
                <TableCell>{c.billing_type}</TableCell>
                <TableCell>R$ {Number(c.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{c.due_date ? new Date(c.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                <TableCell><Badge className={STATUS_COLORS[c.status] || ''}>{c.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {c.invoice_url && <Button variant="ghost" size="icon" asChild><a href={c.invoice_url} target="_blank" rel="noreferrer" title="Fatura"><ExternalLink className="h-3 w-3" /></a></Button>}
                    {c.pix_copy_paste && <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(c.pix_copy_paste); toast({ title: 'PIX copiado' }); }} title="Copiar PIX"><Copy className="h-3 w-3" /></Button>}
                    {isAdmin && !['CANCELLED', 'RECEIVED', 'CONFIRMED'].includes(c.status) && <Button variant="ghost" size="icon" onClick={() => cancel(c.asaas_charge_id)} title="Cancelar"><X className="h-3 w-3" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma cobrança</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}