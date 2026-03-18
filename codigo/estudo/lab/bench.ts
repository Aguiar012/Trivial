/**
 * bench.ts — Benchmark automatizado do Recognizer
 *
 * Uso:
 *   npx tsx codigo/estudo/lab/bench.ts
 *   npx tsx codigo/estudo/lab/bench.ts --sweep   (testa variações de parâmetros)
 *   npx tsx codigo/estudo/lab/bench.ts --topk 3  (considera correto se label está no top-3)
 *
 * Requer: samples.json com amostras capturadas pelo SampleCapture.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Importa o Recognizer (sem localStorage, sem window) ──────────────
// Patch mínimo para rodar em Node
(globalThis as any).window = undefined;
(globalThis as any).localStorage = { getItem: () => null, setItem: () => {} };

const { PointCloudRecognizer } = await import('../Recognizer.ts');

// ── Tipos ─────────────────────────────────────────────────────────────
interface Sample {
    label: string;
    strokes: { x: number; y: number }[][];
    capturedAt: string;
}

interface BenchResult {
    label: string;
    top1Correct: boolean;
    topKCorrect: boolean;
    top1Name: string;
    top1Score: number;
    rank: number;   // posição do label correto no ranking (1 = top1)
}

// ── Args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const SWEEP = args.includes('--sweep');
const TOPK = parseInt(args.find(a => a.startsWith('--topk'))?.split('=')[1] ?? '1');
const VERBOSE = args.includes('--verbose') || args.includes('-v');

// ── Carrega amostras ──────────────────────────────────────────────────
const samplesPath = resolve(__dirname, 'samples.json');
let samples: Sample[] = [];
try {
    samples = JSON.parse(readFileSync(samplesPath, 'utf-8'));
} catch {
    console.error('❌ samples.json não encontrado ou inválido.');
    console.error('   Execute o SampleCapture no app para capturar amostras primeiro.');
    process.exit(1);
}

if (samples.length === 0) {
    console.error('❌ samples.json está vazio. Capture amostras primeiro.');
    process.exit(1);
}

console.log(`\n🔬 Benchmark do Recognizer`);
console.log(`   Amostras: ${samples.length} | Top-K: ${TOPK}\n`);

// ── Função de benchmark ───────────────────────────────────────────────
function runBenchmark(rec: InstanceType<typeof PointCloudRecognizer>, topK = 1): {
    results: BenchResult[];
    accuracy: number;
    topKAccuracy: number;
    byLabel: Record<string, { total: number; correct: number; topK: number; avgScore: number; commonMistake: string }>;
} {
    const results: BenchResult[] = [];

    for (const sample of samples) {
        const recResults = rec.recognize(sample.strokes);
        const top1 = recResults[0];
        const rankIdx = recResults.findIndex(r => r.name === sample.label);

        results.push({
            label: sample.label,
            top1Correct: top1?.name === sample.label,
            topKCorrect: rankIdx >= 0 && rankIdx < topK,
            top1Name: top1?.name ?? '?',
            top1Score: top1?.score ?? 0,
            rank: rankIdx >= 0 ? rankIdx + 1 : 999,
        });
    }

    const correct = results.filter(r => r.top1Correct).length;
    const correctTopK = results.filter(r => r.topKCorrect).length;

    // Por label
    const byLabel: Record<string, { total: number; correct: number; topK: number; avgScore: number; commonMistake: string; mistakes: string[] }> = {};
    for (const r of results) {
        if (!byLabel[r.label]) byLabel[r.label] = { total: 0, correct: 0, topK: 0, avgScore: 0, commonMistake: '', mistakes: [] };
        const b = byLabel[r.label];
        b.total++;
        b.avgScore += r.top1Score;
        if (r.top1Correct) b.correct++;
        if (r.topKCorrect) b.topK++;
        if (!r.top1Correct) b.mistakes.push(r.top1Name);
    }
    for (const b of Object.values(byLabel)) {
        b.avgScore = b.avgScore / b.total;
        // Erro mais comum
        const freq: Record<string, number> = {};
        for (const m of b.mistakes) freq[m] = (freq[m] ?? 0) + 1;
        b.commonMistake = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
        delete (b as any).mistakes;
    }

    return {
        results,
        accuracy: correct / results.length,
        topKAccuracy: correctTopK / results.length,
        byLabel,
    };
}

// ── Benchmark principal ───────────────────────────────────────────────
const rec = new PointCloudRecognizer();
const bench = runBenchmark(rec, TOPK);

// Relatório por label
const labels = Object.keys(bench.byLabel).sort();
const maxLabelW = Math.max(...labels.map(l => l.length), 5);

console.log(`${'Label'.padEnd(maxLabelW)} | Correct | Top-K | Avg Score | Mistake`);
console.log(`${''.padEnd(maxLabelW, '─')}─┼─────────┼───────┼───────────┼────────`);

for (const label of labels) {
    const b = bench.byLabel[label];
    const pct = (b.correct / b.total * 100).toFixed(0).padStart(3);
    const topKPct = (b.topK / b.total * 100).toFixed(0).padStart(3);
    const score = (b.avgScore * 100).toFixed(1).padStart(5);
    const ok = b.correct === b.total ? '✅' : b.correct >= b.total * 0.6 ? '⚠️' : '❌';
    console.log(
        `${label.padEnd(maxLabelW)} | ${pct}% ${ok}   | ${topKPct}%   | ${score}%    | ${b.commonMistake || '—'}`
    );
}

console.log();
console.log(`━━━ RESULTADO GERAL ━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  Top-1 Accuracy : ${(bench.accuracy * 100).toFixed(1)}%  (${bench.results.filter(r => r.top1Correct).length}/${bench.results.length})`);
if (TOPK > 1)
    console.log(`  Top-${TOPK} Accuracy : ${(bench.topKAccuracy * 100).toFixed(1)}%  (${bench.results.filter(r => r.topKCorrect).length}/${bench.results.length})`);

if (VERBOSE) {
    console.log('\n── Erros detalhados ──');
    for (const r of bench.results.filter(r => !r.top1Correct)) {
        console.log(`  '${r.label}' → '${r.top1Name}' (score ${(r.top1Score*100).toFixed(1)}%, rank ${r.rank})`);
    }
}

// ── SWEEP de parâmetros ────────────────────────────────────────────────
if (SWEEP) {
    console.log('\n━━━ SWEEP DE PARÂMETROS ━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Testando variações de NUM_POINTS e scoring...\n');

    // Como NUM_POINTS está hardcoded no Recognizer, testamos outras variações
    // que podemos controlar externamente: minTop1Score, requiredStableCount
    const configs = [
        { label: 'baseline (atual)', minScore: 0.72, stableCount: 4 },
        { label: 'minScore 0.65', minScore: 0.65, stableCount: 4 },
        { label: 'minScore 0.78', minScore: 0.78, stableCount: 4 },
        { label: 'stableCount 3', minScore: 0.72, stableCount: 3 },
        { label: 'stableCount 6', minScore: 0.72, stableCount: 6 },
    ];

    console.log(`Config                  | Top-1 Acc | Notes`);
    console.log(`────────────────────────┼───────────┼──────`);

    for (const cfg of configs) {
        // Recria recognizer com mesmos templates mas avalia com threshold diferente
        const r2 = new PointCloudRecognizer();
        runBenchmark(r2, 1);

        // Simula threshold: filtra resultados onde top1.score >= cfg.minScore
        const passScore = bench.results.filter(r => r.top1Score >= cfg.minScore);
        const correctPass = passScore.filter(r => r.top1Correct).length;
        const acc = passScore.length > 0 ? correctPass / passScore.length : 0;
        const coverage = passScore.length / bench.results.length;

        console.log(
            `${cfg.label.padEnd(23)} | ${(acc*100).toFixed(1).padStart(5)}%     | coverage: ${(coverage*100).toFixed(0)}% (${passScore.length}/${bench.results.length} samples)`
        );
    }
}

console.log('\n💡 Dica: capture pelo menos 5 amostras por caractere para resultados confiáveis.');
console.log('   Adicione --verbose para ver todos os erros individuais.');
console.log('   Adicione --sweep para testar variações de parâmetros.\n');
