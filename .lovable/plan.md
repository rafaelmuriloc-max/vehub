

## Plano: Seletor de CNAE com dados do IBGE

### Abordagem
Criar um componente de busca/seleção de CNAE que consulta a API pública do IBGE (`servicodados.ibge.gov.br/api/v2/cnae/subclasses`) e permite ao usuário pesquisar e selecionar atividades por código ou descrição.

### 1. Componente `CnaeCombobox`

Novo componente em `src/components/CnaeCombobox.tsx`:
- Usa o Popover + Command (cmdk) já existentes no projeto para criar um combobox com busca
- Carrega todas as subclasses CNAE da API do IBGE na primeira abertura (~1300 itens)
- Cache local via React state para não recarregar a cada abertura
- Exibe formato: `0111301 - CULTIVO DE ARROZ`
- Filtragem client-side pelo código ou descrição
- Props: `value`, `onChange`, `placeholder`

### 2. Componente `CnaeMultiSelect`

Para atividades secundárias, permitir selecionar múltiplos CNAEs:
- Mesmo padrão do combobox, mas armazena array de códigos
- Exibe badges com os CNAEs selecionados e botão de remover
- Valor salvo no banco como texto separado por vírgula (campo `secondary_activities` já existente)

### 3. Alterações em `Clients.tsx`

- Substituir o `<Input>` de "Atividade Principal (CNAE)" pelo `CnaeCombobox`
- Substituir o `<Textarea>` de "Atividades Secundárias" pelo `CnaeMultiSelect`
- Formato salvo: `"código - descrição"` para manter legibilidade

### Detalhes Técnicos
- API pública IBGE: `https://servicodados.ibge.gov.br/api/v2/cnae/subclasses` (sem autenticação, CORS habilitado)
- Sem necessidade de edge function ou migration
- Dados cacheados em memória durante a sessão

