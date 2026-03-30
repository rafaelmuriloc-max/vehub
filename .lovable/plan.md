
Objetivo: corrigir o que está realmente em branco na base e preencher automaticamente sem depender de ação manual.

O que encontrei
- Hoje não há clientes com `business_classification` em branco e com CNAEs disponíveis.
- O campo que ainda está vazio em vários cadastros é `business_segment`.
- Há 31 clientes com `business_segment` vazio, mas todos já possuem `business_classification` preenchido.
- A classificação automática atual só atualiza `business_classification`, por isso o outro campo continua vazio.
- Também há um bug na query atual: o `select` do auto-classify não traz `business_classification`, mas o filtro em JS usa esse campo.

Plano de implementação

1. Corrigir a automação em `src/pages/Clients.tsx`
- Ajustar o auto-classify para buscar também `business_classification` no `select`.
- Manter a lógica de retry diário apenas para clientes realmente pendentes.
- Normalizar a checagem para considerar `null`, vazio e espaços.

2. Preencher automaticamente `business_segment` quando houver classificação
- Criar uma função utilitária local para mapear a classificação IA para um texto de segmento:
  - `Comércio` → `Comércio`
  - `Serviço` → `Serviços`
  - `Indústria` → `Indústria`
  - `Misto` → `Misto`
- Sempre que `classifyByAI` retornar valor, salvar também `business_segment` junto com `business_classification`.

3. Corrigir os fluxos já existentes
- No `fetchCnpjData`, além de preencher `business_classification`, preencher `business_segment`.
- No `batchUpdateAllCnpj`, quando classificar, atualizar os dois campos.
- Nas mudanças manuais de CNAE (`CnaeCombobox` e `CnaeMultiSelect`), recalcular e preencher os dois campos.

4. Fazer backfill automático dos clientes já afetados
- No mesmo `useEffect` da página, incluir um segundo passo:
  - localizar clientes com `business_segment` vazio e `business_classification` preenchido
  - atualizar `business_segment` por mapeamento, sem chamar IA novamente
- Isso resolve imediatamente os 31 registros já existentes.
- Se necessário, depois rodar a classificação IA apenas para quem estiver sem os dois campos e tiver CNAEs.

5. Ajustar consistência de valores
- Hoje o banco tem variações como `SERVIÇO`, `COMÉRCIO`, `MISTO`, `INDÚSTRIA` e também `Serviço`.
- Padronizar no front antes de salvar para evitar gráficos e filtros quebrados.
- Usar um normalizador central para gravar sempre no mesmo formato.

6. Corrigir warning visual relacionado aos gráficos
- O console mostra warning de `ref` no componente `Badge`.
- Isso provavelmente vem do uso do `Badge` em algum wrapper do gráfico/tabela.
- Ajustar `src/components/ui/badge.tsx` para `React.forwardRef`, evitando warnings e garantindo compatibilidade com libs/UI wrappers.

Resultado esperado
- Os clientes já classificados deixarão de aparecer com “segmento” em branco.
- Novos clientes terão `business_classification` e `business_segment` preenchidos juntos.
- A rotina automática ficará mais confiável para futuros cadastros pendentes.
- Os gráficos de segmento continuarão usando dados consistentes e sem categorias duplicadas por diferença de capitalização.

Detalhes técnicos
- Arquivos a alterar:
  - `src/pages/Clients.tsx`
  - `src/components/ui/badge.tsx`
- Sem migração de banco.
- Sem necessidade de nova edge function.
- A correção principal é de lógica entre dois campos existentes: `business_classification` e `business_segment`.
