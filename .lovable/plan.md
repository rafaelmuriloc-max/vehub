

# Plano: Atualizar catálogo completo do Integra Contador com documentacao oficial SERPRO

## Contexto

A documentacao oficial confirma que os IDs e a estrutura do body/auth estao corretos na edge function. O catalogo no frontend precisa ser expandido com todos os servicos "Em producao" que estao faltando.

## Servicos faltantes a adicionar

### Simples Nacional (adicionar ao existente)
- `PGDASD/GERARDASPROCESSO18` (Emitir) - DAS referente a processo de Cobranca RFB
- `REGIMEAPURACAO/EFETUAROPCAOREGIME101` (Declarar) - Efetuar opcao regime
- `REGIMEAPURACAO/CONSULTAROPCAOREGIME103` (Consultar) - Consultar opcao regime
- `REGIMEAPURACAO/CONSULTARRESOLUCAO104` (Consultar) - Consultar resolucao regime caixa
- `DEFIS/TRANSDECLARACAO141` (Declarar) - Transmitir DEFIS
- `DEFIS/CONSDECREC144` (Consultar) - Consultar declaracao/recibo DEFIS

### MEI (adicionar)
- `PGMEI/ATUBENEFICIO23` (Emitir) - Atualizar Beneficio
- `CCMEI/CCMEISITCADASTRAL123` (Consultar) - Situacao cadastral CNPJ MEI por CPF

### DCTFWeb (adicionar)
- `DCTFWEB/TRANSDECLARACAO310` (Declarar) - Transmitir declaracao
- `DCTFWEB/GERARGUIAANDAMENTO313` (Emitir) - Guia declaracao em andamento

### MIT (nova subcategoria dentro de DCTFWeb)
- `MIT/ENCAPURACAO314` (Declarar) - Encerrar Apuracao MIT
- `MIT/SITUACAOENC315` (Apoiar) - Situacao Encerramento MIT
- `MIT/CONSAPURACAO316` (Consultar) - Consultar Apuracao MIT
- `MIT/LISTAAPURACOES317` (Consultar) - Listar Apuracoes MIT

### Pagamentos (adicionar)
- `PAGTOWEB/CONTACONSDOCARRPG73` (Consultar) - Contar documentos arrecadacao pago

### Nova categoria: Gerenciador
- `AUTENTICAPROCURADOR/ENVIOXMLASSINADO81` (Apoiar) - Envio XML assinado para TOKEN procurador

### Nova categoria: Eventos de Atualizacao
- `EVENTOSATUALIZACAO/SOLICEVENTOSPF131` (Monitorar) - Solicitar eventos PF
- `EVENTOSATUALIZACAO/SOLICEVENTOSPJ132` (Monitorar) - Solicitar eventos PJ
- `EVENTOSATUALIZACAO/OBTEREVENTOSPF133` (Monitorar) - Obter eventos PF
- `EVENTOSATUALIZACAO/OBTEREVENTOSPJ134` (Monitorar) - Obter eventos PJ

### Nova categoria: Parcelamentos SN (8 modalidades, 40 servicos)
- **PARCSN** (ordinario): GERARDAS161, PARCELASPARAGERAR162, PEDIDOSPARC163, OBTERPARC164, DETPAGTOPARC165
- **PARCSN-ESP** (especial): GERARDAS171..DETPAGTOPARC175
- **PERTSN**: GERARDAS181..DETPAGTOPARC185
- **RELPSN**: GERARDAS191..DETPAGTOPARC195
- **PARCMEI**: GERARDAS201..DETPAGTOPARC205
- **PARCMEI-ESP**: GERARDAS211..DETPAGTOPARC215
- **PERTMEI**: GERARDAS221..DETPAGTOPARC225
- **RELPMEI**: GERARDAS231..DETPAGTOPARC235

### Nova categoria: Redesim
- `PNRCONTADOR/CONSVINCULOS261` (Consultar)
- `PNRCONTADOR/SOLICRENUNCIA262` (Declarar)
- `PNRCONTADOR/CONSRENUNCIA263` (Consultar)
- `PNRCONTADOR/COMPRENUNCIA264` (Emitir)
- `PNRCONTADOR/SITSOLICRENUNCIA265` (Consultar)

### Nova categoria: e-Processo
- `EPROCESSO/CONSPROCPORINTER271` (Consultar) - Consultar processos por interessado

## Alteracao na edge function

Verificar que o header `Role-Type: TERCEIROS` ja esta presente (confirmado). Nenhuma alteracao necessaria na edge function.

## Arquivos

| Acao | Arquivo |
|------|---------|
| Editar | `src/pages/IntegraContador.tsx` - expandir SERVICE_CATALOG com ~60 servicos adicionais |

## Notas tecnicas

- Apenas servicos marcados "Em producao" serao incluidos (ignorar "Em prospecção" e "Em construção")
- Parcelamentos serao agrupados em uma unica categoria com subgrupos por modalidade
- Campos de formulario usarao `cnpjBasico` e `pa` como padrao, com campos especificos onde documentado (ex: `numeroPedido` para OBTERPARC, `protocolo` para SITFIS)

