# Corrigir "Consultar todas" do FGTS

## Causa (confirmada)
No cadastro de clientes, o CNPJ fica num campo chamado `document`, e não `cnpj`. A tela FGTS e a consulta pedem um campo `cnpj`, que não existe. Por isso:
- a lista de empresas vem vazia;
- "Consultar todas" não tem nenhuma empresa para consultar e mostra "concluída" na hora.

Confirmações: nenhuma guia foi gravada até agora, e a função de consulta só foi iniciada, nunca processou uma empresa.

## Correção
1. **Tela FGTS:** buscar o CNPJ no campo `document` e mostrar um erro na tela quando a lista de empresas não carregar, em vez de ficar em branco.
2. **Consulta no servidor:** ler o CNPJ da empresa do campo `document`.
3. **"Consultar todas":** antes de começar, avisar se não houver empresas. Ao final, mostrar quantas deram certo e quantas falharam, junto com o motivo do primeiro erro.

## Detalhes técnicos
- `src/pages/FgtsDigital.tsx`: trocar o select por `id, company_name, document, sci_code` e mapear para `cnpj`. Tratar o erro do select e incluir um aviso de lista vazia em `syncAll`, mais um resumo com o primeiro erro.
- `supabase/functions/fgts-digital-sync/index.ts`: `select("id, document")` e usar `client.document`.
