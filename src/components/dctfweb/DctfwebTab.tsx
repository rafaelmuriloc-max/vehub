import { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { FileCheck, Loader2, Receipt, FileText, Banknote, Search, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatClientLabel } from '@/lib/utils';

type Client = { id: string; company_name: string; sci_code: string | null; document: string | null };
type Action = 'recibo' | 'declaracao' | 'guia';

const ACTIONS: Record<Action, { label: string; idServico: string; tipo: string; icon: any }> = {
  recibo: { label: 'Recibo', idServico: 'CONSRECIBO32', tipo: 'Consultar', icon: Receipt },
  declaracao: { label: 'Declaração', idServico: 'CONSDECCOMPLETA33', tipo: 'Consultar', icon: FileText },
  guia: { label: 'Guia', idServico: 'GERARGUIA31', tipo: 'Emitir', icon: Banknote },
};
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const PAGE = 15;

function walkForPdf(o: any): string | null {
  if (!o || typeof o !== 'object') return null;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' && v.length > 100 && (k.toLowerCase() === 'pdf' || v.startsWith('JVBERi0'))) return v;
    if (typeof v === 'object') { const f = walkForPdf(v); if (f) return f; }
  }
  return null;
}

function openPdf(b64: string, filename: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
  window.open(url, '_blank');
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function DctfwebTab() {
  const { toast } = useToast();
  const prev = new Date(); prev.setDate(1); prev.setMonth(prev.getMonth() - 1);
  const [mes, setMes] = useState(String(prev.getMonth() + 1).padStart(2, '0'));
  const [ano, setAno] = useState(String(prev.getFullYear()));
  const [categoria, setCategoria] = useState('GERAL_MENSAL');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<{ id: string; action: Action } | null>(null);

  // Só empresas com a obrigação "Darf Previdenciário" concluída na competência escolhida.
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setPage(0);
    (async () => {
      const refMonth = `${ano}-${categoria === 'GERAL_MENSAL' ? mes : '12'}-01`;
      const { data: obs } = await supabase.from('obligations').select('id').ilike('name', '%darf previd%');
      const ids = (obs || []).map((o: any) => o.id);
      if (ids.length === 0) { if (!cancel) { setClients([]); setLoading(false); } return; }
      const { data } = await supabase.from('obligation_instances')
        .select('client_id, clients(id, company_name, sci_code, document, status)')
        .in('obligation_id', ids).eq('status', 'done').is('deleted_at', null).eq('reference_month', refMonth);
      const map = new Map<string, Client>();
      for (const r of (data || []) as any[]) {
        const c = r.clients;
        if (c && c.status === 'active') map.set(c.id, { id: c.id, company_name: c.company_name, sci_code: c.sci_code, document: c.document });
      }
      if (!cancel) {
        setClients([...map.values()].sort((a, b) => a.company_name.localeCompare(b.company_name)));
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [ano, mes, categoria]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    if (!q) return clients;
    return clients.filter(c => c.company_name.toLowerCase().includes(q) || (c.sci_code || '').toLowerCase().includes(q)
      || (c.document || '').toLowerCase().includes(q) || (!!qd && (c.document || '').replace(/\D/g, '').includes(qd)));
  }, [clients, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  useEffect(() => setPage(0), [search]);

  const years = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i));

  const fetchPdf = async (c: Client, action: Action): Promise<string> => {
    const a = ACTIONS[action];
    const dados: Record<string, unknown> = { categoria, anoPA: ano };
    if (categoria !== 'GERAL_ANUAL' && categoria !== '13_SALARIO') dados.mesPA = mes;
    const { data, error } = await supabase.functions.invoke('integra-contador', {
      body: { client_id: c.id, idSistema: 'DCTFWEB', idServico: a.idServico, tipo: a.tipo, dados: JSON.stringify(dados) },
    });
    if (error) throw error;
    const msgs = (data?.data?.mensagens || data?.mensagens || []) as Array<{ texto: string }>;
    const raw = data?.data?.dados ?? data?.dados;
    const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : raw;
    const pdf = (typeof parsed === 'string' && parsed.startsWith('JVBERi0') ? parsed : null) || walkForPdf(parsed) || walkForPdf(data?.data);
    if (!pdf) throw new Error(msgs.map(m => m.texto).join('; ') || data?.error || 'A Receita não retornou o documento.');
    return pdf;
  };
  const safeName = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '_').slice(0, 40);

  const run = async (c: Client, action: Action) => {
    const a = ACTIONS[action];
    setBusy({ id: c.id, action });
    try {
      const pdf = await fetchPdf(c, action);
      openPdf(pdf, `DCTFWeb_${safeName(a.label)}_${ano}${mes}_${safeName(c.company_name)}.pdf`);
    } catch (e) {
      toast({ title: `${a.label} indisponível`, description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const [bulk, setBulk] = useState<{ open: boolean; running: boolean; done: number; total: number; ok: number; fails: { name: string; msg: string }[] }>({ open: false, running: false, done: 0, total: 0, ok: 0, fails: [] });
  const cancelRef = useRef(false);

  const runBulk = async () => {
    const list = filtered.filter(c => c.document);
    if (!list.length) return;
    cancelRef.current = false;
    setBulk({ open: true, running: true, done: 0, total: list.length, ok: 0, fails: [] });
    const zip = new JSZip();
    let ok = 0;
    const fails: { name: string; msg: string }[] = [];
    for (let i = 0; i < list.length; i++) {
      if (cancelRef.current) break;
      const c = list[i];
      try {
        let pdf: string;
        try { pdf = await fetchPdf(c, 'guia'); }
        catch (e) {
          if (/fetch|network|failed to send/i.test((e as Error).message)) { await sleep(1500); pdf = await fetchPdf(c, 'guia'); }
          else throw e;
        }
        zip.file(`Guia_${c.sci_code || 'sem_codigo'}_${safeName(c.company_name)}.pdf`, pdf, { base64: true });
        ok++;
      } catch (e) {
        fails.push({ name: formatClientLabel(c as any), msg: (e as Error).message });
      }
      setBulk(b => ({ ...b, done: i + 1, ok, fails: [...fails] }));
      await sleep(500);
    }
    if (ok > 0) {
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `DCTFWeb_Guias_${ano}${mes}.zip`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
    setBulk(b => ({ ...b, running: false }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0">
          <FileCheck className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">DCTFWeb</h1>
          <p className="text-muted-foreground">Recibo, declaração completa e guia por empresa</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por empresa, código SCI ou CNPJ..." className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Select value={mes} onValueChange={setMes} disabled={categoria !== 'GERAL_MENSAL'}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1).padStart(2, '0')}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="GERAL_MENSAL">Geral Mensal</SelectItem>
              <SelectItem value="13_SALARIO">13º Salário</SelectItem>
              <SelectItem value="GERAL_ANUAL">Geral Anual</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={runBulk} disabled={loading || bulk.running || filtered.filter(c => c.document).length === 0}>
            <Download className="h-4 w-4 mr-1" /> Baixar todas as guias ({filtered.filter(c => c.document).length})
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card divide-y">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada.</p>
        ) : rows.map(c => (
          <div key={c.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-medium">{formatClientLabel(c as any)}</p>
              <p className="text-xs text-muted-foreground">{c.document || 'Sem CNPJ'}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              {(Object.keys(ACTIONS) as Action[]).map(k => {
                const A = ACTIONS[k];
                const isBusy = busy?.id === c.id && busy.action === k;
                return (
                  <Button key={k} size="sm" variant={k === 'guia' ? 'default' : 'outline'} disabled={busy?.id === c.id || !c.document} onClick={() => run(c, k)}>
                    {isBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <A.icon className="h-4 w-4 mr-1" />}
                    {A.label}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length} empresas</span>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <span>Página {page + 1} de {pages}</span>
          <Button size="icon" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <Dialog open={bulk.open} onOpenChange={o => { if (!bulk.running) setBulk(b => ({ ...b, open: o })); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Guias DCTFWeb em lote</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Progress value={bulk.total ? (bulk.done / bulk.total) * 100 : 0} />
            <p className="text-sm text-muted-foreground">
              {bulk.done} de {bulk.total} • {bulk.ok} guias geradas • {bulk.fails.length} falhas
              {!bulk.running && bulk.ok > 0 && ' — arquivo ZIP baixado.'}
            </p>
            {bulk.fails.length > 0 && (
              <div className="max-h-60 overflow-y-auto rounded-md border divide-y text-xs">
                {bulk.fails.map((f, i) => (
                  <div key={i} className="p-2"><p className="font-medium">{f.name}</p><p className="text-muted-foreground">{f.msg}</p></div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            {bulk.running
              ? <Button variant="outline" onClick={() => { cancelRef.current = true; }}>Cancelar</Button>
              : <Button onClick={() => setBulk(b => ({ ...b, open: false }))}>Fechar</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
