/*
 * Character.tsx — O personagem (bonequinho 3D)
 *
 * Este componente carrega o modelo GLTF do personagem e controla:
 *   - Andar até onde o jogador clicou
 *   - Sentar na escrivaninha
 *   - Deitar na cama
 *   - Trocar cor de pele
 *   - Desenhar a linha tracejada mostrando o caminho
 *
 * Conceitos técnicos usados aqui:
 *   - useFrame: roda a cada frame (~60x por segundo), é onde a animação acontece
 *   - lerp: "linear interpolation" — move suavemente de A para B (em vez de teletransportar)
 *   - slerp: mesma coisa que lerp, mas para rotação
 *   - quaternion: forma matemática de armazenar rotação 3D (evita o "gimbal lock")
 *   - useGLTF: carrega arquivo 3D no formato .gltf
 *   - useAnimations: extrai as animações que vieram dentro do arquivo .gltf
 */

import { useRef, useEffect, useMemo } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { POSICAO_ESCRIVANINHA, POSICAO_CAMA, POSICAO_DEITADO, CHAO_Y, POSICAO_BANCO_SENTADO } from '../posicoes'

// Fases da sequência de ir para a cama:
//   'livre'        — o personagem está em pé, andando normalmente
//   'subindo_cama' — chegou ao pé da cama, escala com as mãos no colchão (SitDown)
//   'deitando'     — chegou à posição de deitar, está tombando de costas
//   'deitado'      — está deitado de costas no colchão, dormindo
type FaseCama = 'livre' | 'subindo_cama' | 'deitando' | 'deitado' | 'sentando_mesa' | 'sentado_mesa'

interface PerfilSono {
    rotacaoY: number
    posicao: THREE.Vector3
}

const PERFIS_SONO: PerfilSono[] = [
    {
        // Pose "certa": cabeça no travesseiro (lado esquerdo da cama)
        rotacaoY: Math.PI / 2,
        posicao: new THREE.Vector3(POSICAO_DEITADO.x - 0.08, POSICAO_DEITADO.y, POSICAO_DEITADO.z),
    },
    {
        rotacaoY: -Math.PI / 2 - 0.18,
        posicao: new THREE.Vector3(POSICAO_DEITADO.x - 0.06, POSICAO_DEITADO.y, POSICAO_DEITADO.z - 0.12),
    },
    {
        rotacaoY: -Math.PI / 2 + 0.18,
        posicao: new THREE.Vector3(POSICAO_DEITADO.x - 0.06, POSICAO_DEITADO.y, POSICAO_DEITADO.z + 0.12),
    },
]

const sortearPerfilSono = (): PerfilSono => {
    const perfil = PERFIS_SONO[Math.floor(Math.random() * PERFIS_SONO.length)]
    return {
        rotacaoY: perfil.rotacaoY,
        posicao: perfil.posicao.clone(),
    }
}

// Ajuste fino para não atravessar o travesseiro
const AJUSTE_SONO_POSICAO = new THREE.Vector3(0.05, 0.06, 0)
const AJUSTE_SONO_INCLINACAO_X = 0.08
const AJUSTE_SONO_INCLINACAO_Z = 0.06

interface CharacterProps {
    view: 'room' | 'desk' | 'bed' | 'notebook' | 'reading' | 'shelf'
    targetPosition?: THREE.Vector3 | null
    skinColor?: string
}

export function Personagem({ view, targetPosition, skinColor = '#ffcba4' }: CharacterProps) {
    const group = useRef<THREE.Group>(null)
    const lineRef = useRef<THREE.Line>(null)

    // Cria a linha tracejada uma única vez na memória
    const lineObj = useMemo(() => {
        const material = new THREE.LineDashedMaterial({
            color: 0xffffff,
            dashSize: 0.2,
            gapSize: 0.1,
            transparent: true,
            opacity: 0.5
        })
        const geometry = new THREE.BufferGeometry()
        return new THREE.Line(geometry, material)
    }, [])

    // Carrega o modelo 3D e suas animações
    const { scene, animations } = useGLTF('/Modelos%20da%20Internet/glTF/Suit_Male.gltf')
    const { actions, names } = useAnimations(animations, group)

    // Mostra no console quais animações existem no modelo (útil para debug)
    useEffect(() => {
        console.log("Animações disponíveis no GLTF:", names)
    }, [names])

    // Controle da fase atual da sequência da cama
    const faseCama = useRef<FaseCama>('livre')

    // Timer interno para as fases que dependem de tempo (ex: 'deitando')
    const faseCamaTempo = useRef(0)

    // Personalidade de sono — varia um pouco a cada vez que o personagem dorme.
    // rotacaoY: leve giro aleatório (para não ficar sempre perfeitamente alinhado)
    // posicao: onde no colchão ele cai (ligeiramente diferente toda vez)
    const personalidadeSono = useRef<PerfilSono>({
        rotacaoY: 0,
        posicao: POSICAO_DEITADO.clone(),
    })

    // Controle de qual animação está tocando agora
    const currentAnim = useRef<string>('Idle')

    /** Troca suavemente de uma animação para outra (crossfade) */
    const playAnim = (name: string) => {
        if (currentAnim.current !== name && actions[name]) {
            // Faz a animação atual sumir gradualmente
            actions[currentAnim.current]?.fadeOut(0.2)

            // Faz a nova animação aparecer gradualmente
            const nextAction = actions[name]?.reset().fadeIn(0.2).play()

            // SitDown e Defeat tocam uma vez e param (não ficam em loop)
            if (name === 'SitDown' || name === 'Defeat') {
                nextAction!.clampWhenFinished = true
                nextAction!.loop = THREE.LoopOnce
            }

            currentAnim.current = name
        }
    }

    // Começa com a animação Idle (parado) quando carrega
    useEffect(() => {
        actions['Idle']?.play()
    }, [actions])

    // Quando sai da view da cama, reseta tudo para poder repetir a sequência
    useEffect(() => {
        if (view !== 'bed') {
            faseCama.current = 'livre'
            faseCamaTempo.current = 0
        }
    }, [view])

    // ── LOOP PRINCIPAL (roda a cada frame) ──────────────────────────────
    useFrame((_state, delta) => {
        if (!group.current) return

        // ── FASE: DEITADO ─────────────────────────────────────────────────────
        // Euler(-PI/2, rotacaoY, 0, 'YXZ'):
        //   R_X(-PI/2) mapeia +Z (face do modelo) para +Y (teto) → barriga pra cima ✓
        //   R_Y(~0) mantém cabeça apontando para -Z (cabeceiro) ✓
        if (faseCama.current === 'deitado') {
            playAnim('Idle')
            const alvoDeitado = personalidadeSono.current.posicao.clone().add(AJUSTE_SONO_POSICAO)
            group.current.position.lerp(alvoDeitado, 0.04)
            const quatDeitado = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(
                    -Math.PI / 2 + AJUSTE_SONO_INCLINACAO_X,
                    personalidadeSono.current.rotacaoY,
                    AJUSTE_SONO_INCLINACAO_Z,
                    'YXZ'
                )
            )
            group.current.quaternion.slerp(quatDeitado, 0.04)
            return
        }

        // ── FASE: DEITANDO (tombando de costas) ───────────────────────────────
        if (faseCama.current === 'deitando') {
            faseCamaTempo.current += delta
            playAnim('Defeat')
            const alvoDeitado = personalidadeSono.current.posicao.clone().add(AJUSTE_SONO_POSICAO)
            group.current.position.lerp(alvoDeitado, 0.04)
            const quatDeitado = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(
                    -Math.PI / 2 + AJUSTE_SONO_INCLINACAO_X,
                    personalidadeSono.current.rotacaoY,
                    AJUSTE_SONO_INCLINACAO_Z,
                    'YXZ'
                )
            )
            group.current.quaternion.slerp(quatDeitado, 0.025)

            if (faseCamaTempo.current > 1.5) {
                faseCama.current = 'deitado'
                faseCamaTempo.current = 0
            }
            return
        }

        // ── FASE: SENTANDO NA MESA (Pulinho charmoso) ─────────────────────────
        if (faseCama.current === 'sentando_mesa') {
            faseCamaTempo.current += delta
            playAnim('Jump')

            // Pula para cima e vira de costas num movimento só
            const duracao = 0.4 
            const t = Math.min(faseCamaTempo.current / duracao, 1.0)
            
            // Eleva o Y em arco até a POSICAO_BANCO_SENTADO.y
            // Math.sin garante que ele suba e desça no banco
            const arco = Math.sin(t * Math.PI) * 0.5
            const novoY = THREE.MathUtils.lerp(CHAO_Y, POSICAO_BANCO_SENTADO.y, t) + arco
            const novoZ = THREE.MathUtils.lerp(POSICAO_ESCRIVANINHA.z, POSICAO_BANCO_SENTADO.z, t)
            
            group.current.position.set(POSICAO_ESCRIVANINHA.x, novoY, novoZ)

            // Vira para ficar de costas para a mesa (Math.PI)
            const quatMesa = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
            group.current.quaternion.slerp(quatMesa, 0.2)

            if (t >= 1.0) {
                faseCama.current = 'sentado_mesa'
            }
            return
        }

        // ── FASE: SENTADO (Já no alto do banquinho) ───────────────────────────
        if (faseCama.current === 'sentado_mesa') {
            playAnim('SitDown')
            return
        }

        // ── FASE: SUBINDO NA CAMA ─────────────────────────────────────────────
        // Olha em direção ao pé da cama (+Z) enquanto sobe.
        // Isso faz o Y convergir para PI, valor exato que a rotação de deitar precisa.
        if (faseCama.current === 'subindo_cama') {
            if (lineRef.current) lineRef.current.visible = false
            playAnim('SitDown')

            group.current.position.lerp(personalidadeSono.current.posicao, 0.025)

            const cabeceiro = new THREE.Vector3(
                personalidadeSono.current.posicao.x - 1.2,
                personalidadeSono.current.posicao.y,
                personalidadeSono.current.posicao.z
            )
            const dummy = new THREE.Object3D()
            dummy.position.copy(group.current.position)
            dummy.lookAt(cabeceiro)
            group.current.quaternion.slerp(dummy.quaternion, 0.06)

            if (group.current.position.distanceTo(personalidadeSono.current.posicao) < 0.25) {
                faseCama.current = 'deitando'
                faseCamaTempo.current = 0
            }
            return
        }

        // ── FASE: LIVRE (andando normalmente) ────────────────────────────────
        if (targetPosition) {
            const target = new THREE.Vector3(targetPosition.x, CHAO_Y, targetPosition.z)
            const distance = group.current.position.distanceTo(target)

            if (distance > 0.1) {
                // ── ANDANDO ──
                // Velocidade constante em unidades/segundo → não depende da distância
                const VELOCIDADE = 4.5
                const passo = Math.min(VELOCIDADE * delta, distance)
                const direcao = target.clone().sub(group.current.position).normalize()
                group.current.position.addScaledVector(direcao, passo)

                playAnim('Walk')

                const dummy = new THREE.Object3D()
                dummy.position.copy(group.current.position)
                dummy.lookAt(target)
                group.current.quaternion.slerp(dummy.quaternion, 0.15)

                if (lineRef.current) {
                    lineRef.current.visible = true
                    const points = [
                        new THREE.Vector3(group.current.position.x, -1.9, group.current.position.z),
                        new THREE.Vector3(target.x, -1.9, target.z)
                    ]
                    lineRef.current.geometry.setFromPoints(points)
                    lineRef.current.computeLineDistances()
                }
            } else {
                // ── CHEGOU NO DESTINO ──
                if (lineRef.current) lineRef.current.visible = false

                if (view === 'desk' && target.distanceTo(POSICAO_ESCRIVANINHA) < 0.1) {
                    faseCama.current = 'sentando_mesa'
                    faseCamaTempo.current = 0
                } else if (view === 'bed' && target.distanceTo(POSICAO_CAMA) < 0.3) {
                    // Chegou ao pé da cama → sorteia 1 de 3 poses de sono
                    personalidadeSono.current = sortearPerfilSono()
                    faseCama.current = 'subindo_cama'

                } else {
                    playAnim('Idle')
                }
            }
        } else {
            // ── ESTADO INICIAL (ninguém clicou em nada ainda) ──
            if (view === 'desk') {
                faseCama.current = 'sentado_mesa'
                group.current.position.copy(POSICAO_BANCO_SENTADO)
                group.current.rotation.y = Math.PI
            } else if (view === 'bed') {
                personalidadeSono.current = sortearPerfilSono()
                faseCama.current = 'subindo_cama'
            } else {
                playAnim('Idle')
            }
        }
    })

    // Ajusta os materiais do modelo para ficar fosco e aconchegante
    useEffect(() => {
        scene.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
                child.castShadow = true
                child.receiveShadow = true
                child.material.roughness = 0.8
                child.material.metalness = 0.0

                // Corrige bug do modelo Quaternius onde a pele vem quase preta
                if (child.material.name === 'Skin') {
                    child.material.color.set(skinColor)
                }
            }
        })
    }, [scene, skinColor])

    return (
        <group>
            {/* Linha tracejada mostrando o caminho */}
            <primitive object={lineObj} ref={lineRef} visible={false} />

            {/* Personagem — começa na frente da escrivaninha */}
            <group ref={group} position={[POSICAO_ESCRIVANINHA.x, POSICAO_ESCRIVANINHA.y, POSICAO_ESCRIVANINHA.z]} rotation={[0, Math.PI, 0]} scale={1.15}>
                <primitive object={scene} />
            </group>
        </group>
    )
}

useGLTF.preload('/Modelos%20da%20Internet/glTF/Suit_Male.gltf')
