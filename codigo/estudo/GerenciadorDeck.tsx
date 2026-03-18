/*
 * GerenciadorDeck.tsx — Painel lateral para gerenciar cartas de um deck
 *
 * Aparece no lado direito da tela (igual ao painel da mesa).
 * Mostra cartas espalhadas em leque como cartas de baralho.
 */

import { useState, useEffect, useCallback } from 'react'
import type { DyCard } from './tipos'
import { carregarCartas, removerCarta } from './store'

interface GerenciadorDeckProps {
    deckId: string
    deckNome: string
    deckCor: string
    onClose: () => void
    onCartasChanged: () => void
    onEstudarDeck: (deckId: string) => void
}

// Estado FSRS legível
function estadoFSRS(state: number): { label: string; color: string; bg: string } {
    switch (state) {
        case 0: return { label: 'Nova', color: '#8cf', bg: '#1a3040' }
        case 1: return { label: 'Aprendendo', color: '#fc8', bg: '#403020' }
        case 2: return { label: 'Revisão', color: '#8f8', bg: '#1a4020' }
        case 3: return { label: 'Reaprendendo', color: '#f88', bg: '#401a1a' }
        default: return { label: '?', color: '#888', bg: '#222' }
    }
}

// Gera um SVG pixel art de flashcard
function cartaSVG(cor: string, index: number): string {
    const patterns = [
        // Losangos
        `<rect x="8" y="8" width="4" height="4" fill="${cor}40"/><rect x="16" y="12" width="4" height="4" fill="${cor}30"/><rect x="24" y="8" width="4" height="4" fill="${cor}40"/>`,
        // Cruzes
        `<rect x="14" y="6" width="4" height="4" fill="${cor}35"/><rect x="10" y="10" width="4" height="4" fill="${cor}35"/><rect x="18" y="10" width="4" height="4" fill="${cor}35"/><rect x="14" y="14" width="4" height="4" fill="${cor}35"/>`,
        // Pontos
        `<circle cx="10" cy="10" r="2" fill="${cor}40"/><circle cx="22" cy="10" r="2" fill="${cor}40"/><circle cx="16" cy="16" r="2" fill="${cor}40"/>`,
        // Linhas
        `<rect x="6" y="8" width="20" height="2" fill="${cor}25"/><rect x="6" y="14" width="20" height="2" fill="${cor}25"/><rect x="6" y="20" width="20" height="2" fill="${cor}25"/>`,
    ]
    return patterns[index % patterns.length]
}

export function GerenciadorDeck({
    deckId,
    deckNome,
    deckCor,
    onClose,
    onCartasChanged,
    onEstudarDeck,
}: GerenciadorDeckProps) {
    const [cartas, setCartas] = useState<DyCard[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedCard, setSelectedCard] = useState<string | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
    const [hoveredCard, setHoveredCard] = useState<string | null>(null)

    const reload = useCallback(async () => {
        setLoading(true)
        const todas = await carregarCartas()
        const doDeck = todas.filter(c => c.baralhoId === deckId)
        setCartas(doDeck)
        setLoading(false)
    }, [deckId])

    useEffect(() => { reload() }, [reload])

    async function handleDelete(cartaId: string) {
        await removerCarta(cartaId)
        setSelectedCard(null)
        setConfirmDelete(null)
        await reload()
        onCartasChanged()
    }

    const selected = cartas.find(c => c.id === selectedCard)

    // Calcular layout do leque
    const totalCards = cartas.length
    const maxSpread = Math.min(totalCards, 20)
    const fanAngle = Math.min(totalCards * 4, 60) // Graus totais do leque
    const startAngle = -fanAngle / 2

    return (
        <div style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(180deg, #1a1020 0%, #0d0816 50%, #150e1e 100%)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: '"Inter","Segoe UI",sans-serif',
            position: 'relative',
        }}>
            {/* Pixel art background texture */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="4" height="4" fill="${deckCor}08"/><rect x="4" y="4" width="4" height="4" fill="${deckCor}08"/></svg>`)}")`,
                backgroundSize: '8px 8px',
                pointerEvents: 'none',
            }} />

            {/* Header */}
            <div style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                borderBottom: `2px solid ${deckCor}33`,
                background: `linear-gradient(90deg, ${deckCor}15, transparent)`,
                position: 'relative',
                zIndex: 2,
            }}>
                {/* Pixel art deck icon */}
                <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '8px',
                    background: deckCor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 4px 12px ${deckCor}44`,
                    imageRendering: 'pixelated' as any,
                }}>
                    <svg width="28" height="28" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' as any }}>
                        {/* Pixel art book icon */}
                        <rect x="6" y="4" width="20" height="24" rx="2" fill="#fff3" />
                        <rect x="8" y="6" width="16" height="20" fill="#fff2" />
                        <rect x="14" y="4" width="4" height="24" fill="#0003" />
                        <rect x="10" y="10" width="4" height="2" fill="#fff5" />
                        <rect x="18" y="10" width="4" height="2" fill="#fff5" />
                        <rect x="10" y="14" width="4" height="2" fill="#fff3" />
                        <rect x="18" y="14" width="4" height="2" fill="#fff3" />
                    </svg>
                </div>
                <div style={{ flex: 1 }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: '18px',
                        fontWeight: 700,
                        color: '#fff',
                        letterSpacing: '0.5px',
                    }}>{deckNome}</h2>
                    <span style={{ fontSize: '12px', color: '#999' }}>
                        {cartas.length} carta{cartas.length !== 1 ? 's' : ''}
                    </span>
                </div>
                <button
                    onClick={() => { onEstudarDeck(deckId) }}
                    style={{
                        background: `linear-gradient(135deg, ${deckCor}, ${deckCor}cc)`,
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: `0 2px 8px ${deckCor}44`,
                        transition: 'all 0.15s',
                        display: cartas.length > 0 ? 'block' : 'none',
                    }}
                >▶ Estudar</button>
                <button
                    onClick={onClose}
                    style={{
                        background: '#2a2a3e',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#aaa',
                        fontSize: '18px',
                        width: '36px',
                        height: '36px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >✕</button>
            </div>

            {/* Fan area - cartas espalhadas em leque */}
            <div style={{
                flex: 1,
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                paddingBottom: '30px',
            }}>
                {loading && (
                    <div style={{ color: '#555', fontSize: '14px', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
                        Carregando...
                    </div>
                )}

                {!loading && cartas.length === 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%,-50%)',
                        textAlign: 'center',
                        color: '#555',
                    }}>
                        <svg width="64" height="64" viewBox="0 0 64 64" style={{ imageRendering: 'pixelated' as any, marginBottom: '12px' }}>
                            <rect x="16" y="12" width="32" height="40" rx="4" fill="#2a2a3e" stroke="#444" strokeWidth="2" />
                            <rect x="20" y="20" width="24" height="2" fill="#444" />
                            <rect x="20" y="26" width="24" height="2" fill="#444" />
                            <rect x="20" y="32" width="16" height="2" fill="#444" />
                            <text x="32" y="48" textAnchor="middle" fill="#666" fontSize="10">?</text>
                        </svg>
                        <div style={{ fontSize: '14px', marginBottom: '6px' }}>Nenhuma carta</div>
                        <div style={{ fontSize: '12px', color: '#444' }}>Use o lápis na mesa para criar!</div>
                    </div>
                )}

                {/* Fan of cards */}
                {cartas.slice(0, maxSpread).map((carta, i) => {
                    const angle = totalCards === 1 ? 0 : startAngle + (i / (maxSpread - 1)) * fanAngle
                    const isHovered = hoveredCard === carta.id
                    const isSelected = selectedCard === carta.id
                    const liftY = isHovered ? -40 : isSelected ? -60 : 0
                    const estado = estadoFSRS(carta.fsrs.state)

                    return (
                        <div
                            key={carta.id}
                            onClick={() => setSelectedCard(isSelected ? null : carta.id)}
                            onMouseEnter={() => setHoveredCard(carta.id)}
                            onMouseLeave={() => setHoveredCard(null)}
                            style={{
                                position: 'absolute',
                                bottom: '20px',
                                left: '50%',
                                width: '120px',
                                height: '170px',
                                transformOrigin: 'bottom center',
                                transform: `translateX(-60px) rotate(${angle}deg) translateY(${liftY}px)`,
                                transition: 'transform 0.2s ease, box-shadow 0.2s',
                                cursor: 'pointer',
                                zIndex: isHovered || isSelected ? 100 : i,
                            }}
                        >
                            {/* Card body - pixel art style */}
                            <div style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: '8px',
                                background: isSelected
                                    ? 'linear-gradient(180deg, #f8f4ec, #ebe5d8)'
                                    : 'linear-gradient(180deg, #f4efe4, #e8e0d0)',
                                border: isSelected ? `3px solid ${deckCor}` : '2px solid #ccc8',
                                boxShadow: isHovered || isSelected
                                    ? `0 8px 24px rgba(0,0,0,0.4), 0 0 20px ${deckCor}33`
                                    : '0 2px 8px rgba(0,0,0,0.3)',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                imageRendering: 'auto',
                                position: 'relative',
                            }}>
                                {/* Card ruled lines (pixel art style) */}
                                <svg width="120" height="170" viewBox="0 0 120 170" style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    opacity: 0.3,
                                }}>
                                    {/* Margin line */}
                                    <rect x="22" y="0" width="1.5" height="170" fill="#c06060" />
                                    {/* Ruled lines */}
                                    {Array.from({ length: 9 }, (_, j) => (
                                        <rect key={j} x="0" y={30 + j * 15} width="120" height="1" fill="#6090d0" />
                                    ))}
                                </svg>

                                {/* Pixel art pattern overlay */}
                                <svg width="32" height="24" viewBox="0 0 32 24" style={{
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    opacity: 0.4,
                                    imageRendering: 'pixelated' as any,
                                }}>
                                    <g dangerouslySetInnerHTML={{ __html: cartaSVG(deckCor, i) }} />
                                </svg>

                                {/* Card number */}
                                <div style={{
                                    position: 'absolute',
                                    top: '6px',
                                    left: '8px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    color: '#8a7a6a',
                                    fontFamily: 'monospace',
                                }}>#{i + 1}</div>

                                {/* State badge */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '6px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    fontSize: '8px',
                                    fontWeight: 600,
                                    color: estado.color,
                                    background: estado.bg,
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    whiteSpace: 'nowrap',
                                }}>{estado.label}</div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Selected card detail panel */}
            {selected && (
                <div style={{
                    borderTop: `2px solid ${deckCor}33`,
                    background: '#12101e',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    maxHeight: '45%',
                    overflowY: 'auto',
                    animation: 'slideUp 0.2s ease',
                    position: 'relative',
                    zIndex: 2,
                }}>
                    <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>
                            Carta #{cartas.indexOf(selected) + 1}
                        </span>
                        <span style={{
                            fontSize: '11px',
                            color: estadoFSRS(selected.fsrs.state).color,
                            background: estadoFSRS(selected.fsrs.state).bg,
                            padding: '3px 10px',
                            borderRadius: '6px',
                        }}>{estadoFSRS(selected.fsrs.state).label} · {selected.fsrs.reps} revisões</span>
                    </div>

                    {/* Front/Back previews */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {['frente', 'verso'].map(side => {
                            const content = side === 'frente' ? selected.frente : selected.verso
                            const isSvg = content.trim().startsWith('<svg') || content.trim().startsWith('<?xml')
                            return (
                                <div key={side} style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: '10px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px',
                                        color: '#666',
                                        marginBottom: '4px',
                                        fontWeight: 600,
                                    }}>{side === 'frente' ? 'Pergunta' : 'Resposta'}</div>
                                    <div style={{
                                        background: '#1a1830',
                                        borderRadius: '8px',
                                        padding: '10px',
                                        height: '90px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        border: '1px solid #2a2840',
                                    }}>
                                        {isSvg ? (
                                            <div
                                                dangerouslySetInnerHTML={{ __html: content }}
                                                style={{ width: '100%', height: '100%' }}
                                            />
                                        ) : (
                                            <span style={{
                                                color: '#bbb',
                                                fontSize: '12px',
                                                textAlign: 'center',
                                                wordBreak: 'break-word',
                                            }}>{content || '(vazio)'}</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        {confirmDelete === selected.id ? (
                            <>
                                <span style={{ color: '#f88', fontSize: '12px', alignSelf: 'center', marginRight: '8px' }}>
                                    Excluir esta carta?
                                </span>
                                <button onClick={() => handleDelete(selected.id)} style={{
                                    background: '#d03030',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    padding: '6px 16px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}>Sim, excluir</button>
                                <button onClick={() => setConfirmDelete(null)} style={{
                                    background: '#2a2a3e',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: '#aaa',
                                    padding: '6px 16px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                }}>Cancelar</button>
                            </>
                        ) : (
                            <button
                                onClick={() => setConfirmDelete(selected.id)}
                                style={{
                                    background: '#2a1a1a',
                                    border: '1px solid #3a2020',
                                    borderRadius: '6px',
                                    color: '#f66',
                                    padding: '6px 14px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >🗑 Excluir carta</button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
