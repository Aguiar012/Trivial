/*
 * ObjectNotification.tsx — Notificações 3D vivas nos objetos do quarto
 *
 * Sistema visual de notificação estilo jogo:
 *   - Ícones flutuantes sobre móveis (mesa, cama, estante)
 *   - Animações de bounce, glow, entrada/saída
 *   - Partículas de brilho ao redor
 *   - Diferentes visuais por tipo (count, alert, info, sleep, sparkle)
 *
 * Inspiração: The Sims (losango verde), Animal Crossing, Kind Words
 */

import { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'

// ── TIPOS ───────────────────────────────────────────────────────────────

export type NotificationType = 'count' | 'alert' | 'info' | 'sleep' | 'sparkle' | 'success'

export interface NotificationData {
    type: NotificationType
    value: string | number
    color?: string
    /** Urgência: controla velocidade da animação (0-1, default 0.5) */
    urgency?: number
}

export interface ObjectNotificationProps {
    data: NotificationData | null
    position: [number, number, number]
    scale?: number
}

// ── CORES E CONFIG POR TIPO ─────────────────────────────────────────────

interface TypeConfig {
    bgColor: string
    glowColor: string
    shape: 'circle' | 'diamond' | 'star' | 'rounded_rect'
    particleCount: number
    particleColor: string
    bounceSpeed: number
    bounceHeight: number
    pulseSpeed: number
    rotates: boolean
}

const TYPE_CONFIGS: Record<NotificationType, TypeConfig> = {
    count: {
        bgColor: '#f39c12',
        glowColor: '#f9d423',
        shape: 'circle',
        particleCount: 4,
        particleColor: '#ffe066',
        bounceSpeed: 2.5,
        bounceHeight: 0.15,
        pulseSpeed: 3.0,
        rotates: false,
    },
    alert: {
        bgColor: '#e74c3c',
        glowColor: '#ff6b6b',
        shape: 'diamond',
        particleCount: 6,
        particleColor: '#ff9999',
        bounceSpeed: 4.0,
        bounceHeight: 0.2,
        pulseSpeed: 5.0,
        rotates: true,
    },
    info: {
        bgColor: '#3498db',
        glowColor: '#74b9ff',
        shape: 'circle',
        particleCount: 3,
        particleColor: '#a6d4ff',
        bounceSpeed: 2.0,
        bounceHeight: 0.1,
        pulseSpeed: 2.5,
        rotates: false,
    },
    sleep: {
        bgColor: '#8e44ad',
        glowColor: '#c39bd3',
        shape: 'rounded_rect',
        particleCount: 2,
        particleColor: '#d7bde2',
        bounceSpeed: 1.2,
        bounceHeight: 0.08,
        pulseSpeed: 1.5,
        rotates: false,
    },
    sparkle: {
        bgColor: '#f1c40f',
        glowColor: '#fff176',
        shape: 'star',
        particleCount: 8,
        particleColor: '#fff9c4',
        bounceSpeed: 3.0,
        bounceHeight: 0.18,
        pulseSpeed: 4.0,
        rotates: true,
    },
    success: {
        bgColor: '#27ae60',
        glowColor: '#69f0ae',
        shape: 'circle',
        particleCount: 5,
        particleColor: '#a5d6a7',
        bounceSpeed: 2.0,
        bounceHeight: 0.12,
        pulseSpeed: 2.0,
        rotates: false,
    },
}

// ── GEOMETRIAS CUSTOMIZADAS ─────────────────────────────────────────────

/** Cria a shape de estrela (para sparkle) */
function createStarShape(outerRadius = 0.22, innerRadius = 0.1, points = 5): THREE.Shape {
    const shape = new THREE.Shape()
    for (let i = 0; i < points * 2; i++) {
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
        const r = i % 2 === 0 ? outerRadius : innerRadius
        const x = Math.cos(angle) * r
        const y = Math.sin(angle) * r
        if (i === 0) shape.moveTo(x, y)
        else shape.lineTo(x, y)
    }
    shape.closePath()
    return shape
}

/** Cria a shape de losango (para alert) */
function createDiamondShape(size = 0.22): THREE.Shape {
    const shape = new THREE.Shape()
    shape.moveTo(0, size)
    shape.lineTo(size * 0.7, 0)
    shape.lineTo(0, -size)
    shape.lineTo(-size * 0.7, 0)
    shape.closePath()
    return shape
}

/** Cria a shape de retângulo arredondado (para sleep/info) */
function createRoundedRectShape(w = 0.55, h = 0.28, r = 0.07): THREE.Shape {
    const shape = new THREE.Shape()
    const hw = w / 2, hh = h / 2
    shape.moveTo(-hw + r, -hh)
    shape.lineTo(hw - r, -hh)
    shape.quadraticCurveTo(hw, -hh, hw, -hh + r)
    shape.lineTo(hw, hh - r)
    shape.quadraticCurveTo(hw, hh, hw - r, hh)
    shape.lineTo(-hw + r, hh)
    shape.quadraticCurveTo(-hw, hh, -hw, hh - r)
    shape.lineTo(-hw, -hh + r)
    shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh)
    return shape
}

// ── COMPONENTE: PARTÍCULAS DE BRILHO ────────────────────────────────────

interface SparkleParticlesProps {
    count: number
    color: string
    radius: number
    speed: number
}

function SparkleParticles({ count, color, radius, speed }: SparkleParticlesProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null)
    const dummy = useMemo(() => new THREE.Object3D(), [])

    // Dados aleatórios de cada partícula
    const [particles, setParticles] = useState<{angle: number, speed: number, orbitRadius: number, yOffset: number, phase: number, size: number}[]>([])

    useEffect(() => {
        setParticles(Array.from({ length: count }, (_, i) => ({
            angle: (i / count) * Math.PI * 2,
            speed: 0.8 + Math.random() * 0.6,
            orbitRadius: radius * (0.7 + Math.random() * 0.5),
            yOffset: (Math.random() - 0.5) * 0.3,
            phase: Math.random() * Math.PI * 2,
            size: 0.015 + Math.random() * 0.015,
        })))
    }, [count, radius])

    useFrame((state) => {
        if (!meshRef.current || particles.length === 0) return
        const t = state.clock.elapsedTime * speed

        for (let i = 0; i < count; i++) {
            const p = particles[i]
            const a = p.angle + t * p.speed

            dummy.position.set(
                Math.cos(a) * p.orbitRadius,
                p.yOffset + Math.sin(t * 2 + p.phase) * 0.1,
                Math.sin(a) * p.orbitRadius
            )

            // Fade in/out baseado na posição orbital
            const fade = (Math.sin(a * 2 + p.phase) + 1) / 2
            const s = p.size * (0.3 + fade * 0.7)
            dummy.scale.setScalar(s)
            dummy.updateMatrix()
            meshRef.current.setMatrixAt(i, dummy.matrix)
        }

        meshRef.current.instanceMatrix.needsUpdate = true
    })

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            <sphereGeometry args={[1, 6, 6]} />
            <meshBasicMaterial
                color={color}
                transparent
                opacity={0.85}
                depthTest={false}
                toneMapped={false}
            />
        </instancedMesh>
    )
}

// ── COMPONENTE: ANEL DE GLOW ────────────────────────────────────────────

function GlowRing({ color, size, speed }: { color: string; size: number; speed: number }) {
    const ringRef = useRef<THREE.Mesh>(null)

    useFrame((state) => {
        if (!ringRef.current) return
        const t = state.clock.elapsedTime * speed
        const mat = ringRef.current.material as THREE.MeshBasicMaterial
        mat.opacity = 0.15 + Math.sin(t) * 0.12
        const s = 1.0 + Math.sin(t * 0.7) * 0.15
        ringRef.current.scale.setScalar(s)
    })

    return (
        <mesh ref={ringRef} position={[0, 0, -0.02]}>
            <ringGeometry args={[size * 0.85, size * 1.3, 32]} />
            <meshBasicMaterial
                color={color}
                transparent
                opacity={0.2}
                depthTest={false}
                side={THREE.DoubleSide}
            />
        </mesh>
    )
}

// ── COMPONENTE: SHAPE DO BADGE ──────────────────────────────────────────

function BadgeShape({ config, urgency }: { config: TypeConfig; urgency: number }) {
    const shapeGeo = useMemo(() => {
        if (config.shape === 'star') {
            return new THREE.ShapeGeometry(createStarShape())
        }
        if (config.shape === 'diamond') {
            return new THREE.ShapeGeometry(createDiamondShape())
        }
        if (config.shape === 'rounded_rect') {
            return new THREE.ShapeGeometry(createRoundedRectShape())
        }
        // circle
        return new THREE.CircleGeometry(0.22, 32)
    }, [config.shape])

    const borderGeo = useMemo(() => {
        if (config.shape === 'star') {
            return new THREE.ShapeGeometry(createStarShape(0.26, 0.12))
        }
        if (config.shape === 'diamond') {
            return new THREE.ShapeGeometry(createDiamondShape(0.26))
        }
        if (config.shape === 'rounded_rect') {
            return new THREE.ShapeGeometry(createRoundedRectShape(0.61, 0.34, 0.08))
        }
        // Para circle, usar um RingGeometry como borda
        return new THREE.RingGeometry(0.22, 0.26, 32)
    }, [config.shape])

    return (
        <>
            {/* Borda / Contorno (branco com leve transparência) */}
            <mesh position={[0, 0, -0.005]} geometry={borderGeo}>
                <meshBasicMaterial
                    color="#ffffff"
                    transparent
                    opacity={0.5 + urgency * 0.3}
                    depthTest={false}
                />
            </mesh>

            {/* Corpo principal */}
            <mesh position={[0, 0, 0]} geometry={shapeGeo}>
                <meshBasicMaterial color={config.bgColor} depthTest={false} />
            </mesh>
        </>
    )
}

// ══════════════════════════════════════════════════════════════════════════
// ── COMPONENTE PRINCIPAL ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

export function ObjectNotification({ data, position, scale = 1.0 }: ObjectNotificationProps) {
    const groupRef = useRef<THREE.Group>(null)
    const innerRef = useRef<THREE.Group>(null)

    // Estado da animação
    const entryProgress = useRef(0)
    const [renderState, setRenderState] = useState<{ visible: boolean; data: NotificationData | null }>({
        visible: false,
        data: null
    })

    // Sincroniza a entrada e saída da notificação
    useEffect(() => {
        if (data && !renderState.visible) {
            // Nova notificação aparecendo
            entryProgress.current = 0
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRenderState({ visible: true, data })
        } else if (data && renderState.visible) {
            // Atualizou a notificação atual
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRenderState({ visible: true, data })
        } else if (!data && renderState.visible) {
            // Notificação foi removida, começa o fade out
            entryProgress.current = 1 // Preparar para encolher no useFrame
            // Deixa visible true temporariamente para tocar a animação
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRenderState(prev => ({ ...prev, data: null }))
        }
    }, [data, renderState.visible])

    // Loop de animação principal
    useFrame((state, dt) => {
        if (!groupRef.current || !innerRef.current) return

        const t = state.clock.elapsedTime
        const isExiting = renderState.visible && !renderState.data

        // ── Animação de entrada e saída ──
        if (isExiting) {
             const currentScale = groupRef.current.scale.x
             if (currentScale > 0.01) {
                 // Encolhe
                 groupRef.current.scale.setScalar(currentScale * 0.85)
             } else {
                 // Terminou de sair
                 setRenderState({ visible: false, data: null })
             }
        } else if (entryProgress.current < 1) {
            entryProgress.current = Math.min(1, entryProgress.current + dt * 4)
            const p = entryProgress.current
            // Ease out elastic
            const elastic = p < 1
                ? 1 - Math.pow(2, -10 * p) * Math.cos(p * Math.PI * 3)
                : 1
            groupRef.current.scale.setScalar(scale * elastic)
        }

        const activeData = renderState.data
        if (!activeData) return

        const config = TYPE_CONFIGS[activeData.type] || TYPE_CONFIGS['info']
        const urgency = activeData.urgency ?? 0.5
        const urgMult = 0.7 + urgency * 0.6

        // ── Bounce (sobe e desce) ──
        const bounceY = Math.sin(t * config.bounceSpeed * urgMult) * config.bounceHeight
        innerRef.current.position.y = bounceY

        // ── Pulso de escala ──
        const pulse = 1.0 + Math.sin(t * config.pulseSpeed * urgMult) * 0.08
        innerRef.current.scale.setScalar(pulse)

        // ── Rotação suave (para tipos que giram) ──
        if (config.rotates) {
            innerRef.current.rotation.z = Math.sin(t * 1.5) * 0.12
        }
    })

    if (!renderState.visible) return null

    const activeData = renderState.data
    const config = activeData ? TYPE_CONFIGS[activeData.type] : TYPE_CONFIGS['info']
    const textStr = activeData ? String(activeData.value) : ''
    const urgency = activeData?.urgency ?? 0.5
    const bgColor = activeData?.color || config.bgColor

    // Override config color if data has custom color
    const finalConfig = activeData?.color ? { ...config, bgColor, glowColor: activeData.color } : config

    return (
        <group ref={groupRef} position={position} scale={scale}>
            {/* Billboard: sempre virado pra câmera */}
            <Billboard>
                <group ref={innerRef}>

                    {/* ── Glow Ring (anel de luz) ── */}
                    <GlowRing
                        color={finalConfig.glowColor}
                        size={0.22}
                        speed={finalConfig.pulseSpeed * (0.7 + urgency * 0.6)}
                    />

                    {/* ── Badge Shape (forma do fundo) ── */}
                    <BadgeShape config={finalConfig} urgency={urgency} />

                    {/* ── Texto 3D nativo via troika-three-text (sem DOM, sem Html) ── */}
                    <Text
                        position={[0, 0, 0.025]}
                        fontSize={activeData?.type === 'count' ? 0.18 : 0.13}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                        outlineWidth={0.006}
                        outlineColor="rgba(0,0,0,0.6)"
                    >
                        {textStr}
                    </Text>

                </group>
            </Billboard>

            {/* ── Partículas de brilho (fora do billboard para orbitar em 3D) ── */}
            <SparkleParticles
                count={finalConfig.particleCount}
                color={finalConfig.particleColor}
                radius={0.4}
                speed={finalConfig.pulseSpeed * 0.4}
            />
        </group>
    )
}
