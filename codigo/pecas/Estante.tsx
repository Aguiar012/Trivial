/*
 * Estante.tsx — Estante interativa com caixas 3D representando decks
 *
 * Cada caixa na prateleira é um deck (matéria).
 * Mostra etiqueta com nome + progresso ("12/30").
 * Click numa caixa → seleciona o deck para estudo.
 */

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

export interface DeckInfo {
    id: string
    nome: string
    cor: string
    totalCartas: number
    cartasHoje: number
}

interface CaixaDeckProps {
    deck: DeckInfo
    posicao: [number, number, number]
    onClick: () => void
}

function CaixaDeck({ deck, posicao, onClick }: CaixaDeckProps) {
    const ref = useRef<THREE.Group>(null)
    const [hover, setHover] = useState(false)

    useFrame((_, dt) => {
        if (ref.current) {
            const tgtY = hover ? posicao[1] + 0.08 : posicao[1]
            ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, tgtY, dt * 8)
        }
    })

    return (
        <group
            ref={ref}
            position={posicao}
            onClick={(e) => { e.stopPropagation(); onClick() }}
            onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
        >
            {/* Corpo da caixa */}
            <RoundedBox args={[0.35, 0.3, 0.25]} radius={0.02} smoothness={2} castShadow>
                <meshStandardMaterial
                    color={deck.cor}
                    roughness={0.85}
                    emissive={hover ? deck.cor : '#000000'}
                    emissiveIntensity={hover ? 0.2 : 0}
                />
            </RoundedBox>

            {/* Etiqueta (faixa branca na frente) */}
            <RoundedBox args={[0.28, 0.12, 0.005]} radius={0.01} smoothness={2}
                position={[0, 0.02, 0.13]}>
                <meshStandardMaterial color="#f4f0e8" roughness={0.9} />
            </RoundedBox>

            {/* Nome do deck */}
            <Text
                position={[0, 0.04, 0.135]}
                fontSize={0.035}
                color="#2a1a10"
                anchorX="center"
                anchorY="middle"
                maxWidth={0.26}
            >
                {deck.nome}
            </Text>

            {/* Progresso */}
            <Text
                position={[0, -0.01, 0.135]}
                fontSize={0.025}
                color="#6a5a4a"
                anchorX="center"
                anchorY="middle"
            >
                {`${deck.cartasHoje}/${deck.totalCartas}`}
            </Text>

            {/* Notificação (!) se tem cartas pendentes */}
            {deck.cartasHoje > 0 && (
                <NotificacaoDeck position={[0.15, 0.2, 0.13]} />
            )}
        </group>
    )
}

function NotificacaoDeck({ position }: { position: [number, number, number] }) {
    const ref = useRef<THREE.Group>(null)

    useFrame((s) => {
        if (ref.current) {
            ref.current.position.y = position[1] + Math.sin(s.clock.elapsedTime * 3) * 0.02
        }
    })

    return (
        <group ref={ref} position={position}>
            <mesh>
                <sphereGeometry args={[0.04, 10, 10]} />
                <meshStandardMaterial
                    color="#e04040"
                    emissive="#e04040"
                    emissiveIntensity={0.5}
                />
            </mesh>
            <Text
                position={[0, 0, 0.03]}
                fontSize={0.035}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
            >
                !
            </Text>
        </group>
    )
}

interface EstanteProps {
    decks: DeckInfo[]
    onDeckClick: (deckId: string) => void
}

export function EstanteInterativa({ decks, onDeckClick }: EstanteProps) {
    // Distribui caixas nas prateleiras (max 3 por prateleira)
    const PRATELEIRA_Y = [0.3, 1.2, 2.1]
    const PRATELEIRA_X = [-0.25, 0.1, 0.45]

    return (
        <group>
            {decks.map((deck, i) => {
                const prateleira = Math.floor(i / 3)
                const posNaPrateleira = i % 3
                if (prateleira >= PRATELEIRA_Y.length) return null

                return (
                    <CaixaDeck
                        key={deck.id}
                        deck={deck}
                        posicao={[
                            PRATELEIRA_X[posNaPrateleira],
                            PRATELEIRA_Y[prateleira],
                            0,
                        ]}
                        onClick={() => onDeckClick(deck.id)}
                    />
                )
            })}
        </group>
    )
}
