# Devolver os botões Funcionários, Férias e Sincronizar na página Pessoal

No redesign, esses três botões foram escondidos no menu de três pontinhos. Eles voltam a ficar visíveis no topo da página, como na imagem:

- **Funcionários** (contorno, ícone de pasta): faz o que fazia antes, que é definir a pasta do Drive. Só aparece para administradores.
- **Férias** (contorno, ícone de palmeira): abre a tela de gestão de férias.
- **Sincronizar** (laranja, com seta): abre a lista com Pasta (fichas), Experiência e Férias. Fica travado enquanto alguma sincronização está rodando.

Os três ficam alinhados à direita, ao lado do título "Pessoal". Essas opções saem do menu de três pontinhos para não aparecerem duas vezes. Se o menu ficar vazio, ele também sai.

## Técnico
- Só muda `src/pages/Personnel.tsx`: os botões entram no cabeçalho, ao lado do título, e as funções `syncNow`, `syncVacations` e a de definir a pasta continuam as mesmas.
