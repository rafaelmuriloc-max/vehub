# Portal do Cliente igual ao modelo enviado

Mesmo visual e mesma ordem do modelo, com o nome e o logo da Velocitä no lugar de "Contabilize". Tudo mostra só dados reais. Quando não houver dado, aparece uma mensagem de "nada por aqui", nunca números de exemplo.

## Tela inicial (Dashboard)
1. **Topo**: logo + "Portal do Cliente"; seletor da empresa com ícone, nome e CNPJ; sino de avisos com contador vermelho; foto ou iniciais do usuário com menu (Trocar senha, Sair).
2. **Três cartões**:
   - Próximos vencimentos: quantidade nos próximos 30 dias.
   - Documentos pendentes: aguardando envio.
   - Faturamento do mês: valor e variação em % contra o mês anterior, com seta verde ou vermelha.
3. **Calendário Fiscal**: mês com setas de navegação e etiquetas coloridas nos dias de vencimento (DAS, FGTS, INSS, ISS, Folha, DARF), com a legenda embaixo.
4. **Evolução de Faturamento**: total, % contra o mesmo período do ano anterior, seletor (Últimos 6 / 12 meses) e colunas azuis com o valor em cima ("R$ 124 mil"). O mês atual fica em azul mais forte.
5. **Documentos Recentes**: ícone PDF ou XLS, nome, área e competência, selo Disponível ou Pendente, botões Visualizar e Baixar e menu "⋮". Tem link "Ver todos".
6. **Vencimentos Próximos**: data em bloco (dia e mês), nome da guia, competência, selo "Em X dias" (vermelho até 3 dias, laranja depois), valor e seta. Tem link "Ver todos".

## Menu inferior fixo (celular)
Dashboard · Calendário · Documentos · Perfil.
- **Calendário**: o calendário em tela cheia e a lista de vencimentos.
- **Documentos**: as guias e documentos, mais as notas emitidas e recebidas, separadas em abas.
- **Perfil**: dados do usuário, troca de senha, avisos e Sair.
- MEI continua com Emitir DAS, Emitir CCMEI e a barra de limite. Ficam no Dashboard, abaixo dos cartões.

No computador o mesmo layout fica centralizado. O menu inferior vira abas no topo.

## De onde vêm os dados
- Faturamento: notas emitidas, como hoje.
- Vencimentos e calendário: obrigações e tarefas da empresa já cadastradas no sistema, mais as guias DAS (Simples e MEI).
- Documentos: guias e documentos enviados pelo escritório para a empresa.
- Sino: avisos do mural.
- Valor das guias aparece só quando o sistema tiver. Senão fica "—".

## Detalhes técnicos
- Reescrever `src/pages/Portal.tsx` em componentes: `src/components/portal/` (Header, KpiCards, FiscalCalendar, RevenueChart com recharts, RecentDocuments, UpcomingDues, BottomNav).
- Novas cores no tema: `--portal-*` e as cores das etiquetas (das, fgts, inss, iss, folha, darf) em `index.css` e no `tailwind.config.ts`. O portal usa fundo claro próprio.
- Hoje o cliente só lê notas, guias MEI e Simples e avisos. Para vencimentos e documentos é preciso uma migração que libera a leitura das tabelas de obrigações, tarefas e documentos da empresa, só para as empresas do próprio cliente (`portal_can_access_client`). Ela é aplicada no banco conectado, com GRANTs.
- Abrir e baixar PDF privado usa link assinado de curta duração.
- Testes: cálculo de variação % e regra do selo "Em X dias".
