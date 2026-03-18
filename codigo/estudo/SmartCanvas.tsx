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
    requiredStableCount: 2,
    /** Delay em ms após pointerup antes de rodar a avaliação */
    evalDelayMs: 150,
    /** Tolerância de proximidade para clustering de strokes (px) */
    clusterTolerance: 15,
    /** Tempo máximo (ms) que strokes ficam sem commit antes de forçar (se score ok) */
    maxWaitMs: 650, // Baixado de 1200ms para ~600ms pra melhorar agilidade
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
        alternatives: {name: string, score: number}[];
        originalStrokes: Stroke[];
        showSymbols?: boolean;
    } | null>(null);

    // Map de estabilidade por "clusterKey" (hash dos IDs dos strokes no cluster)
    const stabilityMapRef = useRef<Map<string, StabilityState>>(new Map());
    const recognitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animFrameRef = useRef<number>(0);

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
                if (s.points.length === 0) return true; // text strokes
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
                if (s.points.length === 0) return true; // text strokes
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

        // AGENDA RECONHECIMENTO
        if (recognitionTimeoutRef.current) clearTimeout(recognitionTimeoutRef.current);
        recognitionTimeoutRef.current = setTimeout(() => {
            runRecognitionLogic();
        }, COMMIT_CONFIG.evalDelayMs);
    };

    // ── Salvar Stroke com alinhamento ────────────────────────────

    const saveStroke = (points: Point[]) => {
        const { maxY, w, h } = getBounds(points);
        let offsetY = 0;
        
        const isVerticalLine = h > w * 1.5 && h > 15;
        
        if (!isVerticalLine) {
            const targetY = Math.ceil(maxY / lineHeight) * lineHeight;
            const diff = targetY - maxY;
            if (Math.abs(diff) < lineHeight * 0.4) {
                offsetY = diff - 2;
            }
        }

        const newStroke: Stroke = {
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            points,
            offsetY,
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
                    const sy = b.minY + cand.offsetY;
                    const smy = b.maxY + cand.offsetY;
                    const tol = COMMIT_CONFIG.clusterTolerance;
                    
                    // Só agrupa se overlaps/toca em X E Y (com tolerancia pequena)
                    const intersect = !(
                        b.minX > cBounds.maxX + tol || b.maxX < cBounds.minX - tol ||
                        sy > cBounds.maxY + tol || smy < cBounds.minY - tol
                    );
                    
                    if (intersect) {
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
                const isVeryStable = stability.stableCount >= 4; // Fast-track: se ficou 4 cycles (~600ms) estável, f... margin

                const firstEvalAge = stability.stableCount > 0 
                    ? Date.now() - (stability.lastEvalTime - stability.stableCount * 150)
                    : 0;
                
                const timedOut = meetsScore && (firstEvalAge > COMMIT_CONFIG.maxWaitMs || isVeryStable);

                const shouldCommit = (meetsScore && marginOk && isStable) || timedOut;

                if (!shouldCommit && meetsScore) {
                    const reasons = [];
                    if (!marginOk && !timedOut) reasons.push(`margin too low (<${(COMMIT_CONFIG.minMargin*100).toFixed(0)}%)`);
                    if (!isStable && !timedOut) reasons.push(`waiting for stability (${stability.stableCount}/${COMMIT_CONFIG.requiredStableCount})`);
                    console.log(`[Recognizer] ⏳ Waiting... top1: '${top1.name}' (${(top1.score * 100).toFixed(1)}%). Reasons: ${reasons.join(', ')}`);
                }

                if (shouldCommit) {
                    // COMMIT! Remove os strokes de tinta e adiciona o texto digital
                    nextStrokes = nextStrokes.filter(s => !cluster.some(c => c.id === s.id));
                    
                    const centerX = cBounds.minX + (cBounds.maxX - cBounds.minX) / 2;
                    const baseY = cBounds.maxY;

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
                } else if (meetsScore) {
                    // Score decente mas estabilidade ou margem insuficiente.
                    // SEMPRE reagenda pra incrementar stableCount ou esperar timeout.
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
                                    alternatives: s.alternatives,
                                    originalStrokes: s.originalStrokes
                                });
                            }
                        }}
                    >
                        {s.text}
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

    const handleCorrection = (strokeId: string, newName: string, originalStrokes: Stroke[]) => {
        // Envia os strokes brutos originais pro cérebro como um novo template!
        const rawPoints = originalStrokes.map(s => s.points.map(p => ({ x: p[0], y: p[1] })));
        recognizer.addCustomTemplate(newName, rawPoints);
        
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
                                    handleCorrection(correctionPopup.strokeId, alt.name, correctionPopup.originalStrokes);
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
                                    handleCorrection(correctionPopup.strokeId, val, correctionPopup.originalStrokes);
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
                                        handleCorrection(correctionPopup.strokeId, sym, correctionPopup.originalStrokes);
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
