# Caixa de empresa do portal só com o nome

Na parte de cima do portal do cliente, a caixa que mostra a empresa vai exibir só o nome dela.

- Sai o ícone do prédio.
- Sai o CNPJ que aparece abaixo do nome.
- O nome fica em uma linha só e termina com "…" quando for longo demais.
- A caixa fica um pouco mais baixa no celular, porque agora tem uma linha a menos.
- A lista para trocar de empresa (quando o cliente tem mais de uma) continua igual.

## Technical details
- `src/pages/Portal.tsx`, SelectTrigger: remover o span com `Building2` e o span com `company?.document`; manter só o nome com `truncate`; trocar `h-14 md:h-12` por `h-11`.
- Remover `Building2` do import do lucide se ele não for usado em outro lugar.
