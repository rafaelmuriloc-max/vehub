import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchInChunks } from "@/lib/fetchInChunks";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Download,
  FileText,
  Search,
  RefreshCw,
  FileCode,
  Loader2,
  PackageOpen,
  ChevronLeft,
  ChevronRight,
  Building2,
  Wallet,
  Landmark,
  ShieldCheck,
  User,
  Coins,
  PieChart,
  Briefcase,
  Heart,
  Building,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatClientLabel } from "@/lib/utils";

const PAGE_SIZE = 20;

type Client = {
  id: string;
  sci_code?: string | null;
  company_name: string;
  document: string | null;
  digital_certificate_url: string | null;
  digital_certificate_expiry: string | null;
};
type ServiceTaker = { document: string; company_name: string };
type Invoice = {
  id: string;
  client_id: string;
  access_key: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  service_description: string | null;
  gross_value: number;
  tax_value: number;
  net_value: number;
  status: string | null;
  xml_url: string | null;
  pdf_url: string | null;
  issuer_cnpj: string | null;
  taker_cnpj: string | null;
  created_at: string;
  raw_data: { xml?: string } | null;
};

type Retentions = {
  iss: number;
  irrf: number;
  pis: number;
  cofins: number;
  csll: number;
  inss: number;
  cp: number;
  total: number;
};

function extractXmlValue(xml: string, tag: string): number {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`));
  return match ? parseFloat(match[1]) || 0 : 0;
}

function parseRetentions(inv: Invoice): Retentions {
  const xml = inv.raw_data?.xml || "";
  if (!xml)
    return {
      iss: 0,
      irrf: 0,
      pis: 0,
      cofins: 0,
      csll: 0,
      inss: 0,
      cp: 0,
      total: 0,
    };

  const irrf = extractXmlValue(xml, "vRetIRRF");
  const pis = extractXmlValue(xml, "vRetPIS");
  const cofins = extractXmlValue(xml, "vRetCOFINS");
  const csll = extractXmlValue(xml, "vRetCSLL");
  const inss = extractXmlValue(xml, "vRetINSS");
  const cp = extractXmlValue(xml, "vRetCP");
  const vTotalRet = extractXmlValue(xml, "vTotalRet");
  const tpRetISSQN = extractXmlValue(xml, "tpRetISSQN");

  const federalTotal = irrf + pis + cofins + csll + inss + cp;
  const iss = tpRetISSQN === 2 ? Math.max(vTotalRet - federalTotal, 0) : 0;
  const total = iss + federalTotal;

  return { iss, irrf, pis, cofins, csll, inss, cp, total };
}

const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value || 0,
  );

const TAX_META: {
  key: Exclude<keyof Retentions, "total">;
  label: string;
  icon: typeof User;
}[] = [
  { key: "iss", label: "ISS", icon: User },
  { key: "irrf", label: "IRRF", icon: FileText },
  { key: "pis", label: "PIS", icon: Coins },
  { key: "cofins", label: "COFINS", icon: PieChart },
  { key: "csll", label: "CSLL", icon: Briefcase },
  { key: "inss", label: "INSS", icon: Heart },
  { key: "cp", label: "CP", icon: Building },
];

type SummaryVariant = "blue" | "orange";

const VARIANT_STYLES: Record<
  SummaryVariant,
  {
    panel: string;
    headerIcon: string;
    iconCircle: string;
    iconColor: string;
    banner: string;
    bannerIcon: string;
    bannerLabel: string;
    bannerValue: string;
    taxIcon: string;
  }
> = {
  blue: {
    panel: "border-l-4 border-l-blue-500 bg-blue-50/40 dark:bg-blue-950/20",
    headerIcon: "bg-blue-600 text-white",
    iconCircle: "bg-blue-100 dark:bg-blue-900/50",
    iconColor: "text-blue-600 dark:text-blue-400",
    banner:
      "bg-blue-100/80 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800",
    bannerIcon: "bg-blue-600 text-white",
    bannerLabel: "text-blue-600 dark:text-blue-400",
    bannerValue: "text-blue-700 dark:text-blue-300",
    taxIcon: "text-blue-500 dark:text-blue-400",
  },
  orange: {
    panel:
      "border-l-4 border-l-orange-500 bg-orange-50/40 dark:bg-orange-950/20",
    headerIcon: "bg-orange-500 text-white",
    iconCircle: "bg-orange-100 dark:bg-orange-900/50",
    iconColor: "text-orange-600 dark:text-orange-400",
    banner:
      "bg-orange-100/80 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-800",
    bannerIcon: "bg-orange-500 text-white",
    bannerLabel: "text-orange-600 dark:text-orange-400",
    bannerValue: "text-orange-600 dark:text-orange-400",
    taxIcon: "text-orange-500 dark:text-orange-400",
  },
};

function ServiceSummarySection({
  variant,
  title,
  type,
  invoices,
  totalGross,
  totalTax,
  retentions,
  showRetentions,
  onRetentionClick,
}: {
  variant: SummaryVariant;
  title: string;
  type: "prestado" | "tomado";
  invoices: Invoice[];
  totalGross: number;
  totalTax: number;
  retentions: Retentions;
  showRetentions: boolean;
  onRetentionClick: (detail: {
    type: "prestado" | "tomado";
    taxKey: keyof Retentions;
  }) => void;
}) {
  const s = VARIANT_STYLES[variant];

  const statCards = [
    { label: "Total de Notas", value: String(invoices.length), icon: FileText },
    { label: "Valor Bruto Total", value: brl(totalGross), icon: Wallet },
    { label: "Total de Impostos", value: brl(totalTax), icon: Landmark },
  ];

  return (
    <Card className={s.panel}>
      <CardContent className="p-4 md:p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-full flex items-center justify-center ${s.headerIcon}`}
          >
            <Building2 className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {statCards.map((stat) => (
            <Card key={stat.label} className="bg-card">
              <CardContent className="p-4 flex items-center gap-4">
                <div
                  className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center ${s.iconCircle}`}
                >
                  <stat.icon className={`h-5 w-5 ${s.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold text-foreground truncate">
                    {stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {showRetentions && (
          <>
            <button
              type="button"
              onClick={() => onRetentionClick({ type, taxKey: "total" })}
              className={`w-full rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 cursor-pointer hover:shadow-md transition-shadow ${s.banner}`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`h-7 w-7 rounded-full flex items-center justify-center ${s.bannerIcon}`}
                >
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span className={`text-sm font-semibold ${s.bannerLabel}`}>
                  Impostos Retidos
                </span>
              </span>
              <span
                className={`hidden sm:block h-6 w-px ${variant === "blue" ? "bg-blue-300 dark:bg-blue-700" : "bg-orange-300 dark:bg-orange-700"}`}
              />
              <span className={`text-xs ${s.bannerLabel}`}>Total Retido</span>
              <span className={`text-xl font-bold ${s.bannerValue}`}>
                {brl(retentions.total)}
              </span>
            </button>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {TAX_META.map((tax) => (
                <Card
                  key={tax.key}
                  className="bg-card cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onRetentionClick({ type, taxKey: tax.key })}
                >
                  <CardContent className="p-3 space-y-1">
                    <span className="flex items-center gap-1.5">
                      <tax.icon className={`h-4 w-4 ${s.taxIcon}`} />
                      <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">
                        {tax.label}
                      </span>
                    </span>
                    <p className="text-sm font-bold text-foreground">
                      {brl(retentions[tax.key])}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function NfseTab() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [referenceMonth, setReferenceMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [listTab, setListTab] = useState<"prestados" | "tomados">("prestados");
  const [datePeriod, setDatePeriod] = useState<
    "all" | "this_month" | "last_month" | "this_year" | "last_year" | "custom"
  >("this_month");
  const [filterDateFrom, setFilterDateFrom] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
  });
  const [filterDateTo, setFilterDateTo] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);
  });
  const [page, setPage] = useState(0);
  const [cnpjNameMap, setCnpjNameMap] = useState<Record<string, string>>({});

  function handleDatePeriodChange(period: typeof datePeriod) {
    setDatePeriod(period);
    if (period === "custom") return;
    const now = new Date();
    if (period === "all") {
      setFilterDateFrom("");
      setFilterDateTo("");
      return;
    }
    let from: Date, to: Date;
    switch (period) {
      case "this_month":
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "last_month":
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "this_year":
        from = new Date(now.getFullYear(), 0, 1);
        to = new Date(now.getFullYear(), 11, 31);
        break;
      case "last_year":
        from = new Date(now.getFullYear() - 1, 0, 1);
        to = new Date(now.getFullYear() - 1, 11, 31);
        break;
    }
    setFilterDateFrom(from!.toISOString().slice(0, 10));
    setFilterDateTo(to!.toISOString().slice(0, 10));
  }
  const [downloadingMap, setDownloadingMap] = useState<Record<string, boolean>>(
    {},
  );
  const [exporting, setExporting] = useState(false);
  const [retentionDetail, setRetentionDetail] = useState<{
    type: "prestado" | "tomado";
    taxKey: keyof Retentions;
  } | null>(null);

  const queryClient = useQueryClient();

  const { data: clientsData } = useQuery({
    queryKey: ["invoice-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select(
          "id, sci_code, company_name, document, digital_certificate_url, digital_certificate_expiry",
        )
        .eq("status", "active")
        .order("company_name");
      return (data || []) as Client[];
    },
  });

  useEffect(() => {
    if (clientsData) setClients(clientsData);
  }, [clientsData]);

  const { data: serviceTakersData } = useQuery({
    queryKey: ["nfse-service-takers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_takers")
        .select("document, company_name")
        .order("company_name");
      return (data || []) as ServiceTaker[];
    },
  });

  useEffect(() => {
    const map: Record<string, string> = {};
    clientsData?.forEach((c) => {
      if (c.document) map[cleanCnpj(c.document)] = formatClientLabel(c);
    });
    serviceTakersData?.forEach((t) => {
      if (t.document) map[cleanCnpj(t.document)] = t.company_name;
    });
    setCnpjNameMap(map);
  }, [clientsData, serviceTakersData]);

  const { data: invoicesData, isFetching } = useQuery({
    queryKey: ["nfse-invoices", filterClient, filterDateFrom, filterDateTo],
    queryFn: async () => {
      const build = (from: number, to: number) => {
        let q = supabase
          .from("invoices")
          .select(
            "id, client_id, access_key, invoice_number, issue_date, service_description, gross_value, tax_value, net_value, status, xml_url, pdf_url, issuer_cnpj, taker_cnpj, created_at, raw_data",
          )
          .order("issue_date", { ascending: false })
          .range(from, to);
        if (filterClient !== "all") q = q.eq("client_id", filterClient);
        if (filterDateFrom) q = q.gte("issue_date", filterDateFrom);
        if (filterDateTo) q = q.lte("issue_date", filterDateTo);
        return q;
      };

      let countQuery = supabase
        .from("invoices")
        .select("id", { count: "exact", head: true });
      if (filterClient !== "all")
        countQuery = countQuery.eq("client_id", filterClient);
      if (filterDateFrom)
        countQuery = countQuery.gte("issue_date", filterDateFrom);
      if (filterDateTo) countQuery = countQuery.lte("issue_date", filterDateTo);
      const { count } = await countQuery;

      return fetchInChunks<Invoice>(
        (from, to) => build(from, to) as never,
        count,
      ) as Promise<Invoice[]>;
    },
  });

  useEffect(() => {
    if (invoicesData) setInvoices(invoicesData);
  }, [invoicesData]);

  const loading = isFetching && invoices.length === 0;

  async function loadInvoices() {
    await queryClient.invalidateQueries({ queryKey: ["nfse-invoices"] });
  }

  async function handleSync() {
    if (!referenceMonth) {
      toast({ title: "Selecione o mês de referência", variant: "destructive" });
      return;
    }

    const clientIds =
      selectedClient && selectedClient !== "all"
        ? [selectedClient]
        : (() => {
            const today = new Date().toISOString().slice(0, 10);
            return clients
              .filter(
                (c) =>
                  c.document &&
                  c.digital_certificate_url &&
                  c.digital_certificate_expiry &&
                  c.digital_certificate_expiry >= today,
              )
              .map((c) => c.id);
          })();

    if (clientIds.length === 0) {
      toast({
        title: "Nenhum cliente com CNPJ e certificado digital válido",
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < clientIds.length; i++) {
        if (clientIds.length > 1) {
          const clientName = formatClientLabel(
            clients.find((c) => c.id === clientIds[i]),
          );
          setSyncProgress(
            `Consultando ${i + 1}/${clientIds.length} — ${clientName}`,
          );
        }

        try {
          const { data, error } = await supabase.functions.invoke(
            "nfse-query",
            {
              body: {
                client_id: clientIds[i],
                reference_month: referenceMonth,
              },
            },
          );

          if (error || data?.error) {
            errorCount++;
          } else {
            successCount++;
          }
        } catch {
          errorCount++;
        }
      }

      await loadInvoices();

      if (clientIds.length === 1) {
        if (errorCount > 0) {
          toast({ title: "Erro na consulta", variant: "destructive" });
        } else {
          toast({ title: "Consulta realizada com sucesso" });
        }
      } else {
        toast({
          title: "Consulta em lote finalizada",
          description: `${successCount} sucesso, ${errorCount} erro(s) de ${clientIds.length} clientes`,
          variant: errorCount > 0 ? "destructive" : "default",
        });
      }
    } catch (e) {
      toast({
        title: "Erro inesperado",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
      setSyncProgress("");
    }
  }

  function triggerDownloadBlob(blobUrl: string, filename: string) {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }

  async function triggerDownload(url: string, filename: string) {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    triggerDownloadBlob(blobUrl, filename);
  }

  async function getSignedXmlUrl(inv: Invoice): Promise<string | null> {
    if (inv.xml_url) {
      const { data } = await supabase.storage
        .from("documents")
        .createSignedUrl(inv.xml_url, 300);
      if (data?.signedUrl) return data.signedUrl;
    }
    const { data, error } = await supabase.functions.invoke("nfse-download", {
      body: { invoice_id: inv.id, type: "xml" },
    });
    if (error || data?.error) return null;
    return data?.signed_url || null;
  }

  async function handleBatchExportXml() {
    const targets = filteredInvoices.filter((i) => i.access_key);
    if (targets.length === 0) {
      toast({
        title: "Nenhuma nota com XML disponível nos filtros atuais",
        variant: "destructive",
      });
      return;
    }
    setExporting(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      let added = 0;

      for (const inv of targets) {
        try {
          const url = await getSignedXmlUrl(inv);
          if (url) {
            const resp = await fetch(url);
            const blob = await resp.blob();
            zip.file(
              `${inv.access_key || inv.invoice_number || inv.id}.xml`,
              blob,
            );
            added++;
          }
        } catch {
          // skip individual failures
        }
      }

      if (added === 0) {
        toast({
          title: "Não foi possível obter nenhum XML",
          variant: "destructive",
        });
        return;
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const blobUrl = URL.createObjectURL(zipBlob);
      triggerDownloadBlob(blobUrl, `nfse-xml-export.zip`);
      toast({ title: `${added} XML(s) exportados com sucesso` });
    } catch (e) {
      toast({
        title: "Erro na exportação",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleDownload(
    invoiceId: string,
    type: "xml" | "pdf",
    existingUrl: string | null,
  ) {
    const key = `${invoiceId}-${type}`;
    setDownloadingMap((prev) => ({ ...prev, [key]: true }));
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    const filename = `${invoice?.access_key || invoice?.invoice_number || invoiceId}.${type}`;

    try {
      if (existingUrl) {
        const { data } = await supabase.storage
          .from("documents")
          .createSignedUrl(existingUrl, 300);
        if (data?.signedUrl) {
          await triggerDownload(data.signedUrl, filename);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke("nfse-download", {
        body: { invoice_id: invoiceId, type },
      });

      if (error) {
        let description = error.message;
        try {
          const context = (error as { context?: Response }).context;
          const payload = context
            ? ((await context.clone().json()) as { error?: string })
            : null;
          if (payload?.error) description = payload.error;
        } catch {
          // Mantém a mensagem original quando a resposta não contiver JSON.
        }
        toast({
          title: `Erro ao baixar ${type.toUpperCase()}`,
          description,
          variant: "destructive",
        });
        return;
      }

      if (data?.error) {
        toast({
          title: `Erro ao baixar ${type.toUpperCase()}`,
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      if (data?.signed_url) {
        await triggerDownload(data.signed_url, filename);
        if (data.fallback && data.warning) {
          toast({ title: "DANFSe gerado do XML", description: data.warning });
        }
        setInvoices((prev) =>
          prev.map((inv) => {
            if (inv.id !== invoiceId) return inv;
            return type === "xml"
              ? { ...inv, xml_url: inv.xml_url || "cached" }
              : { ...inv, pdf_url: inv.pdf_url || "cached" };
          }),
        );
      } else {
        toast({
          title: `${type.toUpperCase()} não disponível`,
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Erro inesperado",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setDownloadingMap((prev) => ({ ...prev, [key]: false }));
    }
  }

  function cleanCnpj(doc: string | null) {
    return doc?.replace(/\D/g, "") || "";
  }

  function getClientCnpj(clientId: string) {
    return cleanCnpj(clients.find((c) => c.id === clientId)?.document || null);
  }

  function getInvoiceType(inv: Invoice): "prestado" | "tomado" {
    const clientCnpj = getClientCnpj(inv.client_id);
    return cleanCnpj(inv.issuer_cnpj) === clientCnpj ? "prestado" : "tomado";
  }

  function getClientName(clientId: string) {
    return formatClientLabel(
      clients.find((c) => c.id === clientId),
      "—",
    );
  }

  function formatCnpj(doc: string | null) {
    const digits = cleanCnpj(doc);
    if (digits.length !== 14) return digits || "—";
    return digits.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5",
    );
  }

  function extractXmlName(
    xml: string | undefined,
    type: "prestado" | "tomado",
  ): string | undefined {
    if (!xml) return undefined;
    const blockPatterns =
      type === "prestado"
        ? [
            /<toma>[\s\S]*?<\/toma>/i,
            /<Tomador[\s>][\s\S]*?<\/Tomador>/i,
            /<dest[\s>][\s\S]*?<\/dest>/i,
          ]
        : [/<emit>[\s\S]*?<\/emit>/i, /<Prestador[\s>][\s\S]*?<\/Prestador>/i];
    for (const pattern of blockPatterns) {
      const block = xml.match(pattern)?.[0];
      if (!block) continue;
      const name =
        block.match(/<xNome>([\s\S]*?)<\/xNome>/i)?.[1] ||
        block.match(/<RazaoSocial>([\s\S]*?)<\/RazaoSocial>/i)?.[1] ||
        block.match(/<xNome[^>]*>([\s\S]*?)<\/xNome>/i)?.[1];
      if (name?.trim()) return name.trim();
    }
    return undefined;
  }

  function getCounterpartyName(inv: Invoice, type: "prestado" | "tomado") {
    const cnpj = type === "prestado" ? inv.taker_cnpj : inv.issuer_cnpj;
    const name = cnpj ? cnpjNameMap[cleanCnpj(cnpj)] : undefined;
    if (name) return name;
    return extractXmlName(inv.raw_data?.xml, type) || "—";
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR");
  }

  let baseFiltered = invoices;
  if (filterClient !== "all")
    baseFiltered = baseFiltered.filter((i) => i.client_id === filterClient);
  if (filterDateFrom)
    baseFiltered = baseFiltered.filter(
      (i) => i.issue_date && i.issue_date >= filterDateFrom,
    );
  if (filterDateTo)
    baseFiltered = baseFiltered.filter(
      (i) => i.issue_date && i.issue_date <= filterDateTo,
    );

  const filteredInvoices = baseFiltered.filter(
    (i) =>
      getInvoiceType(i) === (listTab === "prestados" ? "prestado" : "tomado"),
  );

  const prestadosInvoices = baseFiltered.filter(
    (i) => getInvoiceType(i) === "prestado",
  );

  const prestadosTotalGross = prestadosInvoices.reduce(
    (s, i) => s + (i.gross_value || 0),
    0,
  );
  const prestadosTotalTax = prestadosInvoices.reduce(
    (s, i) => s + (i.tax_value || 0),
    0,
  );

  const tomadosTotalGross = baseFiltered
    .filter((i) => getInvoiceType(i) === "tomado")
    .reduce((s, i) => s + (i.gross_value || 0), 0);
  const tomadosTotalTax = baseFiltered
    .filter((i) => getInvoiceType(i) === "tomado")
    .reduce((s, i) => s + (i.tax_value || 0), 0);

  // Retention totals (uses baseFiltered to ignore type filter)
  const tomadosInvoices = baseFiltered.filter(
    (i) => getInvoiceType(i) === "tomado",
  );
  const calcRetentions = (invs: typeof invoices) =>
    invs.reduce<Retentions>(
      (acc, inv) => {
        const r = parseRetentions(inv);
        return {
          iss: acc.iss + r.iss,
          irrf: acc.irrf + r.irrf,
          pis: acc.pis + r.pis,
          cofins: acc.cofins + r.cofins,
          csll: acc.csll + r.csll,
          inss: acc.inss + r.inss,
          cp: acc.cp + r.cp,
          total: acc.total + r.total,
        };
      },
      { iss: 0, irrf: 0, pis: 0, cofins: 0, csll: 0, inss: 0, cp: 0, total: 0 },
    );
  const prestadosRetentionTotals = calcRetentions(prestadosInvoices);
  const tomadosRetentionTotals = calcRetentions(tomadosInvoices);
  const showPrestadosRetentions =
    filterClient !== "all" || prestadosRetentionTotals.total > 0;
  const showTomadosRetentions =
    filterClient !== "all" || tomadosRetentionTotals.total > 0;

  const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE);
  const paginatedInvoices = filteredInvoices.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [filterClient, listTab, datePeriod, filterDateFrom, filterDateTo]);

  return (
    <div className="space-y-6 pt-6">
      {/* Sync Card */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              Consultar Notas no Portal Nacional
            </CardTitle>
          </CardHeader>
          <CardContent className="border-t border-border pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px] space-y-2">
                <Label>Cliente</Label>
                <Select
                  value={selectedClient}
                  onValueChange={setSelectedClient}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {clients
                      .filter((c) => c.document)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {formatClientLabel(c)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[200px] space-y-2">
                <Label>Mês de Referência</Label>
                <Input
                  type="month"
                  value={referenceMonth}
                  onChange={(e) => setReferenceMonth(e.target.value)}
                />
              </div>
              <Button
                onClick={handleSync}
                disabled={syncing}
                className="ml-auto"
              >
                {syncing ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                {syncing ? syncProgress || "Consultando..." : "Buscar Notas"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <h3 className="text-lg font-bold text-foreground">Notas Fiscais</h3>
        <div className="flex items-center gap-2 flex-wrap md:ml-auto">
          <Select
            value={datePeriod}
            onValueChange={(v) =>
              handleDatePeriodChange(v as typeof datePeriod)
            }
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os períodos</SelectItem>
              <SelectItem value="this_month">Esse Mês</SelectItem>
              <SelectItem value="last_month">Mês Anterior</SelectItem>
              <SelectItem value="this_year">Esse Ano</SelectItem>
              <SelectItem value="last_year">Ano Anterior</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {datePeriod === "custom" && (
            <>
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">De:</Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Até:</Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-[160px]"
                />
              </div>
            </>
          )}
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-full md:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {formatClientLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="w-full md:w-auto"
            disabled={
              exporting ||
              filteredInvoices.filter((i) => i.access_key).length === 0
            }
            onClick={handleBatchExportXml}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <PackageOpen className="h-4 w-4 mr-2" />
            )}
            {exporting ? "Exportando..." : "Exportar XMLs"}
          </Button>
        </div>
      </div>

      <ServiceSummarySection
        variant="blue"
        title="Serviços Prestados"
        type="prestado"
        invoices={prestadosInvoices}
        totalGross={prestadosTotalGross}
        totalTax={prestadosTotalTax}
        retentions={prestadosRetentionTotals}
        showRetentions={showPrestadosRetentions}
        onRetentionClick={setRetentionDetail}
      />

      <ServiceSummarySection
        variant="orange"
        title="Serviços Tomados"
        type="tomado"
        invoices={tomadosInvoices}
        totalGross={tomadosTotalGross}
        totalTax={tomadosTotalTax}
        retentions={tomadosRetentionTotals}
        showRetentions={showTomadosRetentions}
        onRetentionClick={setRetentionDetail}
      />

      <Card>
        <CardHeader className="pb-0">
          <div className="flex border-b border-border">
            {[
              {
                key: "prestados" as const,
                label: "Prestados",
                count: prestadosInvoices.length,
              },
              {
                key: "tomados" as const,
                label: "Tomados",
                count: tomadosInvoices.length,
              },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setListTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  listTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">
              Carregando...
            </p>
          ) : filteredInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma nota fiscal encontrada. Use a consulta acima para buscar
              notas do Portal Nacional.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead className="max-w-[180px]">
                        {listTab === "prestados" ? "Destinatário" : "Emitente"}
                      </TableHead>
                      <TableHead className="max-w-[150px] hidden lg:table-cell">
                        Cliente
                      </TableHead>
                      <TableHead>Data Emissão</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Descrição
                      </TableHead>
                      <TableHead className="text-right">Valor Bruto</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">
                        Impostos
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        Status
                      </TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInvoices.map((inv) => {
                      const xmlLoading = downloadingMap[`${inv.id}-xml`];
                      const pdfLoading = downloadingMap[`${inv.id}-pdf`];
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">
                            {inv.invoice_number || "—"}
                          </TableCell>
                          <TableCell
                            className="max-w-[180px] truncate"
                            title={getCounterpartyName(
                              inv,
                              listTab === "prestados" ? "prestado" : "tomado",
                            )}
                          >
                            {getCounterpartyName(
                              inv,
                              listTab === "prestados" ? "prestado" : "tomado",
                            )}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate hidden lg:table-cell">
                            {getClientName(inv.client_id)}
                          </TableCell>
                          <TableCell>{formatDate(inv.issue_date)}</TableCell>
                          <TableCell className="max-w-[150px] truncate hidden lg:table-cell">
                            {inv.service_description || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(inv.gross_value)}
                          </TableCell>
                          <TableCell className="text-right hidden lg:table-cell">
                            {formatCurrency(inv.tax_value)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge
                              variant={
                                inv.status === "cancelada"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {inv.status || "normal"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {inv.access_key && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={xmlLoading}
                                    onClick={() =>
                                      handleDownload(inv.id, "xml", inv.xml_url)
                                    }
                                    title="Baixar XML"
                                  >
                                    {xmlLoading ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <FileCode className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={pdfLoading}
                                    onClick={() =>
                                      handleDownload(inv.id, "pdf", inv.pdf_url)
                                    }
                                    title="Baixar PDF"
                                  >
                                    {pdfLoading ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <FileText className="h-4 w-4" />
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {page + 1} de {totalPages} ({filteredInvoices.length}{" "}
                    notas)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Retention Detail Dialog */}
      <Dialog
        open={!!retentionDetail}
        onOpenChange={(open) => !open && setRetentionDetail(null)}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {retentionDetail?.taxKey === "total"
                ? "Total Retido"
                : retentionDetail?.taxKey.toUpperCase()}{" "}
              — Serviços{" "}
              {retentionDetail?.type === "prestado" ? "Prestados" : "Tomados"}
            </DialogTitle>
          </DialogHeader>
          {(() => {
            if (!retentionDetail) return null;
            const sourceInvoices =
              retentionDetail.type === "prestado"
                ? prestadosInvoices
                : tomadosInvoices;
            const taxKey = retentionDetail.taxKey;
            const detailed = sourceInvoices
              .map((inv) => {
                const r = parseRetentions(inv);
                const retValue = taxKey === "total" ? r.total : r[taxKey];
                return { inv, retValue };
              })
              .filter((d) => d.retValue > 0)
              .sort((a, b) => b.retValue - a.retValue);
            const totalValue = detailed.reduce((s, d) => s + d.retValue, 0);

            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Total:{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(totalValue)}
                  </span>{" "}
                  — {detailed.length} nota(s)
                </p>
                {detailed.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhuma nota com retenção para este imposto.
                  </p>
                ) : (
                  <Table className="text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Data Emissão</TableHead>
                        <TableHead className="text-right">
                          Valor Bruto
                        </TableHead>
                        <TableHead className="text-right">
                          Valor Retido
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailed.map(({ inv, retValue }) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">
                            {inv.invoice_number || "—"}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate">
                            {getClientName(inv.client_id)}
                          </TableCell>
                          <TableCell>{formatDate(inv.issue_date)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(inv.gross_value)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(retValue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
