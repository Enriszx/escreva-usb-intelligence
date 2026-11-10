# USB Intelligence — Resumo Executivo

**Encaixe o pendrive. O resto é automático.**

Plataforma brasileira de inteligência de arquivos que roda **100% no aparelho** —
sem servidor, sem nuvem, sem conta. Analisa, verifica, organiza e protege arquivos
de qualquer pendrive, HD ou pasta, com uma assistente de IA em português e
processamento que **nunca envia o conteúdo dos arquivos para fora**.

---

## 1. O que é

Um aplicativo web (abre no navegador e instala como app no celular ou computador)
que transforma um pendrive bagunçado em um acervo **lido, verificado, limpo de
cópias, organizado e documentado** — com um único toque de autorização.

Depois de configurado uma vez, é só encaixar o pendrive: o app detecta sozinho e
executa todo o fluxo, do reconhecimento ao relatório final, sem intervenção.

## 2. O problema que resolve

Toda organização acumula arquivos sem controle: cópias duplicadas consumindo
espaço, nomes inconsistentes, nenhuma garantia de integridade, nenhum registro do
que existe. Mover isso para a nuvem é caro, lento e, em muitos casos, **proibido
por política de dados**.

O USB Intelligence resolve isso **localmente**: a inteligência vai até o arquivo,
em vez de o arquivo ir até um servidor.

## 3. Como funciona (fluxo automático)

| Etapa | O que acontece |
|-------|----------------|
| **1. Detectar** | O app percebe o pendrive encaixado, sozinho. |
| **2. Ler e classificar** | Cada arquivo vira um tipo: documento, imagem, vídeo, planilha, áudio… |
| **3. Verificar** | Calcula a impressão digital **SHA-256** de cada arquivo, no próprio aparelho. |
| **4. Achar cópias** | Compara **conteúdo, não nome**. Mostra quanto espaço dá para recuperar. |
| **5. Organizar** | Monta pastas por tipo, data ou tamanho — e move de verdade, se autorizado. |
| **6. Relatar** | Gera relatório com números reais, pronto para exportar em CSV ou JSON. |

Tudo é **reversível**: nada é apagado sem confirmação, cópias vão para uma lixeira
restaurável e cada ação fica registrada no histórico.

## 4. Diferenciais

- **Privacidade por projeto, não por promessa.** Nenhum arquivo sai do aparelho.
  Não há servidor recebendo dados, não há coleta silenciosa.
- **Conformidade com a LGPD por desenho.** Como o processamento é local, dados
  sensíveis não trafegam nem são armazenados por terceiros.
- **Integridade verificável.** SHA-256 por arquivo e cofre **AES-256-GCM** com
  chave derivada da senha do usuário.
- **Assistente de IA em português, gratuita.** A "Vigia" entende pedidos em
  linguagem natural ("quanto sobrou na planilha de fluxo de caixa?"), lê o
  conteúdo de textos e planilhas (CSV, XLSX, XLS, ODS), pesquisa na internet
  quando preciso e executa as ações do app. Roda no próprio aparelho ou em um
  serviço online gratuito — sem chave, sem cobrança.
- **Funciona offline.** Instalado como app (PWA), opera sem internet e recebe
  arquivos arrastados de fora.
- **Zero custo de infraestrutura.** Não há backend para manter, escalar ou pagar.

## 5. Onde pode ser usado (empresa grande)

- **TI e governança de dados:** inventário de acervos, higienização de storage,
  redução de custo com duplicados, padronização de nomes e pastas.
- **Compliance e LGPD:** triagem de arquivos sem expor dados a terceiros;
  processamento local auditável.
- **Segurança e perícia:** verificação de integridade por SHA-256, cofre
  criptografado para documentos sensíveis, confirmação de que um arquivo não
  foi alterado.
- **Operação de campo e quiosques:** equipes que recebem pendrives de clientes,
  fornecedores ou órgãos públicos e precisam triar com segurança, offline.
- **Onboarding e distribuição:** padronizar e verificar pendrives entregues a
  colaboradores ou parceiros.

## 6. Plataforma (o que já existe)

Central de arquivos (Acervo, Visão geral, Duplicados, Nomes, Organização, Lixeira),
Segurança (hash, verificação, cofre AES-256-GCM), Relatórios, Histórico, Modo
Automático, Laboratório 3D, Personagem personalizável, Apresentação, Casos de uso,
Configurações e Ajuda. Assistente de IA integrada em todas as telas.

## 7. Requisitos

- **Para analisar:** qualquer navegador moderno (celular ou computador).
- **Para mexer de verdade nos arquivos** (renomear, mover, lixeira, organizar):
  Chrome/Edge no computador ou o app Android — tecnologia de acesso a pastas do
  próprio sistema, com autorização explícita do usuário.
- **Instalação:** opcional, como app (PWA), em um toque.

## 8. Em uma frase

> Uma plataforma que coloca inteligência, verificação e organização dentro do
> pendrive — com segurança de nível corporativo e **sem que um único arquivo
> saia do aparelho**.

---

*Documento preparado para apresentação. O produto está em operação e pode ser
demonstrado ao vivo encaixando um pendrive.*
