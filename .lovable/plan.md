

# Corrigir nomes dos campos de dados do PGDASD e PAGTOWEB

## Problema
A documentação oficial do SERPRO (PDF enviado) mostra que o campo correto para o serviço GERARDAS12 e outros do PGDASD e "periodoApuracao", nao "pa". O sistema envia `{"cnpjBasico":"31333686","pa":"202512"}` mas o SERPRO espera `{"periodoApuracao":"201801"}`.

Da mesma forma, o PAGTOWEB pode esperar nomes de campo diferentes de `cnpjBasico` e `anoCalendario`.

## Evidencia do PDF
```text
GERARDAS12:
  dados: "{ \"periodoApuracao\": \"201801\" }"

CONSDECLARACAO13:
  dados: "{ \"anoCalendario\": \"2018\" }"

PAGTOWEB PAGAMENTOS71:
  dados: "{ \"cnpjBasico\": \"99999999\", \"anoCalendario\": \"2024\" }"
```

O campo `anoCalendario` ja esta correto para CONSDECLARACAO13. O problema e especificamente o campo `pa` usado nos servicos de emissao do PGDASD — deveria ser `periodoApuracao`.

## Solucao

### Em `src/pages/IntegraContador.tsx`:

1. Criar um novo campo constante:
```typescript
const F_PERIODO = { key: 'periodoApuracao', label: 'Periodo Apuracao (AAAAMM)', required: true, placeholder: '202401' };
```

2. Substituir `F_PA` por `F_PERIODO` nos servicos PGDASD que usam periodo de apuracao:
   - GERARDAS12, GERARDASCOBRANCA17, GERARDASAVULSO19, TRANSDECLARACAO11

3. Manter `F_PA` para servicos de outros sistemas que realmente usam `pa` como nome de campo (se houver), ou remover se nao for mais usado.

## Sobre o PAGTOWEB
O erro `cnpjBasico invalido` no PAGTOWEB precisa ser verificado tambem no PDF. Vou verificar os campos corretos.

## Arquivo alterado
- `src/pages/IntegraContador.tsx` — ~10 linhas (renomear campos)

## Resultado esperado
Os campos enviados ao SERPRO terao os nomes corretos conforme a documentacao oficial, eliminando os erros 400.

