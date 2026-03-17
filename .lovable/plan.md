

# Plano: Corrigir catálogo de serviços do Integra Contador com IDs reais do SERPRO

## Problema

A API retorna erro 400 `[EntradaIncorreta-IGERENCIADOR-062]` — "Identificação do sistema ou serviço inválido" porque os `idServico` no catálogo do frontend são inventados. Exemplo: usamos `CONSPENDENCIAS` mas o real é `SOLICITARPROTOCOLO91`.

## Correção em `src/pages/IntegraContador.tsx`

Substituir todo o `SERVICE_CATALOG` com os IDs corretos do catálogo oficial SERPRO (apenas serviços "Em produção"):

### Simples Nacional (SN)
| idSistema | idServico | Tipo | Descrição |
|-----------|-----------|------|-----------|
| PGDASD | TRANSDECLARACAO11 | Declarar | Entregar declaração mensal |
| PGDASD | GERARDAS12 | Emitir | Gerar DAS |
| PGDASD | CONSDECLARACAO13 | Consultar | Consultar declarações transmitidas |
| PGDASD | CONSULTIMADECREC14 | Consultar | Consultar última declaração/recibo |
| PGDASD | CONSDECREC15 | Consultar | Consultar declaração/recibo |
| PGDASD | CONSEXTRATO16 | Consultar | Consultar extrato do DAS |
| PGDASD | GERARDASCOBRANCA17 | Emitir | Gerar DAS Cobrança RFB |
| PGDASD | GERARDASAVULSO19 | Emitir | Gerar DAS Avulso |
| REGIMEAPURACAO | CONSULTARANOSCALENDARIOS102 | Consultar | Consultar opções regime apuração |
| DEFIS | CONSDECLARACAO142 | Consultar | Consultar declarações DEFIS |
| DEFIS | CONSULTIMADECREC143 | Consultar | Consultar última declaração DEFIS |

### MEI
| idSistema | idServico | Tipo | Descrição |
|-----------|-----------|------|-----------|
| PGMEI | GERARDASPDF21 | Emitir | Gerar DAS PDF |
| PGMEI | GERARDASCODBARRA22 | Emitir | Gerar DAS código de barras |
| PGMEI | DIVIDAATIVA24 | Consultar | Consultar dívida ativa |
| CCMEI | EMITIRCCMEI121 | Emitir | Emitir certificado condição MEI |
| CCMEI | DADOSCCMEI122 | Consultar | Consultar dados CCMEI |

### DCTFWeb
| idSistema | idServico | Tipo | Descrição |
|-----------|-----------|------|-----------|
| DCTFWEB | GERARGUIA31 | Emitir | Gerar guia declaração |
| DCTFWEB | CONSRECIBO32 | Consultar | Consultar recibo declaração |
| DCTFWEB | CONSDECCOMPLETA33 | Consultar | Consultar declaração completa |
| DCTFWEB | CONSXMLDECLARACAO38 | Consultar | Consultar XML declaração |

### Sicalc (DARF)
| idSistema | idServico | Tipo | Descrição |
|-----------|-----------|------|-----------|
| SICALC | CONSOLIDARGERARDARF51 | Emitir | Consolidar e emitir DARF PDF |
| SICALC | CONSULTAAPOIORECEITAS52 | Apoiar | Consultar receitas Sicalc |
| SICALC | GERARDARFCODBARRA53 | Emitir | Emitir DARF código de barras |

### Caixa Postal
| idSistema | idServico | Tipo | Descrição |
|-----------|-----------|------|-----------|
| CAIXAPOSTAL | MSGCONTRIBUINTE61 | Consultar | Mensagens por contribuinte |
| CAIXAPOSTAL | MSGDETALHAMENTO62 | Consultar | Detalhes de mensagem |
| CAIXAPOSTAL | INNOVAMSG63 | Monitorar | Indicador novas mensagens |
| DTE | CONSULTASITUACAODTE111 | Consultar | Situação adesão Caixa Postal |

### Situação Fiscal
| idSistema | idServico | Tipo | Descrição |
|-----------|-----------|------|-----------|
| SITFIS | SOLICITARPROTOCOLO91 | Apoiar | Solicitar protocolo relatório |
| SITFIS | RELATORIOSITFIS92 | Emitir | Emitir relatório situação fiscal |

### Pagamentos
| idSistema | idServico | Tipo | Descrição |
|-----------|-----------|------|-----------|
| PAGTOWEB | PAGAMENTOS71 | Consultar | Consultar pagamentos |
| PAGTOWEB | COMPARRECADACAO72 | Emitir | Emitir comprovante arrecadação |

### Procurações (nova categoria)
| idSistema | idServico | Tipo | Descrição |
|-----------|-----------|------|-----------|
| PROCURACOES | OBTERPROCURACAO41 | Consultar | Obter procuração |

### Campos dos formulários

Os campos `dados` também precisam ser ajustados conforme a documentação de cada serviço. Para a maioria dos serviços SN/MEI os campos são `cnpjBasico` e `pa` (período apuração). Será necessário consultar a documentação individual de cada serviço para os campos exatos — inicialmente usar campos genéricos (`cnpjBasico`, `pa`, `anoCalendario`) e ajustar conforme testes.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/pages/IntegraContador.tsx` — substituir SERVICE_CATALOG completo |

