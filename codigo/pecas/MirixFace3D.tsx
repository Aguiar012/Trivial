/**
 * MirixFace3D — Rosto estilo Retro "Pixel Art" feito com matriz de geometria 3D.
 * Exibe diferentes rostos (feliz, triste, pensativo, surpreso) mapeados numa grade.
 *
 * SISTEMA DE PERSONALIDADE:
 *   - Clique na tela → reage surpreso
 *   - Clique repetido → fica irritado (progressivamente)
 *   - Muito spam → fica furioso e vermelho
 *   - Deixa quieto → volta ao normal com o tempo
 *   - Dormindo → face sonolenta
 */

import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Tipos e Cores ───────────────────────────────────────────────────────────
type Emotion = 'idle' | 'happy' | 'sad' | 'surprised' | 'curious' | 'sleepy'
    | 'touched' | 'annoyed' | 'angry' | 'furious' | 'love'

const EMOTION_CYCLE: Emotion[] = [
    'idle', 'idle', 'happy', 'idle', 'curious', 'idle', 'sad', 'idle', 'surprised', 'idle'
]

const COLORS: Record<Emotion, THREE.ColorRepresentation> = {
    idle:      0x00eeff,  // Cyan
    happy:     0x50ff90,  // Verde-água
    sad:       0x00eeff,  // Cyan
    curious:   0xffcc00,  // Amarelo
    surprised: 0xff66aa,  // Rosa
    sleepy:    0x7788cc,  // Azul pastel
    touched:   0xffaa44,  // Laranja surpreso
    annoyed:   0xff8833,  // Laranja irritado
    angry:     0xff4422,  // Vermelho irritado
    furious:   0xff0000,  // Vermelho puro
    love:      0xff66cc,  // Rosa amor
}

// ── DEFINIÇÃO DA MATRIX (15 colunas x 9 linhas) ─────────────────────────────
// Cada string tem 15 caracteres. 'X' = pixel aceso, ' ' = apagado.
const FACES: Record<Emotion, string[]> = {
    idle: [
        "               ",
        "  XXXX   XXXX  ",
        "  X  X   X  X  ",
        "  X  X   X  X  ",
        "  XXXX   XXXX  ",
        "               ",
        "               ",
        "    XXXXXXX    ",
        "               ",
    ],
    happy: [
        "               ",
        "  X  X   X  X  ",
        "  XXXX   XXXX  ",
        "  X  X   X  X  ",
        "               ",
        " X           X ",
        "  X         X  ",
        "   XXXXXXXXX   ",
        "               ",
    ],
    sad: [
        "               ",
        "  XXXX   XXXX  ",
        "  X  X   X  X  ",
        "               ",
        "               ",
        "               ",
        "   XXXXXXXXX   ",
        "  X         X  ",
        " X           X ",
    ],
    surprised: [
        "               ",
        "   XX     XX   ",
        "  X  X   X  X  ",
        "  X  X   X  X  ",
        "   XX     XX   ",
        "               ",
        "      XXX      ",
        "     X   X     ",
        "      XXX      ",
    ],
    curious: [
        "               ",
        "  XXXX    XX   ",
        "  X  X   X  X  ",
        "  XXXX   X  X  ",
        "          XX   ",
        "               ",
        "               ",
        "     XXXXXX    ",
        "               ",
    ],
    sleepy: [
        "               ",
        "               ",
        "               ",
        "  XXXX   XXXX  ",
        "               ",
        "               ",
        "               ",
        "    XXXXXXX    ",
        "               ",
    ],

    // ── NOVAS EMOÇÕES DE REAÇÃO ─────────────────────────────────────

    // Tocado/surpreso (olhos arregalados + boca "o")
    touched: [
        "               ",
        "   XX     XX   ",
        "  X  X   X  X  ",
        "  X  X   X  X  ",
        "   XX     XX   ",
        "               ",
        "      XXX      ",
        "     X   X     ",
        "      XXX      ",
    ],

    // Irritado leve (olhos semi-cerrados + boca torta)
    annoyed: [
        "               ",
        "               ",
        "  XXXX   XXXX  ",
        "     X   X     ",
        "               ",
        "               ",
        "               ",
        "      XXXXX    ",
        "               ",
    ],

    // Irritado forte (sobrancelhas + boca tensa)
    angry: [
        " X         X   ",
        "  X       X    ",
        "  XXXX   XXXX  ",
        "     X   X     ",
        "               ",
        "               ",
        "  XXXXXXXXXXX  ",
        "               ",
        "               ",
    ],

    // Furioso (olhos tipo V + dentes)
    furious: [
        "X           X  ",
        " X         X   ",
        "  XXXX   XXXX  ",
        "  X  X   X  X  ",
        "               ",
        "               ",
        " XXXXXXXXXXXXX ",
        " X X X X X X X ",
        " XXXXXXXXXXXXX ",
    ],

    // Amor / carinho (corações nos olhos)
    love: [
        "               ",
        "  X  X   X  X  ",
        "  XXXX   XXXX  ",
        "  XXXX   XXXX  ",
        "   XX     XX   ",
        "               ",
        "  X         X  ",
        "   XXXXXXXXX   ",
        "               ",
    ],
}

// Para piscar os olhos, temporariamente sumimos as linhas superiores da "idle" ou afins.
const BLINK_MASK: string[] = [
        "               ",
        "               ",
        "               ",
        "  XXXX   XXXX  ",
        "               ",
        "               ",
        "               ",
        "               ",
        "               ",
]

const COLS = 15
const ROWS = 9
const TILE_SIZE = 0.05
const GAP = 0.01

// ── Configuração de irritação ────────────────────────────────────────────────
const ANNOYANCE_THRESHOLDS = {
    touched: 1,    // 1 clique = surpreso
    annoyed: 3,    // 3 cliques = irritado leve
    angry: 6,      // 6 cliques = irritado forte
    furious: 10,   // 10+ cliques = furioso
}
const ANNOYANCE_DECAY_TIME = 3000 // ms para o nível de irritação diminuir 1 ponto
const REACTION_DURATION = 1500    // ms que a reação fica visível antes de voltar ao ciclo

interface MirixFace3DProps {
    isAsleep?: boolean
    charPositionRef?: React.MutableRefObject<THREE.Vector3>
    view?: 'room' | 'desk' | 'shelf' | 'bed'
}

export function MirixFace3D({ isAsleep = false, charPositionRef, view = 'room' }: MirixFace3DProps) {
    // Estado atual e ciclo
    const [emotionIdx, setEmotionIdx] = useState(0)
    useEffect(() => {
        const id = setInterval(() => setEmotionIdx(i => i + 1), 4000)
        return () => clearInterval(id)
    }, [])
    
    // ── SISTEMA DE PERSONALIDADE ──────────────────────────────────────
    const [annoyance, setAnnoyance] = useState(0)
    const [reactionEmotion, setReactionEmotion] = useState<Emotion | null>(null)
    const lastClickTime = useRef(0)
    const decayTimer = useRef<ReturnType<typeof setInterval> | null>(null)
    const reactionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const shakeRef = useRef({ active: false, intensity: 0, startTime: 0 })

    // Limpar timers ao desmontar
    useEffect(() => {
        return () => {
            if (decayTimer.current) clearInterval(decayTimer.current)
            if (reactionTimeout.current) clearTimeout(reactionTimeout.current)
        }
    }, [])

    // Decay da irritação com o tempo
    useEffect(() => {
        if (annoyance > 0) {
            decayTimer.current = setInterval(() => {
                setAnnoyance(prev => Math.max(0, prev - 1))
            }, ANNOYANCE_DECAY_TIME)
            return () => { if (decayTimer.current) clearInterval(decayTimer.current) }
        }
    }, [annoyance > 0]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleClick = useCallback(() => {
        const now = performance.now()
        const timeSinceLastClick = now - lastClickTime.current
        lastClickTime.current = now

        // Se clicou muito rápido, irritação aumenta mais
        const boost = timeSinceLastClick < 800 ? 2 : 1
        const newAnnoyance = annoyance + boost

        setAnnoyance(newAnnoyance)

        // Determina a emoção baseada no nível de irritação
        let reaction: Emotion
        if (newAnnoyance >= ANNOYANCE_THRESHOLDS.furious) {
            reaction = 'furious'
        } else if (newAnnoyance >= ANNOYANCE_THRESHOLDS.angry) {
            reaction = 'angry'
        } else if (newAnnoyance >= ANNOYANCE_THRESHOLDS.annoyed) {
            reaction = 'annoyed'
        } else {
            reaction = 'touched'
        }

        setReactionEmotion(reaction)

        // Shake visual (quanto mais irritado, mais intenso)
        shakeRef.current = {
            active: true,
            intensity: Math.min(newAnnoyance * 0.003, 0.025),
            startTime: now,
        }

        // Limpa reação anterior
        if (reactionTimeout.current) clearTimeout(reactionTimeout.current)

        // Volta ao normal depois de um tempo (se não clicar de novo)
        const duration = reaction === 'furious' ? 3000 : REACTION_DURATION
        reactionTimeout.current = setTimeout(() => {
            setReactionEmotion(null)
            shakeRef.current.active = false
        }, duration)
    }, [annoyance])

    // Animação e refs
    const groupRef = useRef<THREE.Group>(null)
    const anim = useRef({
        nextBlink: performance.now() + 2000,
        isBlinking: false,
        emotion: EMOTION_CYCLE[0] as Emotion,
    })

    // Determina emoção final com context awareness
    let emotion: Emotion
    if (isAsleep) {
        emotion = 'sleepy'
    } else if (reactionEmotion) {
        emotion = reactionEmotion
    } else if (view === 'desk') {
        // Feliz quando o usuário está estudando!
        emotion = 'happy'
    } else if (view === 'bed') {
        emotion = 'sleepy'
    } else if (view === 'shelf') {
        emotion = 'curious'
    } else {
        emotion = EMOTION_CYCLE[emotionIdx % EMOTION_CYCLE.length]
    }
    anim.current.emotion = emotion

    // Eye tracking offset (simulado via deslocamento sutil do grupo inteiro)
    const eyeOffset = useRef({ x: 0, y: 0 })

    // Módulos de Matrizes Instanciadas para alta performance com 135 quadradinhos
    const instancedMeshRef = useRef<THREE.InstancedMesh>(null)

    // Precisamos de um dummy matrix para calcular as posições
    const dummy = useMemo(() => new THREE.Object3D(), [])
    const targetColor = useMemo(() => new THREE.Color(), [])
    const currentColor = useRef(new THREE.Color())

    useFrame((_, delta) => {
        const now = performance.now()
        const a = anim.current

        // Lógica de Piscar (não pisca quando está reagindo a cliques, exceto idle/happy/curious/sad)
        const canBlink = !reactionEmotion || reactionEmotion === 'touched'
        if (now > a.nextBlink && !a.isBlinking && emotion !== 'sleepy' && canBlink) {
            a.isBlinking = true
            setTimeout(() => {
                a.isBlinking = false
                // Chance de double blink
                if (Math.random() > 0.6) {
                    setTimeout(() => {
                        a.isBlinking = true
                        setTimeout(() => (a.isBlinking = false), 120)
                    }, 200)
                }
            }, 120)
            a.nextBlink = now + 1500 + Math.random() * 4500
        }

        // Escolhe qual grid usar agora
        let grid = FACES[a.emotion]
        if (a.isBlinking) {
            grid = BLINK_MASK.map((r, i) => {
                if (i <= 4) return r
                return grid[i]
            })
        }

        // Suavizar cor baseada na emoção
        targetColor.set(COLORS[a.emotion])
        currentColor.current.lerp(targetColor, delta * 5)

        // Atualizar InstancedMesh "pixels"
        if (instancedMeshRef.current) {
            let i = 0
            const totalWidth = COLS * TILE_SIZE + (COLS - 1) * GAP
            const totalHeight = ROWS * TILE_SIZE + (ROWS - 1) * GAP
            
            const startX = -totalWidth / 2 + TILE_SIZE / 2
            const startY = totalHeight / 2 - TILE_SIZE / 2

            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const char = grid[r][c]
                    
                    const x = startX + c * (TILE_SIZE + GAP)
                    const y = startY - r * (TILE_SIZE + GAP)
                    
                    dummy.position.set(x, y, 0)
                    
                    const isVisible = char === 'X' || char === 'x'
                    
                    if (isVisible) {
                        dummy.scale.set(1, 1, 1)
                        instancedMeshRef.current.setColorAt(i, currentColor.current)
                    } else {
                        dummy.scale.set(0.01, 0.01, 0.01)
                        instancedMeshRef.current.setColorAt(i, new THREE.Color(0x0a1520))
                    }
                    
                    dummy.updateMatrix()
                    instancedMeshRef.current.setMatrixAt(i, dummy.matrix)
                    i++
                }
            }
            instancedMeshRef.current.instanceMatrix.needsUpdate = true
            if (instancedMeshRef.current.instanceColor) {
                instancedMeshRef.current.instanceColor.needsUpdate = true
            }
        }

        // Bobbing + Shake + Eye Tracking
        if (groupRef.current) {
            const baseY = 0.5 + Math.sin(now * 0.002) * 0.005
            const shake = shakeRef.current

            // Eye tracking: calcula direção do personagem relativa à mesa
            // Mesa está em world [-2.5, 0, -3], Mirix está no local [0, 0.5, -0.68] da mesa
            if (charPositionRef) {
                const charPos = charPositionRef.current
                // Direção do personagem relativo à mesa em world-space
                const dx = charPos.x - (-2.5) // X relativo à mesa
                const dz = charPos.z - (-3)    // Z relativo à mesa
                // Normaliza e limita o offset (max ±0.015 units)
                const maxOffset = 0.015
                const dist = Math.sqrt(dx * dx + dz * dz) || 1
                eyeOffset.current.x = THREE.MathUtils.lerp(
                    eyeOffset.current.x,
                    (dx / dist) * maxOffset,
                    0.03
                )
                eyeOffset.current.y = THREE.MathUtils.lerp(
                    eyeOffset.current.y,
                    Math.max(-maxOffset, Math.min(maxOffset, -(dz / dist) * maxOffset * 0.5)),
                    0.03
                )
            }

            if (shake.active) {
                const elapsed = (now - shake.startTime) / 1000
                const decay = Math.max(0, 1 - elapsed * 0.8)
                const shakeX = Math.sin(elapsed * 45) * shake.intensity * decay
                const shakeY = Math.cos(elapsed * 35) * shake.intensity * 0.5 * decay
                groupRef.current.position.x = shakeX + eyeOffset.current.x
                groupRef.current.position.y = baseY + shakeY + eyeOffset.current.y
            } else {
                // Suaviza incluindo o eye tracking
                groupRef.current.position.x = THREE.MathUtils.lerp(
                    groupRef.current.position.x,
                    eyeOffset.current.x,
                    0.1
                )
                groupRef.current.position.y = baseY + eyeOffset.current.y
            }
        }
    })

    return (
        <group
            ref={groupRef}
            position={[0, 0.5, -0.68]}
            rotation={[-0.05, 0, 0]}
            scale={0.8}
            onClick={(e) => {
                e.stopPropagation()
                handleClick()
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { document.body.style.cursor = 'auto' }}
        >
            {/* Área clicável invisível (maior que os pixels para facilitar o clique) */}
            <mesh visible={false} position={[0, 0, -0.01]}>
                <planeGeometry args={[1.0, 0.6]} />
                <meshBasicMaterial />
            </mesh>

            {/* O InstancedMesh gerencia as 135 "lâmpadas" LED */}
            <instancedMesh 
                ref={instancedMeshRef} 
                args={[undefined as any, undefined as any, COLS * ROWS]}
            >
                <boxGeometry args={[TILE_SIZE, TILE_SIZE, 0.01]} />
                <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </instancedMesh>
        </group>
    )
}
