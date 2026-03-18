/**
 * Recognizer.ts — Reconhecedor de escrita manuscrita por Point Cloud ($P)
 *
 * CAMADA 1: Template matching puro, sem ML.
 *
 * Suporte:
 *   - Dígitos: 0 1 2 3 4 5 6 7 8 9
 *   - Símbolos: + - × ÷ = < > ( ) / \ . ,
 *   - Letras maiúsculas: A–Z
 *
 * Cada caractere tem 2–5 variantes de template para cobrir
 * diferentes estilos de escrita (ex: "4" aberto vs fechado).
 *
 * O reconhecedor retorna os top-K candidatos com score normalizado [0, 1].
 */

export interface Point2D {
    x: number;
    y: number;
    strokeId: number;
}

export interface Result {
    name: string;
    score: number;
}

const NUM_POINTS = 48;

// ── HELPERS GEOMÉTRICOS ─────────────────────────────────────────

/** Gera pontos ao longo de um arco */
function arc(cx: number, cy: number, rx: number, ry: number, startA: number, endA: number, steps = 16): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
        const a = startA + (endA - startA) * (i / steps);
        pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
    }
    return pts;
}

/** Gera pontos numa Bézier quadrática */
function quadBezier(p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, steps = 12): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        pts.push({
            x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
            y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
        });
    }
    return pts;
}

/** Linha reta entre dois pontos */
function line(x0: number, y0: number, x1: number, y1: number, steps = 8): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        pts.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
    }
    return pts;
}

/** Elipse completa */
function ellipse(cx: number, cy: number, rx: number, ry: number, steps = 20): { x: number; y: number }[] {
    return arc(cx, cy, rx, ry, 0, Math.PI * 2, steps);
}

// ═══════════════════════════════════════════════════════════════════
// CLASSE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

interface TemplateEntry {
    name: string;
    points: Point2D[];
    strokeCount: number;
    bboxDiag: number;   // diagonal da bounding box antes de normalizar (0 = ponto)
    isTiny: boolean;    // template "pontual" (., , etc) que não deve matchear inputs grandes
    aspectRatio: number; // width/height (>1 = largo, <1 = alto)
    isCustom: boolean;   // template do usuário via correção (few-shot)
    useCount: number;    // quantas vezes este template foi usado em reconhecimento correto
}

export class PointCloudRecognizer {
    templates: TemplateEntry[] = [];
    // Mapa de correções: "char_errado" → Set<"char_correto"> — para penalizar falsos positivos
    private correctionHistory: Map<string, Map<string, number>> = new Map();

    constructor() {
        if (typeof window !== 'undefined') {
            setTimeout(() => this.loadCustomTemplates(), 100);
        }
    }

    /** Registra que o usuário corrigiu `wrongName` para `correctName` */
    recordCorrection(wrongName: string, correctName: string) {
        if (wrongName === correctName) return;
        const corrections = this.correctionHistory.get(wrongName) ?? new Map<string, number>();
        corrections.set(correctName, (corrections.get(correctName) ?? 0) + 1);
        this.correctionHistory.set(wrongName, corrections);
    }

    /** Quantos templates custom o usuário tem para este caractere */
    customCountFor(name: string): number {
        return this.templates.filter(t => t.isCustom && t.name === name).length;
    }

    addCustomTemplate(name: string, strokes: { x: number; y: number }[][], wrongName?: string) {
        const MAX_CUSTOM_PER_CHAR = 8; // Aumentado para mais memória

        // Registra a correção se houve erro anterior
        if (wrongName && wrongName !== name) {
            this.recordCorrection(wrongName, name);
        }

        let points: Point2D[] = [];
        strokes.forEach((stroke, i) => {
            stroke.forEach(p => points.push({ x: p.x, y: p.y, strokeId: i }));
        });

        // Calcula diagonal e aspect ratio antes de normalizar
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of points) {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
        const bboxDiag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
        const width = maxX - minX;
        const height = maxY - minY;
        const aspectRatio = height > 0.001 ? width / height : 1;

        points = this.normalize(points);

        // Dedup: remove templates custom antigos do mesmo caractere se já atingiu o limite
        // Em vez de FIFO puro, remove o que tem menor useCount (menos útil)
        const existingCustom = this.templates
            .map((t, idx) => ({ t, idx }))
            .filter(({ t }) => t.isCustom && t.name === name);

        if (existingCustom.length >= MAX_CUSTOM_PER_CHAR) {
            // Remove o template com menor useCount (o menos confirmado pelo uso)
            const leastUsed = existingCustom.reduce((min, cur) =>
                cur.t.useCount < min.t.useCount ? cur : min
            );
            this.templates.splice(leastUsed.idx, 1);
        }

        this.templates.push({
            name,
            points,
            strokeCount: strokes.length,
            bboxDiag,
            isTiny: bboxDiag < 0.2,
            aspectRatio,
            isCustom: true,
            useCount: 0,
        });

        // Salvar local no profile do usuário
        try {
            const raw = localStorage.getItem('smartcanvas_custom') || '[]';
            let saved = JSON.parse(raw);
            saved.push({ name, strokes });
            // Limitar a MAX_CUSTOM_PER_CHAR por caractere no storage também
            const countMap = new Map<string, number>();
            saved = saved.filter((item: { name: string }) => {
                const count = (countMap.get(item.name) ?? 0) + 1;
                countMap.set(item.name, count);
                // Mantém os últimos MAX_CUSTOM_PER_CHAR de cada caractere
                return true;
            });
            // Trim: para cada name, manter só os últimos N
            const byName = new Map<string, typeof saved>();
            for (const item of saved) {
                const arr = byName.get(item.name) ?? [];
                arr.push(item);
                byName.set(item.name, arr);
            }
            const trimmed: typeof saved = [];
            for (const arr of byName.values()) {
                trimmed.push(...arr.slice(-MAX_CUSTOM_PER_CHAR));
            }
            localStorage.setItem('smartcanvas_custom', JSON.stringify(trimmed));

            // Persiste o histórico de correções também
            const corrObj: Record<string, Record<string, number>> = {};
            for (const [wrong, corrections] of this.correctionHistory) {
                corrObj[wrong] = Object.fromEntries(corrections);
            }
            localStorage.setItem('smartcanvas_corrections', JSON.stringify(corrObj));

            console.log(`[Recognizer] Aprendizado salvo: Nova variante para '${name}' (${existingCustom.length + 1} custom).`);
        } catch (e) {
            console.error(e);
        }
    }

    loadCustomTemplates() {
        try {
            const raw = localStorage.getItem('smartcanvas_custom');
            if (!raw) return;
            const saved = JSON.parse(raw);
            for (const item of saved) {
                this.addTemplate(item.name, item.strokes, false);
            }
            if (saved.length > 0) {
                console.log(`[Recognizer] Carregados ${saved.length} templates personalizados do usuário (localStorage).`);
            }

            // Carrega histórico de correções
            const corrRaw = localStorage.getItem('smartcanvas_corrections');
            if (corrRaw) {
                const corrObj = JSON.parse(corrRaw) as Record<string, Record<string, number>>;
                for (const [wrong, corrections] of Object.entries(corrObj)) {
                    this.correctionHistory.set(wrong, new Map(Object.entries(corrections).map(([k, v]) => [k, v as number])));
                }
            }
        } catch (e) {
            console.error('Falha ao carregar templates', e);
        }
    }

    addTemplate(name: string, strokes: { x: number; y: number }[][], tiny = false) {
        let points: Point2D[] = [];
        strokes.forEach((stroke, i) => {
            stroke.forEach(p => points.push({ x: p.x, y: p.y, strokeId: i }));
        });
        // Calcula diagonal e aspect ratio antes de normalizar
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of points) {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
        const bboxDiag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
        const width = maxX - minX;
        const height = maxY - minY;
        const aspectRatio = height > 0.001 ? width / height : 1;
        points = this.normalize(points);
        this.templates.push({ name, points, strokeCount: strokes.length, bboxDiag, isTiny: tiny, aspectRatio, isCustom: false, useCount: 0 });
    }

    private resample(points: Point2D[], n: number): Point2D[] {
        if (points.length === 0) return [];
        const I = this.pathLength(points) / (n - 1);
        let D = 0.0;
        const newPoints: Point2D[] = [points[0]];
        const pts = [...points]; // clone to avoid splice issues
        for (let i = 1; i < pts.length; i++) {
            if (pts[i].strokeId === pts[i - 1].strokeId) {
                const d = this.distance(pts[i - 1], pts[i]);
                if (d === 0) continue; // Skip identical points to avoid divide by zero

                if (D + d >= I) {
                    const qx = pts[i - 1].x + ((I - D) / d) * (pts[i].x - pts[i - 1].x);
                    const qy = pts[i - 1].y + ((I - D) / d) * (pts[i].y - pts[i - 1].y);
                    const q: Point2D = { x: qx, y: qy, strokeId: pts[i].strokeId };
                    newPoints.push(q);
                    pts.splice(i, 0, q);
                    D = 0.0;
                } else {
                    D += d;
                }
            }
        }
        while (newPoints.length < n && pts.length > 0) {
            newPoints.push({ ...pts[pts.length - 1] });
        }
        return newPoints.slice(0, n);
    }

    private scale(points: Point2D[]): Point2D[] {
        let minX = +Infinity, maxX = -Infinity, minY = +Infinity, maxY = -Infinity;
        for (const p of points) {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        }
        const size = Math.max(maxX - minX, maxY - minY);
        if (size === 0) return points;
        return points.map(p => ({
            x: (p.x - minX) / size,
            y: (p.y - minY) / size,
            strokeId: p.strokeId
        }));
    }

    private translateTo(points: Point2D[], cx: number, cy: number): Point2D[] {
        let cntx = 0, cnty = 0;
        for (const p of points) { cntx += p.x; cnty += p.y; }
        cntx /= points.length; cnty /= points.length;
        return points.map(p => ({
            x: p.x + cx - cntx,
            y: p.y + cy - cnty,
            strokeId: p.strokeId
        }));
    }

    private normalize(points: Point2D[]): Point2D[] {
        points = this.resample(points, NUM_POINTS);
        points = this.scale(points);
        points = this.translateTo(points, 0, 0);
        return points;
    }

    private pathLength(points: Point2D[]): number {
        let d = 0.0;
        for (let i = 1; i < points.length; i++) {
            if (points[i].strokeId === points[i - 1].strokeId) {
                d += this.distance(points[i - 1], points[i]);
            }
        }
        return d;
    }

    private distance(p1: Point2D, p2: Point2D): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private greedyCloudMatch(points1: Point2D[], points2: Point2D[]): number {
        const e = 0.5;
        let step = Math.floor(Math.pow(points1.length, 1.0 - e));
        if (step < 1) step = 1;
        let min = +Infinity;
        for (let i = 0; i < points1.length; i += step) {
            const d1 = this.cloudDistance(points1, points2, i);
            const d2 = this.cloudDistance(points2, points1, i);
            min = Math.min(min, Math.min(d1, d2));
        }
        return min;
    }

    private cloudDistance(pts1: Point2D[], pts2: Point2D[], start: number): number {
        const matched = new Array(pts1.length).fill(false);
        let sum = 0;
        let cnt = 0;
        let index = -1;

        for (let i = start; cnt < pts1.length; i = (i + 1) % pts1.length) {
            let min = +Infinity;
            for (let j = 0; j < pts1.length; j++) {
                if (!matched[j]) {
                    const d = this.distance(pts1[i % pts1.length], pts2[j]);
                    if (d < min) { min = d; index = j; }
                }
            }
            if (index !== -1) {
                matched[index] = true;
                sum += min;
            }
            cnt++;
        }
        return sum;
    }

    // EXTRAÇÃO DE FEATURES ESTRUTURAIS:
    // O algoritmo $P é "cego" pra posição relativa vertical de strokes independentes.
    // Ex: "i" (traço, depois ponto no topo) é geometricamente igual a "!" (traço, depois ponto na base)
    // Então extraímos informações físicas dos strokes ONDE ESTÃO para desempate.
    private extractFeatures(points: Point2D[]) {
        let isTopDot: boolean | null = null;
        let isTopCross: boolean | null = null;

        const strokes = new Map<number, Point2D[]>();
        for (const p of points) {
            let s = strokes.get(p.strokeId);
            if (!s) { s = []; strokes.set(p.strokeId, s); }
            s.push(p);
        }

        if (strokes.size >= 2) { // Só importa pra caracteres com + de 1 stroke
            let minDiag = +Infinity;
            let dotCy = 0.5;

            let maxHorizRatio = 0;
            let barCy = 0.5;

            for (const s of strokes.values()) {
                let minX = +Infinity, maxX = -Infinity, minY = +Infinity, maxY = -Infinity;
                for (const p of s) {
                    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
                }
                const width = maxX - minX;
                const height = maxY - minY;
                const diag = Math.sqrt(width * width + height * height);
                const cy = (minY + maxY) / 2;

                // Acha o stroke mais parecido com um "ponto" (menor diagonal geral)
                if (diag < minDiag) {
                    minDiag = diag;
                    dotCy = cy;
                }

                // Acha o stroke mais parecido com uma "barra horizontal" (largo e curto)
                const ratio = width / Math.max(height, 0.001);
                if (ratio > maxHorizRatio) {
                    maxHorizRatio = ratio;
                    barCy = cy;
                }
            }

            // Se o menor stroke do input for bem pequeno (< 25% do canvas normalizado), é um ponto
            if (minDiag < 0.25) {
                isTopDot = dotCy < 0.5;
            }

            // Se o traço mais horizontal for muito mais largo que alto (ratio > 1.5)
            if (maxHorizRatio > 1.5) {
                isTopCross = barCy < 0.45; // Se cruza no topo (<45%), é T, senão é + / =
            }
        }
        return { isTopDot, isTopCross };
    }

    /**
     * Reconhece os strokes e retorna top-K candidatos com score.
     * Score normalizado: [0, 1] onde 1 = match perfeito.
     */
    recognize(strokes: { x: number; y: number }[][]): Result[] {
        let points: Point2D[] = [];
        strokes.forEach((stroke, i) => {
            stroke.forEach(p => points.push({ x: p.x, y: p.y, strokeId: i }));
        });

        if (points.length < 5) return []; // mínimo 5 pontos pra evitar noise

        // Calcula bounding box do input
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of points) {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
        const inputDiag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
        const inputStrokeCount = strokes.length;
        const inputWidth = maxX - minX;
        const inputHeight = maxY - minY;
        const inputAR = inputHeight > 0.001 ? inputWidth / inputHeight : 1;

        points = this.normalize(points);

        // Map: nome → melhor score (pega o melhor dentre as variantes)
        const bestPerName = new Map<string, number>();
        // Map: nome → lista de scores dos templates custom (para nearest-neighbor voting)
        const customScoresPerName = new Map<string, number[]>();

        let evalCount = 0;
        for (const template of this.templates) {
            // PRE-FILTER 1: templates "tiny" (., ,) só matcheiam inputs pequenos (< 20px diag)
            if (template.isTiny && inputDiag > 20) continue;

            // PRE-FILTER 2: diferença de stroke count > 2 → skip
            if (Math.abs(template.strokeCount - inputStrokeCount) > 2) continue;

            evalCount++;
            const sumDistance = this.greedyCloudMatch(points, template.points);

            const d = sumDistance / NUM_POINTS;
            let score = Math.max(1.0 - d, 0.0);

            // PENALIDADE DE TRAÇOS
            const strokeDiff = Math.abs(template.strokeCount - inputStrokeCount);
            if (strokeDiff > 0) {
                score *= Math.max(1.0 - (strokeDiff * 0.08), 0.7);
            }

            // PENALIDADE DE ASPECT RATIO
            const arDiff = Math.abs(Math.log((inputAR + 0.01) / (template.aspectRatio + 0.01)));
            if (arDiff > 0.4) {
                score *= Math.max(1.0 - (arDiff - 0.4) * 0.25, 0.55);
            }

            // Rastreia scores dos templates custom separadamente para voting
            if (template.isCustom) {
                const list = customScoresPerName.get(template.name) ?? [];
                list.push(score);
                customScoresPerName.set(template.name, list);
            }

            const prev = bestPerName.get(template.name) ?? 0;
            if (score > prev) bestPerName.set(template.name, score);
        }

        // ── FEW-SHOT NEAREST-NEIGHBOR VOTING ──────────────────────────────
        // Para cada caractere que tem templates custom, calcula um "voto ponderado"
        // que reflete o quão parecido o input é com os exemplos do usuário.
        // O boost é proporcional à quantidade de exemplos E à qualidade do match.
        for (const [name, customScores] of customScoresPerName) {
            if (customScores.length === 0) continue;

            // Top-2 scores dos templates custom deste caractere
            const sortedScores = [...customScores].sort((a, b) => b - a);
            const topScore = sortedScores[0];
            const secondScore = sortedScores[1] ?? 0;

            // Voto: média ponderada dos 2 melhores (o melhor vale mais)
            const votedScore = topScore * 0.7 + secondScore * 0.3;

            // Boost dinâmico: escala de 1.10 (1 exemplo) até 1.40 (8+ exemplos)
            const n = customScores.length;
            const boostFactor = Math.min(1.10 + (n - 1) * 0.04, 1.40);

            const boosted = votedScore * boostFactor;

            // Só substitui se o voto boosted for melhor que o melhor template base
            const current = bestPerName.get(name) ?? 0;
            if (boosted > current) {
                bestPerName.set(name, boosted);
            }
        }

        const results: Result[] = [];
        for (const [name, score] of bestPerName) {
            results.push({ name, score });
        }
        
        // POST-PROCESSING ESTRUTURAL
        // Penaliza letras que $P misturou visualmente
        const feature = this.extractFeatures(points);
        for (const res of results) {
            if (feature.isTopDot !== null) {
                if (feature.isTopDot && (res.name === '!' || res.name === '?')) res.score *= 0.5;
                if (!feature.isTopDot && (res.name === 'i' || res.name === 'j')) res.score *= 0.5;
            }
            if (feature.isTopCross !== null) {
                if (feature.isTopCross && res.name === '+') res.score *= 0.6; // "+" não cruza no topo
                if (!feature.isTopCross && (res.name === 'T' || res.name === 't')) res.score *= 0.7; // T cruza no topo
            }

            // PENALIDADE POR HISTÓRICO DE CORREÇÕES:
            // Se o usuário já corrigiu `res.name` para outro caractere N vezes,
            // e o resultado com maior voto é diferente, penaliza `res.name`.
            const corrections = this.correctionHistory.get(res.name);
            if (corrections && corrections.size > 0) {
                let totalCorrections = 0;
                for (const count of corrections.values()) totalCorrections += count;
                // Penalidade proporcional: até -25% com 5+ correções
                const penalty = Math.min(totalCorrections * 0.05, 0.25);
                res.score *= (1 - penalty);
            }
        }

        // TIEBREAKER MÁGICO PARA TEXTO:
        // Como '0', 'O', e 'o' têm 100% o MESMO aspecto (além de 's' e 'S', 'c' e 'C', etc),
        // eles chegam aqui com notas matematicamente idênticas.
        // Adicionamos +0.1% a todas as letras minúsculas (a-z). 
        // Isso é fraco demais para atrapalhar um reconhecimento real, 
        // mas FORÇA o algoritmo a preferir a letra minúscula caso a forma seja ambígua.
        for (const res of results) {
            if (res.name.length === 1 && res.name >= 'a' && res.name <= 'z') {
                res.score += 0.001;
            }
        }

        results.sort((a, b) => b.score - a.score);
        console.log(`[Recognizer] Evaluated ${evalCount}/${this.templates.length} templates. Top: ${results.slice(0, 3).map(r => `'${r.name}'@${(r.score*100).toFixed(0)}%`).join(', ')}`);
        return results;
    }
}

// ═══════════════════════════════════════════════════════════════════
// INSTÂNCIA GLOBAL + PREENCHIMENTO DE TEMPLATES
// ═══════════════════════════════════════════════════════════════════

export const recognizer = new PointCloudRecognizer();

// ── HELPER: adicionar com nome e múltiplas variantes ─────────────
function add(name: string, ...variants: { x: number; y: number }[][][]) {
    for (const strokes of variants) {
        recognizer.addTemplate(name, strokes);
    }
}

// Helper pra templates "tiny" (pontos, vírgulas) que só devem matchear inputs minúsculos
function addTiny(name: string, ...variants: { x: number; y: number }[][][]) {
    for (const strokes of variants) {
        recognizer.addTemplate(name, strokes, true);
    }
}

// ══════════════════════════════════════════════════════════════════
// DÍGITOS 0–9
// ══════════════════════════════════════════════════════════════════

// 0 — círculo/elipse (horário e anti-horário)
add('0',
    [ellipse(0.5, 0.5, 0.4, 0.5)],                          // horário
    [ellipse(0.5, 0.5, 0.4, 0.5).reverse()],                 // anti-horário
    [ellipse(0.5, 0.5, 0.35, 0.45)],                         // mais apertado
);

// 1
add('1',
    [line(0.5, 0, 0.5, 1)],
    [line(0.2, 0.2, 0.5, 0), line(0.5, 0, 0.5, 1)],
    [line(0.2, 0.2, 0.5, 0), line(0.5, 0, 0.5, 1), line(0.2, 1, 0.8, 1)],
    // variante 1-stroke (chapéu + haste contínua)
    [[{x: 0.2, y: 0.2}, {x: 0.5, y: 0}, {x: 0.5, y: 1}]],
    // variante 1-stroke (chapéu + haste + base zig-zag cursivo)
    [[{x: 0.2, y: 0.2}, {x: 0.5, y: 0}, {x: 0.5, y: 1}, {x: 0.2, y: 1}, {x: 0.8, y: 1}]],
    // variante 2-strokes (chapéu+haste contínua, base separada)
    [[{x: 0.2, y: 0.2}, {x: 0.5, y: 0}, {x: 0.5, y: 1}], line(0.2, 1, 0.8, 1)],
);

// 2
add('2',
    [[
        ...arc(0.5, 0.3, 0.35, 0.3, -Math.PI, 0, 12),
        ...line(0.85, 0.3, 0.1, 1, 6),
        ...line(0.1, 1, 0.9, 1, 6),
    ]],
    [[
        { x: 0.15, y: 0.22 }, { x: 0.5, y: 0 }, { x: 0.85, y: 0.22 }, { x: 0.85, y: 0.42 },
        { x: 0.15, y: 1 }, { x: 0.85, y: 1 },
    ]],
);

// 3
add('3',
    [[
        ...arc(0.5, 0.28, 0.35, 0.28, -Math.PI * 0.8, Math.PI * 0.3, 10),
        ...arc(0.5, 0.72, 0.35, 0.28, -Math.PI * 0.3, Math.PI * 0.8, 10),
    ]],
    [[
        { x: 0.2, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.8, y: 0.4 },
        { x: 0.4, y: 0.5 }, { x: 0.8, y: 0.6 }, { x: 0.8, y: 0.9 }, { x: 0.2, y: 0.9 },
    ]],
);

// 4 — traço contínuo ou 2 strokes
add('4',
    [[{ x: 0.7, y: 0 }, { x: 0.1, y: 0.6 }, { x: 0.9, y: 0.6 }], line(0.7, 0.3, 0.7, 1)],  // 2 strokes
    [[{ x: 0.7, y: 0 }, { x: 0.1, y: 0.6 }, { x: 0.9, y: 0.6 }, { x: 0.7, y: 0.6 }, { x: 0.7, y: 1 }]],  // contínuo
    [[{ x: 0.65, y: 0 }, { x: 0.15, y: 0.65 }, { x: 0.85, y: 0.65 }], line(0.65, 0.25, 0.65, 1)],
);

// 5
add('5',
    [[
        { x: 0.8, y: 0 }, { x: 0.2, y: 0 }, { x: 0.2, y: 0.45 },
        ...arc(0.5, 0.55, 0.35, 0.35, -Math.PI * 0.5, Math.PI * 0.7, 10),
    ]],
    [line(0.8, 0, 0.2, 0), [{ x: 0.2, y: 0 }, { x: 0.2, y: 0.4 }, ...arc(0.5, 0.6, 0.35, 0.35, -Math.PI * 0.5, Math.PI * 0.7, 10)]],
);

// 6
add('6',
    [[
        ...arc(0.5, 0.3, 0.35, 0.3, -Math.PI * 0.3, Math.PI, 10),
        ...ellipse(0.5, 0.65, 0.35, 0.3, 14),
    ]],
    [[
        { x: 0.7, y: 0.05 }, { x: 0.3, y: 0.2 }, { x: 0.15, y: 0.5 },
        ...ellipse(0.5, 0.65, 0.35, 0.3, 14),
    ]],
);

// 7
add('7',
    [[{ x: 0.15, y: 0 }, { x: 0.85, y: 0 }, { x: 0.35, y: 1 }]],
    [line(0.15, 0, 0.85, 0), line(0.85, 0, 0.35, 1)],  // 2 strokes
    [[{ x: 0.15, y: 0 }, { x: 0.85, y: 0 }, { x: 0.45, y: 1 }]],
);

// 8
add('8',
    [[
        ...arc(0.5, 0.27, 0.3, 0.27, Math.PI * 1.5, Math.PI * 3.5, 12),
        ...arc(0.5, 0.73, 0.32, 0.27, -Math.PI * 0.5, Math.PI * 1.5, 12),
    ]],
    [[
        ...ellipse(0.5, 0.28, 0.28, 0.28, 12),
        ...ellipse(0.5, 0.72, 0.3, 0.28, 12),
    ]],
);

// 9
add('9',
    [[
        ...ellipse(0.5, 0.32, 0.33, 0.32, 14).reverse(),
        ...line(0.83, 0.32, 0.5, 1, 6),
    ]],
    [[
        ...ellipse(0.5, 0.32, 0.33, 0.32, 14),
        ...line(0.83, 0.32, 0.5, 1, 6),
    ]],
);

// ══════════════════════════════════════════════════════════════════
// SÍMBOLOS MATEMÁTICOS
// ══════════════════════════════════════════════════════════════════

// + (2 strokes)
add('+',
    [line(0.5, 0.1, 0.5, 0.9), line(0.1, 0.5, 0.9, 0.5)],
    [line(0.1, 0.5, 0.9, 0.5), line(0.5, 0.1, 0.5, 0.9)],  // ordem inversa
);

// - (traço horizontal)
add('-',
    [line(0.1, 0.5, 0.9, 0.5)],
    [line(0.0, 0.5, 1.0, 0.5)],
);

// × (multiplicação — X)
add('×',
    [line(0.15, 0.15, 0.85, 0.85), line(0.85, 0.15, 0.15, 0.85)],
    [line(0.85, 0.15, 0.15, 0.85), line(0.15, 0.15, 0.85, 0.85)],
);

// ÷ (dividir — traço com pontos acima e abaixo)
add('÷',
    [line(0.1, 0.5, 0.9, 0.5), [{ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.2 }], [{ x: 0.5, y: 0.8 }, { x: 0.5, y: 0.8 }]],
);

// = (dois traços horizontais)
add('=',
    [line(0.1, 0.35, 0.9, 0.35), line(0.1, 0.65, 0.9, 0.65)],
    [line(0.1, 0.3, 0.9, 0.3), line(0.1, 0.7, 0.9, 0.7)],
);

// < 
add('<',
    [[{ x: 0.8, y: 0.1 }, { x: 0.2, y: 0.5 }, { x: 0.8, y: 0.9 }]],
);

// >
add('>',
    [[{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.5 }, { x: 0.2, y: 0.9 }]],
);

// / (diagonal)
add('/',
    [line(0.85, 0.1, 0.15, 0.9)],
    [line(0.9, 0.0, 0.1, 1.0)],
);

// \ (contra-diagonal)
add('\\',
    [line(0.15, 0.1, 0.85, 0.9)],
    [line(0.1, 0.0, 0.9, 1.0)],
);

// ( — arco esquerdo
add('(',
    [arc(0.7, 0.5, 0.45, 0.5, Math.PI * 0.6, Math.PI * 1.4, 14)],
    [arc(0.65, 0.5, 0.4, 0.5, Math.PI * 0.55, Math.PI * 1.45, 14)],
);

// ) — arco direito
add(')',
    [arc(0.3, 0.5, 0.45, 0.5, -Math.PI * 0.4, Math.PI * 0.4, 14)],
    [arc(0.35, 0.5, 0.4, 0.5, -Math.PI * 0.45, Math.PI * 0.45, 14)],
);

// . (ponto) — marcado como TINY: só matcheia se o input for minúsculo (< 20px)
// Usa um micro-círculo em vez de pontos degenerados
addTiny('.',
    [ellipse(0.5, 0.5, 0.15, 0.15, 8)],   // micro círculo
);

// , (vírgula) — marcado como TINY
addTiny(',',
    [[{ x: 0.5, y: 0.3 }, { x: 0.5, y: 0.6 }, { x: 0.4, y: 0.9 }, { x: 0.35, y: 1.0 }]],
);

// ? (interrogação)
add('?',
    [[
        ...arc(0.5, 0.25, 0.3, 0.25, -Math.PI, 0, 10),
        ...quadBezier({ x: 0.8, y: 0.25 }, { x: 0.8, y: 0.55 }, { x: 0.5, y: 0.65 }, 8),
    ], [{ x: 0.5, y: 0.85 }, { x: 0.5, y: 0.86 }]],
);

// ! (exclamação)
add('!',
    [line(0.5, 0.05, 0.5, 0.7), [{ x: 0.5, y: 0.9 }, { x: 0.5, y: 0.9 }]],
);

// ══════════════════════════════════════════════════════════════════
// LETRAS MAIÚSCULAS A–Z
// ══════════════════════════════════════════════════════════════════

// A
add('A',
    [[{ x: 0.1, y: 1 }, { x: 0.5, y: 0 }, { x: 0.9, y: 1 }], line(0.28, 0.6, 0.72, 0.6)],
    [[{ x: 0.1, y: 1 }, { x: 0.5, y: 0 }, { x: 0.9, y: 1 }, { x: 0.72, y: 0.6 }, { x: 0.28, y: 0.6 }]],  // contínuo
);

// B
add('B',
    [
        line(0.2, 0, 0.2, 1),
        [{ x: 0.2, y: 0 }, ...arc(0.5, 0.25, 0.3, 0.25, -Math.PI / 2, Math.PI / 2, 8), { x: 0.2, y: 0.5 },
         ...arc(0.5, 0.75, 0.32, 0.25, -Math.PI / 2, Math.PI / 2, 8), { x: 0.2, y: 1 }],
    ],
);

// C
add('C',
    [arc(0.55, 0.5, 0.4, 0.45, Math.PI * 0.4, Math.PI * 1.6, 16)],
    [arc(0.55, 0.5, 0.4, 0.5, Math.PI * 0.3, Math.PI * 1.7, 16)],
);

// D
add('D',
    [line(0.2, 0, 0.2, 1), [{ x: 0.2, y: 0 }, ...arc(0.4, 0.5, 0.45, 0.5, -Math.PI / 2, Math.PI / 2, 12), { x: 0.2, y: 1 }]],
    [[{ x: 0.2, y: 0 }, { x: 0.2, y: 1 }, { x: 0.2, y: 0 }, ...arc(0.4, 0.5, 0.45, 0.5, -Math.PI / 2, Math.PI / 2, 12), { x: 0.2, y: 1 }]],
);

// E
add('E',
    [line(0.2, 0, 0.2, 1), line(0.2, 0, 0.8, 0), line(0.2, 0.5, 0.7, 0.5), line(0.2, 1, 0.8, 1)],
    [[{ x: 0.8, y: 0 }, { x: 0.2, y: 0 }, { x: 0.2, y: 0.5 }, { x: 0.7, y: 0.5 }, { x: 0.2, y: 0.5 }, { x: 0.2, y: 1 }, { x: 0.8, y: 1 }]],
);

// F
add('F',
    [line(0.2, 0, 0.2, 1), line(0.2, 0, 0.8, 0), line(0.2, 0.5, 0.7, 0.5)],
    [[{ x: 0.8, y: 0 }, { x: 0.2, y: 0 }, { x: 0.2, y: 1 }], line(0.2, 0.5, 0.7, 0.5)],
);

// G
add('G',
    [[
        ...arc(0.55, 0.5, 0.4, 0.45, Math.PI * 0.3, Math.PI * 1.6, 14),
        { x: 0.55, y: 0.95 }, { x: 0.9, y: 0.85 }, { x: 0.9, y: 0.5 }, { x: 0.6, y: 0.5 },
    ]],
);

// H
add('H',
    [line(0.2, 0, 0.2, 1), line(0.8, 0, 0.8, 1), line(0.2, 0.5, 0.8, 0.5)],
);

// I
add('I',
    [line(0.5, 0, 0.5, 1)],
    [line(0.3, 0, 0.7, 0), line(0.5, 0, 0.5, 1), line(0.3, 1, 0.7, 1)],
);

// J
add('J',
    [[{ x: 0.7, y: 0 }, { x: 0.7, y: 0.75 }, ...arc(0.45, 0.75, 0.25, 0.25, 0, Math.PI * 0.7, 8)]],
);

// K
add('K',
    [line(0.2, 0, 0.2, 1), [{ x: 0.8, y: 0 }, { x: 0.2, y: 0.5 }, { x: 0.8, y: 1 }]],
);

// L
add('L',
    [[{ x: 0.2, y: 0 }, { x: 0.2, y: 1 }, { x: 0.8, y: 1 }]],
    [line(0.2, 0, 0.2, 1), line(0.2, 1, 0.8, 1)],
);

// M
add('M',
    [[{ x: 0.1, y: 1 }, { x: 0.1, y: 0 }, { x: 0.5, y: 0.55 }, { x: 0.9, y: 0 }, { x: 0.9, y: 1 }]],
);

// N
add('N',
    [[{ x: 0.15, y: 1 }, { x: 0.15, y: 0 }, { x: 0.85, y: 1 }, { x: 0.85, y: 0 }]],
);

// O
add('O',
    [ellipse(0.5, 0.5, 0.4, 0.5)],
    [ellipse(0.5, 0.5, 0.4, 0.5).reverse()],
);

// P
add('P',
    [line(0.2, 0, 0.2, 1), [{ x: 0.2, y: 0 }, ...arc(0.5, 0.25, 0.3, 0.25, -Math.PI / 2, Math.PI / 2, 10), { x: 0.2, y: 0.5 }]],
);

// Q
add('Q',
    [ellipse(0.5, 0.5, 0.4, 0.45, 16), line(0.65, 0.75, 0.9, 1)],
);

// R
add('R',
    [line(0.2, 0, 0.2, 1), [{ x: 0.2, y: 0 }, ...arc(0.5, 0.25, 0.3, 0.25, -Math.PI / 2, Math.PI / 2, 10), { x: 0.2, y: 0.5 }, { x: 0.8, y: 1 }]],
);

// S
add('S',
    [[
        ...arc(0.5, 0.28, 0.32, 0.28, -Math.PI * 0.3, Math.PI * 1.1, 10),
        ...arc(0.5, 0.72, 0.32, 0.28, Math.PI * 1.1, Math.PI * 2.3, 10),
    ]],
    [[
        { x: 0.75, y: 0.15 }, { x: 0.5, y: 0 }, { x: 0.2, y: 0.15 }, { x: 0.2, y: 0.4 },
        { x: 0.8, y: 0.6 }, { x: 0.8, y: 0.85 }, { x: 0.5, y: 1 }, { x: 0.2, y: 0.85 },
    ]],
);

// T
add('T',
    [line(0.1, 0, 0.9, 0), line(0.5, 0, 0.5, 1)],
    [line(0.5, 0, 0.5, 1), line(0.1, 0, 0.9, 0)],  // ordem inversa
    [[{ x: 0.1, y: 0 }, { x: 0.9, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 }]], // contínuo num traço só
);

// U
add('U',
    [[{ x: 0.15, y: 0 }, { x: 0.15, y: 0.7 }, ...arc(0.5, 0.7, 0.35, 0.3, Math.PI, Math.PI * 2, 10), { x: 0.85, y: 0 }]],
);

// V
add('V',
    [[{ x: 0.1, y: 0 }, { x: 0.5, y: 1 }, { x: 0.9, y: 0 }]],
);

// W
add('W',
    [[{ x: 0.05, y: 0 }, { x: 0.25, y: 1 }, { x: 0.5, y: 0.4 }, { x: 0.75, y: 1 }, { x: 0.95, y: 0 }]],
);

// X
add('X',
    [line(0.15, 0, 0.85, 1), line(0.85, 0, 0.15, 1)],
    [line(0.85, 0, 0.15, 1), line(0.15, 0, 0.85, 1)],
);

// Y
add('Y',
    [[{ x: 0.1, y: 0 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0 }], line(0.5, 0.5, 0.5, 1)],
    [[{ x: 0.1, y: 0 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 1 }], line(0.9, 0, 0.5, 0.5)],
);

// Z
add('Z',
    [[{ x: 0.15, y: 0 }, { x: 0.85, y: 0 }, { x: 0.15, y: 1 }, { x: 0.85, y: 1 }]],
);

// ══════════════════════════════════════════════════════════════════
// LETRAS MINÚSCULAS MAIS COMUNS (a, b, c, d, e, n, o, r, s, t, u, x)
// ══════════════════════════════════════════════════════════════════

// a (minúsculo)
add('a',
    [[...ellipse(0.5, 0.55, 0.32, 0.35, 14).reverse(), { x: 0.82, y: 0.55 }, { x: 0.82, y: 1 }]],
);

// i (minúsculo) - traço + ponto
// Removi a variante sem pingo, assim ele NUNCA vai confundir "1" (traço) com "i",
// pois o "1" tem 1 traço e "i" OBRIGATORIAMENTE tem 2 traços (será penalizado se não tiver).
add('i',
    [line(0.5, 0.35, 0.5, 1), ellipse(0.5, 0.1, 0.05, 0.05, 6)],
);

// b (minúsculo)
add('b',
    [line(0.2, 0, 0.2, 1), [...ellipse(0.52, 0.7, 0.32, 0.3, 14)]],
);

// c (minúsculo)
add('c',
    [arc(0.55, 0.65, 0.32, 0.35, Math.PI * 0.4, Math.PI * 1.6, 12)],
);

// d (minúsculo)  
add('d',
    [[...ellipse(0.48, 0.7, 0.32, 0.3, 14).reverse()], line(0.8, 0, 0.8, 1)],
    // variante cursiva de 1 stroke: termina bola, sobe pra haste e desce
    [[...ellipse(0.48, 0.7, 0.32, 0.3, 14).reverse(), { x: 0.8, y: 0.7 }, { x: 0.8, y: 0 }, { x: 0.8, y: 1 }]],
);

// e (minúsculo)
add('e',
    [[{ x: 0.2, y: 0.6 }, { x: 0.8, y: 0.6 }, ...arc(0.5, 0.6, 0.3, 0.35, -Math.PI * 0.3, Math.PI * 1.3, 12)]],
);

// n (minúsculo)
add('n',
    [[{ x: 0.2, y: 1 }, { x: 0.2, y: 0.4 }, ...arc(0.5, 0.5, 0.3, 0.3, Math.PI, 0, 8), { x: 0.8, y: 1 }]],
);

// o (minúsculo)
add('o',
    [ellipse(0.5, 0.65, 0.3, 0.32)],
    [ellipse(0.5, 0.65, 0.3, 0.32).reverse()],
);

// r (minúsculo)
add('r',
    [[{ x: 0.25, y: 1 }, { x: 0.25, y: 0.4 }, { x: 0.35, y: 0.35 }, { x: 0.6, y: 0.35 }, { x: 0.75, y: 0.42 }]],
);

// s (minúsculo)
add('s',
    [[
        { x: 0.7, y: 0.42 }, { x: 0.5, y: 0.35 }, { x: 0.3, y: 0.45 }, { x: 0.3, y: 0.58 },
        { x: 0.7, y: 0.72 }, { x: 0.7, y: 0.88 }, { x: 0.5, y: 0.95 }, { x: 0.3, y: 0.88 },
    ]],
);

// t (minúsculo)
add('t',
    [line(0.4, 0.1, 0.4, 1), line(0.2, 0.4, 0.65, 0.4)], // 2 strokes (cruzeta)
    [[{ x: 0.4, y: 0.1 }, { x: 0.4, y: 0.8 }, ...arc(0.55, 0.8, 0.15, 0.15, Math.PI, 0, 8), { x: 0.7, y: 0.5 }]], // 1 stroke cursivo
);

// u (minúsculo)
add('u',
    [[{ x: 0.2, y: 0.35 }, { x: 0.2, y: 0.8 }, ...arc(0.5, 0.8, 0.3, 0.2, Math.PI, 0, 6), { x: 0.8, y: 0.35 }, { x: 0.8, y: 1 }]],
    [[{ x: 0.2, y: 0.35 }, { x: 0.2, y: 0.8 }, ...arc(0.5, 0.8, 0.3, 0.2, Math.PI, 0, 6), { x: 0.8, y: 0.35 }]], // estilo "copo" redondo
);

// x (minúsculo) — same as X
add('x',
    [line(0.2, 0.35, 0.8, 1), line(0.8, 0.35, 0.2, 1)],
);

// ══════════════════════════════════════════════════════════════════
// LETRAS MINÚSCULAS QUE FALTAVAM (f, g, h, j, k, l, m, p, q, v, w, y, z)
// ══════════════════════════════════════════════════════════════════

// f (minúsculo) — gancho no topo + haste + cruzeta
add('f',
    // 2 strokes: haste curvada + barra horizontal
    [[...arc(0.6, 0.15, 0.15, 0.15, -Math.PI * 0.8, 0, 6), { x: 0.45, y: 0.15 }, { x: 0.45, y: 1 }], line(0.25, 0.45, 0.7, 0.45)],
    // 1 stroke cursivo: gancho → desce → para
    [[{ x: 0.7, y: 0.1 }, { x: 0.55, y: 0 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 1 }], line(0.2, 0.4, 0.65, 0.4)],
);

// g (minúsculo) — círculo + descender curvando à esquerda
add('g',
    [[...ellipse(0.5, 0.45, 0.3, 0.28, 14).reverse(), { x: 0.8, y: 0.45 }, { x: 0.8, y: 0.85 }, ...arc(0.55, 0.85, 0.25, 0.15, 0, Math.PI * 0.8, 6)]],
    // variante 2 strokes: círculo + haste descende
    [ellipse(0.5, 0.45, 0.3, 0.28, 14).reverse(), [{ x: 0.8, y: 0.2 }, { x: 0.8, y: 0.9 }, { x: 0.55, y: 1 }, { x: 0.3, y: 0.9 }]],
);

// h (minúsculo) — haste alta + bump à direita (como n mas mais alto)
add('h',
    [[{ x: 0.2, y: 0 }, { x: 0.2, y: 1 }, { x: 0.2, y: 0.45 }, ...arc(0.5, 0.5, 0.3, 0.25, Math.PI, 0, 8), { x: 0.8, y: 1 }]],
    // 2 strokes
    [line(0.2, 0, 0.2, 1), [{ x: 0.2, y: 0.45 }, ...arc(0.5, 0.5, 0.3, 0.25, Math.PI, 0, 8), { x: 0.8, y: 1 }]],
);

// j (minúsculo) — ponto + haste descende curvando à esquerda
add('j',
    [line(0.5, 0.35, 0.5, 0.85), ellipse(0.5, 0.12, 0.04, 0.04, 6)],
    [[{ x: 0.5, y: 0.35 }, { x: 0.5, y: 0.9 }, { x: 0.35, y: 1 }, { x: 0.2, y: 0.95 }], ellipse(0.5, 0.12, 0.04, 0.04, 6)],
);

// k (minúsculo) — haste + seta
add('k',
    [line(0.25, 0, 0.25, 1), [{ x: 0.75, y: 0.35 }, { x: 0.25, y: 0.6 }, { x: 0.75, y: 1 }]],
    // 1 stroke contínuo
    [[{ x: 0.25, y: 0 }, { x: 0.25, y: 1 }, { x: 0.25, y: 0.6 }, { x: 0.7, y: 0.35 }, { x: 0.25, y: 0.6 }, { x: 0.7, y: 1 }]],
);

// l (minúsculo) — linha vertical (distinguir de I/1 via aspect ratio + contexto)
add('l',
    [line(0.5, 0, 0.5, 1)],
    // variante com serifinha na base
    [[{ x: 0.5, y: 0 }, { x: 0.5, y: 0.95 }, { x: 0.65, y: 1 }]],
);

// m (minúsculo) — dois bumps
add('m',
    [[{ x: 0.1, y: 1 }, { x: 0.1, y: 0.4 },
      ...arc(0.3, 0.5, 0.2, 0.2, Math.PI, 0, 6), { x: 0.5, y: 0.7 },
      ...arc(0.7, 0.5, 0.2, 0.2, Math.PI, 0, 6), { x: 0.9, y: 1 }]],
    // variante pontiaguda
    [[{ x: 0.1, y: 1 }, { x: 0.1, y: 0.4 }, { x: 0.35, y: 0.4 }, { x: 0.5, y: 0.7 }, { x: 0.65, y: 0.4 }, { x: 0.9, y: 0.4 }, { x: 0.9, y: 1 }]],
);

// p (minúsculo) — haste desce + círculo no topo direito
add('p',
    [line(0.2, 0.3, 0.2, 1), [...ellipse(0.52, 0.5, 0.3, 0.25, 14)]],
    // 1 stroke: desce e volta pra fazer o bump
    [[{ x: 0.2, y: 0.3 }, { x: 0.2, y: 1 }, { x: 0.2, y: 0.3 }, ...arc(0.5, 0.45, 0.3, 0.25, -Math.PI / 2, Math.PI / 2, 10), { x: 0.2, y: 0.7 }]],
);

// q (minúsculo) — círculo + haste descende à direita
add('q',
    [[...ellipse(0.48, 0.5, 0.3, 0.25, 14).reverse()], line(0.78, 0.3, 0.78, 1)],
    // 1 stroke
    [[...ellipse(0.48, 0.5, 0.3, 0.25, 14).reverse(), { x: 0.78, y: 0.5 }, { x: 0.78, y: 1 }]],
);

// v (minúsculo) — idêntico a V
add('v',
    [[{ x: 0.15, y: 0.35 }, { x: 0.5, y: 1 }, { x: 0.85, y: 0.35 }]],
);

// w (minúsculo) — idêntico a W
add('w',
    [[{ x: 0.05, y: 0.35 }, { x: 0.25, y: 1 }, { x: 0.5, y: 0.55 }, { x: 0.75, y: 1 }, { x: 0.95, y: 0.35 }]],
);

// y (minúsculo) — V + descender
add('y',
    [[{ x: 0.15, y: 0.35 }, { x: 0.5, y: 0.75 }], [{ x: 0.85, y: 0.35 }, { x: 0.5, y: 0.75 }, { x: 0.3, y: 1 }]],
    // 1 stroke
    [[{ x: 0.15, y: 0.35 }, { x: 0.5, y: 0.75 }, { x: 0.85, y: 0.35 }, { x: 0.5, y: 0.75 }, { x: 0.3, y: 1 }]],
);

// z (minúsculo) — idêntico a Z
add('z',
    [[{ x: 0.2, y: 0.35 }, { x: 0.8, y: 0.35 }, { x: 0.2, y: 1 }, { x: 0.8, y: 1 }]],
);

// ══════════════════════════════════════════════════════════════════
// VARIANTES EXTRAS (caracteres mais confundidos)
// ══════════════════════════════════════════════════════════════════

// 0 vs O — variante oval mais alta para '0'
add('0',
    [ellipse(0.5, 0.5, 0.3, 0.5)],  // mais alto que largo
    [ellipse(0.5, 0.5, 0.3, 0.5).reverse()],
);

// a — variante de "a" impresso (dois andares)
add('a',
    // "a" de dois andares: arco em cima + barriga em baixo + haste
    [[{ x: 0.7, y: 0.35 }, { x: 0.5, y: 0.35 }, ...arc(0.5, 0.55, 0.3, 0.25, Math.PI * 1.5, Math.PI * 0.5, 10), { x: 0.8, y: 0.55 }, { x: 0.8, y: 1 }]],
);

// n — variante angular (sem curva)
add('n',
    [[{ x: 0.2, y: 1 }, { x: 0.2, y: 0.4 }, { x: 0.8, y: 0.4 }, { x: 0.8, y: 1 }]],
);

// u — variante angular
add('u',
    [[{ x: 0.2, y: 0.35 }, { x: 0.2, y: 0.85 }, { x: 0.8, y: 0.85 }, { x: 0.8, y: 0.35 }]],
);

// 2 — variante cursiva (sem base reta)
add('2',
    [[
        { x: 0.2, y: 0.25 }, { x: 0.5, y: 0.05 }, { x: 0.8, y: 0.25 },
        { x: 0.2, y: 0.95 }, { x: 0.8, y: 0.95 },
    ]],
);

// 7 — variante com barra horizontal
add('7',
    [[{ x: 0.15, y: 0 }, { x: 0.85, y: 0 }, { x: 0.45, y: 1 }], line(0.35, 0.5, 0.7, 0.5)],
);

console.log(`[Recognizer] ${recognizer.templates.length} templates carregados`);
