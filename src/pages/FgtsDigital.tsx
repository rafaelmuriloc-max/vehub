import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, FileDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Client = { id: string; company_name: string; cnpj: string | null; sci_code?: string | null };
type Guia = {
  id: string; client_id: string; competencia: string; numero_guia: string; tipo: string | null;
  situacao: string | null; data_vencimento: string | null; data_pagamento: string | null;
  valor_total: number | null; guia_pdf_url: string | null; consultado_em: string;
};

const brl = (v: number | null) => v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (v: string | null) => v ? v.split("-").reverse().join("/") : "—";

function statusOf(g?: Guia) {
  if (!g) return { label: "Não consultado", variant: "outline" as const };
  const s = (g.situacao ?? "").toLowerCase();
  if (s.includes("sem guia")) return { label: "Sem guias", variant: "secondary" as const };
  if (g.data_pagamento || s.includes("pag") || s.includes("quit")) return { label: "Paga", variant: "default" as const };
  if (g.data_vencimento && g.data_vencimento < new Date().toISOString().slice(0, 10)) return { label: "Vencida", variant: "destructive" as const };
  return { label: g.situacao || "Em aberto", variant: "outline" as const };
}

function prevMonth() {
  const d = new Date(); d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function FgtsDigital() {
  const nav = useNavigate();
  const [comp, setComp] = useState(prevMonth());
  const [clients, setClients] = useState<Client[]>([]);
  const [guias, setGuias] = useState<Guia[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const load = async () => {
    const [{ data: c }, { data: g }] = await Promise.all([
      supabase.from("clients").select("id, company_name, cnpj, sci_code").eq("status", "active").order("company_name"),
      (supabase as any).from("fgts_digital_guias").select("*").eq("competencia", comp),
    ]);
    setClients((c as any) ?? []);
    setGuias(g ?? []);
  };
  useEffect(() => { load(); }, [comp]);

  const periodo = `${comp.slice(5)}/${comp.slice(0, 4)}`;
  const sync = async (clientId: string) => {
    const { data, error } = await supabase.functions.invoke("fgts-digital-sync", { body: { client_id: clientId, periodo } });
    if (error || data?.error) throw new Error(data?.error || error?.message);
  };
  const syncOne = async (id: string) => {
    setBusy(id);
    try { await sync(id); toast.success("FGTS consultado"); } catch (e: any) { toast.error(e.message); }
    setBusy(null); load();
  };
  const syncAll = async () => {
    const list = [...new Set(rows.map((r) => r.client.id))];
    let fails = 0;
    setProgress(0);
    for (let i = 0; i < list.length; i++) {
      try { await sync(list[i]); } catch { fails++; }
      setProgress(Math.round(((i + 1) / list.length) * 100));
    }
    setProgress(null);
    toast.info(`Consulta concluída${fails ? ` — ${fails} com erro` : ""}`);
    load();
  };

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return clients
      .filter((c) => !q || c.company_name.toLowerCase().includes(q) || (c.cnpj ?? "").includes(q) || String(c.sci_code ?? "").includes(q))
      .flatMap((c) => {
        const gs = guias.filter((g) => g.client_id === c.id);
        return gs.length ? gs.map((g) => ({ client: c, guia: g as Guia | undefined })) : [{ client: c, guia: undefined }];
      })
      .filter((r) => {
        const l = statusOf(r.guia).label;
        if (filter === "all") return true;
        if (filter === "paga") return l === "Paga";
        if (filter === "vencida") return l === "Vencida";
        if (filter === "aberto") return !["Paga", "Vencida", "Sem guias", "Não consultado"].includes(l);
        if (filter === "nao") return l === "Não consultado";
        return true;
      });
  }, [clients, guias, search, filter]);

  const real = guias.filter((g) => g.numero_guia);
  const pagas = real.filter((g) => statusOf(g).label === "Paga");
  const pend = real.filter((g) => statusOf(g).label !== "Paga");
  const sum = (a: Guia[]) => a.reduce((s, g) => s + (g.valor_total ?? 0), 0);

  const exportCsv = () => {
    const head = "Codigo;Empresa;CNPJ;Guia;Tipo;Vencimento;Pagamento;Valor;Status";
    const lines = rows.map((r) => [r.client.sci_code ?? "", r.client.company_name, r.client.cnpj ?? "", r.guia?.numero_guia ?? "",
      r.guia?.tipo ?? "", dt(r.guia?.data_vencimento ?? null), dt(r.guia?.data_pagamento ?? null),
      r.guia?.valor_total?.toFixed(2).replace(".", ",") ?? "", statusOf(r.guia).label].join(";"));
    const blob = new Blob(["\ufeff" + [head, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `fgts-${comp}.csv`; a.click();
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav("/personnel")}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">FGTS Digital</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Empresas consultadas</p>
          <p className="text-2xl font-bold">{new Set(guias.map((g) => g.client_id)).size} / {clients.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Guias pagas</p>
          <p className="text-2xl font-bold">{pagas.length} · {brl(sum(pagas))}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Em aberto / vencidas</p>
          <p className="text-2xl font-bold text-destructive">{pend.length} · {brl(sum(pend))}</p></CardContent></Card>
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <Input type="month" value={comp} onChange={(e) => setComp(e.target.value)} className="md:w-44" />
        <Input placeholder="Buscar empresa, CNPJ ou código" value={search} onChange={(e) => setSearch(e.target.value)} className="md:flex-1" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem><SelectItem value="paga">Pagas</SelectItem>
            <SelectItem value="aberto">Em aberto</SelectItem><SelectItem value="vencida">Vencidas</SelectItem>
            <SelectItem value="nao">Não consultadas</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={syncAll} disabled={progress !== null}><RefreshCw className="h-4 w-4 mr-1" />Consultar todas</Button>
        <Button variant="outline" onClick={exportCsv}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
      </div>
      {progress !== null && <Progress value={progress} />}

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Empresa</TableHead><TableHead className="hidden md:table-cell">Guia</TableHead>
            <TableHead className="hidden md:table-cell">Vencimento</TableHead><TableHead>Valor</TableHead>
            <TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r, i) => {
              const st = statusOf(r.guia);
              return (
                <TableRow key={r.client.id + i}>
                  <TableCell><div className="font-medium">{r.client.sci_code ? `${r.client.sci_code} · ` : ""}{r.client.company_name}</div>
                    <div className="text-xs text-muted-foreground">{r.client.cnpj}</div></TableCell>
                  <TableCell className="hidden md:table-cell">{r.guia?.numero_guia || "—"}<div className="text-xs text-muted-foreground">{r.guia?.tipo}</div></TableCell>
                  <TableCell className="hidden md:table-cell">{dt(r.guia?.data_vencimento ?? null)}</TableCell>
                  <TableCell>{brl(r.guia?.valor_total ?? null)}</TableCell>
                  <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {r.guia?.guia_pdf_url && <Button size="icon" variant="ghost" asChild><a href={r.guia.guia_pdf_url} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /></a></Button>}
                    <Button size="icon" variant="ghost" disabled={busy === r.client.id} onClick={() => syncOne(r.client.id)}>
                      <RefreshCw className={`h-4 w-4 ${busy === r.client.id ? "animate-spin" : ""}`} /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
