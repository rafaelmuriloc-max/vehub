# Redesign visual da tela Situação Fiscal (padrão da imagem de referência)

## Objetivo
Reorganizar apenas o **visual/layout** da aba Situação Fiscal (`src/components/integra-contador/SituacaoFiscalTab.tsx`) para seguir o padrão da imagem enviada: barra de busca + filtros em linha no topo, abas com contadores, e tabela mais rica. Nenhuma funcionalidade existente é removida (consulta individual/em lote, baixar PDFs, seleção, paginação 10/20/50/100/Todos, filtro por regime).

## Mudanças

### 1. Barra superior de filtros (estilo da referência)
- Linha única com: busca (cliente, CNPJ), filtro de situação, filtro de regime tributário — como selects no padrão da imagem.
- Botão de ações em lote mantido (Baixar PDFs / Consultar em Lote) no canto direito.

### 2. Abas com contadores
- Abas no topo da tabela, no estilo da imagem: **Todos (n)**, **Com pendência (n)**, **Regulares (n)** e **Sem consulta (n)**, cada uma com contador dinâmico baseado nos dados filtrados.
- A aba ativa funciona como filtro de situação (sincronizada com o filtro existente de status), com underline destacado.

### 3. Tabela no padrão da referência
- Colunas: checkbox, **Cliente** (razão social), **CNPJ/CPF**, **Regime** (tax_regime), **Situação Fiscal** (badge colorido: verde Regular / vermelho Com pendência / cinza Pendente / âmbar Erro), **Pendências** (contagem de pendency_types), **Última Verificação** (data/hora da consulta), **Ações** (menu "…" com Consultar, Ver relatório, Baixar PDF).
- Linhas compactas (padding já reduzido), hover suave, cabeçalho discreto.
- Badges de situação em formato pill colorido como na imagem.

### 4. Manutenções
- Paginação 10/20/50/100/Todos mantida no rodapé.
- Dialog de detalhes de pendências, download em ZIP, consulta em lote com progresso — sem alteração de lógica.
- Dados e queries ao Supabase inalterados.

## Detalhes técnicos
- Arquivo principal: `src/components/integra-contador/SituacaoFiscalTab.tsx` (954 linhas) — apenas JSX/estilos e estado de aba ativa; nenhuma mudança em queries, edge functions ou banco.
- Componentes usados: Tabs (shadcn), Select, Badge, DropdownMenu para ações por linha.
- `resolveStatusKey`/`PENDENCY_LABELS` de `SitfisOverviewPanel` continuam como fonte da classificação.
- Verificação: typecheck + build.
