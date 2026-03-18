import { useEffect, useState } from 'react'

export interface NotebookFaceProps {
    /** Estado emocional do robô */
    emotion?: 'idle' | 'happy' | 'thinking' | 'sleeping'
    className?: string
}

export function NotebookFace({ emotion = 'idle', className = '' }: NotebookFaceProps) {
    const [blink, setBlink] = useState(false)
    const [look, setLook] = useState({ x: 0, y: 0 })

    // ── ROTINA DE PISCAR ──────────────────────────────────────────────────
    useEffect(() => {
        if (emotion === 'sleeping') return

        const scheduleBlink = () => {
            const nextBlink = 2000 + Math.random() * 4000
            return setTimeout(() => {
                setBlink(true)
                setTimeout(() => setBlink(false), 150)

                if (Math.random() > 0.7) {
                    setTimeout(() => {
                        setBlink(true)
                        setTimeout(() => setBlink(false), 150)
                    }, 380)
                }
                timeoutId = scheduleBlink()
            }, nextBlink)
        }

        let timeoutId = scheduleBlink()
        return () => clearTimeout(timeoutId)
    }, [emotion])

    // ── MOVIMENTO DOS OLHOS ───────────────────────────────────────────────
    useEffect(() => {
        if (emotion === 'sleeping') {
            setLook({ x: 0, y: 14 })
            return
        }
        const handleMouseMove = (e: MouseEvent) => {
            const nx = (e.clientX / window.innerWidth) * 2 - 1
            const ny = (e.clientY / window.innerHeight) * 2 - 1
            setLook({ x: nx * 14, y: ny * 10 })
        }
        window.addEventListener('mousemove', handleMouseMove)
        return () => window.removeEventListener('mousemove', handleMouseMove)
    }, [emotion])

    const eyeScaleY = blink || emotion === 'sleeping' ? 0.08 : 1
    const isHappy = emotion === 'happy'
    const isThinking = emotion === 'thinking'
    const irisColor = isThinking ? '#ffcc00' : '#00eeff'
    const glowColor = isThinking ? '#ffcc00' : '#00c8ff'

    return (
        <div
            className={`notebook-face-container ${className}`}
            style={{
                background: 'radial-gradient(ellipse at 50% 60%, #0a1628 60%, #050d18 100%)',
                borderRadius: 4,
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            {/* Scan-line overlay for CRT feel */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 4px)',
                pointerEvents: 'none', zIndex: 2,
            }} />

            <svg
                viewBox="0 0 300 200"
                className="notebook-svg"
                preserveAspectRatio="xMidYMid meet"
                style={{ position: 'relative', zIndex: 1 }}
            >
                <defs>
                    {/* Glow forte */}
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="glowSmall" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* ── OLHO ESQUERDO ── */}
                <g transform="translate(90, 100)">
                    {/* Anel externo */}
                    <ellipse cx="0" cy="0" rx="36" ry="44"
                        fill="none" stroke="#1a3a4a" strokeWidth="5" filter="url(#glowSmall)" />
                    {/* Fundo do olho */}
                    <ellipse cx="0" cy="0" rx="32" ry="40" fill="#071015" />

                    {/* Pálpebra animada */}
                    <g style={{
                        transform: `scaleY(${eyeScaleY})`,
                        transition: 'transform 0.12s cubic-bezier(0.4,0,0.2,1)',
                        transformOrigin: '0px 0px'
                    }}>
                        {/* Íris + pupila */}
                        <g style={{
                            transform: `translate(${look.x}px, ${look.y}px)`,
                            transition: 'transform 0.18s ease-out'
                        }}>
                            {/* Anel de íris */}
                            <circle cx="0" cy="0" r="24" fill={irisColor} opacity="0.2" />
                            {/* Pupila */}
                            <circle cx="0" cy="0" r="20" fill={irisColor} filter="url(#glow)" />
                            {/* Brilho secundário */}
                            <circle cx="0" cy="0" r="13" fill="#ffffff" opacity="0.12" />
                            {/* Catchlight */}
                            <circle cx="-6" cy="-7" r="5" fill="#ffffff" opacity="0.9" />
                            <circle cx="7" cy="-10" r="2.5" fill="#ffffff" opacity="0.5" />
                        </g>

                        {/* Capa feliz */}
                        {isHappy && (
                            <path d="M -36 8 Q 0 -14 36 8 L 36 50 L -36 50 Z" fill="#071015" />
                        )}
                    </g>

                    {/* Pálpebra pensativa */}
                    {isThinking && (
                        <path d="M -40 -48 L 40 -22 L 40 -50 L -40 -50 Z" fill="#071015" />
                    )}
                </g>

                {/* ── OLHO DIREITO ── */}
                <g transform="translate(210, 100)">
                    <ellipse cx="0" cy="0" rx="36" ry="44"
                        fill="none" stroke="#1a3a4a" strokeWidth="5" filter="url(#glowSmall)" />
                    <ellipse cx="0" cy="0" rx="32" ry="40" fill="#071015" />

                    <g style={{
                        transform: `scaleY(${eyeScaleY})`,
                        transition: 'transform 0.12s cubic-bezier(0.4,0,0.2,1)',
                        transformOrigin: '0px 0px'
                    }}>
                        <g style={{
                            transform: `translate(${look.x}px, ${look.y}px)`,
                            transition: 'transform 0.18s ease-out'
                        }}>
                            <circle cx="0" cy="0" r="24" fill={irisColor} opacity="0.2" />
                            <circle cx="0" cy="0" r="20" fill={irisColor} filter="url(#glow)" />
                            <circle cx="0" cy="0" r="13" fill="#ffffff" opacity="0.12" />
                            <circle cx="-6" cy="-7" r="5" fill="#ffffff" opacity="0.9" />
                            <circle cx="7" cy="-10" r="2.5" fill="#ffffff" opacity="0.5" />
                        </g>

                        {isHappy && (
                            <path d="M -36 8 Q 0 -14 36 8 L 36 50 L -36 50 Z" fill="#071015" />
                        )}
                    </g>

                    {isThinking && (
                        <path d="M -40 -22 L 40 -48 L 40 -50 L -40 -50 Z" fill="#071015" />
                    )}
                </g>

                {/* ── BOCA ── */}
                {isHappy && (
                    <path
                        d="M 110 162 Q 150 185 190 162"
                        stroke={glowColor} strokeWidth="5" fill="none"
                        strokeLinecap="round" filter="url(#glowSmall)"
                    />
                )}
                {isThinking && (
                    <line
                        x1="120" y1="168" x2="180" y2="165"
                        stroke={glowColor} strokeWidth="4"
                        strokeLinecap="round" filter="url(#glowSmall)"
                    />
                )}

                {/* Linha de queixo no idle */}
                {emotion === 'idle' && (
                    <path
                        d="M 125 165 Q 150 175 175 165"
                        stroke={glowColor} strokeWidth="3"
                        fill="none" strokeLinecap="round" opacity="0.5"
                        filter="url(#glowSmall)"
                    />
                )}
            </svg>
        </div>
    )
}
