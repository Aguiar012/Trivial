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

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Box, Cylinder, useGLTF, Center } from '@react-three/drei'
import * as THREE from 'three'

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
    'Red': '#c04050',
    'DarkRed': '#8a2838',
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
}

export function Quarto({ onFloorClick, onCamaClick, onMesaClick, onEstanteClick }: QuartoProps) {
    // ── REFS PARA ANIMAÇÕES VISUAIS ──────────────────────────────────
    const camaRef = useRef<THREE.Group>(null)
    const camaTempo = useRef(999)
    const telaRef = useRef<THREE.MeshBasicMaterial>(null)
    const mesaTempo = useRef(999)

    // ── MODELOS 3D CARREGADOS ────────────────────────────────────────
    const camaScene = useMovel(MODELO.cama, CORES_CAMA)
    const estanteScene = useMovel(MODELO.estante, '#5a3525')
    const luminariaScene = useMovel(MODELO.luminaria, CORES_LUMINARIA, EMISSIVOS_LUMINARIA)
    const plantaScene = useMovel(MODELO.planta, CORES_PLANTA)
    const banquinhoScene = useMovel(MODELO.banquinho, CORES_BANQUINHO)

    // ── LOOP DE ANIMAÇÃO (todo frame) ────────────────────────────────
    useFrame((_state, delta) => {
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
                0.85 + brilho * 0.15,
                0.92 + brilho * 0.08,
                0.95 + brilho * 0.05
            )
        }
    })

    return (
        <group position={[0, -2, 0]}>

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
                {warm('#7a4a55')}
            </Box>

            {/* Rodapé */}
            <Box args={[10, 0.25, 0.1]} position={[0, 0.12, -4.62]}>
                {warm('#4a2530')}
            </Box>
            <Box args={[0.1, 0.25, 10]} position={[-4.62, 0.12, 0]}>
                {warm('#4a2530')}
            </Box>

            {/* Parede do fundo — coral/salmão quente */}
            <Box args={[10, 8, 0.5]} position={[0, 4, -4.75]} receiveShadow>
                {warm('#c05565')}
            </Box>

            {/* Parede lateral esquerda — coral ligeiramente mais escuro */}
            <Box args={[0.5, 8, 10]} position={[-4.75, 4, 0]} receiveShadow>
                {warm('#b04f60')}
            </Box>

            {/* ── JANELA ─────────────────────────────────────── */}
            {/* Céu noturno */}
            <Box args={[3, 4, 0.6]} position={[1, 4.5, -4.72]}>
                <meshBasicMaterial color="#0d1b2a" />
            </Box>
            {/* Estrelinhas */}
            <mesh position={[0.2, 5.8, -4.65]}>
                <sphereGeometry args={[0.04, 8, 8]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[1.5, 5.2, -4.65]}>
                <sphereGeometry args={[0.03, 8, 8]} />
                <meshBasicMaterial color="#ffffcc" />
            </mesh>
            <mesh position={[0.8, 4.2, -4.65]}>
                <sphereGeometry args={[0.03, 8, 8]} />
                <meshBasicMaterial color="#ffffff" />
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
            {/* Cortinas simples (painéis de tecido) */}
            <Box args={[0.8, 4.6, 0.15]} position={[-0.8, 4.5, -4.45]} castShadow>
                <meshStandardMaterial color="#a04050" roughness={0.95} />
            </Box>
            <Box args={[0.8, 4.6, 0.15]} position={[2.8, 4.5, -4.45]} castShadow>
                <meshStandardMaterial color="#a04050" roughness={0.95} />
            </Box>

            {/* ══════════════════════════════════════════════════════
                MÓVEIS INTERATIVOS
            ══════════════════════════════════════════════════════ */}

            {/* ESCRIVANINHA — clique pisca a tela + manda o personagem sentar */}
            <group
                position={[-2.5, 2, -3]}
                onClick={(e) => {
                    e.stopPropagation()
                    mesaTempo.current = 0
                    onMesaClick?.()
                }}
                onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
                onPointerOut={() => { document.body.style.cursor = 'auto' }}
            >
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
                <Box args={[1.2, 0.8, 0.1]} position={[0, 0.5, -0.8]} rotation={[-0.1, 0, 0]} castShadow>
                    {warm('#3a3a40')}
                </Box>
                {/* Tela — pisca quando clica */}
                <Box args={[1.1, 0.7, 0.05]} position={[0, 0.5, -0.74]} rotation={[-0.1, 0, 0]}>
                    <meshBasicMaterial ref={telaRef} color="#d4e8f0" />
                </Box>

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
            <group
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
                <primitive object={camaScene} scale={1.55} rotation={[0, Math.PI / 2, 0]} />
            </group>

            {/* Tapete redondo — rosa quente */}
            <Cylinder args={[3, 3, 0.08, 32]} position={[0, 0.04, 0]} receiveShadow>
                <meshStandardMaterial color="#c06075" roughness={0.95} />
            </Cylinder>

            {/* ══════════════════════════════════════════════════════
                MÓVEIS DECORATIVOS (modelos 3D)
            ══════════════════════════════════════════════════════ */}

            {/* Estante de livros — encostada na parede esquerda */}
            {/* X=-4.0: a cada scale 1.5 o modelo se estende ~0.57u no eixo X após rotação,
                ficando em X=-4.57 — seguro (parede em X=-4.75). Era -4.3 → clipava em -4.83 */}
            <group
                position={[-4.0, 0, 2.0]}
                rotation={[0, Math.PI / 2, 0]}
                onClick={(e) => { e.stopPropagation(); onEstanteClick?.() }}
                onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
                onPointerOut={() => { document.body.style.cursor = 'auto' }}
            >
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

            {/* Planta — canto direito traseiro (modelo 3D) */}
            <primitive object={plantaScene} position={[3.8, 0, -3.5]} scale={1.8} />

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

        </group>
    )
}

// Pré-carrega todos os modelos para não ter delay ao abrir
useGLTF.preload(MODELO.cama)
useGLTF.preload(MODELO.estante)
useGLTF.preload(MODELO.luminaria)
useGLTF.preload(MODELO.planta)
useGLTF.preload(MODELO.banquinho)
