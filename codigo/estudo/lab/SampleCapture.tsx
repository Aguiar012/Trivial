/**
 * SampleCapture.tsx
 *
 * Página de captura de amostras de escrita para benchmark do Recognizer.
 * Acesse em: /lab (adicionar rota no app se necessário, ou montar temporariamente)
 *
 * Fluxo:
 *   1. Escolhe o caractere alvo (A-Z, 0-9, símbolos)
 *   2. Desenha N vezes no SmartCanvas bruto (sem reconhecimento)
 *   3. Clica "Salvar amostra" → JSON é baixado / acumulado em memória
 *   4. Clica "Exportar tudo" → baixa samples.json para substituir o arquivo do repo
 */

import React, { useRef, useState, useCallback } from 'react';
import { getStroke } from 'perfect-freehand';

type Point = [number, number, number];

interface Sample {
    label: string;          // caractere correto
    strokes: { x: number; y: number }[][];  // pontos brutos por traço
    capturedAt: string;
}

const CHARS_TO_CAPTURE = [
    'A','B','C','D','E','F','G','H','I','J','K','L','M',
    'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
    'a','b','c','d','e','f','g','h','i','j','k','l','m',
    'n','o','p','q','r','s','t','u','v','w','x','y','z',
    '0','1','2','3','4','5','6','7','8','9',
    '+','-','=','×','÷','(',')','√','π','∞','∫','Σ',
];

const getSvgPath = (stroke: number[][]) => {
    if (!stroke.length) return '';
    const d = stroke.reduce((acc, [x0, y0], i, arr) => {
        const [x1, y1] = arr[(i + 1) % arr.length];
        acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        return acc;
    }, ['M', ...stroke[0], 'Q'] as (string | number)[]);
    d.push('Z');
    return d.join(' ');
};

export function SampleCapture() {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [label, setLabel] = useState('A');
    const [currentStroke, setCurrentStroke] = useState<Point[] | null>(null);
    const [committedStrokes, setCommittedStrokes] = useState<Point[][]>([]);
    const [samples, setSamples] = useState<Sample[]>([]);
    const [lastMsg, setLastMsg] = useState('');

    const msg = (m: string) => { setLastMsg(m); setTimeout(() => setLastMsg(''), 3000); };

    const handleDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        const rect = containerRef.current!.getBoundingClientRect();
        const pt: Point = [e.clientX - rect.left, e.clientY - rect.top, 0.5];
        setCurrentStroke([pt]);
        containerRef.current!.setPointerCapture(e.pointerId);
    }, []);

    const handleMove = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        if (!currentStroke) return;
        const rect = containerRef.current!.getBoundingClientRect();
        setCurrentStroke(prev => [...(prev ?? []), [e.clientX - rect.left, e.clientY - rect.top, 0.5]]);
    }, [currentStroke]);

    const handleUp = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        if (!currentStroke || currentStroke.length < 2) { setCurrentStroke(null); return; }
        setCommittedStrokes(prev => [...prev, currentStroke]);
        setCurrentStroke(null);
    }, [currentStroke]);

    const saveSample = () => {
        if (committedStrokes.length === 0) { msg('⚠️ Desenhe algo primeiro!'); return; }
        const sample: Sample = {
            label,
            strokes: committedStrokes.map(s => s.map(p => ({ x: p[0], y: p[1] }))),
            capturedAt: new Date().toISOString(),
        };
        setSamples(prev => [...prev, sample]);
        setCommittedStrokes([]);
        msg(`✅ Amostra #${samples.length + 1} de '${label}' salva!`);
    };

    const clearCanvas = () => { setCommittedStrokes([]); setCurrentStroke(null); };

    const exportAll = () => {
        if (samples.length === 0) { msg('⚠️ Nenhuma amostra para exportar.'); return; }
        const json = JSON.stringify(samples, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'samples.json';
        a.click();
        URL.revokeObjectURL(url);
        msg(`📦 Exportado ${samples.length} amostras → samples.json`);
    };

    const importSamples = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const loaded = JSON.parse(ev.target!.result as string) as Sample[];
                setSamples(loaded);
                msg(`📂 Importado ${loaded.length} amostras existentes.`);
            } catch { msg('❌ Arquivo inválido.'); }
        };
        reader.readAsText(file);
    };

    // Estatísticas
    const countByLabel = samples.reduce<Record<string, number>>((acc, s) => {
        acc[s.label] = (acc[s.label] ?? 0) + 1;
        return acc;
    }, {});

    const allStrokes = [...committedStrokes, ...(currentStroke ? [currentStroke] : [])];

    return (
        <div style={{ display: 'flex', height: '100vh', fontFamily: 'monospace', background: '#0f0f1a', color: '#eee' }}>
            {/* Sidebar */}
            <div style={{ width: 280, background: '#1a1a2e', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
                <div style={{ fontWeight: 'bold', fontSize: 18, color: '#a78bfa' }}>🔬 Sample Capture</div>

                {/* Seletor de caractere */}
                <div>
                    <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>CARACTERE ALVO</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                        {CHARS_TO_CAPTURE.map(c => (
                            <button key={c} onClick={() => setLabel(c)} style={{
                                width: 32, height: 32, fontSize: 14, cursor: 'pointer',
                                background: label === c ? '#7c3aed' : '#2d2d4e',
                                border: label === c ? '2px solid #a78bfa' : '1px solid #444',
                                color: '#eee', borderRadius: 4,
                                fontWeight: label === c ? 'bold' : 'normal',
                                position: 'relative',
                            }}>
                                {c}
                                {countByLabel[c] && (
                                    <span style={{
                                        position: 'absolute', top: -4, right: -4,
                                        background: '#4ade80', color: '#000',
                                        borderRadius: '50%', fontSize: 9, width: 14, height: 14,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>{countByLabel[c]}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Alvo atual */}
                <div style={{ textAlign: 'center', fontSize: 72, lineHeight: 1, color: '#fbbf24', fontFamily: 'serif' }}>
                    {label}
                </div>

                {/* Ações */}
                <button onClick={saveSample} style={btnStyle('#16a34a')}>
                    ✅ Salvar amostra de '{label}'
                </button>
                <button onClick={clearCanvas} style={btnStyle('#dc2626')}>
                    🗑️ Limpar canvas
                </button>

                <hr style={{ border: '1px solid #333' }} />

                <div style={{ fontSize: 11, opacity: 0.6 }}>BANCO DE AMOSTRAS: {samples.length} total</div>
                {Object.entries(countByLabel).sort(([a], [b]) => a.localeCompare(b)).map(([c, n]) => (
                    <div key={c} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: n >= 5 ? '#4ade80' : n >= 3 ? '#fbbf24' : '#f87171' }}>'{c}'</span>
                        <span>{n} amostras {n >= 5 ? '✅' : n >= 3 ? '⚠️' : '❌'}</span>
                    </div>
                ))}

                <hr style={{ border: '1px solid #333' }} />

                <button onClick={exportAll} style={btnStyle('#7c3aed')}>
                    📦 Exportar samples.json
                </button>
                <label style={{ ...btnStyle('#374151'), textAlign: 'center', cursor: 'pointer' }}>
                    📂 Importar samples.json
                    <input type="file" accept=".json" onChange={importSamples} style={{ display: 'none' }} />
                </label>

                {lastMsg && (
                    <div style={{ background: '#1e3a2e', border: '1px solid #4ade80', borderRadius: 6, padding: 8, fontSize: 12, color: '#4ade80' }}>
                        {lastMsg}
                    </div>
                )}
            </div>

            {/* Canvas */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <div style={{ color: '#888', fontSize: 13 }}>
                    Desenhe <b style={{ color: '#fbbf24' }}>'{label}'</b> no canvas abaixo — pode fazer múltiplos traços como num caractere real
                </div>
                <div style={{ color: '#555', fontSize: 11 }}>
                    {committedStrokes.length} traço(s) no canvas atual
                </div>

                <div
                    ref={containerRef}
                    style={{
                        width: 500, height: 500,
                        background: '#fcfaf8',
                        border: '3px solid #4b5563',
                        borderRadius: 12,
                        cursor: 'crosshair',
                        touchAction: 'none',
                        position: 'relative',
                        boxShadow: '0 0 40px rgba(124,58,237,0.2)',
                    }}
                    onPointerDown={handleDown}
                    onPointerMove={handleMove}
                    onPointerUp={handleUp}
                    onPointerCancel={handleUp}
                >
                    <svg ref={svgRef} width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                        {/* Grid de referência */}
                        <line x1="250" y1="0" x2="250" y2="500" stroke="#ddd" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
                        <line x1="0" y1="250" x2="500" y2="250" stroke="#ddd" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />

                        {allStrokes.map((pts, i) => {
                            const outline = getStroke(pts, { size: 8, thinning: 0.6, smoothing: 0.5, streamline: 0.5, simulatePressure: false });
                            return <path key={i} d={getSvgPath(outline)} fill="#1e1b4b" />;
                        })}
                    </svg>
                </div>

                <div style={{ color: '#4b5563', fontSize: 11 }}>
                    Recomendado: ≥ 5 amostras por caractere para benchmark confiável
                </div>
            </div>
        </div>
    );
}

const btnStyle = (bg: string): React.CSSProperties => ({
    background: bg,
    border: 'none',
    color: '#fff',
    borderRadius: 6,
    padding: '10px 14px',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontWeight: 'bold',
});
