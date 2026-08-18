import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

export const PENDENCY_LABELS: Record<string, string> = {
  debitos: 'Débitos',
  omissao: 'Omissão de declaração',
  parcelamento: 'Parcelamento',
  divida_ativa: 'Inscrição em dívida ativa',
  suspensa: 'Processo / exigibilidade suspensa',
  outros: 'Outros',
};

export const PENDENCY_RULES: { key: string; terms: string[] }[] = [
  { key: 'divida_ativa', terms: ['dívida ativa', 'divida ativa', 'inscrição em dívida', 'inscricao em divida', 'pgfn'] },
  { key: 'omissao', terms: ['omissão', 'omissao', 'omisso', 'declaração não entregue', 'declaracao nao entregue', 'falta de entrega'] },
  { key: 'parcelamento', terms: ['parcelamento', 'parcelado', 'parcelas em atraso'] },
  { key: 'suspensa', terms: ['exigibilidade suspensa', 'processo administrativo', 'sob julgamento', 'suspenso por decisão', 'suspenso por decisao'] },
  { key: 'debitos', terms: ['débito', 'debito', 'inadimpl', 'cobrança', 'cobranca', 'multa', 'auto de infração', 'auto de infracao', 'pendência de pagamento', 'pendencia de pagamento'] },
];

export function classifyPendencies(text: string): string[] {
  const t = (text || '').toLowerCase();
  if (!t.trim()) return [];
  const found = PENDENCY_RULES.filter(r => r.terms.some(term => t.includes(term))).map(r => r.key);
  return found.length > 0 ? found : ['outros'];
}

/** Extrai trechos do relatório onde as palavras-chave do tipo de pendência aparecem. */
export function extractPendencyExcerpts(text: string, key: string, max = 3): string[] {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const rule = PENDENCY_RULES.find(r => r.key === key);
  const terms = rule?.terms ?? PENDENCY_RULES.flatMap(r => r.terms);
  const lower = clean.toLowerCase();
  const excerpts: string[] = [];
  const usedRanges: [number, number][] = [];

  for (const term of terms) {
    let from = 0;
    while (excerpts.length < max) {
      const idx = lower.indexOf(term, from);
      if (idx === -1) break;
      const start = Math.max(0, idx - 120);
      const end = Math.min(clean.length, idx + term.length + 180);
      const overlaps = usedRanges.some(([s, e]) => idx >= s && idx <= e);
      if (!overlaps) {
        usedRanges.push([start, end]);
        excerpts.push(
          `${start > 0 ? '…' : ''}${clean.slice(start, end).trim()}${end < clean.length ? '…' : ''}`
        );
      }
      from = idx + term.length;
    }
    if (excerpts.length >= max) break;
  }
  return excerpts;
}

const STATUS_META: { key: string; label: string; color: string }[] = [
  { key: 'regular', label: 'Regular', color: 'hsl(142 71% 40%)' },
  { key: 'irregular', label: 'Irregular', color: 'hsl(0 72% 51%)' },
  { key: 'error', label: 'Erro', color: 'hsl(25 95% 53%)' },
  { key: 'pending', label: 'Pendente', color: 'hsl(215 16% 65%)' },
];

const PENDENCY_COLORS = [
  'hsl(0 72% 51%)',
  'hsl(25 95% 53%)',
  'hsl(45 93% 47%)',
  'hsl(262 60% 55%)',
  'hsl(199 89% 48%)',
  'hsl(215 16% 65%)',
];

export type SitfisOverviewItem = {
  sitfis_status: string | null;
  pendency_types: string[];
};

type Props = {
  items: SitfisOverviewItem[];
  loading?: boolean;
  activeStatus: string;
  onSelectStatus: (status: string) => void;
  onSelectPendency?: (key: string) => void;
};

function Donut({
  data,
  onSliceClick,
}: {
  data: { name: string; value: number; color: string; key?: string }[];
  onSliceClick?: (key: string) => void;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative h-44 w-full sm:w-44 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={52}
            outerRadius={76}
            paddingAngle={2}
            stroke="none"
            onClick={(entry: any) => {
              const k = entry?.payload?.key ?? entry?.key;
              if (k && onSliceClick) onSliceClick(k);
            }}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} cursor={onSliceClick ? 'pointer' : undefined} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              color: 'hsl(var(--popover-foreground))',
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold text-foreground">{total}</span>
        <span className="text-[11px] text-muted-foreground">total</span>
      </div>
    </div>
  );
}

export default function SitfisOverviewPanel({ items, loading, activeStatus, onSelectStatus, onSelectPendency }: Props) {
  const statusData = useMemo(() => {
    const counts: Record<string, number> = { regular: 0, irregular: 0, error: 0, pending: 0 };
    items.forEach(i => {
      const key = i.sitfis_status && counts[i.sitfis_status] !== undefined ? i.sitfis_status : 'pending';
      counts[key] += 1;
    });
    return STATUS_META.map(m => ({ ...m, name: m.label, value: counts[m.key] }));
  }, [items]);

  const pendencyData = useMemo(() => {
    const counts = new Map<string, number>();
    items
      .filter(i => i.sitfis_status === 'irregular')
      .forEach(i => {
        const types = i.pendency_types?.length ? i.pendency_types : ['outros'];
        types.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
      });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, value], i) => ({
        key,
        name: PENDENCY_LABELS[key] || key,
        value,
        color: PENDENCY_COLORS[i % PENDENCY_COLORS.length],
      }));
  }, [items]);

  const total = items.length;

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-60 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (total === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Situação geral</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center gap-4">
          <Donut data={statusData.filter(d => d.value > 0)} />
          <div className="grid grid-cols-2 gap-2 w-full">
            {statusData.map(s => {
              const pct = total ? Math.round((s.value / total) * 100) : 0;
              const active = activeStatus === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onSelectStatus(active ? 'all' : s.key)}
                  className={`rounded-lg border p-2 text-left transition-colors hover:bg-muted/60 ${active ? 'border-primary bg-muted/50' : 'border-border'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-lg font-semibold text-foreground">{s.value}</span>
                    <span className="text-[11px] text-muted-foreground">{pct}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tipos de pendência</CardTitle>
          <p className="text-xs text-muted-foreground">
            Clientes irregulares — clique para ver os clientes e a descrição
          </p>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center gap-4">
          {pendencyData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8">
              Nenhuma pendência identificada nos relatórios consultados.
            </p>
          ) : (
            <>
              <Donut data={pendencyData} onSliceClick={onSelectPendency} />
              <div className="grid gap-2 w-full">
                {pendencyData.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => onSelectPendency?.(p.key)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-border p-2 text-left transition-colors hover:bg-muted/60"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                      <span className="text-xs text-muted-foreground truncate">{p.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{p.value}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}