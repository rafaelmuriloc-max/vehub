# Ler o relatório de previsão de contrato de experiência

Agora o relatório chegou íntegro. Ele tem 28 blocos de empresa (um por página), cada um com o cabeçalho
`Empresa: 16 - POUSADA DO PESCADOR LTDA` + `CNPJ:42.466.142/0001-99` e uma grade de colaboradores:

```text
Código |   Colaborador                   | Data Adm.  | Data Venc. | Prazo | Data Venc. | Prazo
43     | BRUNA ALESSANDRA MENEZES PINTO  | 04/08/2026 | 17/09/2026 | 45    | 01/11/2026 | 45
```

O leitor atual não reconhece esses rótulos — por isso nada foi preenchido. Não há CPF no relatório.

## O que será feito

1. Ensinar o leitor os rótulos reais: `Código` (código do colaborador), `Colaborador`, `Data Adm.`,
   `Data Venc.` + `Prazo` (primeiro par) e `Data Venc.` + `Prazo` (segundo par).
2. Empresa pelo cabeçalho do bloco: CNPJ e, como reforço, o código do escritório (`Empresa: 16 - ...`).
   Cada pessoa vai para a empresa do seu próprio bloco; sem empresa reconhecida, a linha é contada e não gravada.
3. Como o relatório não traz CPF, o funcionário é localizado na empresa pelo nome (comparação sem acentos,
   maiúsculas e espaços extras). Quem não existir é cadastrado com nome, admissão e os dois prazos.
4. Os quatro campos de experiência são sempre atualizados com o que o relatório trouxer; nenhum outro campo é tocado.
5. O resumo da sincronização mostra empresas atendidas, prazos atualizados e linhas sem empresa.
6. Conferência: comparo o "Total de colaboradores" de cada bloco com o que foi gravado e te informo divergências.

## Detalhes técnicos

- `sciTrial.ts`: `looksLikeTrialHtml` passa a aceitar "previsao de contrato de experiencia";
  `FIELD_ALIASES` ganha `codigo`/`cod` → `employee_code` (deixa de cair em `company_code`),
  `colaborador` → `full_name`, `data adm` → `admission_date`, e o par `data venc`/`prazo` resolvido
  posicionalmente (primeiro par → `trial_end_1`/`trial_days_1`, segundo → `trial_end_2`/`trial_days_2`),
  reaproveitando `resolveDays`. Cabeçalho de empresa: regex `Empresa:\s*(\d+)\s*-\s*(.+)` para
  `company_code`/`company_name` e `CNPJ:\s*([\d./-]+)` para `company_document`; o contexto é reiniciado
  a cada novo cabeçalho. `build()` deixa de exigir CPF: nome + pelo menos um prazo bastam.
- `index.ts`: match do funcionário por nome normalizado dentro da empresa quando não houver CPF;
  mantém o caminho estruturado exclusivo em `only: "experiencia"` (sem IA, sem empresa padrão) e
  remove o log de amostra de diagnóstico.
- `sciTrial.test.ts`: fixture com o formato real (dois blocos de empresa), verificando empresa por CNPJ,
  os dois pares de datas/dias e linha sem segundo prazo.
- Sem alteração de banco de dados.
- Validação: `deno test` do parser, `bunx tsgo --noEmit`, build e uma sincronização real conferida bloco a bloco.
