# Botão para sincronizar só o relatório de experiência

Hoje o botão "Sincronizar pasta" lê todos os arquivos da pasta (fichas de registro, planilhas, PDFs). Quando você só atualizou a previsão de contrato de experiência, isso é demorado à toa.

## O que muda

- Novo botão **Sincronizar experiência**, ao lado de "Sincronizar pasta", na tela Pessoal.
- Ele percorre a pasta e processa apenas os arquivos cujo nome indica previsão de contrato de experiência (por exemplo "Previsão contrato de experiência.html"); todo o resto é ignorado nessa rodada.
- O resumo final mostra quantos funcionários tiveram os prazos atualizados.
- Como só um arquivo leve é lido, a sincronização termina em uma única passada.
- O botão "Sincronizar pasta" continua exatamente como está, lendo tudo.

## Detalhes técnicos

- `supabase/functions/employee-folder-sync/index.ts`: aceita `only: "experiencia"` no corpo da requisição; quando presente, o laço de arquivos pula tudo que não casar com o padrão de nome (normalizado: contém "experiencia" e extensão `.htm`/`.html`/`.xls`), e usa `force_reprocess` implícito para reler o relatório mesmo sem alteração no Drive.
- `src/pages/Personnel.tsx`: novo botão com estado próprio de carregamento, chamando `supabase.functions.invoke('employee-folder-sync', { body: { only: 'experiencia', force_reprocess: true } })`, com o mesmo resumo em toast (destacando `experiencias_atualizadas`).
- Sem alteração de banco de dados.
- Validação: `bunx tsgo --noEmit`, build limpo e deploy da função.
