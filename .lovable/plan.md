

## Plano: Aba "Contrato" no cadastro do cliente

### Resumo
Adicionar uma aba "Contrato" ao formulário de cliente que gera um contrato de prestação de serviços contábeis baseado no modelo PDF fornecido, preenchido automaticamente com dados do cliente. As cláusulas serão editáveis e haverá um botão para gerar PDF.

### Estrutura do contrato (baseada no PDF)
O contrato possui placeholders que serão preenchidos com dados do cliente:
- `[data]` → data atual
- `[Nome]` → `company_name`
- `[Cnpj]` → `document`
- `[Rua], [Número], [Bairro], [Cidade]/[UF]` → `address`
- `[Representante]` → `contact_name`
- `[Cpf]` → campo a definir (partners_info ou novo campo)
- `[Honorários]` → `monthly_value`

Dados da CONTRATADA são fixos (Velocità Gestão Contábil).

### Alterações

**1. Dependência: jsPDF**
Instalar `jspdf` para geração de PDF no client-side.

**2. Novo componente `src/components/ContractTab.tsx`**
- Recebe os dados do cliente como props
- Exibe o contrato com 10 cláusulas pré-preenchidas, cada uma em um `<Textarea>` editável
- Cabeçalho com dados da CONTRATANTE (do cliente) e CONTRATADA (fixos)
- Botão "Gerar PDF" que monta o documento usando jsPDF
- Estado local para o texto de cada cláusula (inicializado com texto padrão do modelo)

**3. Alteração em `src/pages/Clients.tsx`**
- Adicionar aba "Contrato" na `TabsList` (mudar grid de 6 para 7 colunas)
- Adicionar `<TabsContent value="contrato">` com o componente `ContractTab`
- A aba só aparece no modo edição (quando já existe um cliente salvo)

### Geração do PDF
- Usar `jspdf` para criar documento A4
- Cabeçalho com dados das partes
- Cada cláusula renderizada sequencialmente
- Paginação automática com quebra de página
- Assinaturas no final

### Cláusulas editáveis (10 cláusulas do modelo)
1. Do Objeto
2. Das Obrigações da Contratante
3. Das Obrigações da Contratada
4. Do Envio de Documentos Digitais
5. Dos Honorários
6. Da Vigência
7. Da Rescisão
8. Da Responsabilidade Técnica
9. Do Tratamento de Dados (LGPD)
10. Do Foro

