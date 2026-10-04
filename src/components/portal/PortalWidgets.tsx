import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Eye, Download, MoreVertical, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { TAGS, TagKey, brlShort, daysUntil, dueBadge, tagFor } from '@/lib/portalDashboard';

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS_LONG = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export type DueItem = { id: string; name: string; due: string; competencia: string; valor: number | null };
export type DocItem = { id: string; label: string; area: string; ref: string | null; file_url: string; file_name: string; created_at: string };

const TAG_BG: Record<TagKey, string> = { das: 'bg-tag-das', fgts: 'bg-tag-fgts', inss: 'bg-tag-inss', iss: 'bg-tag-iss', folha: 'bg-tag-folha', darf: 'bg-tag-darf', icms: 'bg-tag-icms', pis_cofins: 'bg-tag-pis_cofins', irpj_csll: 'bg-tag-irpj_csll', outro: 'bg-tag-outro' };

export function SectionCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn('rounded-2xl bg-card shadow-sm border border-border/60 p-4 sm:p-5', className)}>{children}</section>;
}

export function KpiCard({ icon, iconClass, title, value, hint, onClick }: { icon: React.ReactNode; iconClass: string; title: string; value: React.ReactNode; hint: React.ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-left rounded-2xl bg-card shadow-sm border border-border/60 p-3 sm:p-4 flex gap-3 min-w-0 hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-blue">
      <span className={cn('hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', iconClass)}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="flex items-start justify-between gap-1"><span className="text-xs sm:text-sm font-medium text-portal-ink leading-tight">{title}</span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></span>
        <span className="block mt-1 text-lg sm:text-2xl font-bold text-portal-ink tabular-nums break-all leading-tight">{value}</span>
        <span className="block text-[11px] sm:text-xs text-muted-foreground mt-0.5">{hint}</span>
      </span>
    </button>
  );
}

export function Trend({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const up = pct >= 0;
  return <span className={cn('inline-flex items-center gap-0.5 font-semibold', up ? 'text-success' : 'text-destructive')}>{up ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{up ? '+' : ''}{pct.toFixed(0)}%</span>;
}

export function FiscalCalendar({ items, month, onMonth }: { items: DueItem[]; month: Date; onMonth: (d: Date) => void }) {
  const y = month.getFullYear(), m = month.getMonth();
  const cells = useMemo(() => {
    const first = new Date(y, m, 1).getDay();
    const out: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) { const d = new Date(y, m, 1 - first + i); out.push({ date: d, inMonth: d.getMonth() === m }); }
    while (out.length > 35 && out.slice(-7).every(c => !c.inMonth)) out.splice(-7);
    return out;
  }, [y, m]);
  const byDay = useMemo(() => {
    const map = new Map<string, DueItem[]>();
    items.forEach(i => { const k = i.due.slice(0, 10); map.set(k, [...(map.get(k) || []), i]); });
    return map;
  }, [items]);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return (
    <SectionCard>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-portal-ink">Calendário Fiscal</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-portal-ink">{MONTHS_LONG[m]} de {y}</span>
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Mês anterior" onClick={() => onMonth(new Date(y, m - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Próximo mês" onClick={() => onMonth(new Date(y, m + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] sm:text-sm text-muted-foreground mb-1">{WEEK.map(w => <span key={w}>{w}</span>)}</div>
      <div className="grid grid-cols-7 border-l border-t border-border/70 rounded-lg overflow-hidden">
        {cells.map(({ date, inMonth }) => {
          const list = inMonth ? byDay.get(key(date)) || [] : [];
          return (
            <div key={key(date)} className="border-r border-b border-border/70 min-h-[52px] sm:min-h-[58px] p-0.5 sm:p-1 flex flex-col items-center gap-0.5">
              <span className={cn('text-xs sm:text-sm', !inMonth && 'text-muted-foreground/50', list.length > 0 && 'font-bold text-portal-ink')}>{date.getDate()}</span>
              {list.slice(0, 2).map(i => (
                <span key={i.id} title={i.name} className={cn('w-full truncate rounded text-[9px] sm:text-[11px] font-semibold text-primary-foreground text-center px-0.5 py-0.5', TAG_BG[tagFor(i.name)])}>
                  {TAGS.find(t => t.key === tagFor(i.name))?.label || i.name.split(' ')[0]}
                </span>
              ))}
              {list.length > 2 && <span className="text-[9px] text-muted-foreground">+{list.length - 2}</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs sm:text-sm text-portal-ink">
        {TAGS.map(t => <span key={t.key} className="inline-flex items-center gap-1.5"><span className={cn('h-3 w-3 rounded-full', TAG_BG[t.key])} />{t.label}</span>)}
      </div>
    </SectionCard>
  );
}

export function RevenueChart({ data, total, pct, range, onRange }: { data: { label: string; value: number }[]; total: number; pct: number | null; range: 6 | 12; onRange: (r: 6 | 12) => void }) {
  return (
    <SectionCard>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg sm:text-xl font-bold text-portal-ink">Evolução de Faturamento</h2>
        <select aria-label="Período" value={range} onChange={e => onRange(Number(e.target.value) as 6 | 12)} className="h-9 rounded-lg border border-input bg-card px-2 text-sm text-portal-ink">
          <option value={6}>Últimos 6 meses</option><option value={12}>Últimos 12 meses</option>
        </select>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-2"><span className="text-2xl sm:text-3xl font-bold text-portal-ink tabular-nums">{brl(total)}</span><Trend pct={pct} /></div>
      <p className="text-xs sm:text-sm text-muted-foreground">{pct == null ? 'Sem faturamento no mesmo período do ano anterior' : 'em relação ao mesmo período do ano anterior'}</p>
      <div className="h-56 sm:h-64 mt-3 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis width={52} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => (v >= 1000 ? `${Math.round(v / 1000)} mil` : String(v))} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
              {data.map((_, i) => <Cell key={i} fill={i === data.length - 1 ? 'hsl(var(--portal-blue-strong))' : 'hsl(var(--portal-blue-bar))'} />)}
              <LabelList dataKey="value" position="top" formatter={(v: number) => (v ? brlShort(v) : '')} style={{ fontSize: 11, fontWeight: 600, fill: 'hsl(var(--portal-ink))' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function fmtRef(r: string | null, created: string) {
  const d = (r || created).slice(0, 7).split('-');
  return `${d[1]}/${d[0]}`;
}

function fileKind(ext: string): { label: string; color: string } {
  if (ext === 'pdf') return { label: 'PDF', color: 'var(--tag-inss)' };
  if (ext.startsWith('xls') || ext === 'csv') return { label: 'XLS', color: 'var(--tag-fgts)' };
  if (ext.startsWith('doc')) return { label: 'DOC', color: 'var(--tag-das)' };
  if (ext === 'xml') return { label: 'XML', color: 'var(--tag-iss)' };
  return { label: (ext || 'ARQ').toUpperCase().slice(0, 4), color: 'var(--tag-outro)' };
}

export function FileTypeIcon({ ext }: { ext: string }) {
  const k = fileKind(ext);
  return (
    <svg viewBox="0 0 40 48" className="h-12 w-10 shrink-0" role="img" aria-label={`Arquivo ${k.label}`}>
      <path d="M6 0h20l14 14v28a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6V6a6 6 0 0 1 6-6z" fill={`hsl(${k.color})`} />
      <path d="M26 0l14 14H31a5 5 0 0 1-5-5z" fill="hsl(var(--primary-foreground))" fillOpacity={0.35} />
      <text x="20" y="33" textAnchor="middle" fontSize={k.label.length > 3 ? 9 : 11} fontWeight={700} fill="hsl(var(--primary-foreground))">{k.label}</text>
    </svg>
  );
}

export function RecentDocuments({ docs, onOpen, onSeeAll, limit = 3 }: { docs: DocItem[]; onOpen: (d: DocItem, download: boolean) => void; onSeeAll?: () => void; limit?: number }) {
  return (
    <SectionCard>
      <div className="flex items-center justify-between mb-2"><h2 className="text-lg sm:text-xl font-bold text-portal-ink">Documentos Recentes</h2>{onSeeAll && <button className="text-sm font-medium text-portal-blue" onClick={onSeeAll}>Ver todos</button>}</div>
      {docs.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum documento disponível ainda.</p>}
      <div className="divide-y divide-border/70">
        {docs.slice(0, limit).map(d => {
          const ext = (d.file_name.split('.').pop() || '').toLowerCase();
          return (
            <div key={d.id} className="flex items-center gap-3 py-3">
              <FileTypeIcon ext={ext} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-portal-ink truncate">{d.label}</p>
                <p className="text-xs text-muted-foreground truncate">{d.area} • {fmtRef(d.ref, d.created_at)}</p>
              </div>
              <span className="hidden md:inline-flex items-center gap-1.5 rounded-md bg-success/10 text-success px-2 py-1 text-xs font-medium"><span className="h-2 w-2 rounded-full bg-success" />Disponível</span>
              <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => onOpen(d, false)}><Eye className="h-4 w-4 mr-1" />Visualizar</Button>
              <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => onOpen(d, true)}><Download className="h-4 w-4 mr-1" />Baixar</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Mais opções"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onOpen(d, false)}><Eye className="h-4 w-4 mr-2" />Visualizar</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onOpen(d, true)}><Download className="h-4 w-4 mr-2" />Baixar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

export function UpcomingDues({ items, onSeeAll, limit = 3 }: { items: DueItem[]; onSeeAll?: () => void; limit?: number }) {
  return (
    <SectionCard>
      <div className="flex items-center justify-between mb-2"><h2 className="text-lg sm:text-xl font-bold text-portal-ink">Vencimentos Próximos</h2>{onSeeAll && <button className="text-sm font-medium text-portal-blue" onClick={onSeeAll}>Ver todos</button>}</div>
      {items.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum vencimento nos próximos 30 dias.</p>}
      <div className="divide-y divide-border/70">
        {items.slice(0, limit).map(i => {
          const days = daysUntil(i.due); const b = dueBadge(days);
          const [, mm, dd] = i.due.slice(0, 10).split('-');
          return (
            <div key={i.id} className="flex items-center gap-3 py-2.5">
              <span className={cn('h-14 w-14 shrink-0 rounded-xl border flex flex-col items-center justify-center', b.tone === 'danger' ? 'bg-destructive/10 border-destructive/20' : 'bg-portal-blue-soft border-portal-blue/15')}>
                <span className={cn('text-xl font-extrabold leading-none', b.tone === 'danger' ? 'text-destructive' : 'text-portal-ink')}>{dd}</span><span className="text-[11px] font-medium uppercase text-portal-ink mt-0.5">{MONTHS[Number(mm) - 1]}</span>
              </span>
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-portal-ink truncate">{i.name}</p><p className="text-xs text-muted-foreground truncate">{i.competencia}</p></div>
              <span className={cn('inline-flex rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap', b.tone === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning')}>{b.label}</span>
              <span className="text-sm font-semibold text-portal-ink tabular-nums whitespace-nowrap">{i.valor != null ? brl(i.valor) : '—'}</span>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
