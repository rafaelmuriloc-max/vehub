---
name: NF-e de saída via SEF-SC
description: Saídas NF-e vêm do WS de download para contabilistas da SEF-SC (nfedownloadV2), não do Ambiente Nacional
type: constraint
---
Ambiente Nacional só entrega entradas. Saídas vêm do WS SEF-SC nfedownloadV2 (NfeDownloadContab, indAtor=3), certificado do contador com fallback do escritório; exige vínculo de contabilista no SAT (cStat 8002 se não). Bloqueio 12h após 117.
