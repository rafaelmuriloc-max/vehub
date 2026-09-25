# Novo visual da tela Folha de pagamento

## O que muda (só a tela /folha)
- **Topo:** caminho "Departamento pessoal / Folha de pagamento", título, subtítulo "Uma visão clara dos valores e das movimentações da sua carteira." e o botão laranja **Sincronizar** à direita (mesma sincronização de hoje, travado com indicador enquanto roda, aviso real de sucesso ou erro).
- **Filtros com rótulo:** "Empresa" e "Competência". Continua dando para marcar várias empresas e vários meses, como hoje. O mês aparece por extenso ("Agosto de 2026"). À direita, "Resumo mensal · 08/2026".
- **4 cards no lugar dos 8:** Total de proventos (fundo azul-marinho, destaque), Líquido da folha, Descontos e Encargos informados (identificado como "INSS + FGTS"). Os valores seguem exatamente como o sistema calcula hoje.
- **Faixa da equipe:** colaboradores ativos, admissões, desligamentos e o saldo (admissões menos desligamentos), verde se positivo, vermelho se negativo, neutro se zero, sempre com sinal + ou −.
- **Gráficos lado a lado:**
  - Evolução da folha (cerca de 2/3): barras de proventos (laranja) e líquido (verde), eixo em R$ abreviado, valor completo ao passar o mouse, só meses com dados. Um seletor alterna para "Encargos" (INSS e FGTS) e "Colaboradores" (gráfico próprio, em pessoas). Rodapé com INSS (GPS) e FGTS do período.
  - Maiores folhas (cerca de 1/3): top 5 por proventos, nome e valor, primeira posição em laranja forte, as demais em laranja suave.
- **Tabela "Folha por empresa":** contagem de empresas, busca por nome ou código, ordenação (maior folha, mais colaboradores, maior líquido, maiores encargos), colunas Empresa (código embaixo), Ativos, Proventos, Líquido (verde) e Encargos. Paginação de 5 por página com opção de 10, 25 ou 50 e contador "1–5 de 32 empresas". Clicar numa empresa marca ou desmarca ela no filtro, como hoje no ranking.
- **Estados:** esqueleto durante o carregamento, aviso quando não há dados (diferente de valor zero) e erro com botão "Tentar novamente".
- **Celular e tablet:** cards em 2 colunas (1 no celular estreito), gráficos empilhados, tabela com rolagem lateral só nela.
- O menu lateral e as outras telas não mudam. Sem números de exemplo: tudo vem do banco.

## Detalhes técnicos
- Só `src/pages/Payroll.tsx` e tokens novos em `src/index.css`/`tailwind.config.ts` (ex.: `--payroll-bg`, `--success` para o verde #138263), sem cores fixas nos componentes e com versão para o modo escuro.
- Reaproveita `load()`, `syncPayroll`, `clientIds`/`selMonths` e os agregados existentes; o ranking vira a tabela com busca/ordenação/paginação em memória antes de paginar.
- Recharts: `BarChart` agrupado, `Legend` clicável para esconder séries, `YAxis` com formatação compacta pt-BR; colaboradores em gráfico separado.
- Números com `tabular-nums`; `motion-reduce` nas animações; foco visível nos controles.
- Sem mudança em banco, sincronização ou permissões. Validação: `bunx tsgo --noEmit` e build.
