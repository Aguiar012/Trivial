import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { getStroke } from 'perfect-freehand';
import { recognizer } from './Recognizer';
import type { Result } from './Recognizer';

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════

type Point = [number, number, number]; // [x, y, pressure]

export interface Stroke {
    id: string;
    points: Point[];
    offsetY: number;
    offsetX: number;
    color: string;
    width: number;
    text?: string;
    textX?: number;
    textY?: number;
    // Animação de commit
    commitAnim?: number;     // 0→1, controla fade-in do texto e fade-out do ink
    commitTime?: number;     // timestamp do commit (pra animação)
    
    // Treinamento personalizado
    alternatives?: {name: string, score: number}[]; 
    originalStrokes?: Stroke[]; 
}

// Estado de estabilidade por cluster (para decidir quando "comitar")
interface StabilityState {
    lastTop1: string | null;
    stableCount: number;     // quantas vezes consecutivas o top1 foi o mesmo
    lastEvalTime: number;
    topK: Result[];
}

function getBounds(points: Point[]) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of points) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return { w: maxX - minX, h: maxY - minY, minX, maxX, minY, maxY };
}

// ═══════════════════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════════════════

export interface SmartCanvasRef {
    clear: () => void;
    undo: () => void;
    redo: () => void;
    exportSvg: () => string;
    setEraseMode: (mode: boolean) => void;
}

interface SmartCanvasProps {
    strokeColor?: string;
    strokeWidth?: number;
    lineHeight?: number;
    className?: string;
    style?: React.CSSProperties;
    onGestureEvent?: (msg: string) => void;
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS DE RENDERIZAÇÃO
// ═══════════════════════════════════════════════════════════════════

const getSvgPathFromStroke = (stroke: number[][]) => {
    if (!stroke.length) return '';
    const d = stroke.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ['M', ...stroke[0], 'Q']
    );
    d.push('Z');
    return d.join(' ');
};

// ═══════════════════════════════════════════════════════════════════
// DETECÇÃO DE GESTOS (Rabisco = Borracha)
// ═══════════════════════════════════════════════════════════════════

const detectGestures = (points: Point[]): 'scribble' | 'none' => {
    if (points.length < 15) return 'none';
    
    const {minX, maxX, minY, maxY} = getBounds(points);
    let pathLength = 0;
    
    for (let i = 1; i < points.length; i++) {
        const dx = points[i][0] - points[i - 1][0];
        const dy = points[i][1] - points[i - 1][1];
        pathLength += Math.sqrt(dx*dx + dy*dy);
    }
    
    const boundingBoxDiagonal = Math.sqrt(Math.pow(maxX - minX, 2) + Math.pow(maxY - minY, 2));
    const ratioLengthToDiagonal = pathLength / (boundingBoxDiagonal || 1);
    
    let xReversals = 0;
    let lastDir = 0;
    for (let i = 1; i < points.length; i++) {
        const dx = points[i][0] - points[i-1][0];
        if (Math.abs(dx) > 1) {
            const dir = Math.sign(dx);
            if (lastDir !== 0 && dir !== lastDir) xReversals++;
            lastDir = dir;
        }
    }
    
    if (pathLength > 100 && ratioLengthToDiagonal > 3.5 && xReversals >= 5) {
        return 'scribble';
    }

    return 'none';
};

const doBoundingBoxesIntersect = (pointsA: Point[], pointsB: Point[], offsetAY = 0, offsetBY = 0) => {
    const bA = getBounds(pointsA);
    const bB = getBounds(pointsB);
    const pad = 5;
    return !(
        bA.minX > bB.maxX + pad || bA.maxX < bB.minX - pad ||
        bA.minY + offsetAY > bB.maxY + offsetBY + pad || bA.maxY + offsetAY < bB.minY + offsetBY - pad
    );
};

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DE CONFIANÇA (do spec do usuário)
// ═══════════════════════════════════════════════════════════════════

const COMMIT_CONFIG = {
    /** Score mínimo do top1 para considerar commit */
    minTop1Score: 0.72,
    /** Margem mínima entre top1 e top2 */
    minMargin: 0.03,
    /** Quantas avaliações consecutivas com o mesmo top1 antes de comitar */
    requiredStableCount: 4,
    /** Delay em ms após pointerup antes de rodar a avaliação */
    evalDelayMs: 150,
    /** Tolerância de proximidade para clustering de strokes (px) */
    clusterTolerance: 15,
    /** Tempo máximo (ms) que strokes ficam sem commit antes de forçar (se score ok) */
    maxWaitMs: 1200,
    /**
     * Gap mínimo (ms) desde o último pointerUp para permitir commit.
     * Evita comitar o 1º traço de um caractere multi-traço enquanto o usuário
     * ainda está desenhando o 2º traço (ex: pingo do 'i', barra do '+', topo do 't').
     */
    interStrokeGapMs: 380,
};

// Caracteres que visualmente são quase impossíveis de diferenciar em manuscrito
// Se a dúvida for entre eles, ignoramos a margem e pegamos o top 1 mais rápido
const AMBIGUOUS_GROUPS = [
    new Set(['0', 'o', 'O']),
    new Set(['1', 'l', 'I', '|', 'i']),
    new Set(['x', 'X', '×']),
    new Set(['c', 'C']),
    new Set(['s', 'S']),
    new Set(['v', 'V']),
    new Set(['z', 'Z']),
    new Set(['p', 'P']),
    new Set(['w', 'W']),
    new Set(['m', 'M']),
    new Set(['-', '_'])
];

const areAmbiguous = (c1: string, c2: string) => {
    return AMBIGUOUS_GROUPS.some(group => group.has(c1) && group.has(c2));
};

/**
 * Caracteres de 1 traço que são subconjuntos visuais de caracteres multi-traço.
 * Ex: o traço vertical de 't' parece 'l' ou '1'; o traço de '-' parece parte de '='.
 * Quando top1 é um destes E o cluster tem apenas 1 stroke, aguardamos maxWaitMs
 * antes de comitar — dando tempo ao usuário de adicionar o 2º traço.
 */
const PATIENCE_CHARS = new Set(['l', '1', 'I', 'i', 'j', '-', 'c', 'C', 'o', 'O', '0', 'r', 'u', 'n', 'v', 'V']);

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export const SmartCanvas = forwardRef<SmartCanvasRef, SmartCanvasProps>(({ 
    strokeColor = '#2b2622', 
    strokeWidth = 3, 
    lineHeight = 40,
    className,
    style,
    onGestureEvent
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [history, setHistory] = useState<Stroke[][]>([]);
    const [historyStep, setHistoryStep] = useState(0);
    const [currentStroke, setCurrentStroke] = useState<Point[] | null>(null);
    const [eraseMode, setInternalEraseMode] = useState(false);

    // UI Correção (Zero-shot learning)
    const [correctionPopup, setCorrectionPopup] = useState<{
        x: number;
        y: number;
        strokeId: string;
        wrongName: string;
        alternatives: {name: string, score: number}[];
        originalStrokes: Stroke[];
        showSymbols?: boolean;
    } | null>(null);

    const [aiLoadingStrokes, setAiLoadingStrokes] = useState<Set<string>>(new Set());

    // Map de estabilidade por "clusterKey" (hash dos IDs dos strokes no cluster)
    const stabilityMapRef = useRef<Map<string, StabilityState>>(new Map());
    const recognitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animFrameRef = useRef<number>(0);
    // Timestamp do último pointerUp — para segurar commit enquanto usuário ainda está escrevendo
    const lastPointerUpRef = useRef<number>(0);

    // ── History ──────────────────────────────────────────────────
    const saveHistory = useCallback((newStrokes: Stroke[]) => {
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(newStrokes);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
        setStrokes(newStrokes);
    }, [history, historyStep]);

    useImperativeHandle(ref, () => ({
        clear: () => {
            saveHistory([]);
            stabilityMapRef.current.clear();
        },
        undo: () => {
            if (historyStep > 0) {
                setHistoryStep(historyStep - 1);
                setStrokes(history[historyStep - 1]);
            }
        },
        redo: () => {
            if (historyStep < history.length - 1) {
                setHistoryStep(historyStep + 1);
                setStrokes(history[historyStep + 1]);
            }
        },
        setEraseMode: (mode: boolean) => setInternalEraseMode(mode),
        exportSvg: () => {
            if (!containerRef.current) return '';
            const svgEl = containerRef.current.querySelector('svg');
            if (svgEl) {
                return new XMLSerializer().serializeToString(svgEl);
            }
            return '';
        }
    }));

    const findSymbolWithAI = async (strokesToFind: Stroke[], strokeIdToFix: string) => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            alert('VITE_GEMINI_API_KEY não configurada no .env');
            return;
        }

        setAiLoadingStrokes(prev => new Set(prev).add(strokeIdToFix));
        setCorrectionPopup(null);
        try {
            // Desenhar os traços em um canvas invisível
            const canvas = document.createElement('canvas'); // Not using react state canvas
            canvas.width = 120;
            canvas.height = 120;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 120, 120);

            // Calcular a bounding box real dos strokes
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            strokesToFind.forEach(s => s.points.forEach(p => {
                const px = Array.isArray(p) ? p[0] : (p as any).x;
                const py = Array.isArray(p) ? p[1] : (p as any).y;
                if (px < minX) minX = px;
                if (py < minY) minY = py;
                if (px > maxX) maxX = px;
                if (py > maxY) maxY = py;
            }));
            const width = maxX - minX;
            const height = maxY - minY;
            const size = Math.max(width, height) || 1;
            const padding = 10;
            const scale = (120 - padding * 2) / size;

            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'black';

            strokesToFind.forEach(s => {
                ctx.beginPath();
                s.points.forEach((p, i) => {
                    const px = Array.isArray(p) ? p[0] : (p as any).x;
                    const py = Array.isArray(p) ? p[1] : (p as any).y;
                    const cx = padding + (px - minX + (size - width) / 2) * scale;
                    const cy = padding + (py - minY + (size - height) / 2) * scale;
                    if (i === 0) ctx.moveTo(cx, cy);
                    else ctx.lineTo(cx, cy);
                });
                ctx.stroke();
            });

            const base64 = canvas.toDataURL('image/jpeg').split(',')[1];

            const payload = {
                contents: [{
                    parts: [
                        { text: "This is a hand-drawn math symbol, physics symbol, or character. Return ONLY the single exact unicode character it most resembles (e.g. √, ∞, ∫, Σ, α, A, %, 2, ∛, matrix brackets). If it's a known math symbol, return it. No markdown, no explanation, no quotes, just the literal 1-character or 2-character symbol maximum." },
                        { inlineData: { mimeType: "image/jpeg", data: base64 } }
                    ]
                }]
            };

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            const symbol = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (symbol && symbol.length <= 3) {
                handleCorrection(strokeIdToFix, symbol, strokesToFind);
            } else {
                alert("A I.A. não conseguiu identificar de forma confiável um símbolo único. Resposta crua: " + symbol);
            }
        } catch (e) {
            console.error(e);
            alert("Erro de conexão ao acionar Gemini API");
        } finally {
            setAiLoadingStrokes(prev => {
                const next = new Set(prev);
                next.delete(strokeIdToFix);
                return next;
            });
        }
    };

    // Initialize history
    useEffect(() => {
        if (history.length === 0) setHistory([[]]);
    }, []);

    // ── Animação contínua para commit transitions ────────────────
    useEffect(() => {
        let running = true;
        const animate = () => {
            if (!running) return;
            setStrokes(prev => {
                let changed = false;
                const now = Date.now();
                const updated = prev.map(s => {
                    if (s.commitTime && s.commitAnim !== undefined && s.commitAnim < 1) {
                        const elapsed = now - s.commitTime;
                        const progress = Math.min(elapsed / 350, 1); // 350ms animação
                        if (progress !== s.commitAnim) {
                            changed = true;
                            return { ...s, commitAnim: progress };
                        }
                    }
                    return s;
                });
                return changed ? updated : prev;
            });
            animFrameRef.current = requestAnimationFrame(animate);
        };
        animFrameRef.current = requestAnimationFrame(animate);
        return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
    }, []);

    // ── Pointer Events ──────────────────────────────────────────

    const handlePointerDown = (e: React.PointerEvent) => {
        if (correctionPopup) setCorrectionPopup(null);
        e.preventDefault();
        if (recognitionTimeoutRef.current) clearTimeout(recognitionTimeoutRef.current);

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        // Captura pontos coalescidos para maior fidelidade
        const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
        const pts: Point[] = coalesced.map(ev => [
            ev.clientX - rect.left,
            ev.clientY - rect.top,
            ev.pressure && e.pointerType !== 'mouse' ? ev.pressure : 0.5,
        ]);
        
        if (pts.length === 0) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const pressure = e.pressure && e.pointerType !== 'mouse' ? e.pressure : 0.5;
            pts.push([x, y, pressure]);
        }
        
        setCurrentStroke(pts);
        
        if (containerRef.current) {
            containerRef.current.setPointerCapture(e.pointerId);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        e.preventDefault();

        // Se a borracha não pegou nada e nem estávamos no pen, abortamos
        if (!currentStroke && !eraseMode) return; 
        if (!currentStroke && eraseMode) return; // Only start new stroke if not eraser
        
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        // Pontos coalescidos
        const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
        const newPts: Point[] = coalesced.map(ev => [
            ev.clientX - rect.left,
            ev.clientY - rect.top,
            ev.pressure && e.pointerType !== 'mouse' ? ev.pressure : 0.5,
        ]);
        
        if (newPts.length === 0) {
            newPts.push([
                e.clientX - rect.left,
                e.clientY - rect.top,
                e.pressure && e.pointerType !== 'mouse' ? e.pressure : 0.5,
            ]);
        }
        
        if (eraseMode) {
            // Se o currentStroke não existe, cria um temporário para a borracha
            const eraserStroke = currentStroke || newPts;
            setCurrentStroke(prev => prev ? [...prev, ...newPts] : newPts);

            let anyRemoved = false;
            const remainingStrokes = strokes.filter(s => {
                if (s.points.length === 0) {
                    // Texto commitado — borracha também apaga
                    const tx = (s.textX ?? 0);
                    const ty = (s.textY ?? 0);
                    const textPoints: Point[] = [
                        [tx,      ty - 36, 0.5],
                        [tx + 28, ty - 36, 0.5],
                        [tx + 28, ty + 4,  0.5],
                        [tx,      ty + 4,  0.5],
                    ];
                    const intersect = doBoundingBoxesIntersect(eraserStroke, textPoints, 0, 0);
                    if (intersect) { anyRemoved = true; return false; }
                    return true;
                }
                const intersect = doBoundingBoxesIntersect(eraserStroke, s.points, 0, s.offsetY);
                if (intersect) anyRemoved = true;
                return !intersect;
            });
            
            if (anyRemoved) {
                setStrokes(remainingStrokes); // Atualiza a tela imediatamente
            }
        } else {
            setCurrentStroke(prev => prev ? [...prev, ...newPts] : newPts);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        e.preventDefault();
        if (containerRef.current) {
            containerRef.current.releasePointerCapture(e.pointerId);
        }
        if (!currentStroke || currentStroke.length === 0) {
            setCurrentStroke(null);
            return;
        }

        const gesture = detectGestures(currentStroke);

        if (eraseMode || gesture === 'scribble') {
            let anyRemoved = false;
            const remainingStrokes = strokes.filter(s => {
                if (s.points.length === 0) {
                    // Stroke de texto commitado — verifica se o rabisco/borracha passa por cima
                    if (gesture === 'scribble' || eraseMode) {
                        // Bounding box aproximada do glyph de texto (fontSize 38px, ~24px wide)
                        const tx = (s.textX ?? 0);
                        const ty = (s.textY ?? 0);
                        const textPoints: Point[] = [
                            [tx,      ty - 36, 0.5],
                            [tx + 28, ty - 36, 0.5],
                            [tx + 28, ty + 4,  0.5],
                            [tx,      ty + 4,  0.5],
                        ];
                        const intersect = doBoundingBoxesIntersect(currentStroke, textPoints, 0, 0);
                        if (intersect) { anyRemoved = true; return false; }
                    }
                    return true;
                }
                const intersect = doBoundingBoxesIntersect(currentStroke, s.points, 0, s.offsetY);
                if (intersect) anyRemoved = true;
                return !intersect;
            });
            
            if (anyRemoved) {
                saveHistory(remainingStrokes);
                if (gesture === 'scribble' && onGestureEvent) {
                    onGestureEvent("Rabisco → Apagou!");
                }
            } else if (!eraseMode) { // Only save stroke if not eraser and nothing was removed
                saveStroke(currentStroke);
            }
        } else {
            saveStroke(currentStroke);
        }
        
        setCurrentStroke(null);

        lastPointerUpRef.current = Date.now();

        // AGENDA RECONHECIMENTO
        if (recognitionTimeoutRef.current) clearTimeout(recognitionTimeoutRef.current);
        recognitionTimeoutRef.current = setTimeout(() => {
            runRecognitionLogic();
        }, COMMIT_CONFIG.evalDelayMs);
    };

    // ── Salvar Stroke com alinhamento ────────────────────────────

    const saveStroke = (points: Point[]) => {
        // Strokes de tinta ficam nas coordenadas originais (offsetY = 0).
        // O alinhamento à linha de pauta acontece apenas no commit,
        // sobre o cluster inteiro — não por stroke individual.
        // Isso garante que traços do mesmo caractere (ex: haste + barra do 't')
        // fiquem próximos no espaço e sejam agrupados corretamente.
        const newStroke: Stroke = {
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            points,
            offsetY: 0,
            offsetX: 0,
            color: strokeColor,
            width: eraseMode ? 8 : strokeWidth,
        };

        saveHistory([...strokes, newStroke]);
    };

    // ═══════════════════════════════════════════════════════════════
    // LÓGICA DE RECONHECIMENTO + CONFIANÇA + ESTABILIDADE
    // ═══════════════════════════════════════════════════════════════

    const runRecognitionLogic = () => {
        // Não comitar se o usuário levantou a caneta há menos de interStrokeGapMs
        // (ele pode estar no meio de desenhar um caractere multi-traço)
        const timeSinceLastUp = Date.now() - lastPointerUpRef.current;
        const userMightBeDrawing = timeSinceLastUp < COMMIT_CONFIG.interStrokeGapMs;

        setStrokes(currentStrokes => {
            if (currentStrokes.length === 0) return currentStrokes;

            // Pega apenas strokes que são tinta (não texto já commitado)
            const inkStrokes = currentStrokes.filter(s => !s.text);
            if (inkStrokes.length === 0) return currentStrokes;

            // Para cada grupo de strokes próximos (cluster), tenta reconhecer
            const processed = new Set<string>();
            let nextStrokes = [...currentStrokes];
            let anyCommit = false;
            let needsReeval = false;
            
            // Começa pelo último stroke e tenta clusterizar para trás
            for (let si = inkStrokes.length - 1; si >= 0; si--) {
                const seed = inkStrokes[si];
                if (processed.has(seed.id)) continue;

                // Monta cluster a partir deste stroke
                const cluster: Stroke[] = [seed];
                processed.add(seed.id);
                
                let cBounds = getBounds(seed.points);
                cBounds.minY += seed.offsetY;
                cBounds.maxY += seed.offsetY;

                // Varre outros strokes perto (sem break — verifica todos)
                for (let j = si - 1; j >= 0; j--) {
                    const cand = inkStrokes[j];
                    if (processed.has(cand.id)) continue;
                    if (cand.points.length === 0) continue;

                    const b = getBounds(cand.points);
                    const sy  = b.minY + cand.offsetY;
                    const smy = b.maxY + cand.offsetY;
                    const tolX = COMMIT_CONFIG.clusterTolerance;
                    const tolY = COMMIT_CONFIG.clusterTolerance + lineHeight * 0.6;

                    // Verifica se o candidato intersecta com QUALQUER stroke já no cluster
                    // (não com a bounding box union) — evita "cadeia" que une letras diferentes
                    const touchesCluster = cluster.some(cs => {
                        const cb = getBounds(cs.points);
                        const csy  = cb.minY + cs.offsetY;
                        const csmy = cb.maxY + cs.offsetY;
                        return !(
                            b.minX  > cb.maxX + tolX || b.maxX < cb.minX - tolX ||
                            sy      > csmy    + tolY  || smy   < csy    - tolY
                        );
                    });

                    if (touchesCluster) {
                        cluster.unshift(cand);
                        processed.add(cand.id);
                        cBounds.minX = Math.min(cBounds.minX, b.minX);
                        cBounds.maxX = Math.max(cBounds.maxX, b.maxX);
                        cBounds.minY = Math.min(cBounds.minY, sy);
                        cBounds.maxY = Math.max(cBounds.maxY, smy);
                    }
                    // NÃO faz break — continua procurando strokes do mesmo caractere
                }

                if (cluster.length === 0) continue;

                // Prepara input pro recognizer
                const inputStrokes = cluster.map(st => 
                    st.points.map(p => ({ x: p[0], y: p[1] + st.offsetY }))
                );
                
                const results = recognizer.recognize(inputStrokes);
                if (results.length === 0) continue;

                const top1 = results[0];
                const top2 = results.length > 1 ? results[1] : { name: '', score: 0 };
                const margin = top1.score - top2.score;

                // ── Chave de estabilidade do cluster ──
                const clusterKey = cluster.map(s => s.id).sort().join('|');
                const stability = stabilityMapRef.current.get(clusterKey) ?? {
                    lastTop1: null,
                    stableCount: 0,
                    lastEvalTime: 0,
                    topK: [],
                };

                // Atualiza estabilidade
                if (stability.lastTop1 === top1.name) {
                    stability.stableCount++;
                } else {
                    stability.lastTop1 = top1.name;
                    stability.stableCount = 1;
                }
                stability.lastEvalTime = Date.now();
                stability.topK = results.slice(0, 5);
                stabilityMapRef.current.set(clusterKey, stability);

                // Debug log para ajudar no desenvolvimento
                console.log(
                    `[Recognizer] cluster(${cluster.length} strokes) → ` +
                    `top1: '${top1.name}' (${(top1.score * 100).toFixed(1)}%) ` +
                    `top2: '${top2.name}' (${(top2.score * 100).toFixed(1)}%) ` +
                    `margin: ${(margin * 100).toFixed(1)}% ` +
                    `stable: ${stability.stableCount}/${COMMIT_CONFIG.requiredStableCount}`
                );

                // ── DECISÃO DE COMMIT ──
                const meetsScore = top1.score >= COMMIT_CONFIG.minTop1Score;
                
                // Se o top1 e top2 são do mesmo grupo ambíguo (ex. o/0), ignoramos a margem
                const marginOk = margin >= COMMIT_CONFIG.minMargin || areAmbiguous(top1.name, top2.name);
                
                const isStable = stability.stableCount >= COMMIT_CONFIG.requiredStableCount;
                const isVeryStable = stability.stableCount >= 6; // Fast-track: se ficou 6 cycles (~900ms) estável, ignora margin

                const firstEvalAge = stability.stableCount > 0
                    ? Date.now() - (stability.lastEvalTime - stability.stableCount * 150)
                    : 0;

                const timedOut = meetsScore && (firstEvalAge > COMMIT_CONFIG.maxWaitMs || isVeryStable);

                // "Patience mode": se top1 é um caractere de 1-stroke que pode ser
                // o início de um caractere multi-stroke (ex: 'l' → 't', '-' → '='),
                // E o cluster ainda tem só 1 stroke, esperamos maxWaitMs inteiros.
                const needsPatience = cluster.length === 1 && PATIENCE_CHARS.has(top1.name) && !timedOut;

                // Bloqueia commit se o usuário acabou de terminar um traço recentemente,
                // ou se estamos em patience mode. timedOut sempre desbloqueaa.
                const shouldCommit = !timedOut
                    ? !userMightBeDrawing && !needsPatience && meetsScore && marginOk && isStable
                    : meetsScore;

                if (!shouldCommit && meetsScore) {
                    const reasons = [];
                    if (!marginOk && !timedOut) reasons.push(`margin too low (<${(COMMIT_CONFIG.minMargin*100).toFixed(0)}%)`);
                    if (!isStable && !timedOut) reasons.push(`waiting for stability (${stability.stableCount}/${COMMIT_CONFIG.requiredStableCount})`);
                    if (needsPatience) reasons.push(`patience (1-stroke ambiguous: '${top1.name}')`);
                    if (userMightBeDrawing) reasons.push(`inter-stroke gap`);
                    console.log(`[Recognizer] ⏳ Waiting... top1: '${top1.name}' (${(top1.score * 100).toFixed(1)}%). Reasons: ${reasons.join(', ')}`);
                }

                if (shouldCommit) {
                    // COMMIT! Remove os strokes de tinta e adiciona o texto digital
                    nextStrokes = nextStrokes.filter(s => !cluster.some(c => c.id === s.id));

                    const centerX = cBounds.minX + (cBounds.maxX - cBounds.minX) / 2;

                    // Alinha o texto à linha de pauta mais próxima da base do cluster
                    const rawBaseY = cBounds.maxY;
                    const baseY = Math.round(rawBaseY / lineHeight) * lineHeight;

                    let displayChar = top1.name;

                    const now = Date.now();
                    const alternatives = results.slice(1, 4).map(r => ({ name: r.name, score: r.score }));

                    nextStrokes.push({
                        id: now.toString() + '_txt_' + displayChar,
                        points: [],
                        offsetY: 0,
                        offsetX: 0,
                        color: strokeColor,
                        width: strokeWidth,
                        text: displayChar,
                        textX: centerX - 14,
                        textY: baseY + 2,
                        commitAnim: 0,
                        commitTime: now,
                        alternatives,
                        originalStrokes: cluster
                    });

                    anyCommit = true;
                    stabilityMapRef.current.delete(clusterKey);

                    if (onGestureEvent) {
                        onGestureEvent(`✨ '${displayChar}' (${(top1.score * 100).toFixed(0)}%)`);
                    }
                    console.log(`[Recognizer] ✅ COMMIT '${displayChar}' score=${(top1.score*100).toFixed(1)}% margin=${(margin*100).toFixed(1)}% stable=${stability.stableCount}`);
                } else if (meetsScore || userMightBeDrawing || needsPatience) {
                    needsReeval = true;
                }
            }

            if (anyCommit) {
                // Salva no histórico
                setHistory(prevH => {
                    const newH = [...prevH.slice(0, prevH.length)];
                    newH.push(nextStrokes);
                    return newH;
                });
                setHistoryStep(prev => prev + 1);
                return nextStrokes;
            }

            // Se algum cluster precisa de re-avaliação, agenda
            if (needsReeval) {
                if (recognitionTimeoutRef.current) clearTimeout(recognitionTimeoutRef.current);
                recognitionTimeoutRef.current = setTimeout(() => {
                    runRecognitionLogic();
                }, 150);
            }

            return currentStrokes;
        });
    };

    // ═══════════════════════════════════════════════════════════════
    // RENDERIZAÇÃO
    // ═══════════════════════════════════════════════════════════════

    const renderStroke = (s: Stroke) => {
        if (s.text) {
            const anim = s.commitAnim ?? 1;
            // Escala de entrada: bounce suave
            const scale = anim < 1 
                ? 0.3 + 0.7 * easeOutBack(anim) 
                : 1;
            const opacity = Math.min(anim * 2, 1); // fade in rápido

            return (
                <g key={s.id}>
                    <text 
                        x={s.textX} 
                        y={s.textY} 
                        fill={s.color}
                        fontFamily='"Caveat", "Indie Flower", "Patrick Hand", cursive'
                        fontSize="38px"
                        fontWeight="bold"
                        opacity={opacity}
                        style={{ 
                            transformOrigin: `${s.textX}px ${(s.textY ?? 0) - 16}px`,
                            transform: `scale(${scale})`,
                            cursor: 'pointer', pointerEvents: 'auto',
                            filter: anim < 0.8 ? 'blur(0.5px)' : 'none',
                        }}
                        onPointerDown={(e) => {
                            e.stopPropagation();
                            if (s.alternatives && s.originalStrokes) {
                                setCorrectionPopup({
                                    x: e.clientX,
                                    y: e.clientY - 40,
                                    strokeId: s.id,
                                    wrongName: s.text ?? '',
                                    alternatives: s.alternatives,
                                    originalStrokes: s.originalStrokes
                                });
                            }
                        }}
                    >
                        {aiLoadingStrokes.has(s.id) ? '✨...' : s.text}
                    </text>
                    {/* Micro-partículas de "tinta mágica" durante a transição */}
                    {anim < 0.6 && (
                        <>
                            {[...Array(4)].map((_, i) => (
                                <circle
                                    key={i}
                                    cx={(s.textX ?? 0) + 12 + Math.sin(i * 1.8 + anim * 10) * 18}
                                    cy={(s.textY ?? 0) - 12 + Math.cos(i * 2.2 + anim * 10) * 14}
                                    r={2 - anim * 3}
                                    fill={s.color}
                                    opacity={(0.6 - anim) * 1.5}
                                />
                            ))}
                        </>
                    )}
                </g>
            );
        }

        const outline = getStroke(s.points, {
            size: s.width * 2,
            thinning: 0.6,
            smoothing: 0.5,
            streamline: 0.6,
            easing: (t) => t,
            simulatePressure: false, 
        });
        
        const pathData = getSvgPathFromStroke(outline);
        return (
            <path 
                key={s.id} 
                d={pathData} 
                fill={s.color} 
                transform={`translate(0, ${s.offsetY})`}
                style={{ transition: 'transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)' }} 
            />
        );
    };

    const handleCorrection = (strokeId: string, newName: string, originalStrokes: Stroke[], wrongName?: string) => {
        // Envia os strokes brutos originais pro cérebro como um novo template!
        const rawPoints = originalStrokes.map(s => s.points.map(p => ({ x: p[0], y: p[1] })));
        recognizer.addCustomTemplate(newName, rawPoints, wrongName);
        
        // Atualiza a tela
        setStrokes(prev => prev.map(s => {
            if (s.id === strokeId) return { ...s, text: newName };
            return s;
        }));
        
        // Joga pro histórico pra garantir que CTRL+Z volta (opcional)
        setHistory(prev => {
            const h = [...prev.slice(0, historyStep + 1)];
            // Precisamos clonar pra não mutar o passado e reconstruir
            h.push(strokes.map(s => s.id === strokeId ? { ...s, text: newName } : s));
            return h;
        });
        setHistoryStep(prev => prev + 1);
        
        setCorrectionPopup(null);
    };

    return (
        <div 
            ref={containerRef}
            className={className}
            style={{ position: 'relative', width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none', ...style }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <svg 
                width="100%" 
                height="100%" 
                xmlns="http://www.w3.org/2000/svg"
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
                {/* Definição de filtro para glow sutil no commit */}
                <defs>
                    <filter id="commitGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Strokes confirmados */}
                {strokes.map(s => renderStroke(s))}
                
                {/* Stroke sendo desenhado agora */}
                {currentStroke && currentStroke.length > 0 && (
                    <g>
                        {renderStroke({ 
                            id: 'current', 
                            points: currentStroke, 
                            color: eraseMode ? '#ff000055' : strokeColor, 
                            width: eraseMode ? 8 : strokeWidth, 
                            offsetY: 0, 
                            offsetX: 0 
                        })}
                        {/* Preview da borracha */}
                        {eraseMode && (
                            <path d={getSvgPathFromStroke(getStroke(currentStroke, { size: 8 * 2, thinning: 0.6, smoothing: 0.5, streamline: 0.6, easing: (t) => t, simulatePressure: false }))} stroke={strokeColor} strokeWidth={2} fill="none" opacity={0.6} strokeDasharray="5,5" />
                        )}
                    </g>
                )}
            </svg>

            {/* POPUP DE RE-TREINAMENTO DO USUÁRIO */}
            {correctionPopup && (
                <div style={{
                    position: 'fixed', left: correctionPopup.x, top: correctionPopup.y,
                    transform: 'translate(-50%, -100%)', zIndex: 1000,
                    pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    fontFamily: 'sans-serif'
                }}
                onPointerDown={e => e.stopPropagation()}
                >
                    <div style={{
                        background: '#333', color: 'white', padding: 8, borderRadius: 8, 
                        display: 'flex', gap: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', alignItems: 'center'
                    }}>
                        <span style={{ fontSize: 11, opacity: 0.7, paddingRight: 6 }}>Quis dizer?</span>
                        {correctionPopup.alternatives.map(alt => (
                            <button key={alt.name} 
                                style={{ 
                                    background: 'transparent', border: '1px solid #666', color: '#fff', 
                                    borderRadius: 4, width: 34, height: 34, fontSize: 18, cursor: 'pointer',
                                    transition: 'all 0.1s'
                                }}
                                onMouseOver={e => e.currentTarget.style.background = '#555'}
                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                onPointerDown={e => {
                                    e.stopPropagation(); e.preventDefault();
                                    handleCorrection(correctionPopup.strokeId, alt.name, correctionPopup.originalStrokes, correctionPopup.wrongName);
                                }}
                                title={`Score: ${(alt.score*100).toFixed(1)}%`}
                            >
                                {alt.name}
                            </button>
                        ))}
                        <div style={{ width: 1, height: 20, background: '#555', margin: '0 4px' }} />
                        <input 
                            type="text"
                            maxLength={1}
                            placeholder="?"
                            style={{ 
                                background: '#222', border: '1px solid #666', color: '#fff', 
                                borderRadius: 4, width: 34, height: 34, fontSize: 18, 
                                textAlign: 'center', outline: 'none'
                            }}
                            onChange={e => {
                                const val = e.currentTarget.value.trim();
                                if (val.length === 1) {
                                    handleCorrection(correctionPopup.strokeId, val, correctionPopup.originalStrokes, correctionPopup.wrongName);
                                }
                            }}
                        />
                        <button 
                            style={{ background: '#222', border: '1px solid #666', color: '#fff', borderRadius: 4, width: 34, height: 34, fontSize: 16, cursor: 'pointer', transition: 'all 0.1s' }}
                            onPointerDown={e => { e.stopPropagation(); e.preventDefault(); setCorrectionPopup(p => p ? {...p, showSymbols: !p.showSymbols} : null); }}
                            title="Símbolos matemáticos"
                        >
                            ∑
                        </button>
                        <button 
                            style={{ background: 'transparent', border: '1px solid #7a5cd6', color: '#d1a3ff', borderRadius: 4, width: 34, height: 34, fontSize: 16, cursor: 'pointer', transition: 'all 0.1s' }}
                            onMouseOver={e => e.currentTarget.style.background = '#453163'}
                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                            onPointerDown={e => {
                                e.stopPropagation(); e.preventDefault();
                                if (correctionPopup) findSymbolWithAI(correctionPopup.originalStrokes, correctionPopup.strokeId);
                            }}
                            title="Procurar símbolo ideal com I.A. (Gemini Vision)"
                        >
                            ✨
                        </button>
                        <button 
                            style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', marginLeft: 6, fontSize: 18 }}
                            onPointerDown={e => {
                                e.stopPropagation(); e.preventDefault();
                                setCorrectionPopup(null);
                            }}
                        >×</button>
                    </div>

                    {correctionPopup.showSymbols && (
                        <div style={{
                            background: '#333', color: 'white', padding: 8, borderRadius: 8,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4
                        }}>
                            {['√', 'π', 'θ', 'Δ', 'Σ', '∞', '≠', '≈', '≤', '≥', '∫', '±', 'α', 'β', 'γ'].map(sym => (
                                <button key={sym}
                                    style={{ background: '#222', border: '1px solid #555', color: '#fff', borderRadius: 4, width: 34, height: 34, fontSize: 16, cursor: 'pointer' }}
                                    onMouseOver={e => e.currentTarget.style.background = '#444'}
                                    onMouseOut={e => e.currentTarget.style.background = '#222'}
                                    onPointerDown={e => {
                                        e.stopPropagation(); e.preventDefault();
                                        handleCorrection(correctionPopup.strokeId, sym, correctionPopup.originalStrokes, correctionPopup.wrongName);
                                    }}
                                >
                                    {sym}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

// ── Easing helpers ──

function easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
