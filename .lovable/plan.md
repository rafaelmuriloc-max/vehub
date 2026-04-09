

# Formulário estruturado para TRANSDECLARACAO11 (Entregar Declaração PGDAS-D)

## Problema
O serviço TRANSDECLARACAO11 requer um payload JSON complexo com dados aninhados (declaração, receitas anteriores, folhas de salário, estabelecimentos com atividades). O usuário precisa preencher esses dados via formulário, não colar JSON.

## Solução
Criar um componente dedicado `PgdasdDeclaracaoForm` com seções organizadas em accordion/tabs que constrói o payload programaticamente.

## Estrutura do formulário (4 seções)

### Seção 1 — Dados Gerais
- Período de Apuração (AAAAMM) — input
- Tipo de Declaração — select (1=Original, 2=Retificadora)
- Indicador de Transmissão — checkbox (default: true)
- Indicador de Comparação — checkbox (default: true)

### Seção 2 — Receitas do Período
- Receita Competência Interno — input numérico
- Receita Competência Externo — input numérico
- Receita Caixa Interno — input numérico (opcional)
- Receita Caixa Externo — input numérico (opcional)
- Valor Fixo ICMS — input numérico (opcional)
- Valor Fixo ISS — input numérico (opcional)

### Seção 3 — Receitas Brutas Anteriores e Folhas de Salário
- Tabela editável com 12 linhas (meses anteriores ao PA)
- Colunas: Mês (AAAAMM), Valor Interno, Valor Externo
- Segunda tabela: Folhas de Salário (12 meses, cada com valor)
- Os meses são calculados automaticamente a partir do PA informado

### Seção 4 — Estabelecimentos e Atividades
- Botão "Adicionar Estabelecimento"
- Cada estabelecimento: CNPJ Completo + lista de atividades
- Cada atividade: ID Atividade, Valor Atividade + receitas por atividade
- Receitas: valor, código outro município, outra UF, isenções, reduções
- Interface com cards colapsáveis para cada estabelecimento/atividade

### Seção 5 (se comparação ativa) — Valores para Comparação
- Tabela editável: Código Tributo (select) + Valor
- Botão "Adicionar Tributo"
- Códigos pré-definidos: 1001-IRPJ, 1002-IPI, 1004-CSLL, 1005-COFINS, 1006-PIS, 1007-ISS, 1010-CPP

## Alterações

### Novo arquivo: `src/components/integra-contador/PgdasdDeclaracaoForm.tsx`
- Componente com estado local para todos os campos
- Accordion com as 5 seções
- Prop `onSubmit(dadosJson: string)` que retorna o JSON stringificado pronto para enviar
- Prop `cnpjContribuinte: string` para pré-preencher automaticamente o cnpjCompleto
- Calcula os 12 meses anteriores ao PA automaticamente

### `src/pages/IntegraContador.tsx`
- Importar `PgdasdDeclaracaoForm`
- Na definição do serviço TRANSDECLARACAO11: adicionar flag `customForm: 'pgdasd-declaracao'`
- No bloco de renderização de parâmetros (linhas 590-613): quando `selectedService.customForm === 'pgdasd-declaracao'`, renderizar `<PgdasdDeclaracaoForm>` ao invés dos campos genéricos
- O `onSubmit` do form chama `handleSubmit` passando o JSON completo como `dados`
- Ajustar `handleSubmit` para aceitar `dados` como override (quando vem do custom form)

## Detalhes técnicos

O payload é montado assim no submit:
```typescript
const payload = {
  cnpjCompleto: cnpjContribuinte,
  pa: Number(pa),
  indicadorTransmissao: true,
  indicadorComparacao: true,
  declaracao: {
    tipoDeclaracao: 1,
    receitaPaCompetenciaInterno: 10000.00,
    // ... demais campos
    receitasBrutasAnteriores: months.map(m => ({ pa: m, valorInterno: 0, valorExterno: 0 })),
    folhasSalario: months.map(m => ({ pa: m, valor: 0 })),
    estabelecimentos: [{ cnpjCompleto, atividades: [...] }],
  },
  valoresParaComparacao: [...]
};
return JSON.stringify(payload);
```

## Arquivos
- **Novo**: `src/components/integra-contador/PgdasdDeclaracaoForm.tsx` (~300 linhas)
- **Editado**: `src/pages/IntegraContador.tsx` (~15 linhas — flag customForm + renderização condicional + override no handleSubmit)

## Resultado esperado
O contador preenche todos os campos da declaração PGDAS-D via formulário estruturado, sem precisar montar JSON manualmente.

