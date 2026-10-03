# Área do Cliente (todas as empresas)

## O que o cliente verá
- Login próprio (e-mail + senha temporária enviada pelo escritório, troca obrigatória no primeiro acesso, mesmo fluxo já usado pelos funcionários).
- Portal separado do sistema interno, pensado primeiro para celular, com seletor de empresa quando o cliente tiver mais de um CNPJ.
- Módulos mostrados conforme o regime da empresa:
  - Todos: Faturamento (soma das notas emitidas por mês), Notas emitidas, Notas recebidas, Mural de Avisos, Documentos/guias enviados pelo escritório.
  - MEI: Controle de limite anual, Emissão do DAS, Emissão do CCMEI.
  - Simples Nacional: Guias DAS do mês (consultadas/geradas pelo escritório).
  - Lucro Presumido/Real: guias e documentos enviados pelo escritório (sem emissão automática).
- O cliente nunca vê o sistema interno, nem dados de outras empresas.

## O que o escritório ganha
- Em Configurações, nova aba "Acessos de Clientes": criar acesso, vincular/desvincular empresas, reenviar senha temporária, desativar acesso.
- Publicação de comunicados no Mural: para todos, por regime ou por empresa específica, com data de expiração.

## Fora desta etapa
- Pagamento online das guias e chat dentro do portal.
- Publicação de funções externas e aplicação em produção ficam aguardando sua autorização, como nas etapas anteriores.

## Detalhes técnicos
- Novo papel `client` no enum de papéis; tabela de vínculos usuário–empresa (N:N) e tabela de comunicados, com GRANTs e RLS: cliente só lê empresas vinculadas; admin gerencia tudo.
- Políticas de leitura adicionais (somente leitura) para notas e guias filtradas pelo vínculo; nenhuma política existente de funcionários é alterada.
- Rotas `/portal/*` com layout próprio; `AppLayout` redireciona usuários `client` para `/portal`, e o portal bloqueia quem não é `client`.
- Criação de acesso reaproveita a função `manage-user` (novo modo cliente) e o envio via WhatsApp existente.
- Emissão de DAS/CCMEI pelo portal chama a função `integra-contador` com verificação de vínculo no servidor e registro no painel de custos SERPRO.
- Testes: regras de módulos por regime e verificação de vínculo.
