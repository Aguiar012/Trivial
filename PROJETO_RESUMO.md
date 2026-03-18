# Trivial — Resumo Completo do Projeto

## O que é este Projeto?

**Trivial** (internamente chamado de "Kind Woods" ou "DyCard") é um **quarto 3D interativo** inspirado no jogo **Kind Words**, construído com **React + Three.js**. Originalmente focado em flashcards, o aplicativo assumiu recentemente o papel de uma Interface de IA e **Diário Digital interativo**. 

O personagem (um bonequinho estilo low-poly de terno) vive neste quarto e pode se mover, sentar na escrivaninha para analisar seus textos manuscritos e deitar na cama para "descansar".

**Repositório GitHub:** https://github.com/Aguiar012/Trivial

---

## Stack Tecnológica

| Tecnologia | Versão | Papel |
|---|---|---|
| **React** | 19.2 | UI e gerenciamento de estado |
| **Three.js** | 0.183 | Motor 3D |
| **@react-three/fiber** | 9.5 | Ponte React↔Three.js |
| **@react-three/drei** | 10.7 | Helpers (useGLTF, useAnimations) |
| **perfect-freehand** | 1.2 | Simulação física de Traçado à Mão / Tinta |
| **Vite** | 7.3 | Bundler e dev server |
| **TypeScript** | 5.9 | Tipagem, matemática geométrica para Point Cloud |

**Rodar o projeto:** `npm run dev` → roda no `localhost:5173`

---

## Estrutura de Arquivos Principal

```
c:/Users/Aya/Trivial/
├── src/
│   ├── App.tsx                  ← Componente raiz: Canvas 3D + Menus 
│   ├── index.css                ← Estilos globais
│   ├── components/
│   │   ├── Character.tsx        ← Personagem 3D (state machine de Walk/Sit/Idle)
│   │   ├── CozyRoom.tsx         ← Geometria do quarto 3D
│   │   ├── CameraController.tsx ← Câmeras cinemáticas ortográficas e tweenings
│   │   └── Lighting.tsx         ← Iluminação Lo-Fi
│   ├── estudo/
│   │   ├── SmartCanvas.tsx      ← Overlay 2D interativo para desenhar e Apagar
│   │   └── Recognizer.ts        ← Algoritmo nativo de Inteligência Artificial ($P)
```

---

## Componentes em Detalhe

### 1. `App.tsx` — Orquestrador e UI Principal

Orquestra toda a state machine de onde a câmera está (`view: 'room' | 'desk' | 'bed'`) e processa paletas de cores e temas. Quando o view vira `desk`, ele aciona a Lousa Interativa (SmartCanvas).

### 2. `Character.tsx` — Personagem NPC Animado

Possui pathfinding 3D. Quando o usuário clica num ponto viável do chão, ele roda animações GSAP/Lerp para girar e caminhar fisicamente até lá (deixando rastro tracejado), alternando as Action States do `useFrame`.

### 3. `CozyRoom.tsx` — Geometria do Quarto

Os móveis globais do quarto. Possui os Raycasters invisíveis na Cama e Cadeira que alteram os destinos de Pathfinding e Viewports de Câmera dinamicamente.

### 4. `CameraController.tsx` e `Lighting.tsx`

Sistema rigoroso de "Orthographic Camera" (isométrico) lo-fi, que movimenta o frustum da câmera de modo cinematico para a mesa/cama/quarto vazio simulando zooms reais.

### 5. `SmartCanvas.tsx` — Lousa Mágica (Overlay 2D)

O coração atual da ferramenta de input. Um canvas 2D injetado com `<svg>` por cima do mundo 3D quando a view é `desk`.
- Simula física, fricção e grossura de caneta natural e responsiva usando a biblioteca `perfect-freehand`.
- Suporta traço (pen) e interações de toque mobile refinadas (`touchAction: 'none'` handling nativo).
- Integra **Scribble to Erase** (apagar texto fazendo rabiscos rápidos por cima dele).
- **UI Orgânica de Zero-Fricção:** Em caso de o algoritmo reconhecer mal uma letra do usuário, basta **clicar nela**. Um balão aparece ("Quis dizer?").

### 6. `Recognizer.ts` — Engine ML ($P Point-Cloud) 🧠

O cérebro de reconhecimento manual, sem uso de APIs ou Python. Ele converte a geometria bruta (arrays vetoriais X e Y) do SmartCanvas para texto em _realtime_ usando a prova matemática Point-Cloud $P.
- Detecta strokes múltiplos (cortes do 't', pingos do 'i').
- Implementa o **Padrão Aya (O-Shot UI Correction)**: Quando a I.A. erra uma letra e o usuário clica e seleciona a correta através do `SmartCanvas`, **a própria curva do erro (originalStrokes)** é instantaneamente reinjetada em `addCustomTemplate()`. Essa assinatura personalíssima é gravada em `<localStorage>`. A máquina efetivamente passa a "reconhecer os ganchos bizarros" da mão única do(a) dono(a) do aplicativo, _sem telas extras de calibração_ ou retreino remoto.

---

## Histórico de Fases do Desenvolvimento

| Fase | Descrição |
|---|---|
| **1 as 8** | Construção da casa 3D inteira, pathfingers, Raycasters, modelos de terno e mobílias, tweenings de Viewports isométricas e arquitetura base do App.tsx. |
| **9** | Foco absoluto no `SmartCanvas.tsx`, com engine SVG hiper rápida simulando caligrafia vetorizada, `getSvgPathFromStroke()`, e gestos complexos como borrar, apagar ou sublinhar via detecção de boundboxes 2D em tempo real. |
| **10** | Integração do motor em TypeScript puríssimo do `Recognizer ($P Cloud)`. Implementação de clustering para múltiplas pernas de caracteres e do **"Padrão Aya" de Arquitetura UX** (Retreino de I.A. Nativo Local e de Fricção-Zero pelo Usuário Final). |

---

## Próximos Passos & Filosofia do App

> Filosofia Base de Interação: O foco de Trivial agora rege a "Priorização da Experiência e Eficiência sobre Algoritmos".
Sempre que uma inteligência não tiver heurística matemática suficiente (falhar), transformamos a frustração do usuário em um **Game Design de Resolução**, permitindo que ele "edite" a experiência fluída para curar e ensinar o próprio sistema orgânico.
