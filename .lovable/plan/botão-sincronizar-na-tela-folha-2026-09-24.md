# Botão Sincronizar na tela Folha

## O que muda
- No topo da tela Folha, ao lado dos filtros de empresa e mês, aparece um botão laranja **Sincronizar**.
- Ele lê o relatório "Espelho e resumo da folha" na pasta do Drive que já usamos. É a mesma leitura da opção Sincronizar → Folha da página Pessoal.
- Enquanto lê, o botão mostra que está carregando e fica travado. No fim aparece um resumo com os arquivos lidos, os meses encontrados, as empresas gravadas e as empresas que não estão cadastradas.
- Depois de sincronizar, os cards, os gráficos e o ranking se atualizam sozinhos e mostram o mês mais recente.
- Se ainda não houver pasta definida, aparece um aviso pedindo para definir a pasta pelo botão Funcionários, na página Pessoal.
- A opção Folha dentro do Sincronizar da página Pessoal continua como está.

## Técnico
- Só muda `src/pages/Payroll.tsx`. Entra a função `syncPayroll`, que chama `employee-folder-sync` com `{ only: 'folha' }`. O carregamento dos dados é extraído para uma função `load()`, chamada de novo depois da sincronização.
- Não há mudança no banco nem na função do servidor.
- Validação: `bunx tsgo --noEmit` e build.
