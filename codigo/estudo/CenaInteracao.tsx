/*
 * CenaInteracao.tsx — Cena 3D: mesa de estudo aconchegante
 *
 * Mesa de madeira rústica com luminária, caderno, lápis dourado, flashcards.
 * Atmosfera quente e intimista — estudar à noite sob a luz de um abajur.
 *
 * TUDO é 3D. Nenhum elemento HTML/2D.
 */

import { useRef, useState, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, RoundedBox, Cylinder } from '@react-three/drei'
import * as THREE from 'three'
import type { DyCard } from './tipos'
import type { PreviewIntervalos } from './fsrs'

// ── CÂMERA ──────────────────────────────────────────────────────────────

function CameraMesa() {
    const { camera, size } = useThree()

    // Adjust camera position based on viewport size
    const isMobile = size.width < 768

    useFrame(() => {
        if (isMobile) {
            // Mobile: camera muito mais perto, olhando direto para a carta
            camera.position.set(0.2, 2.0, 1.5)
            camera.lookAt(0.2, 0.05, 0.4)
            if ('fov' in camera) {
                // eslint-disable-next-line react-hooks/immutability
                (camera as THREE.PerspectiveCamera).fov = 60
                ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
            }
        } else {
            // Desktop: foco no centro da mesa, ligeiramente à direita para incluir o lápis
            camera.lookAt(0.6, 0.0, -0.2)
        }
    })
    return null
}

// ── PALETA DE CORES ─────────────────────────────────────────────────────

const C = {
    mesa: '#5c3a24',
    mesaBorda: '#3d2416',
    papel: '#f4e8d0',
    linha: '#d0b898',
    tinta: '#1a0e06',
    tintaSuave: '#7a6050',
    capa: '#2a3040',
    pagina: '#f8f0e0',
    lombada: '#1a2530',
    lapis: '#e8b830',
    borracha: '#d06060',
    grafite: '#404040',
    pontaLapis: '#c09060',
    metal: '#b8a080',
    metalEsc: '#8a7060',
    lampada: '#ffe8c0',
    ceramica: '#e0d0b8',
    cafe: '#3a2010',
    fita: '#a04040',
}

function buildCardCanvas(content: string, type: 'frente' | 'verso'): HTMLCanvasElement {
    const W = 1400, H = 900;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { alpha: true })!;

    // Limpar com transparente puro
    ctx.clearRect(0, 0, W, H);

    // Path com cantos arredondados
    ctx.beginPath();
    const r = 60;
    ctx.moveTo(r, 0);
    ctx.lineTo(W - r, 0);
    ctx.arcTo(W, 0, W, r, r);
    ctx.lineTo(W, H - r);
    ctx.arcTo(W, H, W - r, H, r);
    ctx.lineTo(r, H);
    ctx.arcTo(0, H, 0, H - r, r);
    ctx.lineTo(0, r);
    ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath();

    // Fundo papel branco
    ctx.fillStyle = type === 'verso' ? '#eef2ff' : '#fefefe';
    ctx.fill();
    ctx.clip();

    // Pautas horizontais sólidas
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#6090d0';
    for (let y = 110; y < H; y += 72) {
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(W - 20, y);
        ctx.stroke();
    }

    // Margem esquerda vermelha
    ctx.strokeStyle = '#cc3333';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(180, 0);
    ctx.lineTo(180, H);
    ctx.stroke();

    // Conteúdo texto (síncrono)
    if (content.trim() && !content.trim().startsWith('<svg') && !content.trim().startsWith('<?xml')) {
        ctx.fillStyle = '#1a2a3a';
        ctx.font = 'bold 54px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const words = content.split(' ');
        let line = '';
        const lines: string[] = [];
        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            if (ctx.measureText(testLine).width > 1100 && i > 0) {
                lines.push(line.trim());
                line = words[i] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line.trim());
        const lineH = 74;
        let y = H / 2 - ((lines.length - 1) * lineH) / 2;
        lines.forEach(l => { ctx.fillText(l, W / 2, y); y += lineH; });
    }

    return canvas;
}

function useCardTexture(content: string, type: 'frente' | 'verso') {
    // Criar textura de forma síncrona para evitar flash branco
    const tex = useMemo(() => {
        const canvas = buildCardCanvas(content, type);
        const t = new THREE.CanvasTexture(canvas);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 16;
        t.premultiplyAlpha = false;
        return t;
    }, [content, type]);

    // SVG: desenhar async e forçar atualização
    useEffect(() => {
        if (!content.trim().startsWith('<svg') && !content.trim().startsWith('<?xml')) return;
        const W = 1400, H = 900;
        // Rebuild canvas with SVG on top
        const canvas = buildCardCanvas('', type); // base sem texto
        const ctx = canvas.getContext('2d')!;
        const img = new Image();
        img.onload = () => {
            const size = Math.min(W, H) * 0.65;
            ctx.drawImage(img, (W - size) / 2, (H - size) / 2, size, size);
            tex.image = canvas;
            tex.needsUpdate = true;
        };
        img.onerror = () => {/* keep existing */};
        const safeSvg = content.includes('xmlns') ? content : content.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
        img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(safeSvg)))}`;
    }, [content, type, tex]);

    return tex;
}


// ── TIPOS EXPORTADOS ────────────────────────────────────────────────────

export type FaseEstudo =
    | 'idle'
    | 'estudando'
    | 'virada'
    | 'escrevendo_frente'
    | 'escrevendo_verso'
    | 'salvando'
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
    feedback?: 'acerto' | 'erro' | null
    onClickPilha: () => void
    onClickCarta: () => void
    onClickLapis: () => void
    onAvaliar: (nota: number) => void
    onConfirmarTexto: () => void
    onAbrirTecladoMobile?: () => void
    onSwipeHint?: (hint: { dir: 0|1|2|3|4; opacity: number; dx: number }) => void
    cartasPendentes?: DyCard[]
    onGuardarTodas?: () => void
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
                <torusGeometry args={[0.05, 0.032, 8, 12, Math.PI]} />
                <meshStandardMaterial color={C.ceramica} roughness={0.85} />
            </mesh>
            {/* Borda */}
            <Cylinder args={[0.095, 0.09, 0.03, 16]} position={[0, 0.205, 0]}>
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
            position={[1.3, 0.14, 0.2]}
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

function PilhaCartas({ quantidade, cartaTopo, onClick }: { quantidade: number; cartaTopo?: any; onClick: () => void }) {
    const [hover, setHover] = useState(false)
    const [cartas, setCartas] = useState<{key: number, ox: number, oz: number, rot: number}[]>([])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCartas(Array.from({ length: Math.min(quantidade, 10) }, (_, i) => ({
            key: i,
            ox: (Math.random() - 0.5) * 0.05,
            oz: (Math.random() - 0.5) * 0.03,
            rot: (Math.random() - 0.5) * 0.08,
        })))
    }, [quantidade])

    const texTopo = useCardTexture(cartaTopo?.frente || '', 'frente')

    if (quantidade === 0) return null

    return (
        <group
            position={[0.8, 0.08, 0.5]}
            onClick={(e) => { e.stopPropagation(); onClick() }}
            onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
        >
            {cartas.map((c) => (
                <group key={c.key} position={[c.ox, c.key * 0.003, c.oz]} rotation={[0, c.rot, 0]}>
                    {/* Espessura da carta (fina) */}
                    <mesh position={[0, 0, 0]}>
                        <boxGeometry args={[1.4, 0.003, 0.9]} />
                        <meshBasicMaterial color="#e8e8e8" />
                    </mesh>

                    {/* Face com textura canvas (igual CartaAtiva) no topo */}
                    <mesh
                        position={[0, 0.002, 0]}
                        rotation={[-Math.PI / 2, 0, 0]}
                        renderOrder={5 + c.key}
                    >
                        <planeGeometry args={[1.4, 0.9]} />
                        <meshBasicMaterial
                            map={texTopo}
                            alphaTest={0.05}
                            transparent={true}
                            depthWrite={false}
                            color={hover && c.key === cartas.length - 1 ? '#f0f8ff' : '#ffffff'}
                        />
                    </mesh>
                </group>
            ))}
            <Text
                position={[0, Math.min(quantidade, 10) * 0.003 + 0.04, 0]}
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
    feedback,
    onClick,
    onAvaliar,
    onSwipeHint,
}: {
    textoFrente: string
    textoVerso: string
    virada: boolean
    editando: boolean
    feedback?: 'acerto' | 'erro' | null
    onClick: () => void
    onAvaliar?: (rating: 1 | 2 | 3 | 4) => void
    onSwipeHint?: (hint: { dir: 0|1|2|3|4; opacity: number; dx: number }) => void
}) {
    const ref = useRef<THREE.Group>(null)
    const flip = useRef(0)
    const velocidadeFlip = useRef(0)
    const posY = useRef(0.08)

    // Tinder drag state
    const [drag, setDrag] = useState({ active: false, startX: 0, startY: 0, x: 0, y: 0 })

    // Position targets for smooth dragging
    const posX = useRef(0.2)
    const posZ = useRef(0.5)

    // Responsive thresholds: smaller screens need smaller gestures
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    const hintThreshold = isMobile ? 20 : 40
    const hintRange = isMobile ? 40 : 80
    const swipeThreshold = isMobile ? 50 : 120
    const clickThreshold = isMobile ? 15 : 10
    const dragScale = isMobile ? 0.012 : 0.005
    const rotScale = isMobile ? 0.003 : 0.001

    const notifyHint = (dx: number, dy: number) => {
        if (!onSwipeHint || !virada) return
        let dir: 0|1|2|3|4 = 0
        let opacity = 0
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > hintThreshold) {
            dir = dx < 0 ? 1 : 3
            opacity = Math.min((Math.abs(dx) - hintThreshold) / hintRange, 1)
        } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > hintThreshold) {
            dir = dy > 0 ? 2 : 4
            opacity = Math.min((Math.abs(dy) - hintThreshold) / hintRange, 1)
        }
        onSwipeHint({ dir, opacity, dx })
    }

    const texFrente = useCardTexture(textoFrente, 'frente')
    const texVerso = useCardTexture(textoVerso, 'verso')

    // Geometria sub-dividida para poder dobrar livremente (grid interno = bending funciona)
    const [geomFrente] = useState(() => new THREE.PlaneGeometry(1.4, 0.9, 32, 24))
    const [geomVerso]  = useState(() => new THREE.PlaneGeometry(1.4, 0.9, 32, 24))
    
    // Arrays originais p/ matemágica do shader via CPU
    const origPosF = useMemo(() => new Float32Array(geomFrente.attributes.position.array), [geomFrente])

    // Física de líquido/geleia da carta
    const bendX = useRef(0)
    const bendY = useRef(0)
    const velX = useRef(0)
    const velY = useRef(0)

    const handlePointerDown = (e: any) => {
        e.stopPropagation()
        if (editando) return
        // Try to capture pointer (may fail on some mobile browsers)
        try { e.target.setPointerCapture(e.pointerId) } catch { /* ignore */ }
        setDrag({ active: true, startX: e.clientX, startY: e.clientY, x: 0, y: 0 })
    }

    const handlePointerMove = (e: any) => {
        if (!drag.active) return
        e.stopPropagation()
        const dx = e.clientX - drag.startX
        const dy = e.clientY - drag.startY
        setDrag(prev => ({ ...prev, x: dx, y: dy }))
        notifyHint(dx, dy)
    }

    const handlePointerUp = (e: any) => {
        e.stopPropagation()
        if (!drag.active) return
        try { e.target.releasePointerCapture(e.pointerId) } catch { /* ignore */ }

        const dx = drag.x
        const dy = drag.y

        setDrag({ active: false, startX: 0, startY: 0, x: 0, y: 0 })
        if (onSwipeHint) onSwipeHint({ dir: 0, opacity: 0, dx: 0 })

        // Handle as simple click if not moved much
        if (Math.abs(dx) < clickThreshold && Math.abs(dy) < clickThreshold) {
            onClick()
            return
        }

        // Emulate tinder swipe for evaluations
        if (virada && onAvaliar) {
            if (Math.abs(dx) > swipeThreshold || Math.abs(dy) > swipeThreshold) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    if (dx < 0) onAvaliar(1) // Left -> Errei
                    else onAvaliar(3) // Right -> Bom
                } else {
                    if (dy > 0) onAvaliar(2) // Down -> Difícil
                    else onAvaliar(4) // Up -> Fácil
                }
            }
        }
    }

    useFrame((s, dt) => {
        const tgtFlip = virada ? Math.PI : 0
        const diff = tgtFlip - flip.current

        // Spring com overshoot (underdamped)
        if (Math.abs(diff) > 0.01) {
            velocidadeFlip.current += diff * 25 * dt  // stiffness
            velocidadeFlip.current *= 0.85             // damping
            flip.current += velocidadeFlip.current * dt
        } else {
            flip.current = tgtFlip
            velocidadeFlip.current = 0
        }

        posY.current = THREE.MathUtils.lerp(posY.current, 0.4, dt * 4)

        let tX = 0.2
        let tZ = 0.5
        let tRx = flip.current
        let tRy = 0
        let tRz = 0

        if (drag.active && virada && !editando) {
            // Translade following pointer (scaled to 3D)
            tX += drag.x * dragScale
            tZ += drag.y * dragScale

            // Emphasize the Tinder effect by rotating with drag
            tRy = -drag.x * rotScale
            tRz = -drag.x * rotScale
            tRx = flip.current - drag.y * rotScale
        }

        // BENDING EFFECT NA PLACA (LIQUID PHYSICS)
        // Multiplicadores suaves - papel fino mas não borracha
        const tgtBendX = drag.active && virada ? Math.max(-150, Math.min(150, drag.x)) * 0.0012 : 0
        const tgtBendY = drag.active && virada ? Math.max(-150, Math.min(150, drag.y)) * 0.0018 : 0

        // Jello spring - Math.min(dt, 0.05) para não espiralar no infinito em lag
        const safeDt = Math.min(dt, 0.05)
        
        velX.current += (tgtBendX - bendX.current) * 200 * safeDt
        velY.current += (tgtBendY - bendY.current) * 200 * safeDt
        
        // Damping mais alto = para mais rápido (papel não vibra éons)
        const damping = Math.exp(-9 * safeDt)
        velX.current *= damping
        velY.current *= damping
        
        bendX.current += velX.current * safeDt
        bendY.current += velY.current * safeDt

        // Ondulação fluida extra (mais discreta)
        const speed = Math.sqrt(velX.current**2 + velY.current**2)
        const ripple = Math.sin(s.clock.elapsedTime * 18) * Math.min(speed, 2.0) * 0.008

        if (geomFrente && geomVerso) {
            const arrF = geomFrente.attributes.position.array as Float32Array
            const arrV = geomVerso.attributes.position.array as Float32Array

            // Atualiza geometria só se estiver movendo ou com mola ativada
            if (Math.abs(bendX.current) > 0.0005 || Math.abs(bendY.current) > 0.0005 || Math.abs(ripple) > 0.001) {
                for (let i = 0; i < arrF.length; i += 3) {
                    const xF = origPosF[i], yF = origPosF[i+1]
                    let zF = 0
                    
                    zF -= bendX.current * (xF * Math.abs(xF)) * 0.8
                    zF -= bendY.current * (yF * Math.abs(yF)) * 0.8
                    zF -= bendX.current * yF * 0.3
                    zF += bendY.current * xF * 0.3
                    zF += ripple * Math.sin(xF * 6) * Math.cos(yF * 6)
                    
                    // eslint-disable-next-line react-hooks/immutability
                    arrF[i+2] = zF
                    // eslint-disable-next-line react-hooks/immutability
                    arrV[i+2] = -zF 
                }
                geomFrente.attributes.position.needsUpdate = true
                geomFrente.computeVertexNormals()
                geomVerso.attributes.position.needsUpdate = true
                geomVerso.computeVertexNormals()
            } else if (Math.abs(arrF[2]) > 0.00001) {
                for (let i = 0; i < arrF.length; i += 3) {
                    arrF[i+2] = 0
                    arrV[i+2] = 0
                }
                geomFrente.attributes.position.needsUpdate = true
                geomFrente.computeVertexNormals()
                geomVerso.attributes.position.needsUpdate = true
                geomVerso.computeVertexNormals()
            }
        }


        posX.current = THREE.MathUtils.lerp(posX.current, tX, dt * 10)
        posZ.current = THREE.MathUtils.lerp(posZ.current, tZ, dt * 10)

        if (ref.current) {
            ref.current.rotation.set(tRx, tRy, tRz)
            ref.current.position.set(posX.current, posY.current, posZ.current)

            // Shake no erro
            if (feedback === 'erro') {
                ref.current.position.x = posX.current + Math.sin(s.clock.elapsedTime * 40) * 0.03
            } else if (!feedback && !drag.active) {
                // Ensure it snaps back nicely if not dragging
                ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, 0.2, dt * 8)
            }
        }
    })

    return (
        <group
            ref={ref}
            position={[0.2, 0.08, 0.5]}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerOver={() => { document.body.style.cursor = editando ? 'text' : virada ? 'grab' : 'pointer' }}
            onPointerOut={() => { document.body.style.cursor = 'auto' }}
        >
            {/* Base invisível pra receber clique/touch na área toda facilmente */}
            <mesh visible={false} position={[0,0,0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[1.4, 0.9]} />
                <meshBasicMaterial />
            </mesh>
            
            {/* ── FRENTE (face +Y no mundo do card, mas plano X-Y) ── */}
            <mesh geometry={geomFrente} position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
                <meshBasicMaterial 
                    map={texFrente} 
                    alphaTest={0.05} 
                    transparent={true}
                    depthWrite={false}
                    side={THREE.FrontSide}
                    color={feedback === 'acerto' ? '#e0ffe0' : feedback === 'erro' ? '#ffe0e0' : '#ffffff'}
                />
            </mesh>

            {/* ── VERSO (face -Z virada) ── */}
            <mesh geometry={geomVerso} position={[0, -0.002, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={10}>
                <meshBasicMaterial 
                    map={texVerso} 
                    alphaTest={0.05} 
                    transparent={true}
                    depthWrite={false}
                    side={THREE.FrontSide}
                    color={feedback === 'acerto' ? '#e0ffe0' : feedback === 'erro' ? '#ffe0e0' : '#ffffff'}
                />
            </mesh>
            
            {editando && !virada && (
                <CursorPiscante
                    position={[0, 0.012, 0.005]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    fontSize={0.1}
                />
            )}
            {editando && virada && (
                <CursorPiscante
                    position={[0, -0.012, -0.005]}
                    rotation={[Math.PI / 2, 0, 0]}
                    fontSize={0.1}
                />
            )}
        </group>
    )
}

// ── SELOS DE AVALIAÇÃO ──────────────────────────────────────────────────

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
            <RoundedBox args={[1.9, 0.018, 1.3]} radius={0.008} smoothness={3}>
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

/* Botões antigos de Avaliação (substituídos pelo Swipe Tinder)
function SeloItem({ cor, label, x, onClick, intervalo }: {
    cor: string
    label: string
    x: number
    onClick: () => void
    intervalo?: string
}) {
    const ref = useRef<THREE.Group>(null)
    const [hover, setHover] = useState(false)

    useFrame((s) => {
        if (ref.current) {
            // flutua diferente baseado no X pra não ficarem todos sincronizados
            ref.current.position.y = 0.08
                + Math.sin(s.clock.elapsedTime * 2 + x) * 0.015
                + (hover ? 0.04 : 0)
        }
    })

    return (
        <group
            ref={ref}
            position={[x, 0.08, 0]}
            onClick={(e) => { e.stopPropagation(); onClick() }}
            onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
        >
            <Cylinder args={[0.25, 0.27, 0.13, 16]} castShadow>
                <meshStandardMaterial
                    color={cor}
                    roughness={0.7}
                    emissive={hover ? cor : '#000000'}
                    emissiveIntensity={hover ? 0.3 : 0}
                />
            </Cylinder>
            <Cylinder args={[0.2, 0.2, 0.025, 16]} position={[0, 0.07, 0]}>
                <meshStandardMaterial color={cor} roughness={0.5} metalness={0.15} />
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
*/

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

// ── PILHA DE RASCUNHOS (cartas criadas mas não salvas) ──────────────────

function PilhaRascunhos({ quantidade, onGuardar }: { quantidade: number; onGuardar: () => void }) {
    const [hover, setHover] = useState(false)
    const btnRef = useRef<THREE.Group>(null)

    useFrame((s) => {
        if (btnRef.current) {
            // Pulsação suave no botão de guardar
            const pulse = Math.sin(s.clock.elapsedTime * 3) * 0.02
            btnRef.current.position.y = 0.12 + pulse + (hover ? 0.04 : 0)
        }
    })

    // Gerar offsets aleatórios estáveis para as cartas
    // IMPORTANTE: Hooks DEVEM ser chamados ANTES de qualquer return condicional!
    const offsets = useMemo(() => 
        Array.from({ length: Math.min(quantidade, 8) }, (_, i) => ({
            key: i,
            ox: (Math.sin(i * 2.7) * 0.03),
            oz: (Math.cos(i * 3.1) * 0.02),
            rot: (Math.sin(i * 1.3) * 0.06),
        }))
    , [quantidade])

    const texRascunho = useCardTexture('', 'frente')

    if (quantidade === 0) return null

    return (
        <group position={[-1.0, 0.08, 0.8]}>
            {/* Pilha de cartas rascunho */}
            {offsets.map((c) => (
                <group key={c.key} position={[c.ox, c.key * 0.003, c.oz]} rotation={[0, c.rot, 0]}>
                    <mesh position={[0, 0, 0]}>
                        <boxGeometry args={[1.0, 0.003, 0.65]} />
                        <meshBasicMaterial color="#e0e0e0" />
                    </mesh>
                    <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3 + c.key}>
                        <planeGeometry args={[1.0, 0.65]} />
                        <meshBasicMaterial
                            map={texRascunho}
                            alphaTest={0.05}
                            transparent={true}
                            depthWrite={false}
                            color="#ffffff"
                        />
                    </mesh>
                </group>
            ))}

            {/* Contador de rascunhos */}
            <Text
                position={[0, Math.min(quantidade, 8) * 0.003 + 0.04, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.09}
                color="#6a5040"
                anchorX="center"
                anchorY="middle"
            >
                {quantidade} rascunho{quantidade !== 1 ? 's' : ''}
            </Text>

            {/* Botão "Guardar tudo" */}
            <group
                ref={btnRef}
                position={[0, 0.12, 0.55]}
                onClick={(e) => { e.stopPropagation(); onGuardar() }}
                onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer' }}
                onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
            >
                <RoundedBox args={[0.8, 0.06, 0.25]} radius={0.02} smoothness={2} castShadow>
                    <meshStandardMaterial
                        color="#2a7a40"
                        roughness={0.6}
                        emissive={hover ? '#2a7a40' : '#000000'}
                        emissiveIntensity={hover ? 0.4 : 0}
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
                    ✓ Guardar tudo
                </Text>
            </group>
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
    stats,
    feedback,
    onClickPilha,
    onClickCarta,
    onClickLapis,
    onAvaliar,
    onConfirmarTexto,
    onAbrirTecladoMobile,
    onSwipeHint,
    cartasPendentes,
    onGuardarTodas,
}: CenaInteracaoProps) {

    // Novas props de rascunhos
    const pendentes = cartasPendentes ?? []
    const guardarTodas = onGuardarTodas ?? (() => {})

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
                <PilhaCartas quantidade={totalHoje} cartaTopo={cartaAtual} onClick={onClickPilha} />
            )}

            {/* Dica quando não tem cartas E não tem rascunhos */}
            {fase === 'idle' && totalHoje === 0 && pendentes.length === 0 && <DicaVazia />}

            {/* Pilha de rascunhos (cartas criadas mas não salvas) */}
            <PilhaRascunhos quantidade={pendentes.length} onGuardar={guardarTodas} />

            {/* Carta ativa */}
            {/* Animação de card voando ao salvar */}
            {fase === 'salvando' && (
                <CartaVoando
                    textoFrente={textoFrenteSalvo}
                    onTerminou={() => { }}
                />
            )}

            {mostrarCarta && (
                <CartaAtiva
                    key={cartaAtual?.id ?? `new-${fase}`}
                    textoFrente={displayFrente}
                    textoVerso={displayVerso}
                    virada={cartaVirada}
                    editando={cartaEditando}
                    feedback={feedback}
                    onClick={onClickCarta}
                    onAvaliar={fase === 'virada' ? onAvaliar : undefined}
                    onSwipeHint={fase === 'virada' ? onSwipeHint : undefined}
                />
            )}

            {/* Botão teclado mobile */}
            {(fase === 'escrevendo_frente' || fase === 'escrevendo_verso') && onAbrirTecladoMobile && (
                <BotaoTeclado onClick={onAbrirTecladoMobile} />
            )}

            {/* Selos de avaliação 
                Comentado porque agora a avaliação é feita por swipe style Tinder!
            {fase === 'virada' && (
                <SelosAvaliacao onAvaliar={onAvaliar} intervalos={intervalos} />
            )}
            */}

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

            {/* Post-it de streak */}
            {(fase === 'estudando' || fase === 'virada' || fase === 'concluido') && (
                <PostItStreak acertos={stats.acertos} />
            )}

            {/* Mensagem de conclusão */}
            {fase === 'concluido' && <MensagemConclusao stats={stats} />}
        </>
    )
}
