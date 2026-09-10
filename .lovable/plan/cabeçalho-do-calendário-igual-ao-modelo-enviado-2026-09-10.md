# Cabeçalho do calendário igual ao modelo enviado

## Resultado visual

Recriar o topo da tela do Calendário seguindo fielmente a imagem de referência, com identidade Vehub:

- data atual, saudação personalizada com o primeiro nome do usuário e o texto de apoio;
- ações **Exportar** e **Nova obrigação** alinhadas à direita;
- quatro cards compactos na mesma linha: **A fazer**, **Atrasadas**, **Concluídas** e **Fora do prazo**;
- painel lateral **Desempenho geral da operação**, com medidor semicircular colorido, percentual central e comparação com o mês anterior;
- azul-marinho, laranja, verde e cores de situação, com tipografia corporativa Sora/Manrope e cantos discretos;
- no celular, os blocos serão reorganizados sem alterar o conteúdo.

Os filtros atuais continuarão disponíveis logo abaixo desse novo cabeçalho. O restante do calendário, suas abas e listas não será redesenhado.

## Dados e comportamento

- Reaproveitar os cálculos mensais já existentes e os filtros selecionados.
- Adicionar o card que falta, **Fora do prazo**, usando as obrigações concluídas após o vencimento.
- Calcular o desempenho como percentual de obrigações concluídas no mês e comparar com o mesmo percentual do mês anterior.
- **Exportar** gerará um relatório PDF do mês e filtros atuais com os quatro totais e o desempenho.
- **Nova obrigação** levará o usuário para o cadastro de obrigações.
- Manter as regras atuais que diferenciam atrasadas pendentes de concluídas fora do prazo.

## Implementação técnica

- Concentrar o novo cabeçalho e seus cálculos em `src/pages/CalendarView.tsx`, extraindo pequenos componentes locais para os cards e o medidor.
- Usar o perfil já carregado pela autenticação para personalizar a saudação.
- Usar tokens semânticos do projeto e ícones existentes; o medidor será desenhado em CSS/SVG acessível, sem imagem incorporada.
- Nenhuma alteração em banco de dados ou funções de servidor.

## Validação

- Conferir visualmente no desktop contra a imagem enviada e validar também no celular.
- Confirmar os quatro totais, o percentual, a comparação mensal, o PDF e o acesso a “Nova obrigação”.
- Verificar que filtros, calendário, abas e listas continuam funcionando sem regressões.
