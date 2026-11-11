# USB Intelligence — Relatório Executivo

**Encaixe o pendrive. O resto é automático.**

Plataforma brasileira de **inteligência de arquivos** que roda **100% no aparelho** —
sem servidor, sem nuvem, sem conta, sem custo de infraestrutura. Analisa, verifica,
limpa, organiza e protege os arquivos de qualquer pendrive, HD ou pasta, com uma
assistente de IA em português, e **nunca envia o conteúdo dos arquivos para fora**.

> Documento preparado para apresentação a empresa. O produto está em operação e
> pode ser demonstrado ao vivo encaixando um pendrive.

---

## 1. O que é

Um aplicativo web (abre no navegador e instala como app no celular ou computador)
que transforma um pendrive bagunçado em um acervo **lido, verificado, livre de
cópias, organizado e documentado** — com uma única autorização do usuário.

Depois de configurado uma vez, basta encaixar o pendrive: o app detecta sozinho e
executa todo o fluxo, do reconhecimento ao relatório final, sem intervenção.

## 2. O problema que resolve

Toda organização acumula arquivos sem controle: **cópias duplicadas** consumindo
espaço e custo, **nomes inconsistentes**, **nenhuma garantia de integridade** e
nenhum inventário do que existe. Mover tudo para a nuvem é caro, lento e, em muitos
casos, **proibido por política de dados ou pela LGPD**.

O USB Intelligence resolve isso **localmente**: a inteligência vai até o arquivo, em
vez de o arquivo ir até um servidor.

## 3. Como funciona (fluxo automático)

| Etapa | O que acontece |
|-------|----------------|
| **1. Detectar** | O app percebe o pendrive encaixado, sozinho. |
| **2. Ler e classificar** | Cada arquivo vira um tipo: documento, imagem, vídeo, planilha, áudio. |
| **3. Verificar** | Calcula a impressão digital **SHA-256** de cada arquivo, no próprio aparelho. |
| **4. Achar cópias** | Compara **conteúdo, não nome**. Mostra quanto espaço dá para recuperar. |
| **5. Organizar** | Monta pastas por tipo, data ou tamanho — e move de verdade, se autorizado. |
| **6. Relatar** | Gera relatório com números reais, pronto para exportar em CSV ou JSON. |

Tudo é **reversível**: nada é apagado sem confirmação, cópias vão para uma lixeira
restaurável e cada ação fica registrada no histórico.

## 4. O que a plataforma faz (funções)

- **Central de arquivos** — selecionar arquivos ou conectar uma pasta; acervo em
  lista ou grade, busca e filtros; visão geral com gráficos honestos; duplicados por
  SHA-256; análise de nomes; plano de organização em pastas; lixeira restaurável.
- **Gestão real de arquivos** (com pasta conectada): renomear, mover, mandar para a
  lixeira e aplicar a organização — sempre com confirmação do usuário.
- **Segurança** — cálculo e verificação de **SHA-256**, referências de integridade e
  **cofre AES-256-GCM** com chave derivada da senha.
- **Relatórios e Histórico** — exportação em JSON/CSV; registro datado de tudo.
- **Assistente de IA (o "Vigia")** — entende linguagem natural, lê o conteúdo de
  textos e planilhas (CSV, XLSX, XLS, ODS) para responder perguntas (ex.: *"quanto
  sobrou na planilha de fluxo de caixa?"*), pesquisa na internet quando precisa e
  executa as ações do app. Roda no próprio aparelho ou em serviço online gratuito —
  **sem chave, sem cobrança**.
- **Modo automático, Laboratório 3D, Personagem, Casos reais, Apresentação e Ajuda** —
  experiência completa, com um laboratório 3D do pendrive conceitual.

## 5. Diferenciais

- **Privacidade por projeto, não por promessa.** Nenhum arquivo sai do aparelho.
  Não há servidor recebendo dados nem coleta silenciosa.
- **Conformidade com a LGPD por desenho.** Processamento local: dados sensíveis não
  trafegam nem são armazenados por terceiros.
- **Integridade verificável.** SHA-256 por arquivo e cofre AES-256-GCM.
- **IA em português, gratuita e opcional.** Nunca recebe o conteúdo sem autorização.
- **Funciona offline.** Instalado como app (PWA), opera sem internet.
- **Zero custo de infraestrutura.** Não há backend para manter, escalar ou pagar.
- **Design de nível profissional.** Identidade visual autoral, escura e editorial,
  nas cores do Brasil, com objeto 3D animado e interface moderna e rápida.

## 6. Onde pode ser usado (empresa grande)

- **TI e governança de dados:** inventário de acervos, higienização de storage,
  redução de custo com duplicados, padronização de nomes e pastas.
- **Compliance e LGPD:** triagem de arquivos sem expor dados a terceiros;
  processamento local auditável.
- **Segurança e perícia:** verificação de integridade por SHA-256, cofre criptografado
  para documentos sensíveis, confirmação de que um arquivo não foi alterado.
- **Operação de campo e quiosques:** equipes que recebem pendrives de clientes,
  fornecedores ou órgãos públicos e precisam triar com segurança, offline.
- **Onboarding e distribuição:** padronizar e verificar pendrives entregues a
  colaboradores ou parceiros.

## 7. Requisitos

- **Para analisar:** qualquer navegador moderno (celular ou computador).
- **Para gerir arquivos de verdade** (renomear, mover, lixeira, organizar):
  Chrome/Edge no computador ou o app Android — acesso a pastas do próprio sistema,
  com autorização explícita do usuário.
- **Instalação:** opcional, como app (PWA), em um toque.

## 8. Em uma frase

> Uma plataforma que coloca **inteligência, verificação e organização dentro do
> pendrive** — com segurança de nível corporativo e **sem que um único arquivo saia
> do aparelho**.

---

*USB Intelligence · Brasil · Inteligência de arquivos · processamento 100% local.*
