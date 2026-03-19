

# Corrigir seleção do autor do pedido no Integra Contador

## Diagnóstico

O problema não é mais o certificado do escritório. Agora o fluxo está caindo no **fallback do e-CNPJ do escritório** porque o modo “certificado do contador” só é ativado quando estes 3 campos existem ao mesmo tempo em `company_settings`:

- `accountant_certificate_url`
- `accountant_certificate_password`
- `accountant_cpf`

Pelo estado atual do banco, o certificado do contador já existe, mas o `accountant_cpf` está `null`. Por isso a função continua montando:

```text
autorPedidoDados.numero = 59400171000150
autorPedidoDados.tipo   = 2
```

Então, respondendo objetivamente: **não foi o próprio cliente**. O autor do pedido continuou sendo o **CNPJ do escritório**, porque o CPF do contador não está salvo na configuração.

## O que implementar

### 1. Fortalecer a regra na edge function
Atualizar `supabase/functions/integra-contador/index.ts` para não fazer fallback silencioso quando houver configuração parcial do contador.

Novo comportamento:
- Se existir certificado do contador, mas faltar CPF ou senha:
  - retornar **400** com mensagem clara:
    - “Certificado do contador configurado sem CPF/senha. Complete a configuração em Meu Escritório.”
- Só usar o modo contador quando houver:
  - certificado
  - senha
  - CPF válido
- Continuar usando o certificado do escritório apenas quando **não houver** configuração de contador.

### 2. Melhorar a UX da aba Meu Escritório
Atualizar `src/components/settings/CompanyTab.tsx` para evitar esse erro de configuração incompleta.

Ajustes:
- Exibir aviso visível quando houver certificado do contador sem CPF salvo.
- Adicionar ação explícita para salvar o CPF do contador, no mesmo padrão de “Salvar Senha”.
- Validar CPF antes de salvar.
- Informar claramente no texto da tela:
  - “Sem CPF salvo, o sistema continuará usando o CNPJ do escritório como autor do pedido.”

### 3. Validar e normalizar o CPF
No salvamento do CPF:
- remover máscara e caracteres não numéricos
- aceitar apenas 11 dígitos
- rejeitar CPF inválido/incompleto

Isso evita que um valor mascarado ou parcial impeça a ativação do modo contador.

### 4. Melhorar observabilidade
Na edge function, registrar em log qual identidade foi escolhida:
- certificado do escritório / autor CNPJ
- certificado do contador / autor CPF

Isso facilita depuração futura sem precisar inspecionar o payload manualmente.

## Resultado esperado

Depois da correção e com o CPF do contador salvo, a requisição deve sair assim:

```text
contratante      = 59400171000150   (CNPJ do escritório)
autorPedidoDados = <CPF do contador>
tipo             = 1
contribuinte     = 40908083000136
```

Se ainda retornar `AcessoNegado-ICGERENCIADOR-022`, então a procuração no eCAC **também não está vinculada a esse CPF** específico.

## Observação importante

Não precisa de nova migration para isso. Os campos já existem em `company_settings`. O foco agora é:
- impedir fallback silencioso
- garantir que o CPF do contador seja salvo e validado corretamente

## Detalhes técnicos

```text
Hoje:
useAccountantCert =
  accountant_certificate_url &&
  accountant_certificate_password &&
  accountant_cpf

Como accountant_cpf está null:
- useAccountantCert = false
- autorPedidoDados = contratanteCnpj
- tipo = 2
```

## Ordem de implementação

1. Ajustar validação e mensagens da edge function
2. Ajustar UI da `CompanyTab` para salvar/validar CPF do contador
3. Confirmar que o payload passa `autorPedidoDados.tipo = 1`
4. Revalidar a consulta do Integra Contador

