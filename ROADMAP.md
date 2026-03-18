# Trivial / DyCard — Roadmap de Features Futuras

> Última atualização: 5 de março de 2026
> Este documento serve como spec técnica e lista de tasks para as features planejadas.
> Inclui ideias novas desenhadas à mão pela Aya (pasta `recursos/Referencias/desenho_em_papel*.jpeg`).

---

## Visão Geral

O Trivial é a interface 3D de um app de estudos que combina flashcards, escrita de
raciocínio e IA contextualizada. O quarto interativo (inspirado em Kind Words) serve
como **hub central** onde cada móvel/zona corresponde a uma ação de estudo:

| Zona do Quarto | Ação de Estudo | Feature |
|---|---|---|
| **Escrivaninha** | Estudar flashcards | Feature 1 — Flashcards FSRS-6 |
| **Mesa (close-up)** | Escrever raciocínio | Feature 2 — Caderno de Escrita |
| **Estante** | Gerenciar decks / Consultar IA | Feature 1 (visual) + Feature 3 |
| **Cama** | Descansar / Revisar | Timer de pausa, resumo do dia |
| **Quarto (geral)** | Companheiro de estudo | Feature 4 — Gato IA |
| **Todos os objetos** | Lembretes visuais | Feature 5 — Notificações nos Objetos |

---

## Feature 1: Flashcards com FSRS-6 + Gemini Variação

### Conceito
O usuário cria flashcards reais (frente: pergunta, verso: resposta). O algoritmo
**FSRS-6** (Free Spaced Repetition Scheduler v6) calcula o agendamento ótimo de
revisão diária. A cada revisão, o **Gemini 3 Flash** gera uma **variação** da
pergunta para evitar memorização mecânica e forçar compreensão real.

### Arquitetura Técnica

```
┌──────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                      │
│                                                          │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────────┐ │
│  │   Quarto 3D  │──▶│  Card Viewer │──▶│  Card Editor  │ │
│  │ (clicar mesa)│   │ (flip anim)  │   │ (criar/editar)│ │
│  └─────────────┘   └──────┬───────┘   └───────────────┘ │
│                           │                               │
│                    ┌──────▼──────┐                        │
│                    │  FSRS-6     │                        │
│                    │ Scheduler   │                        │
│                    │ (ts-fsrs)   │                        │
│                    └──────┬──────┘                        │
│                           │                               │
└───────────────────────────┼───────────────────────────────┘
                            │ API call
                    ┌───────▼───────┐
                    │  Gemini Flash │
                    │  (variação)   │
                    │ gemini-3-flash-preview    │
                    └───────────────┘
```

### Fluxo do Usuário
1. Personagem senta na escrivaninha → câmera faz zoom (preset `desk`)
2. UI sobreposta mostra as cartas do dia (puxadas pelo FSRS-6)
3. Usuário vê a frente (variação gerada pelo Gemini) → clica para virar
4. Avalia: "Fácil / Bom / Difícil / Errei" → FSRS-6 recalcula o intervalo
5. Ao terminar o deck do dia → animação de vitória do personagem

### Estante como Gerenciador Visual de Decks (ideia dos desenhos)

> Referência: `recursos/Referencias/6desenho_em_papel.jpeg`

A **estante do quarto** funciona como o **gerenciador visual** dos decks de flashcards.
Cada prateleira mostra **caixas/livros** representando um deck (matéria):

```
┌──────────────────────────────┐
│  ┌───┐  ┌───┐  ┌───┐        │  ← Prateleira 1
│  │ B │  │ H │  │ M │        │    B=Bio, H=Hist, M=Mat
│  └───┘  └───┘  └───┘        │
│──────────────────────────────│
│  ┌──────┐  ┌───┐            │  ← Prateleira 2
│  │  Fís │  │ Q │            │    Fís=Física, Q=Química
│  └──────┘  └───┘            │
│──────────────────────────────│
│  ┌───┐                      │  ← Prateleira 3
│  │ P │                      │    P=Português
│  └───┘                      │
└──────────────────────────────┘
```

- Cada caixa tem uma **etiqueta** com o nome da matéria + indicador de progresso (ex: "16/30")
- **Ao tocar** em uma caixa, ela pode ser **arremessada** para a mesa (animação com física!)
- **Cartas adicionadas automaticamente** pela IA aparecem como itens novos nas caixas
- **Etiquetas de organização** coladas nas caixas com cores por matéria

### Stack Necessária
- **ts-fsrs** (npm) — implementação TypeScript do FSRS-6
- **@google/generative-ai** (npm) — SDK do Gemini para variações
- **IndexedDB ou Supabase** — persistência das cartas e scheduling
- **Framer Motion ou React Spring** — animação de flip do card

### Tasks

- [ ] **F1-01** Instalar `ts-fsrs` e criar módulo `codigo/estudo/fsrs.ts`
- [ ] **F1-02** Modelar tipos TypeScript para Card, ReviewLog, Deck
- [ ] **F1-03** Criar store persistente (IndexedDB via `idb-keyval` ou Supabase)
- [ ] **F1-04** Criar componente `CardEditor.tsx` — form de criação de card (frente/verso/tags)
- [ ] **F1-05** Criar componente `CardViewer.tsx` — exibição com flip animation
- [ ] **F1-06** Integrar FSRS-6: calcular cards do dia, processar feedback do usuário
- [ ] **F1-07** Criar componente `DeckOverlay.tsx` — UI sobreposta no Canvas (sessão de estudo)
- [ ] **F1-08** Integrar Gemini Flash: enviar card original → receber variação → exibir
- [ ] **F1-09** Criar prompt engineering para variações (mesmo conceito, formulação diferente)
- [ ] **F1-10** Animação do personagem: conectar início/fim de sessão com animações 3D
- [ ] **F1-11** Câmera: transição desk → close-up quando cards aparecem
- [ ] **F1-12** Estatísticas: streak diário, cards revisados, taxa de acerto
- [ ] **F1-13** Notificação/lembrete de revisão diária
- [ ] **F1-14** Estante 3D como gerenciador visual: caixas/livros por matéria nas prateleiras
- [ ] **F1-15** Etiquetas de organização nas caixas (nome da matéria + progresso "16/30")
- [ ] **F1-16** Animação de arremessar caixa da estante para a mesa (física com cannon-es ou rapier)
- [ ] **F1-17** Cartas adicionadas automaticamente pela IA aparecem como itens novos nas caixas

### Câmera para Flashcards
Usar o preset **`desk`** atual (zoom 130, atrás da cadeira). Quando o card aparecer
na tela, a câmera já deve estar focada na mesa. O card fica como overlay HTML
sobre o Canvas — não precisa ser 3D (mais fácil de estilizar e animar).

---

## Feature 2: Caderno de Escrita com Análise de Raciocínio

### Conceito
O usuário tem um **caderno virtual** com linhas. Usando caneta stylus (tablet/celular)
ou mouse, ele **seleciona uma linha** e começa a escrever à mão, desenhando seu
raciocínio passo-a-passo para resolver uma questão. Uma IA analisa:
1. O **conteúdo escrito** (OCR → texto)
2. A **sequência de passos** (ordem lógica)
3. Os **erros conceituais** (onde o raciocínio divergiu)

Isso cria um **modelo profundo do entendimento do aluno** — não apenas se ele acertou
ou errou, mas **como ele pensa**.

### Arquitetura Técnica

```
┌──────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                      │
│                                                          │
│  ┌─────────────┐   ┌──────────────────────────────────┐ │
│  │   Quarto 3D  │──▶│  Notebook Component               │ │
│  │(clicar mesa) │   │  ┌──────────────────────────────┐│ │
│  │ notebook view│   │  │  Canvas de Escrita (ink)     ││ │
│  └─────────────┘   │  │  - Linhas do caderno         ││ │
│                     │  │  - Pressão da caneta         ││ │
│                     │  │  - Undo/Redo/Borracha        ││ │
│                     │  └──────────────────────────────┘│ │
│                     │  ┌──────────────────────────────┐│ │
│                     │  │  Seletor de Linha/Página     ││ │
│                     │  └──────────────────────────────┘│ │
│                     └──────────┬───────────────────────┘ │
│                                │                          │
└────────────────────────────────┼──────────────────────────┘
                                 │ strokes → image/SVG
                         ┌───────▼───────┐
                         │  Pipeline IA   │
                         │  1. OCR (texto)│
                         │  2. Análise de │
                         │     raciocínio │
                         │  3. Feedback   │
                         └───────────────┘
```

### Fluxo do Usuário
1. Personagem senta na escrivaninha → botão "Abrir Caderno" aparece
2. Câmera faz zoom EXTREMO (preset `notebook`, zoom 180+)
3. UI do caderno abre em overlay — linhas horizontais, visual de papel
4. Usuário toca/clica em uma linha → ela fica "selecionada" (highlight)
5. Usuário escreve com caneta/stylus/mouse naquela linha
6. Ao terminar, clica em "Analisar" → IA processa:
   - OCR transforma os strokes em texto
   - Modelo analisa a sequência de raciocínio
   - Retorna feedback: "Seu passo 2 está correto, mas no passo 3 você
     confundiu derivada com integral..."
7. Feedback aparece ao lado do caderno (painel lateral)
8. **Duplo clique fora** do caderno → sai e volta a ver a mesa (ideia dos desenhos)

### Gestos da Caneta (ideias dos desenhos)

> Referência: `recursos/Referencias/2desenho_em_papel.jpeg` e `3desenho_em_papel.jpeg`

A caneta/stylus tem gestos especiais além de escrever:

| Gesto | Ação |
|---|---|
| **Escrever normalmente** | Modo escrita (dentro das linhas selecionadas) |
| **Rabisco/risco irregular** | Comando **apagar** (borracha gestual) |
| **Risco reto (linha reta)** | Comando **mover câmera** (pan/scroll) |
| **Duplo clique fora do caderno** | Sair do caderno, voltar à visão da mesa |
| **Selecionar linha** | Limita a caneta ao modo escrita naquela linha |

> *"Escrita deve ser tão fluido que é mais rápido de escrever do que digitar"*
> — Prioridade absoluta: latência zero, sem lag, sem delay entre toque e tinta.

### Física dos Papéis na Mesa (ideia dos desenhos)

> Referência: `recursos/Referencias/7desenho_em_papel.jpeg`

- **Caderno de folhas infinitas** — nunca acaba, novas páginas surgem conforme necessário
- **Física real nos papéis** da mesa: folhas caem, empilham, podem ser puxadas
- A mesa deve parecer **dinâmica e viva**, não estática
- Papéis soltos podem ser organizados pelo aluno arrastando
- Stack técnica sugerida: `@react-three/rapier` ou `cannon-es` para física 3D

### Stack Necessária
- **Canvas API** ou **react-sketch-canvas** — captura de strokes
- **Pointer Events API** — suporte a caneta stylus com pressão
- **Tesseract.js** ou **Google Cloud Vision** — OCR dos strokes
- **Gemini Pro** ou **GPT-4** — análise de raciocínio
- **Storage** — salvar páginas do caderno como SVG/PNG + strokes raw

### Tasks

- [ ] **F2-01** Pesquisar libs de digital ink (react-sketch-canvas, perfect-freehand, tldraw)
- [ ] **F2-02** Criar componente `Notebook.tsx` com canvas de desenho
- [ ] **F2-03** Implementar sistema de linhas (caderno pautado) com seleção de linha
- [ ] **F2-04** Suporte a Pointer Events (pressão, inclinação da caneta)
- [ ] **F2-05** Undo/Redo/Borracha/Limpar linha
- [ ] **F2-06** Salvar strokes como dados raw (pontos + timestamps) + exportar imagem
- [ ] **F2-07** Integrar OCR (Tesseract.js para offline ou Cloud Vision para precisão)
- [ ] **F2-08** Criar pipeline de análise de raciocínio com prompt engineering
- [ ] **F2-09** Componente `FeedbackPanel.tsx` — mostra análise da IA ao lado do caderno
- [ ] **F2-10** Câmera: ativar preset `notebook` quando caderno abre (zoom 180)
- [ ] **F2-11** Animação do personagem: pose de "escrevendo" quando caderno está aberto
- [ ] **F2-12** Sistema de páginas — navegar entre páginas do caderno
- [ ] **F2-13** Vincular página a uma questão específica (ex: "Q3 do ENEM 2024")
- [ ] **F2-14** Gestos da caneta: rabisco = apagar, risco reto = mover câmera
- [ ] **F2-15** Duplo clique fora do caderno para sair e voltar à mesa
- [ ] **F2-16** Caderno de folhas infinitas (páginas geradas sob demanda)
- [ ] **F2-17** Física real nos papéis da mesa (folhas caem, empilham, podem ser arrastadas)
- [ ] **F2-18** Prioridade de performance: latência zero na escrita (mais rápido que digitar)

### Câmera para Caderno
Usar o novo preset **`notebook`** — câmera muito próxima, quase top-down sobre a mesa.
Zoom 180+ para que a superfície da mesa ocupe a maior parte da tela. O caderno em si
é um overlay HTML/Canvas posicionado sobre o 3D — a câmera dá o "clima" mas a escrita
acontece em 2D para precisão total.

---

## Feature 3: Modelo Contextual Profundo (FUVEST/ENEM + RLM)

### ⚡ ESTADO ATUAL: Boa parte já existe!

> **Projeto existente:** `C:\Users\Aya\Desktop\Fuvest RLM` (Python)
>
> O que JÁ ESTÁ PRONTO:
> - ✅ **Pipeline de ingestão** — PDF da FUVEST → JSON estruturado (com imagens extraídas via PyMuPDF)
> - ✅ **Enriquecimento via IA** — Gemini 2.5 Flash classifica cada questão (matéria, tópico, sub-tópico, dificuldade)
> - ✅ **Banco de questões** — FUVEST 2023 processada e enriquecida (~1.2MB, `banco_questoes_enriquecido.json`)
> - ✅ **Agente RLM** — Gemini 3.0 Pro como controlador, escreve código Python pra consultar questões via Pandas
> - ✅ **Sub-agente recursivo** — código gerado chama `consultar_ia()` (Gemini Flash-Lite) pra análise semântica profunda
> - ✅ **Prompt de sistema** — instruções pedagógicas do agente (`instrucoes_do_sistema.py`)
>
> O que FALTA pra integrar com o Trivial:
> - ❌ **API web** — precisa de um wrapper FastAPI em cima do código Python existente
> - ❌ **Frontend** — componente `ChatPanel.tsx` no React
> - ❌ **Vector Store** — atual usa Pandas (funciona, mas não escala). Pode adicionar embeddings depois
> - ❌ **Student Profile** — conectar com dados de estudo do Trivial
>
> **Nota técnica:** O RLM do Fuvest usa uma abordagem diferente do RAG tradicional.
> Em vez de Vector DB → top-K → LLM, ele faz: LLM → gera código Python → Pandas filtra
> dados → sub-LLM analisa semanticamente → resultado volta pro LLM principal.
> Isso é mais flexível que RAG puro mas precisa de um backend Python rodando.

### Conceito
Um modelo de IA com acesso a um **banco de provas reais** (FUVEST, ENEM, e outros
vestibulares) que dá **respostas super-contextualizadas** ao aluno. Usa a técnica
**RLM (Retrieval-augmented Language Model)** (ou RAG evoluído) para expandir a
memória efetiva do LLM muito além do context window, permitindo respostas que
referenciam questões específicas de provas passadas, padrões de cobrança, e
conexões entre temas.

### Arquitetura Técnica (atualizada com o projeto Fuvest RLM existente)

```
┌───────────────────────────────────────────────────────────────┐
│              BACKEND PYTHON (já existe em Fuvest RLM)         │
│                                                               │
│  ┌─────────────────┐   ┌──────────────────────────────────┐  │
│  │  Banco de Provas │   │  Pandas DataFrame (em memória)   │  │
│  │  ✅ FUVEST 2023  │   │  ✅ banco_questoes_enriquecido   │  │
│  │  - PDF → JSON    │   │  - matéria, tópico, dificuldade  │  │
│  │  - Imagens       │   │  - gabarito + resolução          │  │
│  └────────┬────────┘   └──────────────┬───────────────────┘  │
│           │                           │                       │
│           └───────────┬───────────────┘                       │
│                       │                                       │
│              ┌────────▼────────┐                              │
│              │  Agente RLM ✅  │                              │
│              │  (Gemini 3 Pro) │                              │
│              │                 │                              │
│              │  1. Recebe query│                              │
│              │  2. Gera código │                              │
│              │     Python      │                              │
│              │  3. Pandas      │                              │
│              │     filtra      │                              │
│              │  4. Sub-agente  │                              │
│              │     analisa     │                              │
│              │  5. Sintetiza   │                              │
│              └────────┬────────┘                              │
│                       │                                       │
│           ┌───────────▼───────────┐                           │
│           │  ❌ FastAPI wrapper   │  ← PRECISA CRIAR          │
│           │  (endpoints REST)     │                           │
│           └───────────┬───────────┘                           │
│                       │                                       │
└───────────────────────┼───────────────────────────────────────┘
                        │ API response (JSON)
                 ┌──────▼──────┐
                 │  FRONTEND   │
                 │  ❌ ChatPanel│  ← PRECISA CRIAR
                 │  no quarto  │
                 └─────────────┘
```

### RLM (Retrieval-augmented Language Model) — O que é
RLM é uma evolução do RAG (Retrieval-Augmented Generation) que:
1. **Não apenas busca documentos** — ela expande a "memória de trabalho" do LLM
2. **Mantém contexto entre sessões** — lembra o que o aluno já estudou, errou, domina
3. **Faz conexões cruzadas** — "essa questão da FUVEST 2023 cobra o mesmo conceito
   que caiu no ENEM 2019, questão 47, mas com uma abordagem diferente"
4. **Prioriza por relevância adaptativa** — o que é relevante *para este aluno*,
   não para qualquer aluno

### Fluxo do Usuário
1. Personagem vai até a estante → câmera faz zoom lateral (preset `reading`)
2. Painel de chat aparece no lado da tela (estilo copilot sidebar)
3. Usuário digita: "Me explica eletrostática no nível da FUVEST"
4. Pipeline RLM:
   a. Busca questões de eletrostática da FUVEST no vector store
   b. Puxa histórico do aluno (o que já revisou, onde errou)
   c. Gera resposta contextualizada com exemplos reais de provas
   d. Sugere: "Tente resolver a questão 12 da FUVEST 2022 — ela testa
      exatamente esse conceito que você errou semana passada"
5. O aluno pode pedir para a questão virar um flashcard (integra Feature 1)

### Stack Necessária
- ✅ **google-generativeai** (Python) — já usado no Fuvest RLM
- ✅ **pymupdf** — já usado para extrair PDFs
- ✅ **pandas** — já usado para queries no banco de questões
- ❌ **FastAPI + uvicorn** — para servir o agente como API REST
- ❌ **React fetch/axios** — para o frontend chamar a API
- ❌ **Student Profile Store** — histórico de estudo, erros, forças/fraquezas

### Tasks

- [x] **F3-01** ~~Coletar banco de provas~~ → já existe: FUVEST 2023 (`banco_questoes_enriquecido.json`)
- [x] **F3-02** ~~Criar parser de PDF → JSON~~ → já existe: `conversor_de_pdf.py` + `extrator_via_ia.py`
- [ ] **F3-03** Gerar embeddings de cada questão + resolução (opcional — atual usa Pandas, funciona)
- [ ] **F3-04** Configurar vector store (opcional — só se Pandas não escalar)
- [x] **F3-05** ~~Criar pipeline RLM~~ → já existe: `controlador_do_fluxo_de_raciocinio.py`
- [ ] **F3-06** Criar wrapper FastAPI em cima do agente RLM existente (`Fuvest RLM/`)
- [ ] **F3-07** Componente `ChatPanel.tsx` — sidebar de chat no frontend
- [ ] **F3-08** Integrar com Feature 1: sugerir questão → criar flashcard
- [ ] **F3-09** Student Profile: tracker de temas estudados, taxa de acerto por tema
- [ ] **F3-10** Câmera: ativar preset `reading` quando chat abre
- [ ] **F3-11** Animação do personagem: pose de "lendo" na estante
- [x] **F3-12** ~~Prompt engineering para respostas pedagógicas~~ → já existe: `instrucoes_do_sistema.py`
- [ ] **F3-13** Cross-referência entre provas: "isso caiu em X e Y também"
- [ ] **F3-14** Ingerir mais provas: FUVEST 2015-2022, 2024-2025, ENEM, Unicamp

### Câmera para Consulta IA
Usar o novo preset **`reading`** — câmera lateral mostrando a estante e o personagem.
Dá uma sensação de "biblioteca pessoal" / "consultando seus livros". O chat fica como
sidebar HTML à direita — não é 3D.

---

## Feature 4: Gato IA — Companheiro de Estudo (NOVA — ideias dos desenhos)

> Referência: `recursos/Referencias/4desenho_em_papel.jpeg` e `5desenho_em_papel.jpeg`

### Conceito
Um **gato virtual controlado por IA** que vive no quarto e se move livremente.
Ele é um **companheiro de estudo** — não apenas decorativo. O gato reage ao
comportamento do aluno, dá dicas visuais, e torna o ambiente mais vivo e
acolhedor (inspiração: Neko Atsume + Tamagotchi + assistente sutil).

### Comportamentos do Gato

| Estado do Aluno | Comportamento do Gato |
|---|---|
| Estudando normalmente | Dorme no tapete / anda pelo quarto |
| Acertou muitos cards | Pula, ronrona, fica feliz (animação de comemoração) |
| Errou muito seguido | Vai até o aluno, mia, mostra carinha de apoio |
| Não estuda há tempo | Senta na mesa, olha pro aluno, "cobra" sutilmente |
| Abriu o caderno | Senta do lado e "observa" o aluno escrever |
| Terminou sessão | Deita satisfeito, ronrona |

### Arquitetura Técnica

```
┌──────────────────────────────────────────┐
│            Gato IA (CatAI.tsx)           │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │  Modelo GLTF │  │  Behavior Tree  │  │
│  │  (gato low-  │  │  - Idle         │  │
│  │   poly)      │  │  - Walk         │  │
│  │              │  │  - Sleep        │  │
│  │  Animações:  │  │  - Sit          │  │
│  │  - Walk      │  │  - Happy        │  │
│  │  - Idle      │  │  - Curious      │  │
│  │  - Sleep     │  │                 │  │
│  │  - Jump      │  │  Estado vem do  │  │
│  │  - Sit       │  │  progresso do   │  │
│  └──────────────┘  │  aluno          │  │
│                     └─────────────────┘  │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  Pathfinding simples             │    │
│  │  - Pontos de interesse no quarto │    │
│  │  - Mesa, cama, estante, tapete   │    │
│  │  - Evita colidir com personagem  │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

### Stack Necessária
- **Modelo GLTF de gato** — low-poly estilizado (Quaternius, Kenney, ou Sketchfab)
- **Behavior Tree** — lógica simples de estados (pode ser uma state machine como o Character.tsx)
- **Pathfinding** — pontos de interesse no quarto (navmesh simples ou waypoints)

### Tasks

- [ ] **F4-01** Encontrar/criar modelo GLTF de gato low-poly com animações (Walk, Idle, Sleep, Sit, Jump)
- [ ] **F4-02** Criar componente `CatAI.tsx` — carregar modelo, renderizar no quarto
- [ ] **F4-03** Implementar state machine básica: Idle → Walk → Idle (andar aleatório pelo quarto)
- [ ] **F4-04** Definir waypoints/pontos de interesse: tapete, mesa, cama, estante, perto do personagem
- [ ] **F4-05** Pathfinding simples entre waypoints (lerp + slerp, como o Character.tsx)
- [ ] **F4-06** Conectar comportamento do gato ao estado do aluno (cards acertados, tempo estudando, etc.)
- [ ] **F4-07** Animações reativas: pular de alegria (acertos), miar (erros), dormir (inatividade)
- [ ] **F4-08** Gato senta e observa quando o caderno está aberto
- [ ] **F4-09** Interação: clicar no gato → ele ronrona / mostra uma dica motivacional
- [ ] **F4-10** Sons opcionais: ronronar, miar suave (Web Audio API)

---

## Feature 5: Notificações nos Objetos do Quarto (NOVA — ideias dos desenhos)

> Referência: `recursos/Referencias/5desenho_em_papel.jpeg`

### Conceito
Os **objetos do quarto** (mesa, estante, cama) mostram **ícones de notificação**
quando há algo pendente. Como os ícones de badge em apps de celular, mas no
mundo 3D — dando ao quarto uma sensação de "estar vivo" e guiando o aluno
para o que precisa fazer.

### Tipos de Notificação

| Objeto | Notificação | Quando aparece |
|---|---|---|
| **Mesa/Escrivaninha** | `!` ou número | "3 flashcards pendentes pra hoje" |
| **Estante** | `!` ou badge | "Novo deck sugerido pela IA" / "Carta adicionada automaticamente" |
| **Caderno** | `!` | "Feedback da IA disponível" / "Termine sua resolução" |
| **Cama** | `zzz` ou relógio | "Hora de descansar" (timer Pomodoro) |
| **Gato** | `💭` (balão) | Gato quer mostrar algo (dica, motivação) |

### Visual
- **Ícone flutuante** sobre o objeto (sprite 3D ou HTML overlay)
- **Animação** de bounce suave (sobe e desce) para chamar atenção
- **Cor** indicando urgência: amarelo (lembrete), vermelho (atrasado), verde (bom progresso)
- Some automaticamente quando o aluno interage com o objeto

### Tasks

- [ ] **F5-01** Criar componente `ObjectNotification.tsx` — sprite/billboard 3D flutuante sobre objetos
- [ ] **F5-02** Sistema de dados: definir quais eventos geram notificações
- [ ] **F5-03** Animação de bounce (flutuação suave) no ícone de notificação
- [ ] **F5-04** Notificação na mesa: cards pendentes do dia (integra Feature 1)
- [ ] **F5-05** Notificação na estante: novo deck ou carta adicionada automaticamente
- [ ] **F5-06** Notificação no caderno: feedback da IA disponível (integra Feature 2)
- [ ] **F5-07** Notificação na cama: timer de descanso / Pomodoro
- [ ] **F5-08** Cores de urgência: amarelo (lembrete), vermelho (atrasado), verde (progresso)
- [ ] **F5-09** Auto-dismiss: notificação some ao interagir com o objeto
- [ ] **F5-10** Integrar com Gato IA: gato aponta/anda até o objeto com notificação (Feature 4)

---

## Integração entre Features

```
                    ┌──────────────────────────┐
                    │  Feature 3 - Modelo IA   │
                    │  "Estude eletrostática"   │
                    └────────┬─────────────────┘
                             │ sugere questão
                    ┌────────▼─────────────────┐
                    │  Feature 1 - Flashcards  │
                    │  Card: "Lei de Coulomb"   │
                    └────────┬─────────────────┘
                             │ aluno erra → abre caderno
                    ┌────────▼─────────────────┐
                    │  Feature 2 - Caderno     │
                    │  Escreve resolução à mão  │
                    └────────┬─────────────────┘
                             │ IA analisa raciocínio
                    ┌────────▼─────────────────┐
                    │  Feature 3 - Feedback    │
                    │  "No passo 3 você..."    │
                    └────────┬─────────────────┘
                             │ Gato IA reage
                    ┌────────▼─────────────────┐
                    │  Feature 4 - Gato IA     │
                    │  Mia, anda até o aluno,   │
                    │  mostra dica visual       │
                    └────────┬─────────────────┘
                             │ notifica próxima tarefa
                    ┌────────▼─────────────────┐
                    │  Feature 5 - Notificações│
                    │  Mesa pisca: "3 cards!"   │
                    └──────────────────────────┘
```

O ciclo completo:
1. **IA sugere** o que estudar (Feature 3)
2. **Flashcard** testa o conhecimento (Feature 1)
3. **Caderno** captura o raciocínio quando erra (Feature 2)
4. **IA analisa** o raciocínio e aprofunda (Feature 3)
5. **Gato IA** reage ao progresso, dá dicas visuais, comemora acertos (Feature 4)
6. **Notificações** nos objetos lembram o que falta fazer (Feature 5)
7. Volta ao passo 1 com dados atualizados do aluno

---

## Prioridade de Implementação

| Fase | Feature | Justificativa |
|---|---|---|
| **Fase A** | Feature 1 — Flashcards FSRS-6 | Core do app, valor imediato, menor complexidade |
| **Fase A+** | Feature 5 — Notificações nos Objetos | Pequena, visual, dá vida ao quarto desde cedo |
| **Fase B** | Feature 2 — Caderno de Escrita | Diferencial único, média complexidade |
| **Fase B+** | Feature 4 — Gato IA | Charme visual, pode começar simples (andar aleatório) e evoluir |
| **Fase C** | Feature 3 — Modelo Contextual | Maior complexidade, depende de backend/dados |

### Dependências entre Fases
- Fase A é independente — pode começar agora
- Fase A+ é independente — pode rodar em paralelo com A (só precisa de dados de "pendências")
- Fase B é independente — pode começar em paralelo com A
- Fase B+ é independente — pode começar simples a qualquer momento
- Fase C depende parcialmente de A (integração flashcard ↔ IA)

---

## Estado Atual da Câmera (Presets Existentes)

| Preset | Status | Zoom | Uso |
|---|---|---|---|
| `room` | ✅ Implementado | 70 | Visão geral do quarto |
| `desk` | ✅ Implementado | 130 | Flashcards / Escrivaninha |
| `bed` | ✅ Implementado | 70 | Descanso |
| `notebook` | ✅ Implementado (novo) | 180 | Caderno de escrita (Feature 2) |
| `reading` | ✅ Implementado (novo) | 100 | Consulta IA (Feature 3) |

---

## Decisões Técnicas em Aberto

1. **Persistência**: IndexedDB (offline-first) vs Supabase (cloud sync)?
2. **Backend**: Supabase Edge Functions vs API Node separada?
3. **LLM para variações**: Gemini Flash (barato) vs Gemini Pro (melhor)?
4. **RLM implementation**: Usar framework existente (LangChain, LlamaIndex) ou custom?
5. **OCR**: Tesseract.js (free, offline) vs Google Vision (melhor com manuscrito)?
6. **Caneta**: Só web (Pointer Events) ou app nativo (React Native) para melhor suporte?
7. **Física 3D**: `@react-three/rapier` (Rust/WASM, rápido) vs `cannon-es` (JS puro, mais simples)?
8. **Modelo do Gato**: Quaternius (mesmo estilo do personagem) vs Kenney vs modelo custom?
9. **Notificações 3D**: Sprite billboard (sempre virado pra câmera) vs HTML overlay (CSS posicionado)?
10. **Gestos da caneta**: Reconhecimento de gesto custom vs lib existente ($1 Recognizer, etc.)?
