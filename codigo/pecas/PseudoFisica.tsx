/* eslint-disable react-refresh/only-export-components */
/*
 * PseudoFisica.tsx — Sistema de pseudo-física para o quarto
 *
 * Dá "game feel" sem engine de física real:
 *   - Objetos leves (caneca, livros) deslizam ao serem empurrados
 *   - Objetos pesados (cama, mesa) tremem/sacodem mas voltam ao lugar
 *   - Partículas de poeira surgem no ponto de contato
 *   - Personagem reage ao bater em objetos pesados (bounce-back)
 *
 * Tudo via lerp/spring no useFrame — zero dependências extras.
 */

import { useRef, useMemo, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ══════════════════════════════════════════════════════════════════════════
// ── TIPOS ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

export type MassCategory = 'heavy' | 'medium' | 'light'

export interface FisicaObjetoConfig {
    /** Posição original do objeto (world-space) */
    posicaoOriginal: [number, number, number]
    /** Raio da esfera de colisão */
    raio: number
    /** Categoria de massa */
    massa: MassCategory
    /** ID único do objeto */
    id: string
}

// Configuração por categoria de massa
const MASS_CONFIG: Record<MassCategory, {
    pushStrength: number  // Força do empurrão (0 = não move, 1 = empurra direto)
    returnSpeed: number   // Velocidade de retorno à posição original
    maxDisplace: number   // Deslocamento máximo permitido
    shakeIntensity: number // Intensidade do shake em colisão
    shakeDuration: number  // Duração do shake (segundos)
    friction: number       // Fricção (0 = sem fricção, 1 = para imediatamente)
    dustCount: number      // Quantidade de partículas de poeira
}> = {
    heavy: {
        pushStrength: 0.0,     // Não move
        returnSpeed: 0.0,
        maxDisplace: 0.0,
        shakeIntensity: 0.06,  // Treme bastante
        shakeDuration: 0.5,
        friction: 1.0,
        dustCount: 12,
    },
    medium: {
        pushStrength: 0.3,    // Move um pouco
        returnSpeed: 0.8,     // Volta devagar
        maxDisplace: 0.6,
        shakeIntensity: 0.03,
        shakeDuration: 0.3,
        friction: 0.92,
        dustCount: 8,
    },
    light: {
        pushStrength: 0.8,    // Desliza fácil
        returnSpeed: 0.3,     // Volta bem devagar
        maxDisplace: 1.5,
        shakeIntensity: 0.01,
        shakeDuration: 0.15,
        friction: 0.96,
        dustCount: 5,
    },
}

// ══════════════════════════════════════════════════════════════════════════
// ── NUVEM DE POEIRA (Particle Burst) ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

interface Particula {
    pos: THREE.Vector3
    vel: THREE.Vector3
    vida: number        // 0→1 (0=nasceu, 1=morreu)
    tamanho: number
    velocidadeVida: number
}

export interface NuvemPoeiraRef {
    emitir: (worldPos: THREE.Vector3, direcao: THREE.Vector3, count: number) => void
}

const MAX_PARTICULAS = 60 // Pool máximo
const COR_POEIRA = new THREE.Color('#d4c0a0')

export function NuvemPoeira({ refHandle }: { refHandle: React.MutableRefObject<NuvemPoeiraRef | null> }) {
    const meshRef = useRef<THREE.InstancedMesh>(null)
    const dummy = useMemo(() => new THREE.Object3D(), [])
    const particulas = useRef<Particula[]>([])

    const emitir = useCallback((worldPos: THREE.Vector3, direcao: THREE.Vector3, count: number) => {
        const normalDir = direcao.clone().normalize()

        for (let i = 0; i < count; i++) {
            // Direção base = oposta à colisão + espalhamento aleatório
            const spread = new THREE.Vector3(
                normalDir.x + (Math.random() - 0.5) * 1.5,
                0.4 + Math.random() * 0.8,   // Sempre sobe um pouco
                normalDir.z + (Math.random() - 0.5) * 1.5
            ).normalize()

            const speed = 1.5 + Math.random() * 2.5

            particulas.current.push({
                pos: worldPos.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 0.15,
                    Math.random() * 0.1,
                    (Math.random() - 0.5) * 0.15,
                )),
                vel: spread.multiplyScalar(speed),
                vida: 0,
                tamanho: 0.03 + Math.random() * 0.05,
                velocidadeVida: 1.5 + Math.random() * 1.5, // Morre em ~0.4-0.7s
            })
        }

        // Limita o pool
        if (particulas.current.length > MAX_PARTICULAS) {
            particulas.current = particulas.current.slice(-MAX_PARTICULAS)
        }
    }, [])

    // Expõe o método emitir via ref
    // eslint-disable-next-line react-hooks/immutability
    refHandle.current = { emitir }

    useFrame((_state, dt) => {
        if (!meshRef.current) return

        const vivas: Particula[] = []

        for (let i = 0; i < particulas.current.length; i++) {
            const p = particulas.current[i]

            // Avança vida
            p.vida += dt * p.velocidadeVida
            if (p.vida >= 1) continue // Morreu

            // Física simples: gravidade + arraste
            p.vel.y -= 3.0 * dt          // Gravidade
            p.vel.multiplyScalar(1 - 2.0 * dt) // Arraste do ar
            p.pos.addScaledVector(p.vel, dt)

            // Não desce do chão
            if (p.pos.y < -1.95) {
                p.pos.y = -1.95
                p.vel.y = Math.abs(p.vel.y) * 0.2 // Micro-bounce
                p.vel.x *= 0.5
                p.vel.z *= 0.5
            }

            vivas.push(p)
        }

        particulas.current = vivas

        // Atualiza instanced mesh
        for (let i = 0; i < MAX_PARTICULAS; i++) {
            if (i < vivas.length) {
                const p = vivas[i]
                const fade = 1 - p.vida
                const s = p.tamanho * fade // Encolhe ao morrer
                dummy.position.copy(p.pos)
                dummy.scale.setScalar(s)
            } else {
                dummy.scale.setScalar(0) // Esconde
                dummy.position.set(0, -100, 0)
            }
            dummy.updateMatrix()
            meshRef.current.setMatrixAt(i, dummy.matrix)
        }

        meshRef.current.instanceMatrix.needsUpdate = true

        // Opacity global fade
        const mat = meshRef.current.material as THREE.MeshBasicMaterial
        if (vivas.length > 0) {
            mat.opacity = 0.6
        }
    })

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICULAS]} frustumCulled={false}>
            <sphereGeometry args={[1, 6, 6]} />
            <meshBasicMaterial
                color={COR_POEIRA}
                transparent
                opacity={0.6}
                depthWrite={false}
            />
        </instancedMesh>
    )
}

// ══════════════════════════════════════════════════════════════════════════
// ── HOOK: useFisicaObjeto ───────────────────────────────────────────────
// Retorna ref + offset para um único objeto que reage à posição do personagem
// ══════════════════════════════════════════════════════════════════════════

interface FisicaState {
    offset: THREE.Vector3      // Deslocamento atual em relação à posição original
    velocity: THREE.Vector3    // Velocidade de deslocamento
    shakeTime: number          // Tempo restante de shake
    shakeDir: THREE.Vector3    // Direção do último impacto (para shake direcional)
}

export function useFisicaObjeto(config: FisicaObjetoConfig) {
    const state = useRef<FisicaState>({
        offset: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        shakeTime: 0,
        shakeDir: new THREE.Vector3(),
    })

    const massConf = MASS_CONFIG[config.massa]
    const origin = useMemo(
        () => new THREE.Vector3(...config.posicaoOriginal),
        [config.posicaoOriginal]
    )

    /** Chamado externamente quando detecta colisão */
    const empurrar = useCallback((direcaoEmpurrao: THREE.Vector3, forca: number) => {
        const s = state.current
        const mc = MASS_CONFIG[config.massa]

        if (mc.pushStrength > 0) {
            s.velocity.addScaledVector(direcaoEmpurrao, forca * mc.pushStrength * 3)
        }

        // Sempre ativa shake (até pesados tremem)
        s.shakeTime = mc.shakeDuration
        s.shakeDir.copy(direcaoEmpurrao).normalize()
    }, [config.massa])

    /** Posição final a ser aplicada no group (original + offset + shake) */
    const posicaoFinal = useRef(new THREE.Vector3())

    const atualizar = useCallback((dt: number, elapsedTime: number) => {
        const s = state.current
        const mc = massConf

        // ── Velocidade / Deslocamento ──
        if (mc.pushStrength > 0) {
            // Aplica velocidade
            s.offset.addScaledVector(s.velocity, dt)

            // Fricção
            s.velocity.multiplyScalar(mc.friction)

            // Retorno suave à origem
            s.offset.lerp(new THREE.Vector3(0, 0, 0), mc.returnSpeed * dt)

            // Clamp deslocamento máximo
            if (s.offset.length() > mc.maxDisplace) {
                s.offset.normalize().multiplyScalar(mc.maxDisplace)
            }

            // Zera velocidades muito pequenas
            if (s.velocity.length() < 0.001) s.velocity.set(0, 0, 0)
        }

        // ── Shake ──
        const shakeOffset = new THREE.Vector3(0, 0, 0)
        if (s.shakeTime > 0) {
            s.shakeTime -= dt
            const t = s.shakeTime / mc.shakeDuration // 1→0
            const intensity = mc.shakeIntensity * t * t // Decay quadrático
            const freq = 25 // Frequência do tremor

            shakeOffset.set(
                Math.sin(elapsedTime * freq) * intensity * s.shakeDir.x,
                Math.abs(Math.sin(elapsedTime * freq * 1.3)) * intensity * 0.3,
                Math.cos(elapsedTime * freq * 0.9) * intensity * s.shakeDir.z
            )
        }

        // Posição final
        posicaoFinal.current.copy(origin).add(s.offset).add(shakeOffset)

        return posicaoFinal.current
    }, [origin, massConf])

    return { empurrar, atualizar, state, origin, raio: config.raio }
}

// ══════════════════════════════════════════════════════════════════════════
// ── HOOK: useFisicaQuarto ───────────────────────────────────────────────
// Gerencia múltiplos objetos + detecção de colisão com personagem
// ══════════════════════════════════════════════════════════════════════════

export interface ObjetoFisica {
    config: FisicaObjetoConfig
    hook: ReturnType<typeof useFisicaObjeto>
}

export interface CollisionEvent {
    objetoId: string
    massa: MassCategory
    contactPoint: THREE.Vector3
    pushDir: THREE.Vector3
    force: number
}

export function useFisicaQuarto(
    objetos: ObjetoFisica[],
    poeiraRef: React.MutableRefObject<NuvemPoeiraRef | null>,
    onCollision?: (e: CollisionEvent) => void
) {
    const lastCharPos = useRef(new THREE.Vector3())
    const charRadius = 0.4

    // Cooldowns por objeto (evita spam de colisão)
    const cooldowns = useRef<Record<string, number>>({})

    const update = useCallback((charPos: THREE.Vector3, dt: number, elapsedTime: number) => {
        const positions: Record<string, THREE.Vector3> = {}

        for (const obj of objetos) {
            // Atualiza a física do objeto
            const finalPos = obj.hook.atualizar(dt, elapsedTime)
            positions[obj.config.id] = finalPos.clone()

            // Cooldown
            if (cooldowns.current[obj.config.id] !== undefined) {
                cooldowns.current[obj.config.id] -= dt
                if (cooldowns.current[obj.config.id] > 0) continue
            }

            // ── Detecção de colisão (2D no plano XZ) ──
            const dx = charPos.x - finalPos.x
            const dz = charPos.z - finalPos.z
            const dist = Math.sqrt(dx * dx + dz * dz)
            const minDist = charRadius + obj.config.raio

            if (dist < minDist && dist > 0.01) {
                // Colisão!
                const pushDir = new THREE.Vector3(
                    (finalPos.x - charPos.x) / dist,
                    0,
                    (finalPos.z - charPos.z) / dist
                )

                const overlap = minDist - dist
                const force = overlap * 2 // Mais overlap = mais força

                // Empurra o objeto
                obj.hook.empurrar(pushDir, force)

                // Ponto de contato (entre os dois centros)
                const contactPoint = new THREE.Vector3(
                    charPos.x + pushDir.x * charRadius,
                    -1.8, // Ligeiramente acima do chão
                    charPos.z + pushDir.z * charRadius
                )

                // Partículas de poeira
                const mc = MASS_CONFIG[obj.config.massa]
                if (poeiraRef.current) {
                    poeiraRef.current.emitir(contactPoint, pushDir, mc.dustCount)
                }

                // Callback para o personagem reagir
                if (onCollision) {
                    onCollision({
                        objetoId: obj.config.id,
                        massa: obj.config.massa,
                        contactPoint,
                        pushDir,
                        force
                    })
                }

                // Cooldown de 0.3s para este objeto
                cooldowns.current[obj.config.id] = 0.3
            }
        }

        lastCharPos.current.copy(charPos)
        return positions
    }, [objetos, poeiraRef, onCollision, charRadius])

    return { update }
}
