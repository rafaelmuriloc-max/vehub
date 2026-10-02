# Redesenho da tela Google Drive (igual à referência)

## O que muda na tela
**Cabeçalho**
- Logo colorido do Google Drive + título "Google Drive" e subtítulo "Arquivos da conta do escritório".
- À direita: botões "Nova pasta", "Upload" (contorno) e "+ Novo" (laranja da marca, com seta abrindo menu: Nova pasta / Upload de arquivo).

**Barra de filtros**
- Abas em pílula: Todos, Pastas, Arquivos, Compartilhados, Recentes (ativa preenchida).
- À direita: alternar Lista/Grade, botão Atualizar, "Ordenar por" (Nome A-Z, Nome Z-A, Modificação mais recente, Tamanho) e botão "Filtros" (busca por nome + tipo de arquivo).
- Navegação de pastas (trilha) aparece logo abaixo quando se entra em uma subpasta.

**Tabela (modo lista)**
- Card com bordas arredondadas; colunas: caixa de seleção, Nome (ordenável, com seta), Proprietário (avatar com iniciais + nome), Última modificação (dd/mm/aaaa hh:mm), Tamanho, Ações.
- Pasta: ícone amarelo grande + "N itens" abaixo do nome. Arquivo: ícone por tipo + tamanho.
- Ações: Compartilhar (copia link), Abrir no Drive, menu "⋮" com Baixar, Renomear, Mover, Excluir (excluir só admin).
- Selecionar várias linhas mostra barra de ações em lote (Baixar / Excluir).

**Modo grade**: cartões com ícone, nome e data.

**Celular**: botões do cabeçalho viram ícones; colunas Proprietário/Tamanho escondidas.

O modo seletor (anexar do Drive no chat/tarefas) mantém o mesmo visual, sem os botões de gerenciamento, com o rodapé "Anexar".

## Detalhes técnicos
- Reescrever `src/components/drive/DriveBrowser.tsx` e ajustar `src/pages/Drive.tsx` (cabeçalho passa para dentro do componente); só tokens semânticos.
- `drive-api` action `list`: incluir `owners(displayName,photoLink)` e `shared` nos campos; aceitar `filter` (`folders` | `files` | `shared` → `sharedWithMe` | `recent` → ordenado por `modifiedTime desc`, sem filtro de pasta) e `orderBy`.
- Contagem "N itens": nova action `countChildren` (lote de IDs de pasta, consultas paralelas com `pageSize=1000, fields=files(id)`), carregada após a lista sem travar a tela.
- A Edge Function `drive-api` precisa ser publicada para os novos campos aparecerem; até lá, Proprietário e contagem mostram "—".
