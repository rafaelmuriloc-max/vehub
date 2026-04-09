

# Tratar HTTP 304 do SERPRO no fluxo AUTENTICAPROCURADOR

## Situação atual
O SERPRO aceita a assinatura e retorna **304** — a autorização de procurador já existe. O body vem vazio. O código trata 304 como erro porque `status >= 300`.

A documentação do SERPRO indica que o 304 significa "autorização já concedida". O token de procurador foi retornado na primeira chamada bem-sucedida, mas não foi persistido.

## Solução

### 1. Persistir o token de procurador no Supabase
Criar uma tabela `procurador_tokens` para cachear tokens obtidos:

```sql
CREATE TABLE procurador_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contratante_cnpj text NOT NULL,
  autor_cnpj text NOT NULL,
  token text NOT NULL,
  obtained_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(contratante_cnpj, autor_cnpj)
);
ALTER TABLE procurador_tokens ENABLE ROW LEVEL SECURITY;
```

### 2. No `obtainProcuradorToken` (integra-contador/index.ts):

**Antes de chamar /Apoiar**: verificar se já existe token em cache no Supabase:
```typescript
const { data: cached } = await supabaseAdmin
  .from("procurador_tokens")
  .select("token, expires_at")
  .eq("contratante_cnpj", contratanteCnpj)
  .eq("autor_cnpj", autorCnpj)
  .single();

if (cached?.token && (!cached.expires_at || new Date(cached.expires_at) > new Date())) {
  return cached.token;
}
```

**Ao receber 2xx**: salvar o token obtido no banco:
```typescript
await supabaseAdmin.from("procurador_tokens").upsert({
  contratante_cnpj: contratanteCnpj,
  autor_cnpj: autorCnpj,
  token: extractedToken,
  obtained_at: new Date().toISOString(),
});
```

**Ao receber 304**: buscar token do cache. Se não existir, retornar erro explicativo:
```typescript
if (response.status === 304) {
  const { data: cached } = await supabaseAdmin
    .from("procurador_tokens")
    .select("token")
    .eq("contratante_cnpj", contratanteCnpj)
    .eq("autor_cnpj", autorCnpj)
    .single();
  if (cached?.token) return cached.token;
  // Sem token em cache — erro
}
```

### 3. Corrigir build errors pré-existentes
Os 18 erros de TypeScript são de **outros arquivos** (cnpj-lookup, cnpj-query, manage-user, nfse-download, nfse-emit, nfse-query, smtp-send, whatsapp-send) e precisam ser corrigidos:
- `'e' is of type 'unknown'` → adicionar `(e as Error).message`
- `Unused '@ts-expect-error'` → remover diretivas desnecessárias
- Type incompatibilities → usar casts apropriados

## Arquivos alterados
- **Nova migração SQL**: criar tabela `procurador_tokens`
- **`supabase/functions/integra-contador/index.ts`**: ~30 linhas — cache de tokens + tratar 304
- **6 outros arquivos de edge functions**: correções pontuais de TypeScript (1-2 linhas cada)

## Resultado esperado
- 304 deixa de ser erro — o token é recuperado do banco
- Primeira chamada (2xx) salva o token para futuras reutilizações
- Build passa sem erros de TypeScript

