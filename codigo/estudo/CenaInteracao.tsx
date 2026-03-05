/*
 * CenaInteracao.tsx — Cena 3D: mesa de estudo aconchegante
 *
 * Mesa de madeira rústica com luminária, caderno, lápis dourado, flashcards.
 * Atmosfera quente e intimista — estudar à noite sob a luz de um abajur.
 *
 * TUDO é 3D. Nenhum elemento HTML/2D.
 */

import { useRef, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, RoundedBox, Cylinder } from '@react-three/drei'
import * as THREE from 'three'
import type { DyCard } from './tipos'
import type { PreviewIntervalos } from './fsrs'

// ── CÂMERA ──────────────────────────────────────────────────────────────

function CameraMesa() {
    const { camera } = useThree()
    useFrame(() => { camera.lookAt(0, 0.05, -0.1) })
    return null
}

// ── PALETA DE CORES ─────────────────────────────────────────────────────

const C = {
    mesa:       '#5c3a24',
    mesaBorda:  '#3d2416',
    papel:      '#f4e8d0',
    linha:      '#d0b898',
    tinta:      '#1a0e06',
    tintaSuave: '#7a6050',
    capa:       '#2a3040',
    pagina:     '#f8f0e0',
    lombada:    '#1a2530',
    lapis:      '#e8b830',
    borracha:   '#d06060',
    grafite:    '#404040',
    pontaLapis: '#c09060',
    metal:      '#b8a080',
    metalEsc:   '#8a7060',
    lampada:    '#ffe8c0',
    ceramica:   '#e0d0b8',
    cafe:       '#3a2010',
    fita:       '#a04040',
}

// ── TIPOS EXPORTADOS ────────────────────────────────────────────────────

export type FaseEstudo =
    | 'idle'
    | 'estudando'
    | 'virada'
    | 'escrevendo_frente'
    | 'escrevendo_verso'
    | 'concluido'

export interface CenaInteracaoProps {
    ativo: boolean
    fase: FaseEstudo
    cartaAtual: DyCard | null
    textoInput: string
    textoFrenteSalvo: string
    totalHoje: number
    indice: number
    intervalos: PreviewIntervalos | null
    stats: { total: number; acertos: number; erros: number }
    onClickPilha: () => void
    onClickCarta: () => void
    onClickLapis: () => void
    onAvaliar: (nota: number) => void
    onConfirmarTexto: () => void
    onAbrirTecladoMobile?: () => void
}

// ══════════════════════════════════════════════════════════════════════════
// ── OBJETOS DECORATIVOS ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

function Luminaria() {
    const glowRef = useRef<THREE.PointLight>(null)

    useFrame((s) => {
        if (glowRef.current) {
            // Leve flicker de lâmpada incandescente
            glowRef.current.intensity = 3.0 + Math.sin(s.clock.elapsedTime * 7) * 0.08
        }
    })

    return (
        <group position={[-2.0, 0.08, -1.0]}>
            {/* Base circular de latão */}
            <Cylinder args={[0.18, 0.22, 0.04, 16]} position={[0, 0.02, 0]}>
                <meshStandardMaterial color={C.metal} metalness={0.7} roughness={0.25} />
            </Cylinder>

            {/* Haste inferior */}
            <Cylinder args={[0.022, 0.022, 0.7, 8]} position={[0.03, 0.39, 0]} rotation={[0, 0, 0.08]}>
                <meshStandardMaterial color={C.metal} metalness={0.6} roughness={0.3} />
            </Cylinder>

            {/* Articulação esférica */}
            <mesh position={[0.06, 0.74, 0]}>
                <sphereGeometry args={[0.035, 10, 10]} />
                <meshStandardMaterial color={C.metalEsc} metalness={0.5} roughness={0.4} />
            </mesh>

            {/* Haste superior */}
            <Cylinder args={[0.018, 0.018, 0.4, 8]} position={[0.2, 0.88, 0]} rotation={[0, 0, 0.7]}>
                <meshStandardMaterial color={C.metal} metalness={0.6} roughness={0.3} />
            </Cylinder>

            {/* Abajur cônico */}
            <mesh position={[0.38, 0.92, 0]} rotation={[0, 0, 0.3]}>
                <coneGeometry args={[0.2, 0.24, 16, 1, true]} />
                <meshStandardMaterial
                    color="#c8a060"
                    side={THREE.DoubleSide}
                    roughness={0.8}
                    emissive="#c8a060"
                    emissiveIntensity={0.2}
                />
            </mesh>

            {/* Lâmpada (esfera brilhante) */}
            <mesh position={[0.38, 0.83, 0]}>
                <sphereGeometry args={[0.04, 10, 10]} />
                <meshStandardMaterial
                    color={C.lampada}
                    emissive={C.lampada}
                    emissiveIntensity={4}
                    toneMapped={false}
                />
            </mesh>

            {/* Luz emitida pelo abajur */}
            <pointLight
                ref={glowRef}
                position={[0.38, 0.8, 0]}
                color="#ffcc88"
                intensity={3.0}
                distance={8}
                decay={2}
                castShadow
                shadow-mapSize={[512, 512]}
            />
        </group>
    )
}

function Caneca() {
    return (
        <group position={[2.1, 0.08, -0.2]} rotation={[0, 0.5, 0]}>
            {/* Corpo cerâmico */}
            <Cylinder args={[0.09, 0.075, 0.2, 16]} position={[0, 0.1, 0]}>
                <meshStandardMaterial color={C.ceramica} roughness={0.85} />
            </Cylinder>
            {/* Alça */}
            <mesh position={[0.12, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.05, 0.012, 8, 12, Math.PI]} />
                <meshStandardMaterial color={C.ceramica} roughness={0.85} />
            </mesh>
            {/* Borda */}
            <Cylinder args={[0.095, 0.09, 0.012, 16]} position={[0, 0.205, 0]}>
                <meshStandardMaterial color={C.ceramica} roughness={0.8} />
            </Cylinder>
            {/* Café escuro dentro */}
            <Cylinder args={[0.08, 0.08, 0.003, 16]} position={[0, 0.19, 0]}>
                <meshStandardMaterial color={C.cafe} roughness={0.15} metalness={0.1} />
            </Cylinder>
        </group>
    )
}

function LivrosEmpilhados() {
    return (
        <group position={[-2.3, 0.08, 0.8]}>
            <RoundedBox args={[0.8, 0.06, 0.55]} radius={0.01} smoothness={2}
                position={[0, 0.03, 0]} castShadow>
                <meshStandardMaterial color="#4a3828" roughness={0.92} />
            </RoundedBox>
            <RoundedBox args={[0.75, 0.05, 0.5]} radius={0.01} smoothness={2}
                position={[0.02, 0.085, 0.01]} rotation={[0, 0.05, 0]} castShadow>
                <meshStandardMaterial color="#3a5040" roughness={0.92} />
            </RoundedBox>
            <RoundedBox args={[0.7, 0.04, 0.48]} radius={0.01} smoothness={2}
                position={[-0.02, 0.13, -0.01]} rotation={[0, -0.03, 0]} castShadow>
                <meshStandardMaterial color="#5a3040" roughness={0.92} />
            </RoundedBox>
        </group>
    )
}

function Borracha() {
    return (
        <RoundedBox args={[0.3, 0.1, 0.15]} radius={0.02} smoothness={2}
            position={[2.1, 0.13, 0.5]} rotation={[0, 0.25, 0]} castShadow>
            <meshStandardMaterial color="#f0e8e0" roughness={0.92} />
        </RoundedBox>
    )
}

// ══════════════════════════════════════════════════════════════════════════
// ── OBJETOS INTERATIVOS ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

function Caderno() {
    return (
        <group position={[-1.2, 0.08, 0.1]} rotation={[0, 0.06, 0]}>
            {/* Capa (couro escuro) */}
            <RoundedBox args={[2.2, 0.05, 1.7]} radius={0.02} smoothness={2} castShadow>
                <meshStandardMaterial color={C.capa} roughness={0.95} />
            </RoundedBox>
            {/* Página esquerda */}
            <RoundedBox args={[1.0, 0.018, 1.5]} radius={0.008} smoothness={2}
                position={[-0.55, 0.035, 0]} receiveShadow>
                <meshStandardMaterial color={C.pagina} roughness={0.95} />
            </RoundedBox>
            {/* Página direita */}
            <RoundedBox args={[1.0, 0.018, 1.5]} radius={0.008} smoothness={2}
                position={[0.55, 0.035, 0]} receiveShadow>
                <meshStandardMaterial color={C.pagina} roughness={0.95} />
            </RoundedBox>
            {/* Lombada */}
            <RoundedBox args={[0.06, 0.06, 1.7]} radius={0.01} smoothness={2}
                position={[0, 0.01, 0]}>
                <meshStandardMaterial color={C.lombada} roughness={0.9} />
            </RoundedBox>
            {/* Linhas do caderno */}
            {[-0.45, -0.2, 0.05, 0.3, 0.55].map((z, i) => (
                <mesh key={i} position={[0.55, 0.046, z]}>
                    <boxGeometry args={[0.85, 0.001, 0.002]} />
                    <meshBasicMaterial color={C.linha} transparent opacity={0.35} />
                </mesh>
            ))}
            {/* Texto decorativo */}
            <Text
                position={[0.55, 0.047, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.065}
                color={C.tintaSuave}
                anchorX="center"
                anchorY="middle"
                maxWidth={0.8}
                textAlign="center"
            >
                notas de estudo...
            </Text>
            {/* Fita marcadora */}
            <mesh position={[1.08, 0.03, -0.4]}>
                <boxGeometry args={[0.015, 0.008, 0.35]} />
                <meshStandardMaterial color={C.fita} roughness={0.7} />
            </mesh>
        </group>
    )
}

function Lapis({ onClick }: { onClick: () => void }) {
    const ref = useRef<THREE.Group>(null)
    const [hover, setHover] = useState(false)

    useFrame((s) => {
        if (ref.current) {
            ref.current.position.y = 0.14 + Math.sin(s.clock.elapsedTime * 2.2) * 0.02
            if (hover) {
                ref.current.rotation.y += 0.02
            }
        }
    })

    return (
        <group
            ref={ref}
            position={[1.7, 0.14, -0.8]}
            rotation={[0, 0.3, Math.PI / 2]}
            onClick={(e) => { e.stopPropagation(); onClick() }}
            onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
        >
            {/* Corpo hexagonal */}
            <Cylinder args={[0.032, 0.032, 0.9, 6]} castShadow>
                <meshStandardMaterial
                    color={C.lapis}
                    roughness={0.55}
                    metalness={0.15}
                    emissive={hover ? '#e8b830' : '#000000'}
                    emissiveIntensity={hover ? 0.4 : 0}
                />
            </Cylinder>
            {/* Anel metálico */}
            <Cylinder args={[0.034, 0.034, 0.04, 8]} position={[0, -0.44, 0]}>
                <meshStandardMaterial color="#c0c0c0" metalness={0.7} roughness={0.2} />
            </Cylinder>
            {/* Borracha */}
            <Cylinder args={[0.03, 0.03, 0.05, 8]} position={[0, -0.49, 0]}>
                <meshStandardMaterial color={C.borracha} roughness={0.9} />
            </Cylinder>
            {/* Ponta de madeira */}
            <mesh position={[0, 0.52, 0]}>
                <coneGeometry args={[0.032, 0.14, 6]} />
                <meshStandardMaterial color={C.pontaLapis} roughness={0.85} />
            </mesh>
            {/* Grafite */}
            <mesh position={[0, 0.62, 0]}>
                <coneGeometry args={[0.009, 0.07, 6]} />
                <meshStandardMaterial color={C.grafite} roughness={0.5} />
            </mesh>
        </group>
    )
}

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

function PilhaCartas({ quantidade, onClick }: { quantidade: number; onClick: () => void }) {
    const [hover, setHover] = useState(false)
    const cartas = useMemo(() =>
        Array.from({ length: Math.min(quantidade, 10) }, (_, i) => ({
            key: i,
            ox: (Math.random() - 0.5) * 0.05,
            oz: (Math.random() - 0.5) * 0.03,
            rot: (Math.random() - 0.5) * 0.08,
        }))
    , [quantidade])

    if (quantidade === 0) return null

    return (
        <group
            position={[0.8, 0.08, 0.5]}
            onClick={(e) => { e.stopPropagation(); onClick() }}
            onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
        >
            {cartas.map((c) => (
                <RoundedBox
                    key={c.key}
                    args={[1.4, 0.01, 0.95]}
                    radius={0.02}
                    smoothness={2}
                    position={[c.ox, c.key * 0.011, c.oz]}
                    rotation={[0, c.rot, 0]}
                    castShadow
                >
                    <meshStandardMaterial
                        color={C.papel}
                        roughness={0.9}
                        emissive={hover ? '#f4e8d0' : '#000000'}
                        emissiveIntensity={hover ? 0.15 : 0}
                    />
                </RoundedBox>
            ))}
            <Text
                position={[0, Math.min(quantidade, 10) * 0.011 + 0.03, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.12}
                color={C.tinta}
                anchorX="center"
                anchorY="middle"
            >
                {quantidade} carta{quantidade !== 1 ? 's' : ''}
            </Text>
        </group>
    )
}

// ── CARTA ATIVA (estudo ou escrita) ─────────────────────────────────────

function CartaAtiva({
    textoFrente,
    textoVerso,
    virada,
    editando,
    onClick,
}: {
    textoFrente: string
    textoVerso: string
    virada: boolean
    editando: boolean
    onClick: () => void
}) {
    const ref = useRef<THREE.Group>(null)
    const flip = useRef(0)
    const posY = useRef(0.08)

    useFrame((_, dt) => {
        const tgtFlip = virada ? Math.PI : 0
        flip.current = THREE.MathUtils.lerp(flip.current, tgtFlip, dt * 6)
        posY.current = THREE.MathUtils.lerp(posY.current, 0.4, dt * 4)
        if (ref.current) {
            ref.current.rotation.x = flip.current
            ref.current.position.y = posY.current
        }
    })

    return (
        <group
            ref={ref}
            position={[0.2, 0.08, 0.5]}
            onClick={(e) => { e.stopPropagation(); onClick() }}
            onPointerOver={() => { document.body.style.cursor = editando ? 'text' : 'pointer' }}
            onPointerOut={() => { document.body.style.cursor = 'auto' }}
        >
            {/* Corpo da carta (bordas arredondadas) */}
            <RoundedBox args={[1.9, 0.018, 1.3]} radius={0.03} smoothness={3} castShadow receiveShadow>
                <meshStandardMaterial color={C.papel} roughness={0.88} />
            </RoundedBox>

            {/* Linhas do papel */}
            {[-0.35, -0.12, 0.11, 0.34].map((z, i) => (
                <mesh key={i} position={[0, 0.011, z]}>
                    <boxGeometry args={[1.6, 0.001, 0.002]} />
                    <meshBasicMaterial color={C.linha} transparent opacity={0.2} />
                </mesh>
            ))}

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
        </group>
    )
}

// ── SELOS DE AVALIAÇÃO ──────────────────────────────────────────────────

function SeloItem({ cor, label, intervalo, x, onClick }: {
    cor: string
    label: string
    intervalo?: string
    x: number
    onClick: () => void
}) {
    const [hover, setHover] = useState(false)
    const ref = useRef<THREE.Group>(null)

    useFrame(() => {
        if (ref.current) {
            const tgt = hover ? 0.06 : 0
            ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, tgt, 0.15)
        }
    })

    return (
        <group
            ref={ref}
            position={[x, 0, 0]}
            onClick={(e) => { e.stopPropagation(); onClick() }}
            onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
        >
            {/* Base do selo */}
            <Cylinder args={[0.2, 0.22, 0.12, 16]} castShadow>
                <meshStandardMaterial color={cor} roughness={0.7} />
            </Cylinder>
            {/* Topo */}
            <Cylinder args={[0.16, 0.16, 0.025, 16]} position={[0, 0.07, 0]}>
                <meshStandardMaterial color={cor} roughness={0.5} metalness={0.15} />
            </Cylinder>
            {/* Nome */}
            <Text
                position={[0, 0.13, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.07}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
            >
                {label}
            </Text>
            {/* Intervalo */}
            {intervalo && (
                <Text
                    position={[0, 0.13, 0.15]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    fontSize={0.045}
                    color="#d0d0d0"
                    anchorX="center"
                    anchorY="middle"
                >
                    {intervalo}
                </Text>
            )}
        </group>
    )
}

function SelosAvaliacao({ onAvaliar, intervalos }: {
    onAvaliar: (nota: number) => void
    intervalos: PreviewIntervalos | null
}) {
    const selos = [
        { nota: 1, cor: '#a03040', label: 'Errei',   intervalo: intervalos?.again, x: -0.95 },
        { nota: 2, cor: '#c07848', label: 'Difícil', intervalo: intervalos?.hard,  x: -0.32 },
        { nota: 3, cor: '#408050', label: 'Bom',     intervalo: intervalos?.good,  x: 0.32 },
        { nota: 4, cor: '#b89030', label: 'Fácil',   intervalo: intervalos?.easy,  x: 0.95 },
    ]

    return (
        <group position={[0.2, 0.08, 1.7]}>
            {selos.map((s) => (
                <SeloItem
                    key={s.nota}
                    cor={s.cor}
                    label={s.label}
                    intervalo={s.intervalo}
                    x={s.x}
                    onClick={() => onAvaliar(s.nota)}
                />
            ))}
        </group>
    )
}

// ── SELO CONFIRMAR (escrita) ────────────────────────────────────────────

function SeloConfirmar({ label, onClick }: { label: string; onClick: () => void }) {
    const ref = useRef<THREE.Group>(null)
    const [hover, setHover] = useState(false)

    useFrame((s) => {
        if (ref.current) {
            ref.current.position.y = 0.08
                + Math.sin(s.clock.elapsedTime * 3) * 0.02
                + (hover ? 0.04 : 0)
        }
    })

    return (
        <group
            ref={ref}
            position={[1.8, 0.08, 1.3]}
            onClick={(e) => { e.stopPropagation(); onClick() }}
            onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
        >
            <Cylinder args={[0.25, 0.27, 0.13, 16]} castShadow>
                <meshStandardMaterial
                    color="#4a7a4a"
                    roughness={0.7}
                    emissive={hover ? '#4a7a4a' : '#000000'}
                    emissiveIntensity={hover ? 0.3 : 0}
                />
            </Cylinder>
            <Cylinder args={[0.2, 0.2, 0.025, 16]} position={[0, 0.07, 0]}>
                <meshStandardMaterial color="#4a7a4a" roughness={0.5} metalness={0.15} />
            </Cylinder>
            <Text
                position={[0, 0.13, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.07}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
            >
                {label}
            </Text>
        </group>
    )
}

// ── PROGRESSO (bolinhas 3D) ─────────────────────────────────────────────

function Progresso({ total, indice }: { total: number; indice: number }) {
    if (total === 0 || total > 30) return null

    return (
        <group position={[-2.2, 0.09, 1.8]}>
            {Array.from({ length: total }, (_, i) => (
                <mesh key={i} position={[i * 0.13, 0, 0]}>
                    <sphereGeometry args={[0.03, 8, 8]} />
                    <meshStandardMaterial
                        color={i < indice ? '#408050' : i === indice ? '#ffd700' : '#8a7a6a'}
                        emissive={i === indice ? '#ffd700' : '#000000'}
                        emissiveIntensity={i === indice ? 0.5 : 0}
                    />
                </mesh>
            ))}
        </group>
    )
}

// ── MENSAGEM DE CONCLUSÃO ───────────────────────────────────────────────

function MensagemConclusao({ stats }: { stats: { total: number; acertos: number; erros: number } }) {
    const ref = useRef<THREE.Group>(null)

    useFrame((s) => {
        if (ref.current) {
            ref.current.position.y = 0.6 + Math.sin(s.clock.elapsedTime * 1.5) * 0.04
        }
    })

    return (
        <group ref={ref} position={[0.3, 0.6, 0.4]}>
            <Text
                position={[0, 0.2, 0]}
                rotation={[-0.5, 0, 0]}
                fontSize={0.16}
                color="#f0d8b8"
                anchorX="center"
                anchorY="middle"
            >
                Sessão concluída!
            </Text>
            <Text
                position={[0, 0, 0]}
                rotation={[-0.5, 0, 0]}
                fontSize={0.09}
                color="#c0a898"
                anchorX="center"
                anchorY="middle"
            >
                {`${stats.total} cartas · ${stats.acertos} acertos · ${stats.erros} erros`}
            </Text>
        </group>
    )
}

// ── DICA QUANDO MESA VAZIA ──────────────────────────────────────────────

function DicaVazia() {
    const ref = useRef<THREE.Group>(null)

    useFrame((s) => {
        if (ref.current) {
            ref.current.position.y = 0.3 + Math.sin(s.clock.elapsedTime * 1.8) * 0.025
        }
    })

    return (
        <group ref={ref} position={[0.8, 0.3, 0.5]}>
            <Text
                rotation={[-0.5, 0, 0]}
                fontSize={0.1}
                color="#c0a898"
                anchorX="center"
                anchorY="middle"
                maxWidth={2.2}
                textAlign="center"
            >
                {'Clique no lápis para\nescrever sua primeira carta'}
            </Text>
        </group>
    )
}

// ══════════════════════════════════════════════════════════════════════════
// ── COMPONENTE PRINCIPAL ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

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

export function CenaInteracao({
    ativo,
    fase,
    cartaAtual,
    textoInput,
    textoFrenteSalvo,
    totalHoje,
    indice,
    intervalos,
    stats,
    onClickPilha,
    onClickCarta,
    onClickLapis,
    onAvaliar,
    onConfirmarTexto,
    onAbrirTecladoMobile,
}: CenaInteracaoProps) {

    // Luz ambiente que acompanha o estado ativo/inativo
    const luzAmbRef = useRef<THREE.PointLight>(null)

    useFrame((_, dt) => {
        const alvo = ativo ? 0.4 : 0.15
        if (luzAmbRef.current) {
            luzAmbRef.current.intensity = THREE.MathUtils.lerp(
                luzAmbRef.current.intensity, alvo, dt * 3
            )
        }
    })

    // ── Texto exibido na carta ativa ──

    let displayFrente = ''
    let displayVerso = ''
    let cartaVirada = false
    let cartaEditando = false

    switch (fase) {
        case 'estudando':
            displayFrente = cartaAtual?.frente ?? ''
            displayVerso = cartaAtual?.verso ?? ''
            cartaVirada = false
            break
        case 'virada':
            displayFrente = cartaAtual?.frente ?? ''
            displayVerso = cartaAtual?.verso ?? ''
            cartaVirada = true
            break
        case 'escrevendo_frente':
            displayFrente = textoInput
            displayVerso = ''
            cartaVirada = false
            cartaEditando = true
            break
        case 'escrevendo_verso':
            displayFrente = textoFrenteSalvo
            displayVerso = textoInput
            cartaVirada = true
            cartaEditando = true
            break
    }

    const mostrarCarta = fase === 'estudando' || fase === 'virada' ||
        fase === 'escrevendo_frente' || fase === 'escrevendo_verso'

    return (
        <>
            {/* ── CÂMERA ── */}
            <CameraMesa />

            {/* ── BACKGROUND ── */}
            <color attach="background" args={['#c05565']} />
            <fog attach="fog" args={['#c05565', 5, 12]} />

            {/* ── ILUMINAÇÃO ── */}
            {/* Ambiente coordenado com o Quarto.tsx (coral quente e direcional rosada) */}
            <ambientLight intensity={1.0} color="#e8907a" />
            <pointLight
                ref={luzAmbRef}
                position={[0, 4, 2]}
                intensity={0.8}
                color="#ffcc88"
            />
            <directionalLight position={[2, 5, 3]} intensity={0.6} color="#ffb8a0" />

            {/* ── MESA (superfície com bordas arredondadas) ── */}
            <RoundedBox args={[5.5, 0.14, 4.5]} radius={0.03} smoothness={2}
                position={[0, 0, 0]} receiveShadow castShadow>
                <meshStandardMaterial color={C.mesa} roughness={0.85} />
            </RoundedBox>
            {/* Borda frontal */}
            <RoundedBox args={[5.6, 0.08, 0.1]} radius={0.02} smoothness={2}
                position={[0, 0.04, 2.3]} castShadow>
                <meshStandardMaterial color={C.mesaBorda} roughness={0.9} />
            </RoundedBox>

            {/* ── DECORAÇÃO ── */}
            <Luminaria />
            <Caneca />
            <Borracha />
            <LivrosEmpilhados />

            {/* ── OBJETOS INTERATIVOS ── */}
            <Caderno />
            <Lapis onClick={onClickLapis} />

            {/* Pilha de cartas (quando idle ou concluido) */}
            {(fase === 'idle' || fase === 'concluido') && (
                <PilhaCartas quantidade={totalHoje} onClick={onClickPilha} />
            )}

            {/* Dica quando não tem cartas */}
            {fase === 'idle' && totalHoje === 0 && <DicaVazia />}

            {/* Carta ativa */}
            {mostrarCarta && (
                <CartaAtiva
                    key={cartaAtual?.id ?? `new-${fase}`}
                    textoFrente={displayFrente}
                    textoVerso={displayVerso}
                    virada={cartaVirada}
                    editando={cartaEditando}
                    onClick={onClickCarta}
                />
            )}

            {/* Botão teclado mobile */}
            {(fase === 'escrevendo_frente' || fase === 'escrevendo_verso') && onAbrirTecladoMobile && (
                <BotaoTeclado onClick={onAbrirTecladoMobile} />
            )}

            {/* Selos de avaliação */}
            {fase === 'virada' && (
                <SelosAvaliacao onAvaliar={onAvaliar} intervalos={intervalos} />
            )}

            {/* Selo confirmar (escrita) */}
            {fase === 'escrevendo_frente' && (
                <SeloConfirmar label="→ Verso" onClick={onConfirmarTexto} />
            )}
            {fase === 'escrevendo_verso' && (
                <SeloConfirmar label="✓ Salvar" onClick={onConfirmarTexto} />
            )}

            {/* Progresso */}
            {(fase === 'estudando' || fase === 'virada') && (
                <Progresso total={totalHoje} indice={indice} />
            )}

            {/* Mensagem de conclusão */}
            {fase === 'concluido' && <MensagemConclusao stats={stats} />}
        </>
    )
}
