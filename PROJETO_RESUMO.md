# Trivial — Resumo Completo do Projeto

## O que é este Projeto?

**Trivial** (internamente chamado de "Kind Woods") é um **quarto 3D interativo** inspirado no jogo **Kind Words**, construído com **React + Three.js**. É a parte visual/sala de estudos de um app de flashcards chamado **DyCard**. O personagem (um bonequinho estilo low-poly de terno) vive neste quarto e pode se mover, sentar na escrivaninha para "escrever cartas" e deitar na cama para "descansar".

**Repositório GitHub:** https://github.com/Aguiar012/Trivial

---

## Stack Tecnológica

| Tecnologia | Versão | Papel |
|---|---|---|
| **React** | 19.2 | UI e gerenciamento de estado |
| **Three.js** | 0.183 | Motor 3D |
| **@react-three/fiber** | 9.5 | Ponte React↔Three.js |
| **@react-three/drei** | 10.7 | Helpers (useGLTF, useAnimations, Box, Cylinder, Sphere, Environment) |
| **Vite** | 7.3 | Bundler e dev server |
| **TypeScript** | 5.9 | Tipagem |

**Rodar o projeto:** `npm run dev` → roda no `localhost:5173` (ou porta seguinte disponível)

---

## Estrutura de Arquivos

```
c:/Users/Aya/DyCard_Room/
├── public/
│   └── Modelos da Internet/
│       └── glTF/              ← Modelos 3D do Quaternius (baixados da internet)
│           ├── Suit_Male.gltf ← MODELO USADO (Boneco de Terno)
│           ├── Casual_Male.gltf
│           ├── ... (dezenas de outros modelos disponíveis)
├── src/
│   ├── App.tsx                ← Componente raiz: Canvas 3D + UI overlay (botões + paleta de cores)
│   ├── main.tsx               ← Entry point React
│   ├── index.css              ← Estilos globais
│   ├── App.css                ← Estilos do App
│   └── components/
│       ├── Character.tsx      ← Personagem 3D: modelo GLTF + animações + pathfinding + state machine
│       ├── CozyRoom.tsx       ← Toda a geometria do quarto: paredes, chão, mesa, cama, estante, planta
│       ├── CameraController.tsx ← Controla câmera ortográfica com lerp entre visões (room/desk/bed)
│       ├── Lighting.tsx       ← Iluminação: ambient, directional, point lights (tom roxo/lavanda)
│       └── DustParticles.tsx  ← Partículas flutuantes decorativas (instanced mesh)
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tsconfig.app.json
```

---

## Arquitetura e Fluxo de Dados

### Estado Global (App.tsx)

O `App.tsx` gerencia 3 estados principais:

```
view: 'room' | 'desk' | 'bed'       → Controla posição da câmera e animação do personagem
targetPosition: THREE.Vector3 | null → Coordenada de destino para o personagem andar
skinColor: string                    → Cor de pele dinâmica do avatar (#ffcba4 default)
```

### Fluxo de Interação

```
Usuário clica no chão/mesa/cama → setTargetPosition(coord) → Character.tsx lê
                                                             ↓
                                                    useFrame() a cada frame:
                                                    - Calcula distância até alvo
                                                    - Se longe: Walk + lerp posição + slerp rotação + desenha linha tracejada
                                                    - Se perto: Auto-snap + toca SitDown/Defeat/Idle + esconde linha
```

---

## Componentes em Detalhe

### 1. `App.tsx` — Orquestrador

- **Canvas ortográfico** com `near: 0.1`, `far: 100`, `zoom: 40`
- **3 botões:** View Room, Write Letters (manda para mesa), Rest (manda para cama)
- **Paleta de Skin Tones** com 6 cores predefinidas
- **Ring Indicator** — anel branco no chão mostrando destino do clique (só aparece na view "room")
- Ao clicar no chão, também força `setView('room')` para câmera voltar à visão geral

### 2. `Character.tsx` — Personagem NPC Animado

**Modelo:** `Suit_Male.gltf` do [Quaternius](https://quaternius.com/) — boneco low-poly de terno  
**Scale:** 1.15  
**Posição inicial:** `[-2.5, -2, -1.0]` (sentado na frente da mesa)  
**Rotação inicial:** `Math.PI` (virado para a mesa)

**Animações disponíveis no .gltf:**
```
Death, Defeat, Idle, Jump, PickUp, RecieveHit, Roll, Run,
Run_Carry, Shoot_OneHanded, SitDown, StandUp, SwordSlash,
Victory, Walk, Walk_Carry
```

**Animações usadas atualmente:**
- `Idle` → parado (estado base)
- `Walk` → caminhando até o alvo
- `SitDown` → sentando na cadeira (LoopOnce, clampWhenFinished)
- `Defeat` → deitando na cama (LoopOnce, clampWhenFinished, é uma "gambiarra criativa")

**Action State Machine (useFrame):**
1. Se `targetPosition` existe e distância > 0.1: toca `Walk`, lerp posição (0.08), slerp rotação (0.15), desenha linha tracejada
2. Se distância <= 0.1 (chegou):
   - Esconde linha tracejada
   - Se `view=desk` E coord=mesa → `SitDown` + snap rotação para `Math.PI`
   - Se `view=bed` E coord=cama → `Defeat` + snap rotação para `-Math.PI/2`
   - Senão → `Idle`
3. Se `targetPosition` é null → estado inicial baseado na `view` atual

**Dashed Line Trail:** Criada via `useMemo` com `THREE.LineDashedMaterial` e renderizada como `<primitive>`. Mostra o caminho entre o personagem e o destino durante o movimento.

**Bug conhecido do modelo Suit_Male:** O material `Skin` vem quase preto no .gltf original. O código intercepta qualquer material com `name === 'Skin'` e força o `skinColor` dinâmico.

### 3. `CozyRoom.tsx` — Geometria do Quarto

**Posição global do grupo:** `[0, -2, 0]` → o "chão" fica em Y=0 relativo (Y=-2 global)

**Estrutura do quarto (10x10 unidades):**
- **Chão:** Box 10x0.5x10 em Y=-0.25. Clicável com `clamp(-4, 4)` em X e Z
- **Parede traseira:** Box 10x8x0.5 em Z=-4.75
- **Parede esquerda:** Box 0.5x8x10 em X=-4.75
- **Janela falsa:** Buraco escuro (#1a1236) + moldura branca na parede traseira

**Móveis principais e suas coordenadas globais (já somando o offset do grupo):**

| Móvel | Posição Global | Detalhes |
|---|---|---|
| **Mesa (Desk)** | X=-2.5, Y=0, Z=-5 | Clicável → envia target `(-2.5, -2, -2.0)` |
| **Cadeira (Stool)** | X=-2.5, Y=-1.2, Z=-2 | Dentro do grupo da mesa, offset `[0, -3.2, 1]` |
| **Cama (Bed)** | X=2.5, Y=-2.5, Z=2.5 | Clicável → envia target `(2.5, -2, 0)` |
| **BED duplicata interativa** | X=2.5, Y=-0.5, Z=2.5 | Segundo grupo com onClick/Pointer |
| **Estante** | X=-4, Y=0, Z=3 | Decorativa, com 3 livros coloridos |
| **Planta** | X=4, Y=-1.5, Z=-3 | Vaso branco + esfera verde |
| **Tapete** | Centro, Y=0.05, raio=3 | Cilindro rosa-lavanda decorativo |

> ⚠️ **Atenção:** Há duas definições de Cama no código (linhas 65-79 e 146-169). A segunda (linhas 146-169) é a interativa com `onClick`. Isso pode ser um bug de duplicação que deveria ser limpo.

### 4. `CameraController.tsx` — Câmera Dinâmica

Câmera **ortográfica** com 3 presets de visão:

| View | Posição Câmera | LookAt | Zoom |
|---|---|---|---|
| `room` | (10, 10, 10) | (0, 0, 0) | 40 |
| `desk` | (-1.0, 1.5, -3.0) | (-2.5, -0.5, -1.0) | 90 |
| `bed` | (4, 3, 6) | (1.5, 0.5, 1.5) | 70 |

Todas as transições usam `lerp(0.05)` para suavidade.

### 5. `Lighting.tsx` — Iluminação Lo-fi

- **Ambient:** roxo escuro `#453163`, intensidade 0.6
- **Directional:** lavanda `#d1a3ff`, posição (5,10,5), com shadow map 1024x1024
- **Point (mesa):** laranja quente `#ffcc88`, posição (-2,3,-1), intensidade 1.2
- **Point (fill):** roxo `#8855cc`, posição (4,2,4), intensidade 0.4

### 6. `DustParticles.tsx` — Partículas Decorativas

100 partículas instanciadas (InstancedMesh) com movimento senoidal suave. Cor rosa-branco `#ffebef`, blending aditivo, opacidade 0.4. **Nota:** Este componente NÃO está sendo usado no App.tsx atualmente (foi removido ou nunca foi adicionado ao canvas).

---

## Sistema de Coordenadas Essencial

```
      +Y (cima)
       |
       |    -Z (fundo/parede traseira)
       |   /
       |  /
       | /
       +---------- +X (direita)
      /
     /
    +Z (frente/câmera)

Chão global: Y = -2
Teto aprox.: Y = 6
Parede traseira: Z = -6.75
Parede esquerda: X = -4.75
Limites do clique: X ∈ [-4, 4], Z ∈ [-4, 4]
```

**Coordenadas-chave para animação:**
- Mesa (target do Write Letters): `(-2.5, -2, -1.0)`
- Cama (target do Rest): `(2.5, -2, 0)`
- Posição inicial do character: `(-2.5, -2, -1.0)` para frente da mesa

---

## Paleta de Cores do Projeto

| Elemento | Cor | Hex |
|---|---|---|
| Background da página | Azul escuro | `#18122B` |
| Chão | Lavanda suave | `#bfaed6` |
| Paredes | Lavanda/roxo | `#a891c9`, `#9b82c0` |
| Mesa/Estante | Madeira quente | `#a38575`, `#8b7266` |
| Cama (cobertor) | Rosa quente | `#f2bbc9` |
| Tapete | Rosa-lavanda | `#dcbbe0` |
| Almofada da cadeira | Roxo | `#9b82c0` |
| Tela do laptop | Azul claro | `#e6f7ff` |
| Abajur | Amarelo | `#ffeb99` |

---

## Problemas Conhecidos / Pontos de Atenção

1. **Cama duplicada no CozyRoom.tsx:** Há dois `<group>` de Cama — um na linha 65-79 (original, sem onClick) e outro na linha 146-169 (interativo, com onClick). O primeiro deveria ser removido ou unificado.

2. **Lints persistentes no App.tsx:** TypeScript reclama de `Cannot find module './components/CozyRoom'` e `'./components/Lighting'`. Isso é um falso positivo causado pela extensão `.tsx` nos arquivos e o tsconfig. O projeto compila e roda normalmente via Vite.

3. **Animação de Sentar:** A animação `SitDown` do modelo Quaternius é genérica — as pernas não se alinham perfeitamente com a cadeira 3D do cenário. Pode precisar de ajuste fino na posição Y do stool ou no Z do target.

4. **Animação de Deitar:** Usa `Defeat` como gambiarra para "dormir". Uma animação customizada seria ideal.

5. **DustParticles.tsx** existe mas **não está sendo renderizado** no `App.tsx` — poderia ser adicionado para dar mais vida à cena.

6. **O modelo Suit_Male tem a pele preta por padrão** — o código corrige isso interceptando o material `Skin` e aplicando a cor selecionada pelo usuário.

---
                                                                                                                                                                                                                                                                                                   ZZZZZZZZZ
## O que o Usuario Quer (Visão Geral)

O Usuario ("Aya") está construindo um **app de flashcards** e quer que esta sala 3D seja a **interface principal** — um quarto acolhedor e aconchegante estilo "Kind Words" ou "Lo-fi Girl". Os objetivos futuros incluem:

- Visual mais **polido e profissional** (não parece "simples demais")
- Animações mais ricas e **interações tipo The Sims** (andar, sentar, escrever, dormir)
- Integração futura com o sistema de flashcards (clicar na mesa → estudar cartas)
- A usuária prefere **código comentado em português** e **variáveis sem abreviações**
- A usuária é detalhista com **qualidade visual** — se algo parecer bugado (pernas flutuando, câmera cortando paredes), ela vai pedir para corrigir

---

## Comandos Úteis

```bash
# Rodar o projeto
npm run dev

# Ver animações disponíveis em qualquer modelo .gltf
node -e "const fs = require('fs'); const gltf = JSON.parse(fs.readFileSync('public/Modelos da Internet/glTF/Suit_Male.gltf', 'utf8')); console.log(gltf.animations.map(a => a.name));"

# Build de produção
npm run build
```

---

## Histórico de Fases (O que já foi feito)

| Fase | Descrição |
|---|---|
| **1** | Quarto 3D básico com geometria Box/Cylinder, iluminação Lo-fi |
| **2** | Câmeras dinâmicas (room/desk/bed) com lerp suave |
| **3** | Personagem GLTF com animações básicas (Idle/SitDown/Defeat) |
| **4** | Correção de modelo (Suit_Male), customização de pele, câmera frontal |
| **5** | Pathfinding point-and-click, Walk animation, Ring indicator, bounds clamping, Action State Machine |
| **6** | Câmera 3/4 sem clipping, Stool rebaixado, Mobília clicável (raycasters), Linha tracejada de trajetória || **7** | Banco real (Stool.glb), remoção criado-mudo, 3 poses de sono aleatórias, câmera livre (OrbitControls) |
| **8** | Novos presets de câmera (notebook, reading) para ações de estudo futuras |

---

## Roadmap de Features Futuras

> Documentação completa em **ROADMAP.md**

### Feature 1 — Flashcards com FSRS-6 + Gemini Variação
Flashcards reais com agendamento por FSRS-6, variações geradas por Gemini Flash.
Câmera: preset `desk`. **Prioridade: ALTA (Fase A)**

### Feature 2 — Caderno de Escrita com Análise de Raciocínio
Notebook com caneta stylus para escrever raciocínio passo-a-passo. IA analisa o processo.
Câmera: preset `notebook` (zoom 180+). **Prioridade: MÉDIA (Fase B)**

### Feature 3 — Modelo Contextual Profundo (FUVEST/ENEM + RLM)
IA com acesso a banco de provas reais, respostas super-contextualizadas via RLM.
Câmera: preset `reading`. **Prioridade: FUTURA (Fase C)**
## Skill Claude: `3d-posicoes`

Skill local instalada em `~/.claude/skills/3d-posicoes.md`. Ativa automaticamente quando se trabalha com posições 3D.

**O que faz:**
- Solicita o JSON da cena (`window.__cena3d`) antes de qualquer alteração de coordenadas
- Lembra que `Quarto.tsx` usa offset `[0,-2,0]` — posições internas são locais, não world-space
- Fornece tabela rápida de bugs comuns e como detectá-los

**Como ativar o debug visual:**
1. Abrir `localhost:5173?debug=1`
2. No console: `copy(window.__cena3d)` — cola o JSON no chat
3. Claude analisa world-space real e propõe coordenadas corretas
