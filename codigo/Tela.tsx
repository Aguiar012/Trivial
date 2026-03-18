/*
 * Tela.tsx — Componente principal: tela dividida em dois espaços 3D
 *
 * ESQUERDA: visão do quarto (câmera isométrica, personagem, móveis)
 * DIREITA:  visão de interação (mesa em primeira pessoa, flashcards 3D)
 *
 * NENHUM elemento 2D/UI. Tudo é objeto 3D montado na cena.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { Quarto } from './pecas/Quarto'
import { Luz } from './pecas/Luz'
import { Personagem } from './pecas/Personagem'
import { Camera } from './pecas/Camera'
import { CenaInteracao, type FaseEstudo } from './estudo/CenaInteracao'
import { criarCarta, cartasParaHoje, avaliarCarta, previewIntervalos, Rating } from './estudo/fsrs'
import { carregarCartas, carregarBaralhos, adicionarCarta, atualizarCarta, salvarRevisao, garantirBaralhoPadrao } from './estudo/store'
import { EstanteInterativa, type DeckInfo } from './pecas/Estante'
import { Debug3D } from './pecas/Debug3D'
import type { DyCard as _DyCard } from './estudo/tipos'
import type { PreviewIntervalos as _PreviewIntervalos } from './estudo/fsrs'
import { POSICAO_ESCRIVANINHA, POSICAO_CAMA, POSICAO_ESTANTE } from './posicoes'
import { DrawingOverlay } from './estudo/DrawingOverlay'
import { GerenciadorDeck } from './estudo/GerenciadorDeck'
import { type NotificationData } from './pecas/ObjectNotification'
import { type CollisionEvent } from './pecas/PseudoFisica'
import { TopMenu } from './pecas/TopMenu'
type DyCard = _DyCard
type PreviewIntervalos = _PreviewIntervalos
import * as THREE from 'three'

type ViewState = 'room' | 'desk' | 'bed' | 'shelf'

function App() {
    // ── ESTADO DO QUARTO ────────────────────────────────────────
    const [view, setView] = useState<ViewState>('desk')
    const [targetPosition, setTargetPosition] = useState<THREE.Vector3 | null>(null)
    const [skinColor] = useState<string>('#ffcba4')
    const [freeCamera, setFreeCamera] = useState(false)

    // ── ESTADO DO ESTUDO (FSRS) ─────────────────────────────────
    const [fase, setFase] = useState<FaseEstudo>('idle')
    const [fila, setFila] = useState<DyCard[]>([])
    const [indice, setIndice] = useState(0)
    const [baralhoId, setBaralhoId] = useState('')
    const [intervalos, setIntervalos] = useState<PreviewIntervalos | null>(null)
    const [stats, setStats] = useState({ total: 0, acertos: 0, erros: 0 })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_todasCartas, setTodasCartas] = useState<DyCard[]>([])

    // ── DECKS PARA A ESTANTE ──────────────────────────────────────
    const [decksInfo, setDecksInfo] = useState<DeckInfo[]>([])
    const [deckGerenciando, setDeckGerenciando] = useState<DeckInfo | null>(null)

    // ── FEEDBACK VISUAL ─────────────────────────────────────────────
    const [ultimoFeedback, setUltimoFeedback] = useState<'acerto' | 'erro' | null>(null)

    // ── SWIPE HINT OVERLAY ──────────────────────────────────────────
    const [swipeHint, setSwipeHint] = useState<{ dir: 0|1|2|3|4; opacity: number; dx: number }>({ dir: 0, opacity: 0, dx: 0 })

    const stampColors = { 1: '#ea4a4a', 2: '#eaa34a', 3: '#4aeaa3', 4: '#4a95ea' } as const
    const stampText  = { 1: 'ERREI', 2: 'DIFÍCIL', 3: 'BOM', 4: 'FÁCIL' } as const
    const stampIcon  = {
        1: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#ea4a4a" stroke-linecap="round" stroke-linejoin="round"><path d="M30 30L70 70M70 30L30 70" stroke-width="12"/></svg>')}`,
        2: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#eaa34a" stroke-linecap="round" stroke-linejoin="round"><path d="M50 20v40M50 78v6" stroke-width="12"/></svg>')}`,
        3: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#4aeaa3" stroke-linecap="round" stroke-linejoin="round"><path d="M25 55l15 15L75 30" stroke-width="12"/></svg>')}`,
        4: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#4a95ea" stroke-linecap="round" stroke-linejoin="round"><path d="M50 15l10 25h25l-20 15 8 25-23-16-23 16 8-25-20-15h25z" stroke-width="6"/></svg>')}`,
    } as const
    const stampTime  = {
        1: intervalos?.again ?? '',
        2: intervalos?.hard  ?? '',
        3: intervalos?.good  ?? '',
        4: intervalos?.easy  ?? '',
    } as const

    // ── ESTADO DE ESCRITA E RASCUNHOS ──────────────────────────────
    const [textoFrente, setTextoFrente] = useState('')
    const [editando, setEditando] = useState(false)
    const [cartasPendentes, setCartasPendentes] = useState<DyCard[]>([])

    // ── REFS ─────────────────────────────────────────────────────
    const quartoContainerRef = useRef<HTMLDivElement>(null)
    const interacaoContainerRef = useRef<HTMLDivElement>(null)

    // ── PSEUDO-FÍSICA: Ref compartilhada de posição do personagem ────
    const charPositionRef = useRef(new THREE.Vector3())

    /** Quando personagem colide com um móvel, faz ele recuar */
    const handleFisicaColisao = useCallback((e: CollisionEvent) => {
        window.dispatchEvent(new CustomEvent('personagem-bounce', {
            detail: { pushBackDir: e.pushDir, massa: e.massa }
        }))
    }, [])

    // ── INICIALIZAÇÃO ───────────────────────────────────────────

    const inicializar = useCallback(async () => {
        try {
            const baralho = await garantirBaralhoPadrao()
            setBaralhoId(baralho.id)
            const cartas = await carregarCartas()
            setTodasCartas(cartas)
            const hoje = cartasParaHoje(cartas)
            setFila(hoje)
            setStats({ total: hoje.length, acertos: 0, erros: 0 })

            // Calcular info dos decks para a estante (deduplicar por nome)
            const baralhos = await carregarBaralhos()
            const infosRaw: DeckInfo[] = baralhos.map(b => {
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
            // Deduplicar: se dois decks têm o mesmo nome, manter o com mais cartas
            const dedup = new Map<string, DeckInfo>()
            for (const info of infosRaw) {
                const existing = dedup.get(info.nome)
                if (!existing || info.totalCartas > existing.totalCartas) {
                    dedup.set(info.nome, info)
                }
            }
            const infos = Array.from(dedup.values())
            setDecksInfo(infos)
        } catch (err) {
            console.warn('[Trivial] Erro ao inicializar:', err)
        }
    }, [])

    useEffect(() => { inicializar() }, [inicializar])

    // DEBUGGING
    useEffect(() => {
        (window as any).debugFila = fila;
        (window as any).debugIndice = indice;
        (window as any).debugCartaAtual = fila[indice];
        (window as any).debugFase = fase;
    }, [fila, indice, fase])

    // ── DIAGNÓSTICO PLAYWRIGHT (apenas em desenvolvimento) ───────
    // Expõe handlers na window para testes E2E poderem acionar
    // ações sem depender de coordenadas exatas no canvas 3D.
    useEffect(() => {
        if (import.meta.env.DEV) {
            (window as any).__handleClickLapis = handleClickLapis
            ;(window as any).__handleClickPilha = handleClickPilha
            ;(window as any).__handleClickCarta = handleClickCarta
            ;(window as any).__handleAvaliar = handleAvaliar
            ;(window as any).__getEditando = () => editando
        }
    })

    // ── PREVIEW INTERVALOS ──────────────────────────────────────

    useEffect(() => {
        if (fase === 'virada' && fila[indice]) {
            setIntervalos(previewIntervalos(fila[indice]))
        } else {
            setIntervalos(null)
        }
    }, [fase, fila, indice])

    // ── QUANDO SENTA NA MESA → RECARREGA CARTAS ────────────────

    useEffect(() => {
        if (view === 'desk') {
            let ativo = true
            inicializar().then(() => {
                if (ativo) setFase('idle')
            }).catch(() => {})
            return () => { ativo = false }
        } else {
            setFase('idle')
            setEditando(false)
        }
        // Limpa gerenciador de deck ao sair da estante
        if (view !== 'shelf') {
            setDeckGerenciando(null)
        }
    }, [view, inicializar])

    // ── HANDLERS DE INTERAÇÃO 3D ────────────────────────────────

    function handleClickPilha() {
        if (fila.length === 0) return
        setIndice(0)
        setFase('estudando')
    }

    function handleClickCarta() {
        if (fase === 'estudando') {
            setFase('virada')
        }
    }

    async function handleAvaliar(nota: number) {
        const ratingMap: Record<number, typeof Rating.Again | typeof Rating.Hard | typeof Rating.Good | typeof Rating.Easy> = {
            1: Rating.Again,
            2: Rating.Hard,
            3: Rating.Good,
            4: Rating.Easy,
        }
        const rating = ratingMap[nota]
        if (!rating || !fila[indice]) return

        const carta = fila[indice]
        const { cartaAtualizada, registro } = avaliarCarta(carta, rating)
        const cartasAtualizadas = await atualizarCarta(cartaAtualizada)
        setTodasCartas(cartasAtualizadas)
        await salvarRevisao(carta.id, registro.log)

        setStats(prev => ({
            ...prev,
            acertos: prev.acertos + (nota >= 3 ? 1 : 0),
            erros: prev.erros + (nota === 1 ? 1 : 0),
        }))

        // Feedback visual
        setUltimoFeedback(nota >= 3 ? 'acerto' : 'erro')
        setTimeout(() => setUltimoFeedback(null), 600)

        // Limpa o overlay de swipe hint
        setSwipeHint({ dir: 0, opacity: 0, dx: 0 })

        if (indice + 1 < fila.length) {
            setIndice(indice + 1)
            setFase('estudando')
        } else {
            setFase('concluido')
        }
    }

    function handleClickLapis() {
        setFase('escrevendo_frente')
        setEditando(true)
    }

    function handleConfirmarDesenho(svgString: string) {
        if (fase === 'escrevendo_frente') {
            setTextoFrente(svgString)
            setFase('escrevendo_verso')
        } else if (fase === 'escrevendo_verso') {
            handleSalvarCarta(textoFrente, svgString)
        }
    }

    function handleCancelarEscrita() {
        setEditando(false)
        setTextoFrente('')
        setFase('idle')
    }

    async function handleSalvarCarta(frente: string, verso: string) {
        // Cria a carta em memória e acumula na mesa
        const novaCarta = criarCarta(frente, verso, [], baralhoId)
        
        // Adiciona à pilha de rascunhos (fica na mesa)
        setCartasPendentes(prev => [...prev, novaCarta])
        
        // Mostra animação rápida de "salvo" e volta ao idle
        setFase('salvando')
        setEditando(false)
        setTextoFrente('')
        setTimeout(() => setFase('idle'), 800)
    }

    async function handleGuardarTodas() {
        if (cartasPendentes.length === 0) return
        
        // Salva todas as cartas no banco de dados
        for (const carta of cartasPendentes) {
            await adicionarCarta(carta)
        }
        
        // Limpa rascunhos e recarrega tudo
        setCartasPendentes([])
        await inicializar()
    }

    // ── ATALHOS DE TECLADO (apenas quando NÃO editando) ─────────
    // Quando editando, o textarea offscreen captura tudo nativamente.

    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
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

    // ── NOTIFICAÇÕES GLOBAIS ────────────────────────────────────
    
    // Motor de notificações: mapeia alvos (desk, bed, etc) para dados visuais.
    const notifications: Record<string, NotificationData> = {}
    
    const pendenciasOutrosDecks = decksInfo
        .filter(d => d.id !== baralhoId)
        .reduce((sum, d) => sum + d.cartasHoje, 0)

    const pendenciasMesa = fila.length
    const pendenciasTotais = pendenciasMesa + pendenciasOutrosDecks

    // Notificação da Mesa (Desk)
    if (view !== 'desk') {
        if (pendenciasMesa > 0) {
            notifications['desk'] = {
                type: 'count',
                value: pendenciasMesa,
                color: '#f39c12'
            }
        } else {
            notifications['desk'] = {
                type: 'success',
                value: 'OK',
                color: '#27ae60' // Verde para finalizado
            }
        }
    }

    // Notificação da Estante (Shelf)
    if (view !== 'shelf' && pendenciasOutrosDecks > 0) {
        notifications['shelf'] = {
            type: 'count',
            value: pendenciasOutrosDecks,
            color: '#e74c3c' // Vermelho/Laranja mais forte
        }
    }

    // Notificação da Cama (Bed)
    if (view !== 'bed' && pendenciasTotais === 0 && decksInfo.length > 0) {
        // Só mostra zzZ se não há nada pendente no total E já carregou a info (decksInfo.length > 0)
        notifications['bed'] = {
            type: 'sleep',
            value: 'Zzz',
            color: '#8e44ad' // Roxo sonolento
        }
    }

    // ── RENDER ──────────────────────────────────────────────────

    return (
        <div className={`tela-split ${(view === 'desk' || deckGerenciando) ? 'view-desk' : 'view-other'}`}>

            {/* ══ INTERFACE 2D (Overlay) ══ */}
            <TopMenu />

            {/* ══ LADO ESQUERDO: Quarto 3D ══ */}
            <div className="tela-quarto" ref={quartoContainerRef}>
                <Canvas shadows orthographic camera={{ position: [10, 10, 10], zoom: 40, near: 0.1, far: 100 }} eventSource={quartoContainerRef as React.MutableRefObject<HTMLDivElement>} eventPrefix="offset">
                    {!freeCamera && <Camera view={view} />}
                    {freeCamera && <OrbitControls />}
                    <Luz />
                    <Quarto
                        onFloorClick={(pos: THREE.Vector3) => {
                            setTargetPosition(pos)
                            setView('room')
                        }}
                        onCamaClick={() => {
                            setView('bed')
                            setTargetPosition(POSICAO_CAMA)
                        }}
                        onMesaClick={() => {
                            setView('desk')
                            setTargetPosition(POSICAO_ESCRIVANINHA)
                        }}
                        onEstanteClick={() => {
                            setView('shelf')
                            setTargetPosition(POSICAO_ESTANTE)
                        }}
                        notifications={notifications}
                        charPositionRef={charPositionRef}
                        onFisicaColisao={handleFisicaColisao}
                        view={view}
                    />
                    <Personagem view={view} targetPosition={targetPosition} skinColor={skinColor} cartaSegurada={null} positionRef={charPositionRef} />

                    {targetPosition && view === 'room' && (
                        <mesh position={[targetPosition.x, targetPosition.y + 0.05, targetPosition.z]} rotation={[-Math.PI / 2, 0, 0]}>
                            <ringGeometry args={[0.2, 0.25, 32]} />
                            <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
                        </mesh>
                    )}

                    {view === 'shelf' && (
                        <group position={[-4.0, -2, 2.0]} rotation={[0, Math.PI / 2, 0]}>
                            <EstanteInterativa
                                decks={decksInfo}
                                onDeckClick={(deckId) => {
                                    const deck = decksInfo.find(d => d.id === deckId)
                                    if (deck) {
                                        setDeckGerenciando(deck)
                                    }
                                }}
                            />
                        </group>
                    )}

                    <Environment preset="sunset" />
                    <Debug3D />
                    <EffectComposer>
                        <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={0.5} />
                        <Vignette darkness={0.5} offset={0.3} />
                    </EffectComposer>
                </Canvas>
            </div>

            {/* ══ LADO DIREITO: Mesa de interação 3D OU Gerenciador de Deck ══ */}
            <div className="tela-interacao-wrapper">
                <div
                    className="tela-interacao"
                    ref={interacaoContainerRef}
                >
                    {deckGerenciando ? (
                        <GerenciadorDeck
                            deckId={deckGerenciando.id}
                            deckNome={deckGerenciando.nome}
                            deckCor={deckGerenciando.cor}
                            onClose={() => setDeckGerenciando(null)}
                            onCartasChanged={() => inicializar()}
                            onEstudarDeck={(deckId) => {
                                setBaralhoId(deckId)
                                carregarCartas().then(cartas => {
                                    const cartasDoDeck = cartas.filter(c => c.baralhoId === deckId)
                                    setTodasCartas(cartasDoDeck)
                                    const hoje = cartasParaHoje(cartasDoDeck)
                                    setFila(hoje)
                                    setStats({ total: hoje.length, acertos: 0, erros: 0 })
                                })
                                setDeckGerenciando(null)
                                setView('desk')
                                setTargetPosition(POSICAO_ESCRIVANINHA)
                            }}
                        />
                    ) : (
                        <Canvas
                            shadows
                            camera={{
                                position: typeof window !== 'undefined' && window.innerWidth < 768
                                    ? [0.2, 2.0, 1.2]
                                    : [0.5, 4.0, 2.8],
                                fov: typeof window !== 'undefined' && window.innerWidth < 768
                                    ? 65
                                    : 58,
                                near: 0.1,
                                far: 50
                            }}
                            eventSource={interacaoContainerRef as React.MutableRefObject<HTMLDivElement>}
                            eventPrefix="offset"
                            onCreated={() => {
                                requestAnimationFrame(() => {
                                    window.dispatchEvent(new Event('resize'));
                                });
                            }}
                        >
                            <CenaInteracao
                                ativo={view === 'desk'}
                                fase={fase}
                                cartaAtual={fila[indice] ?? null}
                                textoFrenteSalvo={textoFrente}
                                totalHoje={fila.length}
                                indice={indice}
                                intervalos={intervalos}
                                stats={stats}
                                feedback={ultimoFeedback}
                                onClickPilha={handleClickPilha}
                                onClickCarta={handleClickCarta}
                                onClickLapis={handleClickLapis}
                                onAvaliar={handleAvaliar}
                                textoInput=""
                                onConfirmarTexto={() => {}}
                                onSwipeHint={setSwipeHint}
                                cartasPendentes={cartasPendentes}
                                onGuardarTodas={handleGuardarTodas}
                            />
                        </Canvas>
                    )}
                </div>
            </div>

            <DrawingOverlay
                isVisible={editando}
                title={fase === 'escrevendo_frente' ? "Draw Question (Front)" : "Draw Answer (Back)"}
                onConfirm={handleConfirmarDesenho}
                onCancel={handleCancelarEscrita}
            />

            {/* Swipe hint overlay — renderizado como DOM puro acima do canvas */}
            {swipeHint.dir !== 0 && (() => {
                const mob = typeof window !== 'undefined' && window.innerWidth < 768
                const d = swipeHint.dir as 1|2|3|4
                const col = stampColors[d]
                return (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                        zIndex: 9999,
                        opacity: swipeHint.opacity,
                        transform: `scale(${0.8 + swipeHint.opacity * 0.25}) rotate(${Math.max(-12, Math.min(12, swipeHint.dx * 0.04))}deg)`,
                        transition: 'opacity 0.07s, transform 0.07s',
                    }}>
                        <div style={{
                            width: mob ? '100px' : '160px',
                            height: mob ? '100px' : '160px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: mob ? '10px' : '16px',
                            background: `${col}18`,
                            boxShadow: `0 0 ${mob ? '40px' : '80px'} ${col}88, inset 0 0 ${mob ? '20px' : '40px'} ${col}33`,
                            border: `${mob ? 5 : 8}px solid ${col}`,
                        }}>
                            <img
                                src={stampIcon[d]}
                                style={{
                                    width: mob ? '55px' : '90px',
                                    height: mob ? '55px' : '90px',
                                    filter: `drop-shadow(0 0 ${mob ? '10px' : '18px'} ${col}) brightness(1.3)`
                                }}
                                alt=""
                            />
                        </div>
                        <div style={{
                            color: col,
                            fontSize: mob ? '28px' : '48px',
                            fontWeight: 900,
                            letterSpacing: mob ? '3px' : '6px',
                            textShadow: `0 0 ${mob ? '12px' : '24px'} ${col}cc`,
                            fontFamily: '"Inter","Segoe UI",sans-serif',
                            textTransform: 'uppercase' as const,
                            background: 'rgba(0,0,0,0.6)',
                            padding: mob ? '4px 16px' : '8px 28px',
                            borderRadius: mob ? '8px' : '12px',
                            whiteSpace: 'nowrap' as const,
                        }}>
                            {stampText[d]}
                        </div>
                        {stampTime[d] && (
                            <div style={{
                                marginTop: mob ? '8px' : '14px',
                                background: col,
                                color: '#fff',
                                fontSize: mob ? '18px' : '28px',
                                fontWeight: 700,
                                padding: mob ? '4px 16px' : '8px 28px',
                                borderRadius: mob ? '14px' : '24px',
                                boxShadow: `0 ${mob ? '4px 15px' : '8px 30px'} ${col}88`,
                                fontFamily: '"Inter","Segoe UI",sans-serif',
                                whiteSpace: 'nowrap' as const,
                            }}>
                                {stampTime[d]}
                            </div>
                        )}
                    </div>
                )
            })()}

        </div>
    )
}

export default App
