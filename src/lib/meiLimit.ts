export const MEI_LIMITE_ANUAL = 81000;
export const MEI_LIMITE_MENSAL = 6750;

export type Faixa = 'normal' | 'alerta' | 'excesso' | 'grave';

/** Limite do ano: proporcional aos meses de atividade quando a empresa abriu no próprio ano. */
export function limiteAnual(ano: number, abertura: string | null): number {
  if (!abertura) return MEI_LIMITE_ANUAL;
  const [y, m] = abertura.split('-').map(Number);
  if (!y || !m || y < ano) return MEI_LIMITE_ANUAL;
  if (y > ano) return 0;
  return (12 - m + 1) * MEI_LIMITE_MENSAL;
}

export function faixaDe(faturado: number, limite: number): Faixa {
  if (limite <= 0) return faturado > 0 ? 'grave' : 'normal';
  const p = faturado / limite;
  if (p > 1.2) return 'grave';
  if (p > 1) return 'excesso';
  if (p >= 0.8) return 'alerta';
  return 'normal';
}

/** Projeção anual pela média dos meses decorridos (no ano atual) ou valor real (anos fechados). */
export function projecao(meses: number[], ano: number, hoje = new Date()): number {
  const total = meses.reduce((a, b) => a + b, 0);
  if (ano < hoje.getFullYear()) return total;
  if (ano > hoje.getFullYear()) return 0;
  const decorridos = hoje.getMonth() + 1;
  return (total / decorridos) * 12;
}

export function somarPorMes(notas: { issue_date: string | null; total_value: number | null }[], ano: number): number[] {
  const m = Array(12).fill(0);
  for (const n of notas) {
    if (!n.issue_date) continue;
    const d = n.issue_date.slice(0, 10);
    if (Number(d.slice(0, 4)) !== ano) continue;
    m[Number(d.slice(5, 7)) - 1] += Number(n.total_value) || 0;
  }
  return m;
}
