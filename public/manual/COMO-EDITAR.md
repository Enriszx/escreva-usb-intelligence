# USB Intelligence — versão manual

Esta pasta é uma versão do site feita só com **HTML, CSS e JavaScript**, sem nada para instalar. Serve para você mudar textos, cores e imagens à mão.

O app completo continua em https://enriszx.github.io/escreva-usb-intelligence/. É lá que ficam o modo automático, a Central de arquivos, o cofre, o 3D e o Vigia IA, que precisam de muito código. A versão manual tem as páginas de apresentação e três ferramentas que funcionam de verdade.

## O que tem aqui

| Arquivo | O que é |
|---|---|
| `index.html` | Página inicial: título, "como funciona" (etapas interativas), números de exemplo, segurança, chamada final |
| `casos.html` | Os 12 casos reais com fonte, as 6 causas e o filtro por tipo |
| `ferramentas.html` | Verificador de backup, checklist 3-2-1 e teste de hash SHA-256 |
| `estilo.css` | Todo o visual: cores, fontes, cantos, tamanhos (as variáveis ficam no topo) |
| `script.js` | Tudo o que é interativo, dividido em 8 blocos numerados e comentados |
| `imagens/logo.svg` | O logo (abre em qualquer editor de SVG, como o Inkscape, ou como texto) |
| `imagens/fundo.svg` | O fundo inspirado na bandeira |

## Ver no computador

Dê dois cliques em `index.html`. Ele abre no navegador, sem internet.

## Editar

Abra o arquivo num editor de texto. O **VS Code** é grátis e mostra as cores; o Bloco de Notas também funciona. Salve e recarregue o navegador (F5).

- **Textos:** procure o texto no `.html` e troque. Os pontos principais estão marcados com `<!-- MUDE AQUI -->`.
- **Cores e fontes:** no topo de `estilo.css`, em `:root`.
  - `--verde`, `--amarelo` e `--azul` são as cores da bandeira;
  - `--fundo` é a cor de fundo e `--destaque` é a cor dos botões principais;
  - `html.claro` guarda as cores do tema claro.
- **Rodapé:** no fim de cada `.html` (coloque seu nome, turma ou data).
- **Novo caso:** em `casos.html`, copie um bloco `<article class="cartao caso" ...>` inteiro, cole embaixo e troque os textos. Em `data-tipos`, use um ou mais destes: `acidente`, `backup`, `migracao`, `desastre`, `ataque`, `exposicao`.
- **Nova página:** copie `casos.html` com outro nome, apague o conteúdo de dentro do `<main>` e adicione o link no `<ul class="menu">` de cada página.

## Colocar numa ferramenta de criação de sites

- **Google Sites:** Inserir → Incorporar → "Incorporar código". Cole o conteúdo do `.html` e, no lugar de `<link rel="stylesheet" href="estilo.css">`, cole o CSS entre `<style>` e `</style>`. As imagens precisam de um endereço público; use as do site publicado, por exemplo `https://enriszx.github.io/escreva-usb-intelligence/manual/imagens/logo.svg`.
- **Wix:** adicione o elemento "Incorporar código" (HTML iframe) e faça o mesmo que no Google Sites.
- **WordPress:** use o bloco "HTML personalizado" e faça o mesmo que no Google Sites.
- **Hospedagens comuns** (GitHub Pages, Netlify, Hostinger etc.): envie a pasta inteira como está.

Observação: o Verificador de backup usa a escolha de pasta do navegador. Dentro de um "incorporar código" ele pode ser bloqueado pela ferramenta; nesse caso, use o link para `ferramentas.html` publicado.

## Publicado

Esta mesma pasta já está no ar em https://enriszx.github.io/escreva-usb-intelligence/manual/.
