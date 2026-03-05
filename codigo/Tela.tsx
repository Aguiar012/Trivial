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
import { carregarCartas, adicionarCarta, atualizarCarta, salvarRevisao, garantirBaralhoPadrao } from './estudo/store'
import type { DyCard as _DyCard } from './estudo/tipos'
import type { PreviewIntervalos as _PreviewIntervalos } from './estudo/fsrs'
import { POSICAO_ESCRIVANINHA, POSICAO_CAMA } from './posicoes'
type DyCard = _DyCard
type PreviewIntervalos = _PreviewIntervalos
import * as THREE from 'three'

type ViewState = 'room' | 'desk' | 'bed'

function App() {
    // ── ESTADO DO QUARTO ────────────────────────────────────────
    const [view, setView] = useState<ViewState>('room')
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

    // ── ESTADO DE ESCRITA (textarea invisível) ──────────────────
    const [textoInput, setTextoInput] = useState('')
    const [textoFrente, setTextoFrente] = useState('')
    const [editando, setEditando] = useState(false)

    // ── REFS PARA EVENT SOURCE (fix multi-Canvas click bug) ─────
    const quartoContainerRef = useRef<HTMLDivElement>(null)
    const interacaoContainerRef = useRef<HTMLDivElement>(null)

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
        } catch (err) {
            console.warn('[Trivial] Erro ao inicializar:', err)
        }
    }, [])

    useEffect(() => { inicializar() }, [inicializar])

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
            inicializar().then(() => setFase('idle')).catch(() => {})
        } else {
            setFase('idle')
            setEditando(false)
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

        if (indice + 1 < fila.length) {
            setIndice(indice + 1)
            setFase('estudando')
        } else {
            setFase('concluido')
        }
    }

    function handleClickLapis() {
        setTextoInput('')
        setTextoFrente('')
        setFase('escrevendo_frente')
        setEditando(true)
    }

    function handleConfirmarTexto() {
        if (fase === 'escrevendo_frente') {
            if (!textoInput.trim()) return
            setTextoFrente(textoInput.trim())
            setTextoInput('')
            setFase('escrevendo_verso')
        } else if (fase === 'escrevendo_verso') {
            if (!textoInput.trim()) return
            handleSalvarCarta(textoFrente, textoInput.trim())
        }
    }

    async function handleSalvarCarta(frente: string, verso: string) {
        const novaCarta = criarCarta(frente, verso, [], baralhoId)
        const cartasAtualizadas = await adicionarCarta(novaCarta)
        setTodasCartas(cartasAtualizadas)
        const hoje = cartasParaHoje(cartasAtualizadas)
        setFila(hoje)
        setTextoInput('')
        setTextoFrente('')
        setEditando(false)
        setFase('idle')
    }

    // ── ATALHOS DE TECLADO ──────────────────────────────────────

    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement

            // F = free camera (dev)
            if (e.key === 'f' && !editando && !isInput) {
                setFreeCamera(prev => !prev)
            }

            // Space = virar carta (se estudando e não editando)
            if (e.key === ' ' && fase === 'estudando' && !isInput) {
                e.preventDefault()
                handleClickCarta()
            }

            // 1-4 = avaliar (se virada e não editando)
            if (fase === 'virada' && !isInput) {
                const n = parseInt(e.key)
                if (n >= 1 && n <= 4) handleAvaliar(n)
            }

            // Escape = voltar ao quarto
            if (e.key === 'Escape') {
                if (editando) {
                    setEditando(false)
                    setFase('idle')
                } else {
                    setView('room')
                }
            }
        }

        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fase, editando, indice, fila])

    // ── RENDER ──────────────────────────────────────────────────

    return (
        <div className="tela-split">

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
                    />
                    <Personagem view={view} targetPosition={targetPosition} skinColor={skinColor} />

                    {targetPosition && view === 'room' && (
                        <mesh position={[targetPosition.x, targetPosition.y + 0.05, targetPosition.z]} rotation={[-Math.PI / 2, 0, 0]}>
                            <ringGeometry args={[0.2, 0.25, 32]} />
                            <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
                        </mesh>
                    )}

                    <Environment preset="sunset" />
                    <EffectComposer>
                        <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={0.5} />
                        <Vignette darkness={0.5} offset={0.3} />
                    </EffectComposer>
                </Canvas>
            </div>

            {/* ══ LADO DIREITO: Mesa de interação 3D ══ */}
            <div
                className="tela-interacao"
                ref={interacaoContainerRef}
            >
                <Canvas
                    shadows
                    camera={{ position: [0, 4.5, 2.5], fov: 50, near: 0.1, far: 50 }}
                    eventSource={interacaoContainerRef as React.MutableRefObject<HTMLDivElement>}
                    eventPrefix="offset"
                >
                    <CenaInteracao
                        ativo={view === 'desk'}
                        fase={fase}
                        cartaAtual={fila[indice] ?? null}
                        textoInput={textoInput}
                        textoFrenteSalvo={textoFrente}
                        totalHoje={fila.length}
                        indice={indice}
                        intervalos={intervalos}
                        stats={stats}
                        onClickPilha={handleClickPilha}
                        onClickCarta={handleClickCarta}
                        onClickLapis={handleClickLapis}
                        onAvaliar={handleAvaliar}
                        onConfirmarTexto={handleConfirmarTexto}
                    />
                    <EffectComposer>
                        <Bloom luminanceThreshold={0.8} luminanceSmoothing={0.4} intensity={0.8} />
                        <Vignette darkness={0.65} offset={0.2} />
                    </EffectComposer>
                </Canvas>
            </div>
        </div>
    )
}

export default App
