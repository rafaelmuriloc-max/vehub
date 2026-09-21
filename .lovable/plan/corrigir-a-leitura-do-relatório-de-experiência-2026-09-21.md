# Corrigir a leitura do relatório de experiência

Verifiquei a sincronização das 16h23: o leitor próprio do relatório não reconheceu nenhuma ficha, então o arquivo caiu na leitura automática por IA. Ela devolveu 66 pessoas sem prazos e jogou todas na **POUSADA DO PESCADOR LTDA** — por isso as colunas Prazo 1/Prazo 2 continuam vazias e há 66 cadastros indevidos nessa empresa.

## O que será feito

1. **Limpar o que entrou errado**: remover os 66 funcionários criados pela importação de 16h22/16h23 nessa empresa e os vínculos daquele arquivo. Nada digitado manualmente, e nenhum outro funcionário, é tocado.
2. **Nunca mais adivinhar**: no botão "Sincronizar experiência", o relatório passa a ser lido apenas pelo leitor estruturado. Se ele não reconhecer as fichas, o arquivo fica como "não reconhecido" e nada é gravado — sem cair na leitura por IA e sem usar empresa padrão.
3. **Descobrir o formato real do seu relatório**: como o arquivo enviado aqui chega vazio (só bytes nulos), a sincronização vai registrar, uma única vez, uma amostra das primeiras linhas e dos rótulos encontrados no arquivo. Com isso eu ajusto o leitor para os nomes de campo exatos do seu relatório (Prazo 1, dias, Prazo 2, dias, empresa).
4. **Ajustar o leitor** com base nessa amostra e validar: número de fichas do relatório x prazos preenchidos, empresa por empresa.

## Como você participa

Depois que eu publicar o passo 3, você clica em **Sincronizar experiência** uma vez. Eu leio a amostra registrada, corrijo o leitor e te aviso para sincronizar de novo — aí os prazos devem aparecer nas colunas.

Se preferir, você também pode enviar o relatório compactado em **.zip** aqui no chat; assim eu ajusto o leitor de imediato, sem esse ciclo.

## Detalhes técnicos

- `supabase/functions/employee-folder-sync/index.ts`: quando `only === "experiencia"`, desabilita o caminho de IA e o fallback de empresa do arquivo; sem fichas reconhecidas → `pending_review` com motivo e `stats.revisao`.
- Log de diagnóstico: primeiras ~40 linhas normalizadas de `htmlToRows` e a lista de rótulos distintos encontrados, truncados para caber no log (sem dados pessoais completos — só rótulos e as duas primeiras linhas de valores).
- `sciTrial.ts`: ampliar `looksLikeTrialHtml`/aliases conforme a amostra; manter a regra de empresa pelo CNPJ da própria ficha.
- Limpeza: `delete` em `client_employees` pelos ids criados na janela 2026-09-21 19:22–19:24 UTC com `source='drive'` na POUSADA DO PESCADOR, mais os vínculos em `employee_documents` daquele arquivo.
- Validação: `bunx tsgo --noEmit`, build e conferência por consulta das contagens antes/depois.
