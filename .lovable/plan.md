

## Plano: Adicionar papel timbrado ao PDF do contrato

### Elementos do papel timbrado (baseado no PDF de exemplo)

Cada pagina do PDF gerado deve ter:

1. **Header (topo de cada pagina)**:
   - Barra preta cobrindo ~60% da largura a esquerda (altura ~8mm)
   - Barra laranja cobrindo ~40% da largura a direita (altura ~8mm, levemente mais baixa)

2. **Footer (rodape de cada pagina)**:
   - Barra preta arredondada com fundo escuro ocupando quase toda a largura
   - Texto branco com: email (atendimento@velocitacontabilidade.com.br), Instagram (@velocitacontabildiade), telefone (47) 3842 0299
   - Detalhe laranja no canto direito

3. **Formatacao do conteudo**:
   - Linha separadora horizontal antes de cada clausula
   - Titulos de clausula em fonte grande e negrito
   - Subtitulos (1.2.1, 1.2.2 etc.) em negrito menor
   - Margem superior ajustada para comecar abaixo do header (~18mm)
   - Margem inferior ajustada para nao sobrepor o footer (~35mm)

4. **Pagina de assinaturas (ultima pagina)**:
   - Assinaturas empilhadas verticalmente (Contratante em cima, Contratada embaixo), nao lado a lado

### Alteracoes

**Arquivo: `src/components/ContractTab.tsx`** - Refatorar a funcao `generatePDF`:
- Criar funcao `drawHeader(doc)` que desenha as barras preta e laranja no topo
- Criar funcao `drawFooter(doc)` que desenha a barra de rodape com contatos
- Aplicar header/footer em cada pagina (inclusive ao chamar `addPage`)
- Ajustar `y` inicial para 22mm (abaixo do header)
- Ajustar limite de quebra de pagina para 265mm (acima do footer)
- Adicionar linha separadora (`doc.line()`) antes de cada clausula
- Usar fonte maior (14pt bold) para titulos de clausula
- Reformatar assinaturas para layout vertical

