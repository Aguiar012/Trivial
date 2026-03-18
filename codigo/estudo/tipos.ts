/*
 * tipos.ts — Tipos TypeScript para o sistema de flashcards
 *
 * ── HIERARQUIA ──────────────────────────────────────────────────
 *
 *   Baralho (Deck) contém muitas Cartas (DyCard)
 *   Cada Carta tem:
 *     - Conteúdo criado pelo usuário (frente/verso)
 *     - Dados do FSRS-6 (scheduling, difficulty, stability)
 *     - Metadados (tags, datas, etc.)
 *
 *   Um RegistroRevisao (ReviewEntry) é criado toda vez que o
 *   usuário avalia uma carta (Fácil/Bom/Difícil/Errei)
 *
 * ── PERSISTÊNCIA ────────────────────────────────────────────────
 *
 *   Tudo é salvo no Supabase (PostgreSQL).
 *   Tabelas: baralhos, cartas, revisoes, config_estudo
 *
 *   Os tipos abaixo espelham as colunas do banco (snake_case)
 *   para facilitar a conversão.
 */

import type { Card as FSRSCard, ReviewLog } from 'ts-fsrs'

// ── CARTA (FLASHCARD) ───────────────────────────────────────────

/** Tipo usado na UI (camelCase, com FSRSCard embutido) */
export interface DyCard {
    /** UUID gerado pelo Supabase */
    id: string

    /** Texto da frente — a pergunta */
    frente: string

    /** Texto do verso — a resposta */
    verso: string

    /** Tags para organização (ex: "matemática", "fuvest", "eletrostática") */
    tags: string[]

    /** ID do baralho ao qual pertence */
    baralhoId: string

    /** Dados internos do FSRS-6 (due, stability, difficulty, state, etc.) */
    fsrs: FSRSCard

    /** Data de criação (ISO string) */
    criadoEm: string

    /** Data da última edição (ISO string) */
    editadoEm: string
}

/** Tipo que espelha a row no Supabase (snake_case, FSRS achatado) */
export interface CartaRow {
    id: string
    baralho_id: string
    frente: string
    verso: string
    tags: string[]
    fsrs_due: string
    fsrs_stability: number
    fsrs_difficulty: number
    fsrs_elapsed_days: number
    fsrs_scheduled_days: number
    fsrs_learning_steps: number
    fsrs_reps: number
    fsrs_lapses: number
    fsrs_state: number
    fsrs_last_review: string | null
    criado_em: string
    editado_em: string
}

// ── CONVERSORES CartaRow ↔ DyCard ───────────────────────────────

export function rowParaDyCard(row: CartaRow): DyCard {
    return {
        id: row.id,
        frente: row.frente,
        verso: row.verso,
        tags: row.tags ?? [],
        baralhoId: row.baralho_id,
        fsrs: {
            due: new Date(row.fsrs_due),
            stability: row.fsrs_stability,
            difficulty: row.fsrs_difficulty,
            elapsed_days: row.fsrs_elapsed_days,
            scheduled_days: row.fsrs_scheduled_days,
            learning_steps: row.fsrs_learning_steps,
            reps: row.fsrs_reps,
            lapses: row.fsrs_lapses,
            state: row.fsrs_state,
            last_review: row.fsrs_last_review ? new Date(row.fsrs_last_review) : undefined,
        },
        criadoEm: row.criado_em,
        editadoEm: row.editado_em,
    }
}

export function dyCardParaRow(card: DyCard): Omit<CartaRow, 'id' | 'criado_em'> {
    return {
        baralho_id: card.baralhoId,
        frente: card.frente,
        verso: card.verso,
        tags: card.tags,
        fsrs_due: card.fsrs.due instanceof Date ? card.fsrs.due.toISOString() : String(card.fsrs.due),
        fsrs_stability: card.fsrs.stability,
        fsrs_difficulty: card.fsrs.difficulty,
        fsrs_elapsed_days: card.fsrs.elapsed_days,
        fsrs_scheduled_days: card.fsrs.scheduled_days,
        fsrs_learning_steps: card.fsrs.learning_steps,
        fsrs_reps: card.fsrs.reps,
        fsrs_lapses: card.fsrs.lapses,
        fsrs_state: card.fsrs.state,
        fsrs_last_review: card.fsrs.last_review
            ? (card.fsrs.last_review instanceof Date ? card.fsrs.last_review.toISOString() : String(card.fsrs.last_review))
            : null,
        editado_em: card.editadoEm,
    }
}

// ── BARALHO (DECK) ──────────────────────────────────────────────

export interface Baralho {
    /** ID único */
    id: string

    /** Nome do baralho (ex: "Física — FUVEST") */
    nome: string

    /** Cor do baralho para UI (hex) */
    cor: string

    /** Data de criação (ISO string) */
    criadoEm: string
}

// ── REGISTRO DE REVISÃO ─────────────────────────────────────────

export interface RegistroRevisao {
    /** ID único */
    id: string

    /** ID da carta revisada */
    cartaId: string

    /** Log do FSRS com rating, state, stability, etc. */
    log: ReviewLog

    /** Data em que a revisão aconteceu (ISO string) */
    data: string
}

// ── CONFIGURAÇÃO ────────────────────────────────────────────────

export interface ConfigEstudo {
    /** Máximo de cartas novas por dia */
    cartasNovasPorDia: number

    /** Máximo de revisões por dia */
    revisoesPorDia: number

    /** Retenção desejada (0.0 a 1.0) — default 0.9 */
    retencaoDesejada: number
}

// ── ESTADO DA SESSÃO DE ESTUDO ──────────────────────────────────

export type FaseEstudo = 'idle' | 'estudando' | 'criando' | 'concluido'

export interface SessaoEstudo {
    /** Cartas pendentes para esta sessão (ordenadas pelo FSRS) */
    fila: DyCard[]

    /** Índice da carta atual na fila */
    indiceAtual: number

    /** A carta está virada? (mostrando o verso) */
    virada: boolean

    /** Fase da sessão */
    fase: FaseEstudo

    /** Estatísticas da sessão atual */
    estatisticas: {
        total: number
        acertos: number   // Good + Easy
        erros: number     // Again
        dificeis: number  // Hard
    }
}

// ── DEFAULTS ────────────────────────────────────────────────────

export const CONFIG_PADRAO: ConfigEstudo = {
    cartasNovasPorDia: 20,
    revisoesPorDia: 100,
    retencaoDesejada: 0.9,
}

export const SESSAO_INICIAL: SessaoEstudo = {
    fila: [],
    indiceAtual: 0,
    virada: false,
    fase: 'idle',
    estatisticas: { total: 0, acertos: 0, erros: 0, dificeis: 0 },
}

export const CORES_BARALHO = [
    '#c04050', // vermelho rosado
    '#5a8f4a', // verde
    '#4a6fa5', // azul
    '#c07a30', // laranja
    '#8a4a8a', // roxo
    '#4a8a8a', // teal
]
