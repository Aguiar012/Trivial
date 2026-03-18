/*
 * Quarto.tsx — O quarto aconchegante, visual polido estilo Kind Words
 *
 * Usa modelos 3D reais (GLB) da pasta /moveis/ para os móveis principais,
 * combinados com formas primitivas para paredes, chão e detalhes.
 *
 * Paleta de cores quente: tons de burgundy, coral, madeira escura, creme.
 * Tudo pensado para parecer um quarto à noite com uma luzinha de mesa.
 *
 * Interações mantidas:
 *   - Clique no chão → personagem anda até lá
 *   - Clique na cama → bounce + personagem deita
 *   - Clique na mesa → flash na tela + personagem senta
 */

import { useRef, useMemo, useCallback, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Box, Cylinder, useGLTF, Center } from '@react-three/drei'
import * as THREE from 'three'
import { ObjectNotification, type NotificationData } from './ObjectNotification'
import { useFisicaObjeto, NuvemPoeira, type CollisionEvent } from './PseudoFisica'
import type { NuvemPoeiraRef } from './PseudoFisica'
import { MirixFace3D } from './MirixFace3D'

// ── CAMINHOS DOS MODELOS GLB ────────────────────────────────────────────
const MODELO = {
    cama: '/moveis/Bed_Single.glb',
    estante: '/moveis/Bookshelf.glb',
    luminaria: '/moveis/Light_Desk.glb',
    planta: '/moveis/Houseplant_1.glb',
    banquinho: '/moveis/Stool.glb',
}

// ── CORES POR MODELO (material name → cor) ──────────────────────────────
// Os nomes dos materiais vêm do arquivo .mtl original de cada modelo.
const CORES_CAMA = {
    'Wood': '#8a6050',
    'Red': '#457b9d',     // Navy Blue para estudos
    'DarkRed': '#1d3557',  // Navy escuro
    'White': '#f0ddd0',
    'Grey': '#c8bdb0',  // era marrom escuro — Grey é o travesseiro/colchão
}
const CORES_LUMINARIA = {
    'Black': '#2a1815',
    'LightMetal': '#d4a878',
    'White': '#fff5e0',
}
const EMISSIVOS_LUMINARIA = { 'White': '#ffcc88' }
const CORES_PLANTA = {
    'Plant_Green': '#4a6a3a',
    'Brown': '#5a3020',
    'Black': '#3a2215',
}
const CORES_BANQUINHO = { 'Wood': '#5a3525', 'Cushin': '#a04050' }

// ── HOOK: CARREGA GLB E RECOLORE ────────────────────────────────────────
/**
 * Carrega um modelo .glb, clona a cena, e aplica novas cores nos materiais.
 *
 * @param url        Caminho do .glb (relativo ao publicDir)
 * @param cores      String (cor única) ou { 'NomeMaterial': '#cor' }
 * @param emissivos  Opcional: { 'NomeMaterial': '#corBrilho' } para partes que brilham
 */
function useMovel(
    url: string,
    cores: Record<string, string> | string,
    emissivos?: Record<string, string>
) {
    const { scene } = useGLTF(url)

    const clone = useMemo(() => {
        const clonado = scene.clone(true)
        const corPadrao = typeof cores === 'string' ? cores : null
        const mapa = typeof cores === 'object' ? cores : null

        clonado.traverse((child: any) => {
            const hasMaterial = child.material != null
            if (child.isMesh || child.isSkinnedMesh || hasMaterial) {
                child.castShadow = true
                child.receiveShadow = true
                const mat0 = Array.isArray(child.material) ? child.material[0] : child.material
                const nome = mat0?.name || ''
                const cor = mapa?.[nome] ?? corPadrao ?? '#5a3525'
                const mat = new THREE.MeshStandardMaterial({
                    color: cor,
                    roughness: 0.85,
                    metalness: 0.0,
                })
                if (emissivos?.[nome]) {
                    mat.emissive = new THREE.Color(emissivos[nome])
                    mat.emissiveIntensity = 0.5
                }
                child.material = mat
            }
        })
        return clonado
    }, [scene, cores, emissivos])

    return clone
}

/** Material Standard fosco com cor quente */
const warm = (color: string) => (
    <meshStandardMaterial color={color} roughness={0.85} metalness={0.0} />
)

// ── COMPONENTE PRINCIPAL ────────────────────────────────────────────────
interface QuartoProps {
    onFloorClick?: (pos: THREE.Vector3) => void
    onCamaClick?: () => void
    onMesaClick?: () => void
    onEstanteClick?: () => void
    notifications?: Record<string, NotificationData>
    /** Ref compartilhada com o Personagem — posição world-space atualizada todo frame */
    charPositionRef?: React.MutableRefObject<THREE.Vector3>
    /** Callback quando personagem colide com um móvel */
    onFisicaColisao?: (e: CollisionEvent) => void
    /** Indica em qual câmera estamos focados */
    view?: 'room' | 'desk' | 'shelf' | 'bed'
}

// ── SISTEMA DE COORDENADAS ───────────────────────────────────────────────
//
// ATENÇÃO: Este componente usa <group position={[0, -2, 0]}> como raiz.
// Todas as posições DENTRO deste arquivo são LOCAIS (relativas ao grupo).
//
// Para converter para world-space:  world = local + [0, -2, 0]
// Para converter de world-space:    local = world - [0, -2, 0]
//
// Exemplos:
//   Escrivaninha: local [-2.5,  2, -3]  → world [-2.5,  0, -3]
//   Cama:         local [ 2.2,  0, 1.8] → world [ 2.2, -2,  1.8]
//   Banquinho:    local [ 0, -0.35, 2.4] dentro da Escrivaninha
//                 world = [-2.5, 2-2-0.35, -3+2.4] = [-2.5, -0.35, -0.6]
//
// O PERSONAGEM e POSICOES.TS usam world-space diretamente (Y=-2 no chão).
//
// Bounds do quarto (world-space):
//   X: [-4.75, 4.75]   Y: [-2.5, 6]   Z: [-4.75, 4.75]
//   Chão: Y = -2   |   Tampo da mesa: Y ≈ 0   |   Teto: Y ≈ 6
// ────────────────────────────────────────────────────────────────────────

export function Quarto({ onFloorClick, onCamaClick, onMesaClick, onEstanteClick, notifications = {}, charPositionRef, onFisicaColisao, view = 'room' }: QuartoProps) {
    // ── REFS PARA ANIMAÇÕES VISUAIS ──────────────────────────────────
    const camaRef = useRef<THREE.Group>(null)
    const camaTempo = useRef(999)
    const telaRef = useRef<THREE.MeshBasicMaterial>(null)
    const mesaTempo = useRef(999)

    // ── REFS PARA NOVOS EFEITOS ─────────────────────────────────────
    const cortinaEsqRef = useRef<THREE.Mesh>(null)
    const cortinaDirRef = useRef<THREE.Mesh>(null)
    const [cortinaSwing, setCortinaSwing] = useState(0) // impulso extra ao clicar
    const estrelaRefs = useRef<THREE.Mesh[]>([])
    const luminariaLuzRef = useRef<THREE.PointLight>(null)
    const plantaInnerRef = useRef<THREE.Group>(null)

    // ── MODELOS 3D CARREGADOS ────────────────────────────────────────
    const camaScene = useMovel(MODELO.cama, CORES_CAMA)
    const estanteScene = useMovel(MODELO.estante, '#5a3525')
    const luminariaScene = useMovel(MODELO.luminaria, CORES_LUMINARIA, EMISSIVOS_LUMINARIA)
    const plantaScene = useMovel(MODELO.planta, CORES_PLANTA)
    const banquinhoScene = useMovel(MODELO.banquinho, CORES_BANQUINHO)

    // ── PSEUDO-FÍSICA ────────────────────────────────────────────────
    const poeiraRef = useRef<NuvemPoeiraRef | null>(null)
    const plantaRef = useRef<THREE.Group>(null)
    const estanteRef = useRef<THREE.Group>(null)
    const mesaRef = useRef<THREE.Group>(null)

    // Hooks de física para cada móvel interativo
    // Posições em WORLD-SPACE (para comparar com o personagem)
    const fisicaCama = useFisicaObjeto({
        id: 'cama', posicaoOriginal: [2.2, -2, 1.8], raio: 1.2, massa: 'heavy'
    })
    const fisicaPlanta = useFisicaObjeto({
        id: 'planta', posicaoOriginal: [3.8, -2, -3.5], raio: 0.45, massa: 'light'
    })
    const fisicaEstante = useFisicaObjeto({
        id: 'estante', posicaoOriginal: [-4.0, -2, 2.0], raio: 0.8, massa: 'heavy'
    })
    const fisicaMesa = useFisicaObjeto({
        id: 'mesa', posicaoOriginal: [-2.5, 0, -3.0], raio: 1.5, massa: 'heavy'
    })

    // Cooldowns de colisão por objeto
    const cooldowns = useRef<Record<string, number>>({})
    const CHAR_RADIUS = 0.4

    // Callback de colisão memoizado
    const handleColisao = useCallback((e: CollisionEvent) => {
        onFisicaColisao?.(e)
    }, [onFisicaColisao])

    // ── LOOP DE ANIMAÇÃO (todo frame) ────────────────────────────────
    useFrame((state, delta) => {
        camaTempo.current += delta
        mesaTempo.current += delta

        // Bounce da cama — salto decaindo com abs() para nunca ir abaixo do chão
        if (camaRef.current && camaTempo.current < 0.7) {
            const t = camaTempo.current
            const bounce = Math.abs(Math.sin(t * Math.PI * 5)) * 0.25 * Math.max(0, 1 - t * 1.8)
            camaRef.current.position.y = bounce
        }

        // Flash da tela do notebook — tons quentes em vez de branco puro
        if (telaRef.current && mesaTempo.current < 0.5) {
            const brilho = Math.max(0, 1 - mesaTempo.current * 2)
            telaRef.current.color.setRGB(
                0.04 + brilho * 0.96,
                0.08 + brilho * 0.84,
                0.13 + brilho * 0.82
            )
        } else if (telaRef.current && mesaTempo.current >= 0.5) {
            // Restaura a cor escura da tela (dark navy) assim que o flash termina
            telaRef.current.color.setRGB(0.04, 0.08, 0.13)
        }

        // ── CORTINAS: Balanço suave com brisa + impulso ao clicar ────
        const breeze = Math.sin(state.clock.elapsedTime * 0.8) * 0.03
            + Math.sin(state.clock.elapsedTime * 1.3 + 1) * 0.015
            + Math.sin(state.clock.elapsedTime * 2.1 + 3) * 0.008
        const swingDecay = cortinaSwing * Math.exp(-state.clock.elapsedTime * 2) * 0.15

        if (cortinaEsqRef.current) {
            cortinaEsqRef.current.rotation.x = breeze + swingDecay
            cortinaEsqRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.01
        }
        if (cortinaDirRef.current) {
            cortinaDirRef.current.rotation.x = -breeze * 0.8 - swingDecay * 0.7
            cortinaDirRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5 + 2) * 0.01
        }

        // ── ESTRELAS: Cintilação ──────────────────────────────────────
        for (let i = 0; i < estrelaRefs.current.length; i++) {
            const star = estrelaRefs.current[i]
            if (!star) continue
            const mat = star.material as THREE.MeshBasicMaterial
            // Cada estrela pisca em frequência e fase diferente
            const twinkle = 0.3 + 0.7 * ((Math.sin(state.clock.elapsedTime * (1.5 + i * 0.7) + i * 2.3) + 1) / 2)
            mat.opacity = twinkle
            // Variação sutil de escala
            const scaleVar = 0.8 + 0.4 * twinkle
            star.scale.setScalar(scaleVar)
        }

        // ── PLANTA: Balanço orgânico de brisa ─────────────────────────
        if (plantaInnerRef.current) {
            plantaInnerRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.7) * 0.02
                + Math.sin(state.clock.elapsedTime * 1.1 + 0.5) * 0.01
            plantaInnerRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5 + 1) * 0.01
        }

        // ── LUMINÁRIA: Luz que "respira" suavemente ───────────────────
        if (luminariaLuzRef.current) {
            const breathe = 0.85 + Math.sin(state.clock.elapsedTime * 1.2) * 0.12
                + Math.sin(state.clock.elapsedTime * 2.7) * 0.03
            luminariaLuzRef.current.intensity = breathe
        }

        // ── PSEUDO-FÍSICA: Colisões com personagem ──────────────────
        if (charPositionRef) {
            const charPos = charPositionRef.current
            const elapsed = state.clock.elapsedTime

            // Atualiza cooldowns
            for (const key in cooldowns.current) {
                cooldowns.current[key] -= delta
            }

            // Lista de objetos com física (box: [halfWidthX, halfDepthZ] para formas retangulares)
            const objetosFisica = [
                { hook: fisicaCama, config: { id: 'cama', raio: 1.2, massa: 'heavy' as const }, box: [1.6, 1.15], ref: camaRef, localY: 0 },
                { hook: fisicaPlanta, config: { id: 'planta', raio: 0.45, massa: 'light' as const }, box: null, ref: plantaRef, localY: 0 },
                { hook: fisicaEstante, config: { id: 'estante', raio: 0.8, massa: 'heavy' as const }, box: [0.6, 1.2], ref: estanteRef, localY: 0 },
                { hook: fisicaMesa, config: { id: 'mesa', raio: 1.5, massa: 'heavy' as const }, box: [2.15, 1.45], ref: mesaRef, localY: 2 },
            ]

            for (const obj of objetosFisica) {
                // Atualiza posição do objeto (spring, shake, retorno)
                const finalWorldPos = obj.hook.atualizar(delta, elapsed)

                // (O check de cooldown agora só bloqueia o efeito visual abaixo, não mais a física em si)

                // ── Detecção de Colisão (Híbrida AABB-Box / Esfera) ──
                let pushDirX = 0, pushDirZ = 0, overlap = 0
                
                if (obj.box) {
                    // Colisão Box vs Esfera (Personagem)
                    // Encontra o ponto na borda do retângulo mais próximo ao personagem
                    const closestX = Math.max(finalWorldPos.x - obj.box[0], Math.min(charPos.x, finalWorldPos.x + obj.box[0]))
                    const closestZ = Math.max(finalWorldPos.z - obj.box[1], Math.min(charPos.z, finalWorldPos.z + obj.box[1]))
                    
                    const dx = charPos.x - closestX
                    const dz = charPos.z - closestZ
                    const dist = Math.sqrt(dx * dx + dz * dz)
                    const MARGIN = 0.1 // Margem extra para evitar que a malha corte o modelo 3D
                    
                    if (dist < CHAR_RADIUS + MARGIN) {
                        overlap = (CHAR_RADIUS + MARGIN) - dist
                        // Se dist for ≈ 0, o centro da esfera está cravado dentro do Box! Expulsa ele.
                        if (dist < 0.001) {
                            pushDirX = charPos.x > finalWorldPos.x ? 1 : -1
                            pushDirZ = 0
                        } else {
                            pushDirX = dx / dist
                            pushDirZ = dz / dist
                        }
                    }
                } else {
                    // Colisão Esfera vs Esfera
                    const dx = charPos.x - finalWorldPos.x
                    const dz = charPos.z - finalWorldPos.z
                    const dist = Math.sqrt(dx * dx + dz * dz)
                    const minDist = CHAR_RADIUS + obj.config.raio

                    if (dist < minDist && dist > 0.01) {
                        overlap = minDist - dist
                        pushDirX = dx / dist
                        pushDirZ = dz / dist
                    }
                }

                if (overlap > 0) {
                    const pushDir = new THREE.Vector3(pushDirX, 0, pushDirZ)
                    
                    // 1. CORREÇÃO FÍSICA IMEDIATA (Paredes maciças)
                    const correcao = pushDir.clone().multiplyScalar(overlap)
                    window.dispatchEvent(new CustomEvent('personagem-correcao', {
                        detail: { correcao }
                    }))
                    
                    // Atualiza a refeência local no mesmo frame para testes subsequentes
                    charPos.add(correcao)

                    // 2. RESPOSTA VISUAL / GAME FEEL (Limitada por cooldown para não pipocar)
                    if ((cooldowns.current[obj.config.id] ?? -1) <= 0) {
                        // Força para empurrar o objeto (inverso, do Perosnagem pro Objeto)
                        const objPushDir = pushDir.clone().negate()
                        const force = overlap * 2.5
                        obj.hook.empurrar(objPushDir, force)

                        // Ponto de contato visual para aplicar a poeira
                        const contactPoint = new THREE.Vector3(
                            charPos.x - pushDirX * CHAR_RADIUS,
                            0.1, // Altura correta relativa ao chão do quarto
                            charPos.z - pushDirZ * CHAR_RADIUS
                        )

                        // Partículas de poeira e Callback (se aplicável)
                        const dustCounts = { heavy: 12, medium: 8, light: 5 }
                        poeiraRef.current?.emitir(contactPoint, objPushDir, dustCounts[obj.config.massa])

                        handleColisao({
                            objetoId: obj.config.id,
                            massa: obj.config.massa,
                            contactPoint,
                            pushDir: objPushDir,
                            force
                        })

                        cooldowns.current[obj.config.id] = 0.2
                    }
                }

                // Aplica posição ao grupo (world→local: Y local = Y original)
                if (obj.ref?.current) {
                    obj.ref.current.position.x = finalWorldPos.x
                    obj.ref.current.position.z = finalWorldPos.z
                }
            }
        }
    })

    return (
        <group name="Quarto" position={[0, -2, 0]}>

            {/* ══════════════════════════════════════════════════════
                ESTRUTURA DO QUARTO (paredes, chão, janela)
            ══════════════════════════════════════════════════════ */}

            {/* Chão — madeira escura com tom quente */}
            <Box
                args={[10, 0.5, 10]}
                position={[0, -0.25, 0]}
                receiveShadow
                onClick={(e) => {
                    e.stopPropagation()
                    if (onFloorClick) {
                        const cx = THREE.MathUtils.clamp(e.point.x, -4.0, 4.0)
                        const cz = THREE.MathUtils.clamp(e.point.z, -4.0, 4.0)
                        onFloorClick(new THREE.Vector3(cx, e.point.y, cz))
                    }
                }}
            >
                {warm('#6b5246')}
            </Box>

            {/* Rodapé */}
            <Box args={[10, 0.25, 0.1]} position={[0, 0.12, -4.62]}>
                {warm('#3c2b23')}
            </Box>
            <Box args={[0.1, 0.25, 10]} position={[-4.62, 0.12, 0]}>
                {warm('#3c2b23')}
            </Box>

            {/* Parede do fundo — coral/salmão quente */}
            <Box args={[10, 8, 0.5]} position={[0, 4, -4.75]} receiveShadow>
                {warm('#cad2c5')}
            </Box>

            {/* Parede lateral esquerda — coral ligeiramente mais escuro */}
            <Box args={[0.5, 8, 10]} position={[-4.75, 4, 0]} receiveShadow>
                {warm('#b4c0b0')}
            </Box>

            {/* ── JANELA ─────────────────────────────────────── */}
            {/* Céu noturno */}
            <Box args={[3, 4, 0.6]} position={[1, 4.5, -4.72]}>
                <meshBasicMaterial color="#0d1b2a" />
            </Box>
            {/* Estrelinhas que cintilam */}
            {[
                { pos: [0.2, 5.8, -4.65] as [number,number,number], size: 0.04, color: '#ffffff' },
                { pos: [1.5, 5.2, -4.65] as [number,number,number], size: 0.03, color: '#ffffcc' },
                { pos: [0.8, 4.2, -4.65] as [number,number,number], size: 0.03, color: '#ffffff' },
                { pos: [1.8, 5.7, -4.65] as [number,number,number], size: 0.025, color: '#ccddff' },
                { pos: [0.5, 4.8, -4.65] as [number,number,number], size: 0.02, color: '#ffeedd' },
                { pos: [1.2, 6.0, -4.65] as [number,number,number], size: 0.02, color: '#ffffff' },
                { pos: [0.0, 5.0, -4.65] as [number,number,number], size: 0.018, color: '#ddeeff' },
            ].map((star, i) => (
                <mesh
                    key={i}
                    position={star.pos}
                    ref={(el) => { if (el) estrelaRefs.current[i] = el }}
                >
                    <sphereGeometry args={[star.size, 8, 8]} />
                    <meshBasicMaterial color={star.color} transparent opacity={1} />
                </mesh>
            ))}
            {/* Lua crescente */}
            <mesh position={[1.9, 6.1, -4.66]}>
                <circleGeometry args={[0.15, 16]} />
                <meshBasicMaterial color="#f0e8c0" />
            </mesh>
            <mesh position={[1.97, 6.15, -4.655]}>
                <circleGeometry args={[0.12, 16]} />
                <meshBasicMaterial color="#0d1b2a" />
            </mesh>
            {/* Moldura com barras cruzadas */}
            <Box args={[3.3, 4.3, 0.15]} position={[1, 4.5, -4.48]} castShadow>
                {warm('#c9a87c')}
            </Box>
            <Box args={[3.3, 0.12, 0.16]} position={[1, 4.5, -4.46]}>
                {warm('#c9a87c')}
            </Box>
            <Box args={[0.12, 4.3, 0.16]} position={[1, 4.5, -4.46]}>
                {warm('#c9a87c')}
            </Box>
            {/* Cortinas que balançam com brisa (pivot no topo) */}
            <group position={[-0.8, 6.8, -4.45]}>
                <mesh
                    ref={cortinaEsqRef}
                    position={[0, -2.3, 0]}
                    castShadow
                    onClick={(e) => { e.stopPropagation(); setCortinaSwing(prev => prev + 3) }}
                    onPointerOver={() => { document.body.style.cursor = 'pointer' }}
                    onPointerOut={() => { document.body.style.cursor = 'auto' }}
                >
                    <boxGeometry args={[0.8, 4.6, 0.15]} />
                    <meshStandardMaterial color="#556b60" roughness={0.95} />
                </mesh>
            </group>
            <group position={[2.8, 6.8, -4.45]}>
                <mesh
                    ref={cortinaDirRef}
                    position={[0, -2.3, 0]}
                    castShadow
                    onClick={(e) => { e.stopPropagation(); setCortinaSwing(prev => prev + 3) }}
                    onPointerOver={() => { document.body.style.cursor = 'pointer' }}
                    onPointerOut={() => { document.body.style.cursor = 'auto' }}
                >
                    <boxGeometry args={[0.8, 4.6, 0.15]} />
                    <meshStandardMaterial color="#556b60" roughness={0.95} />
                </mesh>
            </group>

            {/* ══════════════════════════════════════════════════════
                MÓVEIS INTERATIVOS
            ══════════════════════════════════════════════════════ */}

            {/* ESCRIVANINHA — clique pisca a tela + manda o personagem sentar */}
            {/* ESCRIVANINHA — local [-2.5,2,-3] → world [-2.5,0,-3]
    Tampo em world Y≈0. Banquinho em world [-2.5,-2.35,-0.6] */}
            <group
                name="Escrivaninha"
                ref={mesaRef}
                position={[-2.5, 2, -3]}
                onClick={(e) => {
                    e.stopPropagation()
                    mesaTempo.current = 0
                    onMesaClick?.()
                }}
                onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
                onPointerOut={() => { document.body.style.cursor = 'auto' }}
            >
                {/* Sistema de Notificações - Mesa */}
                {notifications['desk'] && (
                    <ObjectNotification data={notifications['desk']} position={[0, 2.0, -0.5]} />
                )}

                {/* Tampo */}
                <Box args={[4, 0.2, 2.5]} position={[0, 0, 0]} castShadow receiveShadow>
                    {warm('#6a4030')}
                </Box>
                {/* Pés laterais (painéis sólidos) */}
                <Box args={[0.2, 2, 2.3]} position={[-1.8, -1, 0]} castShadow receiveShadow>
                    {warm('#5a3525')}
                </Box>
                <Box args={[0.2, 2, 2.3]} position={[1.8, -1, 0]} castShadow receiveShadow>
                    {warm('#5a3525')}
                </Box>

                {/* Notebook — corpo cinza escuro */}
                <Box args={[1.2, 0.8, 0.1]} position={[0, 0.5, -0.8]} rotation={[-0.05, 0, 0]} castShadow>
                    {warm('#3a3a40')}
                </Box>
                {/* Tela (fundo escuro) */}
                <Box args={[1.1, 0.7, 0.05]} position={[0, 0.5, -0.74]} rotation={[-0.05, 0, 0]}>
                    <meshBasicMaterial ref={telaRef} color="#0a1520" />
                </Box>

                {/* ── ROSTO MIRIX ANIMADO ────────────────────────── */}
                <MirixFace3D isAsleep={view === 'bed'} charPositionRef={charPositionRef} view={view} />

                {/* Luz quente da luminária (respira suavemente) */}
                <pointLight
                    ref={luminariaLuzRef}
                    position={[-1.2, 1.2, -0.5]}
                    color="#ffcc88"
                    intensity={0.85}
                    distance={4}
                    decay={2}
                />

                {/* Luminária de mesa (modelo 3D com brilho na cúpula) */}
                <primitive object={luminariaScene} position={[-1.2, 0.15, -0.8]} scale={1.2} />

                {/* Caneca */}
                <Cylinder args={[0.12, 0.1, 0.3, 12]} position={[1.2, 0.25, -0.3]} castShadow>
                    {warm('#c07060')}
                </Cylinder>

                {/* Banquinho (onde o personagem senta) - Centralizado e ancorado no chão (-2) */}
                <group position={[0, -0.35, 2.4]}>
                    <Center position={[0, 0, 0]} receiveShadow castShadow disableY={false} bottom>
                         <primitive object={banquinhoScene} scale={1.2} />
                    </Center>
                </group>
            </group>

            {/* CAMA — modelo 3D com bounce ao clicar */}
            {/* posição ajustada para caber dentro das paredes */}
            {/* CAMA — local [2.2,0,1.8] → world [2.2,-2,1.8]
    Topo do colchão em world Y≈-0.8 */}
            <group
                name="Cama"
                ref={camaRef}
                position={[2.2, 0, 1.8]}
                onClick={(e) => {
                    e.stopPropagation()
                    camaTempo.current = 0
                    onCamaClick?.()
                }}
                onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
                onPointerOut={() => { document.body.style.cursor = 'auto' }}
            >
                {/* Sistema de Notificações - Cama */}
                {notifications['bed'] && (
                    <ObjectNotification data={notifications['bed']} position={[0, 1.8, 0]} />
                )}
                
                <primitive object={camaScene} scale={1.55} rotation={[0, Math.PI / 2, 0]} />
            </group>

            {/* Tapete redondo — rosa quente */}
            <Cylinder args={[3, 3, 0.08, 32]} position={[0, 0.04, 0]} receiveShadow>
                <meshStandardMaterial color="#dfd5c6" roughness={0.95} />
            </Cylinder>

            {/* ══════════════════════════════════════════════════════
                MÓVEIS DECORATIVOS (modelos 3D)
            ══════════════════════════════════════════════════════ */}

            {/* Estante de livros — encostada na parede esquerda */}
            {/* X=-4.0: a cada scale 1.5 o modelo se estende ~0.57u no eixo X após rotação,
                ficando em X=-4.57 — seguro (parede em X=-4.75). Era -4.3 → clipava em -4.83 */}
            {/* ESTANTE — local [-4.0,0,2.0] rotation Y=PI/2 → world [-4.0,-2,2.0]
    Personagem vai até world [-3.5,-2,2.0] (POSICAO_ESTANTE) */}
            <group
                name="Estante"
                ref={estanteRef}
                position={[-4.0, 0, 2.0]}
                rotation={[0, Math.PI / 2, 0]}
                onClick={(e) => { e.stopPropagation(); onEstanteClick?.() }}
                onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
                onPointerOut={() => { document.body.style.cursor = 'auto' }}
            >
                {/* Sistema de Notificações - Estante */}
                {notifications['shelf'] && (
                    <ObjectNotification data={notifications['shelf']} position={[0, 3.5, 0.5]} />
                )}

                <primitive object={estanteScene} scale={1.5} />
                {/* Livros nos nichos */}
                <Box args={[0.12, 0.38, 0.28]} position={[-0.28, 1.3, -0.05]} castShadow>
                    <meshStandardMaterial color="#c07080" roughness={0.9} />
                </Box>
                <Box args={[0.1, 0.35, 0.24]} position={[-0.08, 1.3, -0.05]} castShadow>
                    <meshStandardMaterial color="#6a8a6a" roughness={0.9} />
                </Box>
                <Box args={[0.14, 0.42, 0.22]} position={[0.16, 1.3, -0.05]} castShadow>
                    <meshStandardMaterial color="#6a7a9a" roughness={0.9} />
                </Box>
                <Box args={[0.12, 0.38, 0.24]} position={[-0.2, 2.2, -0.05]} castShadow>
                    <meshStandardMaterial color="#d4906a" roughness={0.9} />
                </Box>
                <Box args={[0.1, 0.32, 0.22]} position={[0.08, 2.2, -0.05]} castShadow>
                    <meshStandardMaterial color="#a07080" roughness={0.9} />
                </Box>
            </group>

            {/* Planta — canto direito traseiro (modelo 3D) — com pseudo-física (light) + brisa */}
            <group ref={plantaRef} position={[3.8, 0, -3.5]}>
                <group ref={plantaInnerRef}>
                    <primitive object={plantaScene} scale={1.8} />
                </group>
            </group>

            {/* Prateleira na parede do fundo — feita com boxes (proporcional!) */}
            {/* shelf bracket */}
            <Box args={[2.0, 0.12, 0.4]} position={[3.0, 3.5, -4.62]} castShadow receiveShadow>
                {warm('#8a5545')}
            </Box>
            {/* objetos na prateleira */}
            <Box args={[0.18, 0.28, 0.18]} position={[2.3, 3.7, -4.58]} castShadow>
                <meshStandardMaterial color="#d4c8b0" roughness={0.8} />
            </Box>
            <Box args={[0.12, 0.22, 0.14]} position={[2.6, 3.67, -4.58]} castShadow>
                <meshStandardMaterial color="#c08070" roughness={0.8} />
            </Box>
            <Box args={[0.25, 0.32, 0.18]} position={[3.0, 3.68, -4.58]} castShadow>
                <meshStandardMaterial color="#8ab0b8" roughness={0.8} />
            </Box>
            <Box args={[0.14, 0.24, 0.16]} position={[3.4, 3.67, -4.58]} castShadow>
                <meshStandardMaterial color="#d4906a" roughness={0.8} />
            </Box>

            {/* ══════════════════════════════════════════════════════
                DECORAÇÃO (quadros, posters, luminárias, detalhes)
            ══════════════════════════════════════════════════════ */}

            {/* Poster — parede esquerda (retrato vertical) */}
            <Box args={[0.06, 1.4, 1.1]} position={[-4.68, 4.8, -1.2]} castShadow>
                <meshStandardMaterial color="#e8705a" roughness={0.9} />
            </Box>
            {/* Poster menor — parede esquerda */}
            <Box args={[0.06, 0.9, 0.9]} position={[-4.68, 4.4, 0.8]} castShadow>
                <meshStandardMaterial color="#f0c870" roughness={0.9} />
            </Box>
            {/* Poster maior — parede do fundo, centro-esquerda */}
            <Box args={[1.4, 1.0, 0.06]} position={[-1.3, 5.8, -4.68]} castShadow>
                <meshStandardMaterial color="#d4946a" roughness={0.95} />
            </Box>
            {/* Poster — parede do fundo, direita (acima da prateleira) */}
            <Box args={[0.9, 1.1, 0.06]} position={[1.5, 6.0, -4.68]} castShadow>
                <meshStandardMaterial color="#7abac4" roughness={0.95} />
            </Box>

            {/* Relógio/despertador em cima do criado-mudo */}
            <Box args={[0.3, 0.25, 0.15]} position={[0.3, 1.1, 1.8]} castShadow>
                <meshStandardMaterial color="#d4d0c8" roughness={0.8} />
            </Box>

            {/* ══════════════════════════════════════════════════════
                SISTEMA DE PARTÍCULAS DE POEIRA
            ══════════════════════════════════════════════════════ */}
            <NuvemPoeira refHandle={poeiraRef} />

        </group>
    )
}

// Pré-carrega todos os modelos para não ter delay ao abrir
useGLTF.preload(MODELO.cama)
useGLTF.preload(MODELO.estante)
useGLTF.preload(MODELO.luminaria)
useGLTF.preload(MODELO.planta)
useGLTF.preload(MODELO.banquinho)
