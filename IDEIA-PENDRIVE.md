# Ideia guardada: pendrive que abre o USB Intelligence sozinho

> Anotação para continuar quando der. A parte do Raspberry Pi fica para outro dia.
> Aqui está a **melhor ideia já desenhada**, pronta para virar tarefa.

## O objetivo (no que faz sentido e é seguro)

Quando o pendrive for conectado, o usuário chega ao USB Intelligence **com um
toque**, e o app já começa a analisar aquele próprio pendrive (o "modo automático"
que já existe). Ou seja: o pendrive carrega o app dentro de si e se auto-apresenta.

## O limite importante (ler antes de construir)

Um pendrive **não executa programa sozinho** ao ser espetado — e isso é proposital:

- **Windows** desligou o autorun/autoplay com execução automática em 2011
  (atualização de segurança), justamente para impedir pendrive malicioso.
- **macOS e Linux** nunca rodaram código de USB automaticamente.

Portanto, o caminho honesto e que funciona de verdade é **consentido**: o pendrive
contém o app e um atalho claro; o usuário abre, e daí tudo é automático. Nada de
execução silenciosa em máquina de terceiros — além de ser abusivo, seria bloqueado
pelos sistemas de qualquer forma.

## Desenho recomendado (3 camadas, da mais simples à mais completa)

### Camada 1 — Pendrive "app portátil" (funciona hoje, sem hardware)
Gravar no pendrive o build estático do site (`dist/`) + um ponto de entrada:

- `ABRIR.html` na raiz: página bonita de boas-vindas com um botão grande
  **"Abrir o USB Intelligence"** que leva ao `index.html` do app.
- `LEIA-ME.txt`: instrução de uma linha ("dê dois cliques em ABRIR.html").
- O app abre offline (já é PWA), reconhece que está rodando a partir do pendrive
  e oferece **analisar este pendrive** direto — sem o usuário procurar a pasta.

Resultado: espetou, abriu o `ABRIR.html`, um clique, e o modo automático roda.
É "quase automático" e é 100% compatível e seguro.

### Camada 2 — Reconhecer o próprio pendrive
Fazer o app detectar que foi aberto **de dentro** de um removível e já sugerir a
pasta raiz daquele dispositivo para o modo automático, pulando a escolha manual.
Marcar o pendrive com um arquivo-âncora (ex.: `.usbi-root`) que o app procura.

### Camada 3 — Autoexecução real (só onde o dono da máquina permite)
Para um **quiosque ou computador próprio da empresa** (não máquina de terceiros),
um pequeno agente instalado **na máquina** (com permissão do dono) pode vigiar a
conexão de pendrives com a etiqueta do USB Intelligence e abrir o app
automaticamente. A automação mora no computador consentido, não no pendrive — que é
o modelo correto e auditável para ambiente corporativo.

## Onde o Raspberry Pi entra (para o outro dia)

O Raspberry serve como **estação que prepara os pendrives**: grava o app + o
ponto de entrada + a etiqueta, de forma idêntica e repetível, em lote. É uma
"fábrica de pendrives USB Intelligence" — útil para distribuir muitos aparelhos
padronizados numa empresa. Isso é totalmente legítimo e não depende de nenhuma
autoexecução.

## Primeiros passos quando voltar

1. Gerar um script `npm run pendrive` que monta a pasta do pendrive: `dist/` +
   `ABRIR.html` + `LEIA-ME.txt` + `.usbi-root`.
2. Fazer o app, ao abrir, procurar `.usbi-root` e já oferecer o modo automático
   daquele dispositivo.
3. Desenhar o `ABRIR.html` com a identidade visual do produto.
4. (Depois) Documentar a gravação em lote pelo Raspberry Pi.

## Princípio que não muda

**Sempre com consentimento.** O valor do produto é justamente ser seguro e privado;
a automação nunca pode virar algo que roda escondido na máquina de outra pessoa.
