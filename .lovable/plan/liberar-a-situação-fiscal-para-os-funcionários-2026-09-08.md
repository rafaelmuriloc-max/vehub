# Liberar a Situação Fiscal para os funcionários

## O que está acontecendo (confirmado no banco)

A tela lê duas fontes: a lista de empresas e os resultados de situação fiscal.
As regras de acesso dos resultados de situação fiscal (e também dos parcelamentos)
permitem leitura **apenas para administradores**.

Dorothea Masson e David Custódio estão cadastrados como funcionários, não como
administradores. Por isso a lista de empresas aparece, mas todas as colunas de
situação, data da consulta e PDF ficam vazias.

## O que será feito

1. Permitir que qualquer usuário conectado ao sistema **veja** os resultados de
   situação fiscal (situação, data da consulta, pendências e relatório em PDF).
2. Permitir que esses mesmos usuários **executem consultas**, individuais ou em
   lote, gravando e atualizando os resultados.
3. Aplicar a mesma liberação aos resultados de parcelamentos, que ficam na mesma
   área fiscal e hoje têm a mesma restrição — assim a página não mostra dados
   pela metade.
4. Nada muda para administradores, e nenhuma outra área do sistema é afetada.

## Detalhes técnicos

- Migração de banco em `sitfis_results` e `parcelamento_results`:
  - substituir as políticas `Admins can view ...` e `Admins can manage ...`
    por políticas para o papel `authenticated`:
    - `SELECT` com `USING (true)`
    - `INSERT` / `UPDATE` / `DELETE` com `auth.uid() IS NOT NULL`
  - confirmar `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` e
    `GRANT ALL ... TO service_role`.
- Nenhuma alteração em `src/components/integra-contador/SituacaoFiscalTab.tsx`
  é necessária: o componente não filtra por papel.
- Após a migração, verificar com uma consulta que os registros aparecem para um
  usuário funcionário.
