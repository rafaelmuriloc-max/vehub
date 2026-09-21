# Detalhar experiências a vencer ao clicar no card

## Objetivo
Na página **Pessoal**, clicar no card **"Experiências a vencer em 15 dias"** abre uma janela (dialog) listando os funcionários com prazo próximo, agrupados por empresa.

## O que muda

### Card clicável
- O card "Experiências a vencer em 15 dias" passa a ser um botão clicável (com cursor de clique e destaque ao passar o mouse). Clicar abre a janela de detalhes.

### Nova janela "Experiências a vencer"
- Lista os funcionários **ativos** cujo **Prazo 1 ou Prazo 2** vence em até 15 dias (mesma regra do número do card).
- **Agrupados por empresa**: cada empresa vira um bloco com seu nome e a lista dos funcionários dela.
- Cada linha mostra: código, nome, cargo, qual prazo está vencendo (1º ou 2º), a data de vencimento e quantos dias faltam ("vence hoje", "faltam 3 d"). Prazos já vencidos aparecem marcados em vermelho ("venceu há X d").
- Ordenação: empresa por nome; dentro dela, o vencimento mais próximo primeiro.
- Se não houver ninguém a vencer, a janela mostra uma mensagem amigável ("Nenhuma experiência a vencer nos próximos 15 dias").
- Rolagem interna quando a lista for longa (tela de ~80% da altura no máximo), funcionando bem no celular.

### Inclusão opcional dos vencidos
- O card também mostra "X prazo(s) já vencido(s)". Na janela, os vencidos aparecem em um bloco separado abaixo ("Já vencidos"), também por empresa, para facilitar a cobrança — somente leitura, sem alterar o número do card.

## Detalhes técnicos
- Arquivo: `src/pages/Personnel.tsx` (somente).
- Reutiliza `daysUntil`, `trialTone`, `activeEmployees` e `employeesByClient` já existentes; novo estado `trialDialogOpen` e um `Dialog` (componente já importado).
- Sem alteração de banco, sincronização ou edge function.

## Validação
- `bunx tsgo --noEmit` sem erros e build OK.
