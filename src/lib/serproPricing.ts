export type TipoCobranca = 'Consultar' | 'Emitir' | 'Declarar';

// Faixas do Anexo I do contrato SERPRO (limite superior inclusivo; Infinity = acima)
export const FAIXAS: Record<TipoCobranca, { ate: number; preco: number }[]> = {
  Consultar: [
    { ate: 300, preco: 0.24 }, { ate: 1000, preco: 0.21 }, { ate: 3000, preco: 0.18 },
    { ate: 7000, preco: 0.16 }, { ate: 15000, preco: 0.14 }, { ate: 23000, preco: 0.11 },
    { ate: 30000, preco: 0.09 }, { ate: Infinity, preco: 0.06 },
  ],
  Emitir: [
    { ate: 500, preco: 0.32 }, { ate: 5000, preco: 0.29 }, { ate: 10000, preco: 0.26 },
    { ate: 15000, preco: 0.22 }, { ate: 25000, preco: 0.19 }, { ate: 35000, preco: 0.16 },
    { ate: 50000, preco: 0.12 }, { ate: Infinity, preco: 0.08 },
  ],
  Declarar: [
    { ate: 100, preco: 0.40 }, { ate: 500, preco: 0.36 }, { ate: 1000, preco: 0.32 },
    { ate: 3000, preco: 0.28 }, { ate: 5000, preco: 0.24 }, { ate: 8000, preco: 0.20 },
    { ate: 10000, preco: 0.16 }, { ate: Infinity, preco: 0.12 },
  ],
};

export function normalizeTipo(t: string): TipoCobranca {
  const s = (t || '').toLowerCase();
  if (s.startsWith('emit')) return 'Emitir';
  if (s.startsWith('declar')) return 'Declarar';
  return 'Consultar';
}

/** Preço da n-ésima requisição (1-based) do ciclo — progressivo por faixa. */
export function precoUnitario(tipo: TipoCobranca, n: number): number {
  return FAIXAS[tipo].find((f) => n <= f.ate)!.preco;
}

export function custoAcumulado(tipo: TipoCobranca, qtd: number): number {
  let total = 0, prev = 0;
  for (const f of FAIXAS[tipo]) {
    if (qtd <= prev) break;
    const n = Math.min(qtd, f.ate) - prev;
    total += n * f.preco;
    prev = f.ate;
  }
  return Math.round(total * 100) / 100;
}

export function faixaAtual(tipo: TipoCobranca, qtd: number) {
  const fx = FAIXAS[tipo];
  const idx = fx.findIndex((f) => qtd + 1 <= f.ate);
  const f = fx[idx];
  return { faixa: idx + 1, preco: f.preco, inicio: idx === 0 ? 0 : fx[idx - 1].ate, ate: f.ate, faltam: f.ate === Infinity ? null : f.ate - qtd };
}

/** Ciclo de faturamento: dia 21 do mês anterior a dia 20 do mês de referência. offset=0 → ciclo atual. */
export function cicloFaturamento(ref: Date = new Date(), offset = 0) {
  let y = ref.getFullYear(), m = ref.getMonth();
  if (ref.getDate() >= 21) m += 1;
  m += offset;
  const fim = new Date(y, m, 20, 23, 59, 59, 999);
  const inicio = new Date(y, m - 1, 21, 0, 0, 0, 0);
  return { inicio, fim, label: `${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')}` };
}
