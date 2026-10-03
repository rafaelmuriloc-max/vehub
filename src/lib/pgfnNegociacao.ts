import { z } from 'zod';

/**
 * Negociações PGFN cadastradas manualmente.
 * Persistidas em parcelamento_results com origem='PGFN' e modalidade=PGFN_MANUAL_MODALIDADE.
 * Não há sincronização automática: nenhum dado aqui vem de consulta à PGFN.
 *
 * raw_response (documentado):
 * {
 *   fonte: 'manual',
 *   schema: 1,
 *   valor_proxima_parcela: number | null,
 *   vencimento_proxima: 'YYYY-MM-DD' | null,
 *   observacoes: string | null,
 *   atualizado_manual_em: ISO string,
 *   atualizado_por: { id, nome } | null,
 *   guia: { path, nome, enviado_em: ISO } | null   // PDF no bucket privado 'documents'
 * }
 */
export const PGFN_MANUAL_MODALIDADE = 'PGFN_MANUAL';
export const SISPAR_URL = 'https://sisparnet.pgfn.fazenda.gov.br/sisparInternet/internet/darf/consultaParcelamentoDarfInternet.xhtml';

export const PGFN_SITUACOES = ['Em dia', 'Em atraso', 'Suspenso', 'Rescindido', 'Liquidado', 'Cancelado', 'Não informado'] as const;

const optMoney = z.number({ invalid_type_error: 'Valor inválido' }).nonnegative('Não pode ser negativo').nullable();
const optInt = z.number({ invalid_type_error: 'Número inválido' }).int('Use número inteiro').nonnegative('Não pode ser negativo').nullable();

export const negociacaoSchema = z.object({
  client_id: z.string().uuid('Selecione a empresa'),
  numero: z.string().trim().min(1, 'Número da negociação é obrigatório').max(40, 'Máximo 40 caracteres').regex(/^[0-9A-Za-z./-]+$/, 'Use apenas números, letras, ponto, barra ou hífen'),
  modalidade: z.string().trim().max(120, 'Máximo 120 caracteres').nullable(),
  situacao: z.string().trim().max(60).nullable(),
  valor_consolidado: optMoney,
  parcelas_total: optInt,
  parcelas_pagas: optInt,
  valor_proxima_parcela: optMoney,
  vencimento_proxima: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').nullable(),
  data_adesao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').nullable(),
  observacoes: z.string().trim().max(1000, 'Máximo 1000 caracteres').nullable(),
}).superRefine((v, ctx) => {
  if (v.parcelas_total != null && v.parcelas_pagas != null && v.parcelas_pagas > v.parcelas_total) {
    ctx.addIssue({ code: 'custom', path: ['parcelas_pagas'], message: 'Pagas não pode ser maior que o total' });
  }
});

export type NegociacaoInput = z.infer<typeof negociacaoSchema>;

export const normalizeNumero = (n: string) => n.trim().replace(/[.\s/-]/g, '').toUpperCase();

/** Converte texto "1.234,56" / "1234.56" em número; vazio => null; inválido => NaN. */
export function parseMoney(s: string): number | null {
  const t = (s || '').trim().replace(/^R\$\s*/i, '');
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : NaN;
}
export function parseIntOrNull(s: string): number | null {
  const t = (s || '').trim();
  if (!t) return null;
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

type ExistingRow = { id: string; client_id: string; origem?: string | null; numero_parcelamento: string | null };

/** Duplicata = mesma empresa + origem PGFN + número normalizado (ignora o próprio registro na edição). */
export function findDuplicate(rows: ExistingRow[], clientId: string, numero: string, ignoreId?: string | null): ExistingRow | null {
  const n = normalizeNumero(numero);
  return rows.find(r => r.id !== ignoreId && r.client_id === clientId && (r.origem || 'RFB') === 'PGFN'
    && normalizeNumero(r.numero_parcelamento || '') === n) || null;
}

/** Somente linhas manuais PGFN — nunca mistura com RFB. */
export const isPgfnManual = (r: { origem?: string | null; modalidade?: string | null }) =>
  r.origem === 'PGFN' && r.modalidade === PGFN_MANUAL_MODALIDADE;

export function buildRow(v: NegociacaoInput, user: { id: string; nome: string | null } | null, prevRaw: any, now = new Date()) {
  const iso = now.toISOString();
  return {
    client_id: v.client_id,
    origem: 'PGFN',
    modalidade: PGFN_MANUAL_MODALIDADE,
    modalidade_label: v.modalidade || null,
    numero_parcelamento: v.numero.trim(),
    situacao: v.situacao || null,
    data_pedido: v.data_adesao || null,
    valor_total: v.valor_consolidado,
    parcelas_total: v.parcelas_total,
    parcelas_pagas: v.parcelas_pagas,
    status: 'success',
    error_message: null,
    consulted_at: iso,
    raw_response: {
      fonte: 'manual',
      schema: 1,
      valor_proxima_parcela: v.valor_proxima_parcela,
      vencimento_proxima: v.vencimento_proxima,
      observacoes: v.observacoes || null,
      atualizado_manual_em: iso,
      atualizado_por: user,
      guia: prevRaw?.guia ?? null,
    },
  };
}
