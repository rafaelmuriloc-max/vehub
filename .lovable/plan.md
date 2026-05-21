## Objetivo

Ao clicar no botão "visualizar" (ícone de olho) de um parcelamento, abrir um diálogo que liste as **parcelas em aberto até o mês corrente** e ofereça, para cada uma, um botão **"Gerar guia"** (DAS/DARF) usando o Integra Contador.

## Mudanças

### 1. `src/components/integra-contador/ParcelamentosTab.tsx`

Adicionar tabela de mapeamento por modalidade RFB com os serviços SERPRO:

| Modalidade | idServico (pedidos) | Parcelas p/ impressão | Emitir guia |
|---|---|---|---|
| PARCSN | PEDIDOSPARC163 | PARCELASPARAIMPRESSAO164 | EMITIRDAS166 |
| PARCSN-ESP | PEDIDOSPARC173 | PARCELASPARAIMPRESSAO174 | EMITIRDAS176 |
| PERTSN | PEDIDOSPARC183 | PARCELASPARAIMPRESSAO184 | EMITIRDAS186 |
| RELPSN | PEDIDOSPARC193 | PARCELASPARAIMPRESSAO194 | EMITIRDAS196 |
| PARCMEI | PEDIDOSPARC203 | PARCELASPARAIMPRESSAO204 | EMITIRDAS206 |
| PARCMEI-ESP | PEDIDOSPARC213 | PARCELASPARAIMPRESSAO214 | EMITIRDAS216 |
| PERTMEI | PEDIDOSPARC223 | PARCELASPARAIMPRESSAO224 | EMITIRDAS226 |
| RELPMEI | PEDIDOSPARC233 | PARCELASPARAIMPRESSAO234 | EMITIRDAS236 |

Para PGFN (`PARCMEPN`): SERPRO não expõe emissão pública de DARF pela API Integra Contador para essas modalidades — mostrar mensagem informativa no diálogo ("Emissão de guia PGFN não suportada via Integra Contador") e desabilitar o botão.

#### Fluxo do diálogo "Ver detalhes"

1. Manter os campos atuais (modalidade, nº, situação, valor, parcelas).
2. Ao abrir, disparar `supabase.functions.invoke('integra-contador', { client_id, idSistema, idServico: <PARCELASPARAIMPRESSAO_xxx>, tipo: 'Consultar', dados: '' })`.
3. Parsear o retorno (lista de parcelas com `parcela` no formato `AAAAMM`, `valor`) e filtrar **apenas parcelas com vencimento ≤ mês corrente** (em aberto).
4. Renderizar tabela: `Parcela (AAAA/MM)` | `Valor` | botão **"Gerar guia"**.
5. O botão chama `integra-contador` com `idServico: <EMITIRDAS_xxx>`, `dados: '{"parcelaParaEmitir": "AAAAMM"}'`, recebe `docArrecadacaoPdfB64` (PDF base64) e abre/baixa o arquivo (`data:application/pdf;base64,...`).
6. Estados de loading isolados por parcela; tratar 404/sem dados com mensagem.

Sem mudanças de banco de dados nem de Edge Function (o backend `integra-contador` é genérico).

## Fora do escopo

- Emissão de guias PGFN (apenas aviso).
- Persistência local das guias geradas (apenas download na hora).
- Histórico de parcelas pagas.
