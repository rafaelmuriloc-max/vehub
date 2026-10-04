# Botões Visualizar/Baixar nos vencimentos com guia

## O que muda
- Em Próximos vencimentos (tela inicial e Calendário), cada imposto com "Guia disponível" ganha os botões **Visualizar** e **Baixar** (no celular, ícones lado a lado).
- A guia é o arquivo que o escritório anexou ao concluir a tarefa daquele imposto. Se houver mais de um arquivo, usa o mais recente.
- Se a tarefa está concluída mas sem arquivo, fica só o selo, sem botões.
- O arquivo abre por link temporário e privado, como já acontece em Documentos.

## Detalhes técnicos
- Migração: atualizar `portal_due_dates` para devolver também `file_url` e `file_name` (último anexo em `obligation_activity_completions` da instância, `file_url is not null`), mantendo a checagem `portal_can_access_client` e os mesmos GRANTs. Os arquivos já ficam na pasta da empresa no bucket `documents`, liberada ao cliente pela regra atual.
- `Portal.tsx`: levar `file_url`/`file_name` para o `DueItem` e reutilizar a função de abrir com URL assinada.
- `UpcomingDues` em `PortalWidgets.tsx`: prop `onOpen`; botões Eye/Download quando houver arquivo.
