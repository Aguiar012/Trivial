# Design: Consertar e Completar Flashcards (Feature 1)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> Data: 5 de março de 2026
> Status: Aprovado pela Aya
> Abordagem: 3D puro (sem overlays HTML)

**Goal:** Consertar o input 3D dos flashcards (trocar textarea por keydown no window), verificar o fluxo criar/estudar ponta-a-ponta, e polir a experiência visual com animações e feedback.

**Architecture:** O app usa React + Three.js (@react-three/fiber) com tela dividida: quarto 3D isométrico à esquerda, mesa de estudo em primeira pessoa à direita. Todo o estudo é renderizado em 3D (sem overlays HTML). FSRS-6 via ts-fsrs gerencia scheduling. Supabase persiste tudo.

**Tech Stack:** React 19, Three.js 0.183, @react-three/fiber 9.5, @react-three/drei 10.7, ts-fsrs 5.2.3, Supabase, Vite 7.3, TypeScript 5.9

---

## Contexto

Os flashcards do Trivial já têm base funcional: ts-fsrs instalado, Supabase conectado,
lógica de criar/avaliar cartas, cena 3D com flip animation. Porém o **input não funciona**
(textarea escondido com focus-stealing agressivo falha) e faltam funcionalidades essenciais.

O objetivo é consertar o input, completar o CRUD, e polir a experiência visual.

---

## Etapa 1: Consertar o Sistema de Input 3D

### Problema
O `textarea` escondido usa `setInterval` a cada 150ms para roubar foco. Falha em
capturar input — o user clica e nada acontece.

### Solucao

Trocar o textarea por captura de teclas no `window`:

1. Quando `editando = true`, registrar `window.addEventListener('keydown')`
2. Cada tecla atualiza `textoInput` direto no state
3. Cursor piscante renderizado como `<Text>` 3D (caractere `|`, pisca a cada 500ms via useFrame)
4. Backspace apaga ultimo caractere, Enter confirma, Escape cancela
5. Sem textarea, sem focus-stealing, sem polling

**Mobile/tablet:** Botao 3D "teclado" que ao clicar abre um `<input>` HTML fora da tela
(`position: fixed; top: -9999px`). O OS abre o teclado virtual, e os eventos `input`
alimentam o mesmo state. Padrao usado por jogos web (Excalidraw, tldraw fazem similar).

### Arquivos afetados
- `codigo/Tela.tsx` — remover textarea e setInterval, adicionar keydown listener
- `codigo/estudo/CenaInteracao.tsx` — adicionar cursor piscante 3D

---

## Etapa 2: Fluxo Completo Criar/Estudar

### Criar Card

```
Personagem senta na mesa -> camera preset desk
  -> Lapis 3D na mesa
  -> Click no lapis -> card em branco aparece
  -> Frente: user digita pergunta (cursor piscando)
  -> Enter -> card vira (flip animado)
  -> Verso: user digita resposta
  -> Enter -> salva (Supabase + FSRS inicializa)
  -> Animacao: card "voa" pra cima com fade (feedback visual)
```

### Estudar

```
Personagem senta na mesa -> cards do dia empilhados
  -> Card mostra frente (pergunta)
  -> Click no card -> flip mostra resposta
  -> 4 opcoes: Errei / Dificil / Bom / Facil
  -> User escolhe -> FSRS recalcula -> proximo card
  -> Acabou deck -> animacao de vitoria
```

### Mudancas no codigo
- Remover `setInterval` de focus-stealing em `Tela.tsx`
- Substituir por `window.addEventListener('keydown')`
- Manter toda a logica FSRS e Supabase que ja funciona
- Adicionar animacao de "card voa" ao salvar

---

## Etapa 3: Estante como Gerenciador Visual de Decks (fase 2)

> Implementar DEPOIS que o input estiver funcionando.

### Visual
- Caixas/livros 3D nas prateleiras da estante existente
- Cada caixa = um deck (materia)
- Etiqueta com nome + progresso ("12/30")
- Cores por materia (Fisica = azul, Historia = marrom, etc.)
- Notificacao (!) flutuante quando tem cards pendentes

### Interacao

```
Click na estante -> camera zoom lateral (preset 'shelf')
  -> Ve todas as caixas com etiquetas
  -> Click numa caixa -> animacao: caixa pula da estante pra mesa
  -> Personagem senta -> comeca a estudar aquele deck
  -> Ou: botao "Criar Deck" -> nova caixa vazia -> nomear
```

### Arquivos novos
- `codigo/pecas/Estante.tsx` — componente da estante com caixas interativas
- `codigo/estudo/gerenciadorDecks.ts` — logica de CRUD de decks

### Arquivos modificados
- `codigo/pecas/Quarto.tsx` — substituir estante estatica pela nova
- `codigo/Tela.tsx` — adicionar estado e handlers pra estante
- `codigo/pecas/Camera.tsx` — novo preset 'shelf'

---

## Etapa 4: Polimento Visual

### Cards
- Textura de papel: material com roughness, cor creme (#f5f0e8)
- Linhas do caderno no card (ja existem — polir)
- Sombra suave do card na mesa

### Animacoes
- Flip com bounce (overshoot + settle via lerp)
- Card salvo: voa suavemente com fade
- Resposta certa: brilho verde na borda + particulas
- Resposta errada: shake suave no card
- Streak: post-it 3D no canto da mesa com contador

### Performance
- Animacoes em useFrame com lerp (como ja esta)
- Nao adicionar post-processing pesado alem do Bloom/Vignette existente

---

## Decisoes Tecnicas

- **Input 3D:** `window.addEventListener('keydown')` + `<Text>` cursor piscante
- **Mobile:** `<input>` fora da tela para teclado virtual do OS
- **Persistencia:** Supabase (ja configurado e funcionando)
- **FSRS:** ts-fsrs v5.2.3 (ja instalado, logica pronta)
- **Animacoes:** useFrame + lerp (padrao do projeto)
- **Fisica futura:** @react-three/rapier (quando for fazer arremesso de cards)

---

# Implementação Detalhada — Tasks Bite-Sized

> Cada task é uma unidade atômica de trabalho (2–10 min).
> Ordem sequencial — cada task depende da anterior.
> Sem testes unitários (projeto não tem vitest configurado; validação é visual no browser).

---

## Task 1: Remover textarea e setInterval de `Tela.tsx`

**Files:**
- Modify: `codigo/Tela.tsx`
- Modify: `codigo/visual.css`

**Step 1: Remover o state e ref do textarea**

Em `codigo/Tela.tsx`, remover estas linhas:

```tsx
// REMOVER (linha 52):
const textareaRef = useRef<HTMLTextAreaElement>(null)
```

**Step 2: Remover o useEffect de focus-stealing**

Em `codigo/Tela.tsx`, remover o bloco inteiro (linhas 58-70):

```tsx
// REMOVER TUDO:
useEffect(() => {
    if (!editando) return
    textareaRef.current?.focus()
    const interval = setInterval(() => {
        if (editando && textareaRef.current && document.activeElement !== textareaRef.current) {
            textareaRef.current.focus()
        }
    }, 150)
    return () => clearInterval(interval)
}, [editando])
```

**Step 3: Remover o JSX do textarea**

Em `codigo/Tela.tsx`, remover o bloco (linhas 307-325):

```tsx
// REMOVER TUDO:
{editando && (
    <textarea
        ref={textareaRef}
        className="input-invisivel"
        value={textoInput}
        onChange={(e) => setTextoInput(e.target.value)}
        onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleConfirmarTexto()
            }
            if (e.key === 'Escape') {
                setEditando(false)
                setFase('idle')
            }
        }}
        autoFocus
    />
)}
```

**Step 4: Remover onClick do container de interação que focava o textarea**

Em `codigo/Tela.tsx`, simplificar o div `tela-interacao` (linha 270-276):

```tsx
// DE:
<div
    className="tela-interacao"
    ref={interacaoContainerRef}
    onClick={() => {
        if (editando) setTimeout(() => textareaRef.current?.focus(), 50)
    }}
>

// PARA:
<div
    className="tela-interacao"
    ref={interacaoContainerRef}
>
```

**Step 5: Remover os setTimeout que focavam o textarea nos handlers**

Em `handleClickLapis` (linha 160), remover:
```tsx
// REMOVER:
setTimeout(() => textareaRef.current?.focus(), 100)
```

Em `handleConfirmarTexto` (linha 169), remover:
```tsx
// REMOVER:
setTimeout(() => textareaRef.current?.focus(), 100)
```

**Step 6: Remover o CSS do input-invisivel**

Em `codigo/visual.css`, remover o bloco inteiro (linhas 45-59):

```css
/* REMOVER TUDO: */
/* ── TEXTAREA INVISÍVEL ──── ... */
.input-invisivel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
}
```

**Step 7: Verificar que compila**

Run: `cd /c/Users/Aya/Trivial && npx vite build 2>&1 | head -20`
Expected: Build succeeds (pode ter warnings de unused vars, mas sem erros)

**Step 8: Commit**

```bash
git add codigo/Tela.tsx codigo/visual.css
git commit -m "refactor: remove broken textarea and focus-stealing interval

The hidden textarea + setInterval(150ms) approach for capturing keyboard
input in 3D flashcards was unreliable. Removed completely to prepare for
window.addEventListener('keydown') replacement."
```

---

## Task 2: Adicionar captura de teclado via window.addEventListener

**Files:**
- Modify: `codigo/Tela.tsx`

**Step 1: Criar o useEffect de captura de teclado para escrita**

Em `codigo/Tela.tsx`, no lugar do antigo useEffect de focus-stealing, adicionar um novo useEffect que captura teclas quando `editando === true`. Este useEffect fica SEPARADO do useEffect de atalhos gerais (que já existe para Space, 1-4, Escape, F).

Adicionar DEPOIS do comentário `// ── ESTADO DE ESCRITA`:

```tsx
// ── CAPTURA DE TECLADO PARA ESCRITA 3D ────────────────────────
useEffect(() => {
    if (!editando) return

    function handleEscrita(e: KeyboardEvent) {
        // Ignora se foco está num input HTML real (ex: mobile fallback)
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

        // Teclas especiais
        if (e.key === 'Enter') {
            e.preventDefault()
            handleConfirmarTexto()
            return
        }
        if (e.key === 'Escape') {
            e.preventDefault()
            setEditando(false)
            setTextoInput('')
            setTextoFrente('')
            setFase('idle')
            return
        }
        if (e.key === 'Backspace') {
            e.preventDefault()
            setTextoInput(prev => prev.slice(0, -1))
            return
        }

        // Ignora teclas de controle (Shift, Ctrl, Alt, Meta, Tab, arrows, F-keys)
        if (e.key.length > 1) return
        if (e.ctrlKey || e.metaKey || e.altKey) return

        // Caractere normal — adiciona ao texto
        e.preventDefault()
        setTextoInput(prev => prev + e.key)
    }

    window.addEventListener('keydown', handleEscrita)
    return () => window.removeEventListener('keydown', handleEscrita)
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [editando, fase, textoFrente])
```

**Step 2: Ajustar o useEffect de atalhos gerais para não conflitar**

No useEffect existente de atalhos (que lida com Space, 1-4, F, Escape), garantir que as ações de tecla SÓ executam quando `!editando`. O código atual já faz `!isInput` checks, mas precisamos garantir que o `editando` state é respeitado.

Atualizar o useEffect de atalhos (linhas 190-225) — substituir o handler inteiro:

```tsx
useEffect(() => {
    function handleKey(e: KeyboardEvent) {
        // Quando editando, o outro useEffect cuida de tudo
        if (editando) return

        const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement

        // F = free camera (dev)
        if (e.key === 'f' && !isInput) {
            setFreeCamera(prev => !prev)
        }

        // Space = virar carta (se estudando)
        if (e.key === ' ' && fase === 'estudando' && !isInput) {
            e.preventDefault()
            handleClickCarta()
        }

        // 1-4 = avaliar (se virada)
        if (fase === 'virada' && !isInput) {
            const n = parseInt(e.key)
            if (n >= 1 && n <= 4) handleAvaliar(n)
        }

        // Escape = voltar ao quarto
        if (e.key === 'Escape') {
            setView('room')
        }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [fase, editando, indice, fila])
```

**Step 3: Verificar que compila**

Run: `cd /c/Users/Aya/Trivial && npx vite build 2>&1 | head -20`
Expected: Build succeeds

**Step 4: Verificar no browser**

Run: `cd /c/Users/Aya/Trivial && npx vite dev`

Teste manual:
1. Abrir `http://localhost:5173`
2. Clicar na escrivaninha → personagem senta
3. Clicar no lápis → card em branco aparece
4. Digitar "teste" no teclado → letras devem aparecer na frente do card 3D
5. Enter → card vira, verso vazio
6. Digitar "resposta" → letras no verso
7. Enter → card salva
8. Escape em qualquer momento → cancela edição

**Step 5: Commit**

```bash
git add codigo/Tela.tsx
git commit -m "feat: replace textarea with window keydown listener for 3D input

Keyboard input now captured via window.addEventListener('keydown') when
editing. Each keystroke updates textoInput state directly. Backspace
deletes, Enter confirms, Escape cancels. No more focus-stealing."
```

---

## Task 3: Cursor piscante 3D na CartaAtiva

**Files:**
- Modify: `codigo/estudo/CenaInteracao.tsx`

**Step 1: Criar componente CursorPiscante**

Adicionar acima de `CartaAtiva` em `CenaInteracao.tsx`:

```tsx
function CursorPiscante({ position, rotation, fontSize }: {
    position: [number, number, number]
    rotation: [number, number, number]
    fontSize: number
}) {
    const ref = useRef<THREE.Mesh>(null)

    useFrame((s) => {
        if (ref.current) {
            // Pisca a cada 500ms (on/off)
            ref.current.visible = Math.floor(s.clock.elapsedTime * 2) % 2 === 0
        }
    })

    return (
        <Text
            ref={ref}
            position={position}
            rotation={rotation}
            fontSize={fontSize}
            color={C.tinta}
            anchorX="left"
            anchorY="middle"
        >
            |
        </Text>
    )
}
```

**Step 2: Usar CursorPiscante na CartaAtiva**

Dentro de `CartaAtiva`, após o `<Text>` que mostra o texto da frente (o que tem `{textoFrente || (editando ? '|' : '')}`), substituir a lógica do cursor estático pelo componente `CursorPiscante`.

Substituir o `<Text>` da frente (linhas 425-437):

```tsx
{/* ── FRENTE (face +Y) ── */}
<Text
    position={[0, 0.012, -0.42]}
    rotation={[-Math.PI / 2, 0, 0]}
    fontSize={0.05}
    color={C.tintaSuave}
    anchorX="center"
    anchorY="middle"
>
    pergunta
</Text>
<Text
    position={[0, 0.012, 0.05]}
    rotation={[-Math.PI / 2, 0, 0]}
    fontSize={0.1}
    color={C.tinta}
    maxWidth={1.7}
    textAlign="center"
    anchorX="center"
    anchorY="middle"
    lineHeight={1.4}
>
    {textoFrente}
</Text>
{editando && !virada && (
    <CursorPiscante
        position={[0, 0.012, 0.05]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.1}
    />
)}
```

E substituir o `<Text>` do verso (linhas 440-462):

```tsx
{/* ── VERSO (face -Y) ── */}
<Text
    position={[0, -0.012, 0.42]}
    rotation={[Math.PI / 2, 0, Math.PI]}
    fontSize={0.05}
    color={C.tintaSuave}
    anchorX="center"
    anchorY="middle"
>
    resposta
</Text>
<Text
    position={[0, -0.012, -0.05]}
    rotation={[Math.PI / 2, 0, Math.PI]}
    fontSize={0.1}
    color={C.tinta}
    maxWidth={1.7}
    textAlign="center"
    anchorX="center"
    anchorY="middle"
    lineHeight={1.4}
>
    {textoVerso}
</Text>
{editando && virada && (
    <CursorPiscante
        position={[0, -0.012, -0.05]}
        rotation={[Math.PI / 2, 0, Math.PI]}
        fontSize={0.1}
    />
)}
```

**Step 3: Verificar que compila**

Run: `cd /c/Users/Aya/Trivial && npx vite build 2>&1 | head -20`
Expected: Build succeeds

**Step 4: Teste visual no browser**

1. Clicar no lápis → card aparece
2. O cursor `|` deve piscar a cada ~500ms na frente do card
3. Digitar texto → cursor some (texto ocupa o espaço)
4. Enter → card vira → cursor pisca no verso
5. Backspace → apaga, cursor continua piscando

**Step 5: Commit**

```bash
git add codigo/estudo/CenaInteracao.tsx
git commit -m "feat: add blinking 3D cursor for card text input

CursorPiscante component renders a '|' character that toggles visibility
every 500ms via useFrame. Shown on front face when writing question,
on back face when writing answer."
```

---

## Task 4: Suporte mobile — input HTML fora da tela para teclado virtual

**Files:**
- Modify: `codigo/Tela.tsx`
- Modify: `codigo/visual.css`
- Modify: `codigo/estudo/CenaInteracao.tsx`

**Step 1: Adicionar input mobile em Tela.tsx**

Adicionar um `<input>` HTML fora da tela que só existe quando `editando === true`. Este input serve APENAS para que o sistema operacional mobile abra o teclado virtual. Os eventos `input` dele alimentam o mesmo state `textoInput`.

No JSX de `Tela.tsx`, ANTES do `</div>` final (onde antes estava o textarea):

```tsx
{/* ══ INPUT MOBILE (fora da tela, abre teclado virtual do OS) ══ */}
{editando && (
    <input
        ref={mobileInputRef}
        className="input-mobile-offscreen"
        type="text"
        value={textoInput}
        onChange={(e) => setTextoInput(e.target.value)}
        onKeyDown={(e) => {
            if (e.key === 'Enter') {
                e.preventDefault()
                handleConfirmarTexto()
            }
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
    />
)}
```

**Step 2: Adicionar ref e lógica do input mobile**

No bloco de state em `Tela.tsx`, adicionar:

```tsx
const mobileInputRef = useRef<HTMLInputElement>(null)
```

**Step 3: Adicionar botão 3D "teclado" na CenaInteracao**

Em `CenaInteracao.tsx`, adicionar uma nova prop `onAbrirTecladoMobile` e um botão 3D visível:

Na interface `CenaInteracaoProps`, adicionar:
```tsx
onAbrirTecladoMobile?: () => void
```

Adicionar componente simples `BotaoTeclado`:

```tsx
function BotaoTeclado({ onClick }: { onClick: () => void }) {
    const [hover, setHover] = useState(false)

    return (
        <group
            position={[-1.5, 0.08, 1.5]}
            onClick={(e) => { e.stopPropagation(); onClick() }}
            onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
        >
            <RoundedBox args={[0.8, 0.06, 0.4]} radius={0.02} smoothness={2} castShadow>
                <meshStandardMaterial
                    color="#606060"
                    roughness={0.7}
                    emissive={hover ? '#606060' : '#000000'}
                    emissiveIntensity={hover ? 0.2 : 0}
                />
            </RoundedBox>
            <Text
                position={[0, 0.04, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.06}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
            >
                teclado
            </Text>
        </group>
    )
}
```

No JSX principal de `CenaInteracao`, dentro do bloco de escrita:

```tsx
{(fase === 'escrevendo_frente' || fase === 'escrevendo_verso') && onAbrirTecladoMobile && (
    <BotaoTeclado onClick={onAbrirTecladoMobile} />
)}
```

**Step 4: Conectar a prop em Tela.tsx**

Onde `<CenaInteracao>` é renderizado, adicionar:

```tsx
onAbrirTecladoMobile={() => {
    mobileInputRef.current?.focus()
}}
```

**Step 5: Adicionar CSS para input mobile**

Em `codigo/visual.css`, adicionar:

```css
/* ── INPUT MOBILE (fora da tela) ─────────────────────────── */
/* Abre o teclado virtual do OS em dispositivos touch.
   O input fica invisível — o texto aparece no 3D. */

.input-mobile-offscreen {
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
}
```

**Step 6: Verificar que compila**

Run: `cd /c/Users/Aya/Trivial && npx vite build 2>&1 | head -20`

**Step 7: Commit**

```bash
git add codigo/Tela.tsx codigo/visual.css codigo/estudo/CenaInteracao.tsx
git commit -m "feat: add mobile keyboard support with offscreen input

On mobile/tablet, a 3D 'teclado' button opens the OS virtual keyboard
by focusing a hidden <input> element offscreen. Events from this input
feed the same textoInput state as the window keydown listener."
```

---

## Task 5: Animação de "card voa" ao salvar

**Files:**
- Modify: `codigo/estudo/CenaInteracao.tsx`
- Modify: `codigo/Tela.tsx`

**Step 1: Adicionar fase 'salvando' ao fluxo**

Na definição de `FaseEstudo` em `CenaInteracao.tsx` (linha 51), adicionar:

```tsx
export type FaseEstudo =
    | 'idle'
    | 'estudando'
    | 'virada'
    | 'escrevendo_frente'
    | 'escrevendo_verso'
    | 'salvando'       // NOVO — card voa para cima com fade
    | 'concluido'
```

**Step 2: Criar componente CartaVoando**

Adicionar em `CenaInteracao.tsx`:

```tsx
function CartaVoando({ textoFrente, onTerminou }: {
    textoFrente: string
    onTerminou: () => void
}) {
    const ref = useRef<THREE.Group>(null)
    const matRef = useRef<THREE.MeshStandardMaterial>(null)
    const progresso = useRef(0)

    useFrame((_, dt) => {
        progresso.current += dt * 1.5 // Dura ~0.7s
        if (ref.current) {
            // Sobe suavemente
            ref.current.position.y = 0.4 + progresso.current * 2
            // Encolhe ligeiramente
            const escala = Math.max(0, 1 - progresso.current * 0.5)
            ref.current.scale.setScalar(escala)
        }
        if (matRef.current) {
            // Fade out
            matRef.current.opacity = Math.max(0, 1 - progresso.current * 1.4)
        }
        if (progresso.current >= 1) {
            onTerminou()
        }
    })

    return (
        <group ref={ref} position={[0.2, 0.4, 0.5]}>
            <RoundedBox args={[1.9, 0.018, 1.3]} radius={0.03} smoothness={3}>
                <meshStandardMaterial
                    ref={matRef}
                    color={C.papel}
                    roughness={0.88}
                    transparent
                    opacity={1}
                />
            </RoundedBox>
            <Text
                position={[0, 0.012, 0.05]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.1}
                color={C.tinta}
                maxWidth={1.7}
                textAlign="center"
                anchorX="center"
                anchorY="middle"
            >
                {textoFrente}
            </Text>
        </group>
    )
}
```

**Step 3: Usar CartaVoando na cena**

No JSX principal de `CenaInteracao`, adicionar:

```tsx
{fase === 'salvando' && (
    <CartaVoando
        textoFrente={textoFrenteSalvo}
        onTerminou={() => {/* Tela.tsx controla a fase via setTimeout */}}
    />
)}
```

**Step 4: Atualizar Tela.tsx para usar fase 'salvando'**

Em `handleSalvarCarta` de `Tela.tsx`, trocar a transição imediata para idle por uma passagem por `salvando`:

```tsx
async function handleSalvarCarta(frente: string, verso: string) {
    const novaCarta = criarCarta(frente, verso, [], baralhoId)
    const cartasAtualizadas = await adicionarCarta(novaCarta)
    setTodasCartas(cartasAtualizadas)
    const hoje = cartasParaHoje(cartasAtualizadas)
    setFila(hoje)
    setTextoInput('')
    setEditando(false)

    // Animação: card voa por ~0.7s, depois volta a idle
    setFase('salvando')
    setTimeout(() => setFase('idle'), 700)
}
```

**Step 5: Incluir 'salvando' nos mostrarCarta**

A variável `mostrarCarta` em `CenaInteracao` NÃO deve incluir 'salvando' — a CartaVoando substitui a CartaAtiva:

```tsx
const mostrarCarta = fase === 'estudando' || fase === 'virada' ||
    fase === 'escrevendo_frente' || fase === 'escrevendo_verso'
// 'salvando' NÃO mostra CartaAtiva — mostra CartaVoando
```

**Step 6: Verificar que compila e testar**

Run: `cd /c/Users/Aya/Trivial && npx vite build 2>&1 | head -20`

Teste visual:
1. Criar card (lápis → digitar frente → Enter → digitar verso → Enter)
2. Card deve "voar" para cima com fade por ~0.7s
3. Depois, volta a idle (pilha atualizada)

**Step 7: Commit**

```bash
git add codigo/Tela.tsx codigo/estudo/CenaInteracao.tsx
git commit -m "feat: add fly-away animation when saving a new card

New 'salvando' phase triggers CartaVoando component that animates
the card upward with opacity fade over 0.7s. Provides visual feedback
that the card was saved successfully."
```

---

## Task 6: Flip com bounce (overshoot + settle)

**Files:**
- Modify: `codigo/estudo/CenaInteracao.tsx`

**Step 1: Melhorar a animação de flip na CartaAtiva**

O flip atual usa lerp linear. Vamos adicionar overshoot (passa do alvo e volta).

Substituir a lógica de flip em `CartaAtiva.useFrame` (linhas 383-391):

```tsx
useFrame((s, dt) => {
    const tgtFlip = virada ? Math.PI : 0
    const diff = tgtFlip - flip.current

    // Se está longe do alvo, usa spring com overshoot
    if (Math.abs(diff) > 0.01) {
        // Spring com damping (overshoots suavemente)
        velocidadeFlip.current += diff * 25 * dt  // stiffness
        velocidadeFlip.current *= 0.85             // damping (< 1 = underdamped = bounce)
        flip.current += velocidadeFlip.current * dt
    } else {
        flip.current = tgtFlip
        velocidadeFlip.current = 0
    }

    posY.current = THREE.MathUtils.lerp(posY.current, 0.4, dt * 4)

    if (ref.current) {
        ref.current.rotation.x = flip.current
        ref.current.position.y = posY.current
    }
})
```

Adicionar ref para velocidade (junto aos outros refs de CartaAtiva):
```tsx
const velocidadeFlip = useRef(0)
```

**Step 2: Verificar que compila e testar**

Teste visual:
1. Estudar um card → clicar para virar
2. O card deve girar com um leve overshoot (passa do PI e volta)
3. O efeito deve ser sutil — não exagerado

**Step 3: Commit**

```bash
git add codigo/estudo/CenaInteracao.tsx
git commit -m "feat: add spring bounce to card flip animation

Replace linear lerp with underdamped spring physics for card flip.
Card now slightly overshoots target rotation and settles back,
giving a more satisfying tactile feel."
```

---

## Task 7: Feedback visual — brilho verde (acerto) e shake (erro)

**Files:**
- Modify: `codigo/estudo/CenaInteracao.tsx`
- Modify: `codigo/Tela.tsx`

**Step 1: Adicionar state de feedback em Tela.tsx**

Em `Tela.tsx`, adicionar state:

```tsx
const [ultimoFeedback, setUltimoFeedback] = useState<'acerto' | 'erro' | null>(null)
```

Em `handleAvaliar`, ANTES de avançar para o próximo card, adicionar:

```tsx
// Feedback visual
setUltimoFeedback(nota >= 3 ? 'acerto' : 'erro')
setTimeout(() => setUltimoFeedback(null), 600)
```

Passar como prop para `CenaInteracao`:

```tsx
feedback={ultimoFeedback}
```

**Step 2: Adicionar prop feedback na CenaInteracao**

Na interface `CenaInteracaoProps`, adicionar:

```tsx
feedback?: 'acerto' | 'erro' | null
```

**Step 3: Usar feedback na CartaAtiva**

Adicionar prop `feedback` em `CartaAtiva`:

```tsx
function CartaAtiva({
    textoFrente,
    textoVerso,
    virada,
    editando,
    feedback,
    onClick,
}: {
    textoFrente: string
    textoVerso: string
    virada: boolean
    editando: boolean
    feedback?: 'acerto' | 'erro' | null
    onClick: () => void
}) {
```

No material do `RoundedBox` do corpo da carta, usar emissive baseado no feedback:

```tsx
<RoundedBox args={[1.9, 0.018, 1.3]} radius={0.03} smoothness={3} castShadow receiveShadow>
    <meshStandardMaterial
        color={C.papel}
        roughness={0.88}
        emissive={feedback === 'acerto' ? '#40a050' : feedback === 'erro' ? '#c04040' : '#000000'}
        emissiveIntensity={feedback ? 0.4 : 0}
    />
</RoundedBox>
```

Para o shake no erro, adicionar no useFrame (atualizar assinatura de `useFrame((_, dt) =>` para `useFrame((s, dt) =>`):

```tsx
// Shake no erro
if (feedback === 'erro' && ref.current) {
    ref.current.position.x = 0.2 + Math.sin(s.clock.elapsedTime * 40) * 0.03
} else if (ref.current && !feedback) {
    ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, 0.2, dt * 8)
}
```

**Step 4: Passar feedback prop no JSX**

Onde `CartaAtiva` é renderizado em `CenaInteracao`:

```tsx
<CartaAtiva
    key={cartaAtual?.id ?? `new-${fase}`}
    textoFrente={displayFrente}
    textoVerso={displayVerso}
    virada={cartaVirada}
    editando={cartaEditando}
    feedback={feedback}
    onClick={onClickCarta}
/>
```

**Step 5: Verificar que compila e testar**

Teste visual:
1. Estudar card → virar → clicar "Bom" ou "Fácil" → brilho verde na borda por 0.6s
2. Estudar card → virar → clicar "Errei" → card treme + brilho vermelho por 0.6s

**Step 6: Commit**

```bash
git add codigo/Tela.tsx codigo/estudo/CenaInteracao.tsx
git commit -m "feat: add visual feedback on card evaluation

Green glow for correct answers (Good/Easy), red glow + shake for
errors (Again). Feedback lasts 600ms with emissive material change
and horizontal oscillation for shake effect."
```

---

## Task 8: Post-it 3D de streak na mesa

**Files:**
- Modify: `codigo/estudo/CenaInteracao.tsx`

**Step 1: Criar componente PostItStreak**

Adicionar em `CenaInteracao.tsx`:

```tsx
function PostItStreak({ acertos }: { acertos: number }) {
    const ref = useRef<THREE.Group>(null)

    useFrame((s) => {
        if (ref.current) {
            // Leve balanço como post-it grudado
            ref.current.rotation.z = Math.sin(s.clock.elapsedTime * 1.2) * 0.03
        }
    })

    if (acertos === 0) return null

    return (
        <group ref={ref} position={[-2.3, 0.09, -0.8]} rotation={[-Math.PI / 2 + 0.05, 0, 0.1]}>
            {/* Post-it amarelo */}
            <RoundedBox args={[0.5, 0.003, 0.5]} radius={0.02} smoothness={2} castShadow>
                <meshStandardMaterial color="#f8e44a" roughness={0.9} />
            </RoundedBox>
            {/* Número grande */}
            <Text
                position={[0, 0.005, -0.05]}
                rotation={[0, 0, 0]}
                fontSize={0.18}
                color="#5a4a00"
                anchorX="center"
                anchorY="middle"
            >
                {acertos}
            </Text>
            {/* Label */}
            <Text
                position={[0, 0.005, 0.15]}
                rotation={[0, 0, 0]}
                fontSize={0.055}
                color="#7a6a10"
                anchorX="center"
                anchorY="middle"
            >
                acertos
            </Text>
        </group>
    )
}
```

**Step 2: Renderizar no JSX principal**

No JSX de `CenaInteracao`, junto com os objetos decorativos:

```tsx
{/* Post-it de streak */}
{(fase === 'estudando' || fase === 'virada' || fase === 'concluido') && (
    <PostItStreak acertos={stats.acertos} />
)}
```

**Step 3: Verificar e commit**

Run: `cd /c/Users/Aya/Trivial && npx vite build 2>&1 | head -20`

```bash
git add codigo/estudo/CenaInteracao.tsx
git commit -m "feat: add 3D post-it streak counter on desk

Yellow post-it note on the desk corner shows current session accuracy
count. Appears during study and review phases with a subtle wobble
animation."
```

---

## Task 9: Preset de câmera 'shelf' para a estante

**Files:**
- Modify: `codigo/pecas/Camera.tsx`

**Step 1: Adicionar preset 'shelf'**

No objeto `CAMERA` em `Camera.tsx`, adicionar:

```tsx
shelf: {
    // Câmera frontal à estante — para gerenciar decks
    // Estante está em world (-4.0, 0, 2.0) rotacionada 90°
    posX: -0.5,    // vem pela direita para ver a estante de frente
    posY: 4,       // altura moderada (vê as prateleiras)
    posZ: 3,       // Z alinhado com a estante
    focoX: -4.0,   // aponta para a estante
    focoY: 0.5,    // centro vertical das prateleiras
    focoZ: 2.0,    // Z da estante
    zoom: 100,     // zoom intermediário — vê toda a estante
    velocidade: 0.08,
},
```

**Step 2: Atualizar o tipo da view**

O tipo `CameraControllerProps.view` já aceita string union. Atualizar para incluir 'shelf':

```tsx
interface CameraControllerProps {
    view: 'room' | 'desk' | 'bed' | 'notebook' | 'reading' | 'shelf'
}
```

**Step 3: Verificar que compila e commit**

```bash
git add codigo/pecas/Camera.tsx
git commit -m "feat: add 'shelf' camera preset for deck management

New camera preset focuses on the bookshelf area where deck management
UI will live. Moderate zoom showing all shelves from a frontal angle."
```

---

## Task 10: Estante interativa — componente base com caixas por deck

**Files:**
- Create: `codigo/pecas/Estante.tsx`

**Step 1: Criar o componente Estante.tsx**

```tsx
/*
 * Estante.tsx — Estante interativa com caixas 3D representando decks
 *
 * Cada caixa na prateleira é um deck (matéria).
 * Mostra etiqueta com nome + progresso ("12/30").
 * Click numa caixa → seleciona o deck para estudo.
 */

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

export interface DeckInfo {
    id: string
    nome: string
    cor: string
    totalCartas: number
    cartasHoje: number
}

interface CaixaDeckProps {
    deck: DeckInfo
    posicao: [number, number, number]
    onClick: () => void
}

function CaixaDeck({ deck, posicao, onClick }: CaixaDeckProps) {
    const ref = useRef<THREE.Group>(null)
    const [hover, setHover] = useState(false)

    useFrame((_, dt) => {
        if (ref.current) {
            const tgtY = hover ? posicao[1] + 0.08 : posicao[1]
            ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, tgtY, dt * 8)
        }
    })

    return (
        <group
            ref={ref}
            position={posicao}
            onClick={(e) => { e.stopPropagation(); onClick() }}
            onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
        >
            {/* Corpo da caixa */}
            <RoundedBox args={[0.35, 0.3, 0.25]} radius={0.02} smoothness={2} castShadow>
                <meshStandardMaterial
                    color={deck.cor}
                    roughness={0.85}
                    emissive={hover ? deck.cor : '#000000'}
                    emissiveIntensity={hover ? 0.2 : 0}
                />
            </RoundedBox>

            {/* Etiqueta (faixa branca na frente) */}
            <RoundedBox args={[0.28, 0.12, 0.005]} radius={0.01} smoothness={2}
                position={[0, 0.02, 0.13]}>
                <meshStandardMaterial color="#f4f0e8" roughness={0.9} />
            </RoundedBox>

            {/* Nome do deck */}
            <Text
                position={[0, 0.04, 0.135]}
                fontSize={0.035}
                color="#2a1a10"
                anchorX="center"
                anchorY="middle"
                maxWidth={0.26}
            >
                {deck.nome}
            </Text>

            {/* Progresso */}
            <Text
                position={[0, -0.01, 0.135]}
                fontSize={0.025}
                color="#6a5a4a"
                anchorX="center"
                anchorY="middle"
            >
                {`${deck.cartasHoje}/${deck.totalCartas}`}
            </Text>

            {/* Notificação (!) se tem cartas pendentes */}
            {deck.cartasHoje > 0 && (
                <NotificacaoDeck position={[0.15, 0.2, 0.13]} />
            )}
        </group>
    )
}

function NotificacaoDeck({ position }: { position: [number, number, number] }) {
    const ref = useRef<THREE.Group>(null)

    useFrame((s) => {
        if (ref.current) {
            ref.current.position.y = position[1] + Math.sin(s.clock.elapsedTime * 3) * 0.02
        }
    })

    return (
        <group ref={ref} position={position}>
            <mesh>
                <sphereGeometry args={[0.04, 10, 10]} />
                <meshStandardMaterial
                    color="#e04040"
                    emissive="#e04040"
                    emissiveIntensity={0.5}
                />
            </mesh>
            <Text
                position={[0, 0, 0.03]}
                fontSize={0.035}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
            >
                !
            </Text>
        </group>
    )
}

interface EstanteProps {
    decks: DeckInfo[]
    onDeckClick: (deckId: string) => void
}

export function EstanteInterativa({ decks, onDeckClick }: EstanteProps) {
    // Distribui caixas nas prateleiras (max 3 por prateleira)
    const PRATELEIRA_Y = [0.3, 1.2, 2.1]
    const PRATELEIRA_X = [-0.25, 0.1, 0.45]

    return (
        <group>
            {decks.map((deck, i) => {
                const prateleira = Math.floor(i / 3)
                const posNaPrateleira = i % 3
                if (prateleira >= PRATELEIRA_Y.length) return null

                return (
                    <CaixaDeck
                        key={deck.id}
                        deck={deck}
                        posicao={[
                            PRATELEIRA_X[posNaPrateleira],
                            PRATELEIRA_Y[prateleira],
                            0,
                        ]}
                        onClick={() => onDeckClick(deck.id)}
                    />
                )
            })}
        </group>
    )
}
```

**Step 2: Verificar que compila (não conectado ao Quarto ainda)**

Run: `cd /c/Users/Aya/Trivial && npx vite build 2>&1 | head -20`

**Step 3: Commit**

```bash
git add codigo/pecas/Estante.tsx
git commit -m "feat: create interactive bookshelf component with deck boxes

EstanteInterativa renders 3D boxes on shelves, each representing a
study deck. Shows deck name, progress (cards today/total), and a
bouncing notification indicator when cards are due."
```

---

## Task 11: Integrar estante no Quarto e conectar com Tela.tsx

**Files:**
- Modify: `codigo/pecas/Quarto.tsx`
- Modify: `codigo/Tela.tsx`
- Modify: `codigo/posicoes.ts`

**Step 1: Adicionar callback na interface QuartoProps**

Em `Quarto.tsx`, adicionar na interface:

```tsx
interface QuartoProps {
    onFloorClick?: (pos: THREE.Vector3) => void
    onCamaClick?: () => void
    onMesaClick?: () => void
    onEstanteClick?: () => void  // NOVO
}
```

E no destructuring:
```tsx
export function Quarto({ onFloorClick, onCamaClick, onMesaClick, onEstanteClick }: QuartoProps) {
```

**Step 2: Tornar a estante clicável no Quarto.tsx**

Envolver o grupo da estante com um handler de click. Adicionar ao grupo da estante (linhas 303-323):

```tsx
onClick={(e) => {
    e.stopPropagation()
    onEstanteClick?.()
}}
onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
onPointerOut={() => { document.body.style.cursor = 'auto' }}
```

**Step 3: Adicionar view 'shelf' em Tela.tsx**

Atualizar o tipo `ViewState`:

```tsx
type ViewState = 'room' | 'desk' | 'bed' | 'shelf'
```

**Step 4: Adicionar posição da estante em posicoes.ts**

```tsx
export const POSICAO_ESTANTE = new THREE.Vector3(-3.5, CHAO_Y, 2.0)
```

**Step 5: Conectar no handler do Quarto em Tela.tsx**

Adicionar callback ao `<Quarto>`:

```tsx
onEstanteClick={() => {
    setView('shelf')
    setTargetPosition(POSICAO_ESTANTE)
}}
```

**Step 6: Verificar que compila e testar**

Teste visual:
1. Clicar na estante no quarto → câmera faz zoom lateral para a estante
2. Escape → volta ao room

**Step 7: Commit**

```bash
git add codigo/pecas/Quarto.tsx codigo/Tela.tsx codigo/posicoes.ts
git commit -m "feat: make bookshelf clickable with 'shelf' camera view

Clicking the bookshelf in the room transitions camera to the new
'shelf' preset. Prepares for deck management UI integration."
```

---

## Task 12: Carregar dados de decks e renderizar caixas na estante

**Files:**
- Modify: `codigo/Tela.tsx`

**Step 1: Carregar baralhos com contagem de cartas**

Em `Tela.tsx`, adicionar imports e state:

```tsx
import { carregarBaralhos } from './estudo/store'
import { EstanteInterativa, type DeckInfo } from './pecas/Estante'

// No bloco de state:
const [decksInfo, setDecksInfo] = useState<DeckInfo[]>([])
```

Atualizar `inicializar` para calcular DeckInfo:

```tsx
const inicializar = useCallback(async () => {
    try {
        const baralho = await garantirBaralhoPadrao()
        setBaralhoId(baralho.id)
        const cartas = await carregarCartas()
        setTodasCartas(cartas)
        const hoje = cartasParaHoje(cartas)
        setFila(hoje)
        setStats({ total: hoje.length, acertos: 0, erros: 0 })

        // Calcular info dos decks para a estante
        const baralhos = await carregarBaralhos()
        const infos: DeckInfo[] = baralhos.map(b => {
            const cartasDoDeck = cartas.filter(c => c.baralhoId === b.id)
            const hojeDoDeck = cartasParaHoje(cartasDoDeck)
            return {
                id: b.id,
                nome: b.nome,
                cor: b.cor,
                totalCartas: cartasDoDeck.length,
                cartasHoje: hojeDoDeck.length,
            }
        })
        setDecksInfo(infos)
    } catch (err) {
        console.warn('[Trivial] Erro ao inicializar:', err)
    }
}, [])
```

**Step 2: Renderizar EstanteInterativa no Canvas do quarto**

No Canvas do quarto (tela-quarto), DEPOIS do componente `<Personagem>`, adicionar condicionalmente:

```tsx
{view === 'shelf' && (
    <group position={[-4.0, -2, 2.0]} rotation={[0, Math.PI / 2, 0]}>
        <EstanteInterativa
            decks={decksInfo}
            onDeckClick={(deckId) => {
                setBaralhoId(deckId)
                // Recarrega cartas filtradas pelo deck selecionado
                carregarCartas().then(cartas => {
                    const cartasDoDeck = cartas.filter(c => c.baralhoId === deckId)
                    setTodasCartas(cartasDoDeck)
                    const hoje = cartasParaHoje(cartasDoDeck)
                    setFila(hoje)
                    setStats({ total: hoje.length, acertos: 0, erros: 0 })
                })
                setView('desk')
                setTargetPosition(POSICAO_ESCRIVANINHA)
            }}
        />
    </group>
)}
```

Nota: o `position` usa y=-2 porque o `<Quarto>` pai tem `position={[0, -2, 0]}`, mas a `EstanteInterativa` está FORA do grupo do Quarto, direto no Canvas. Ajustar conforme necessário baseado nos testes visuais.

**Step 3: Importar POSICAO_ESTANTE**

```tsx
import { POSICAO_ESCRIVANINHA, POSICAO_CAMA, POSICAO_ESTANTE } from './posicoes'
```

**Step 4: Verificar que compila e testar**

Teste visual:
1. Clicar estante → câmera vai para shelf
2. Caixas dos decks aparecem nas prateleiras com cores e nomes
3. Clicar numa caixa → personagem vai para a mesa → cartas do deck carregam
4. Escape → volta ao room

**Step 5: Commit**

```bash
git add codigo/Tela.tsx
git commit -m "feat: render interactive deck boxes on bookshelf

Loads deck info from Supabase and renders CaixaDeck components on
the bookshelf. Clicking a deck box loads its cards and transitions
to desk view for studying."
```

---

## Ordem de Implementacao (Resumo)

| Task | O que | Prioridade | ~Tempo |
|---|---|---|---|
| 1 | Remover textarea e setInterval | CRÍTICA | 5 min |
| 2 | Adicionar captura de teclado via keydown | CRÍTICA | 10 min |
| 3 | Cursor piscante 3D | CRÍTICA | 5 min |
| 4 | Suporte mobile (input offscreen) | MÉDIA | 10 min |
| 5 | Animação card voa ao salvar | MÉDIA | 10 min |
| 6 | Flip com bounce (spring) | MÉDIA | 5 min |
| 7 | Feedback visual (verde/shake) | MÉDIA | 10 min |
| 8 | Post-it 3D de streak | BAIXA | 5 min |
| 9 | Preset de câmera 'shelf' | MÉDIA | 3 min |
| 10 | Componente Estante interativa | MÉDIA | 15 min |
| 11 | Integrar estante no Quarto | MÉDIA | 10 min |
| 12 | Carregar decks e renderizar caixas | MÉDIA | 10 min |

**Total estimado: ~100 min de implementação**

### Dependências entre tasks:
- **Tasks 1→2→3** são sequenciais e bloqueantes (input precisa funcionar)
- **Tasks 4-8** são polimento visual (podem ser feitas em qualquer ordem, depois da 3)
- **Tasks 9→10→11→12** são a estante (sequenciais entre si, independentes de 4-8)
- Duas trilhas paralelas possíveis: **[4,5,6,7,8]** e **[9,10,11,12]**
