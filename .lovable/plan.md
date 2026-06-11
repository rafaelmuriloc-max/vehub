## Problema

O CNPJ `67.203.457/0001-74` é recente (abertura em 08/06/2026) e ainda não consta nas bases que a edge function `cnpj-lookup` consulta:

- **BrasilAPI** → 404 "CNPJ não encontrado"
- **ReceitaWS / Minha Receita** → 404 "CNPJ não encontrado"

Já a base **publica.cnpj.ws** retorna os dados completos (testado e confirmado). A função precisa de um terceiro fallback para cobrir CNPJs recém-abertos.

## Mudança

Adicionar `https://publica.cnpj.ws/cnpj/{cnpj}` como **terceira tentativa** em `supabase/functions/cnpj-lookup/index.ts`, executada apenas se BrasilAPI e ReceitaWS falharem.

O retorno da `publica.cnpj.ws` tem estrutura diferente — será convertido para o mesmo formato que o frontend já consome (formato BrasilAPI), mapeando:

| Campo frontend (BrasilAPI) | Origem em publica.cnpj.ws |
|---|---|
| `razao_social` | `razao_social` |
| `nome_fantasia` | `estabelecimento.nome_fantasia` |
| `cnpj` | `estabelecimento.cnpj` |
| `logradouro` / `numero` / `complemento` / `bairro` / `cep` | `estabelecimento.*` |
| `municipio` | `estabelecimento.cidade.nome` |
| `uf` | `estabelecimento.estado.sigla` |
| `email` | `estabelecimento.email` |
| `ddd_telefone_1` | `estabelecimento.ddd1 + telefone1` |
| `cnae_fiscal` / `cnae_fiscal_descricao` | `estabelecimento.atividade_principal.subclasse` (sem pontuação) / `.descricao` |
| `cnaes_secundarios` | `estabelecimento.atividades_secundarias` mapeado para `{codigo, descricao}` |
| `qsa` | `socios` mapeado para `{nome_socio, qualificacao_socio}` |
| `opcao_pelo_simples` | `simples.simples === "Sim"` |
| `opcao_pelo_mei` | `simples.mei === "Sim"` |
| `data_inicio_atividade` | `estabelecimento.data_inicio_atividade` |

Se as três fontes falharem, mantém o retorno atual `200 { error: "CNPJ_NOT_FOUND", fallback: true }`.

## Arquivos

- `supabase/functions/cnpj-lookup/index.ts` — adicionar bloco try/catch para `publica.cnpj.ws` após o bloco do ReceitaWS, com o mapeamento descrito.

Sem alterações no frontend.