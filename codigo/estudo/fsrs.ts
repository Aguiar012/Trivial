/*
 * fsrs.ts — Integração com o algoritmo FSRS-6
 *
 * ── O QUE FAZ ───────────────────────────────────────────────────
 *
 *   Encapsula o ts-fsrs para criar cartas, calcular revisões do dia,
 *   e processar o feedback do usuário (Again/Hard/Good/Easy).
 *
 *   O FSRS-6 calcula automaticamente:
 *     - Quando a carta deve ser revisada (due date)
 *     - A estabilidade da memória (stability)
 *     - A dificuldade da carta (difficulty)
 *     - Os passos de aprendizado (learning steps)
 *
 * ── USO ─────────────────────────────────────────────────────────
 *
 *   import { criarCarta, cartasParaHoje, avaliarCarta } from './fsrs'
 *
 *   const carta = criarCarta('Pergunta?', 'Resposta!', ['tag'], baralhoId)
 *   const hoje = cartasParaHoje(todasAsCartas)
 *   const { cartaAtualizada, registro } = avaliarCarta(carta, Rating.Good)
 */

import { fsrs, createEmptyCard, Rating, type Card as FSRSCard, type RecordLogItem } from 'ts-fsrs'
import type { DyCard, RegistroRevisao, ConfigEstudo } from './tipos'
import { CONFIG_PADRAO } from './tipos'

// ── INSTÂNCIA DO FSRS ───────────────────────────────────────────

let _config: ConfigEstudo = CONFIG_PADRAO

/** Cria uma instância do FSRS com a config atual */
function criarFSRS() {
    return fsrs({
        request_retention: _config.retencaoDesejada,
        enable_fuzz: true,        // pequena variação nos intervalos (evita acúmulo)
        enable_short_term: true,  // passos de aprendizado de curto prazo
    })
}

/** Atualiza a configuração do FSRS */
export function configurarFSRS(config: Partial<ConfigEstudo>) {
    _config = { ..._config, ...config }
}

// ── CRIAR CARTA ─────────────────────────────────────────────────

/** Gera um ID único usando crypto.randomUUID */
function gerarId(): string {
    return crypto.randomUUID()
}

/** Cria uma nova DyCard com dados FSRS zerados (carta nova) */
export function criarCarta(
    frente: string,
    verso: string,
    tags: string[],
    baralhoId: string,
): DyCard {
    const agora = new Date().toISOString()
    const fsrsCard: FSRSCard = createEmptyCard()

    return {
        id: gerarId(),
        frente,
        verso,
        tags,
        baralhoId,
        fsrs: fsrsCard,
        criadoEm: agora,
        editadoEm: agora,
    }
}

// ── CALCULAR CARTAS DO DIA ──────────────────────────────────────

/**
 * Filtra e ordena as cartas que devem ser revisadas hoje.
 *
 * Regras:
 *   1. Cartas com due <= agora → são revisões pendentes
 *   2. Cartas novas (state=New) → limitadas pelo cartasNovasPorDia
 *   3. Ordenação: revisões atrasadas primeiro, depois novas
 */
export function cartasParaHoje(
    todasAsCartas: DyCard[],
    config: ConfigEstudo = _config,
): DyCard[] {
    const agora = new Date()

    // Separa cartas vencidas (due <= agora) das novas
    const vencidas: DyCard[] = []
    const novas: DyCard[] = []

    for (const carta of todasAsCartas) {
        const due = new Date(carta.fsrs.due)
        if (carta.fsrs.state === 0) {
            // State.New = 0
            novas.push(carta)
        } else if (due <= agora) {
            vencidas.push(carta)
        }
    }

    // Ordena vencidas pela due date (mais atrasada primeiro)
    vencidas.sort((a, b) => new Date(a.fsrs.due).getTime() - new Date(b.fsrs.due).getTime())

    // Limita cartas novas pelo config
    const novasLimitadas = novas.slice(0, config.cartasNovasPorDia)

    // Limita total de revisões
    const revisoesLimitadas = vencidas.slice(0, config.revisoesPorDia)

    // Revisões primeiro, depois novas
    return [...revisoesLimitadas, ...novasLimitadas]
}

// ── AVALIAR CARTA ───────────────────────────────────────────────

export interface ResultadoAvaliacao {
    /** A carta com os dados FSRS atualizados */
    cartaAtualizada: DyCard

    /** O registro de revisão para salvar no histórico */
    registro: RegistroRevisao
}

/**
 * Processa a avaliação do usuário (Again/Hard/Good/Easy) e retorna
 * a carta atualizada + o registro de revisão.
 */
export function avaliarCarta(
    carta: DyCard,
    nota: typeof Rating.Again | typeof Rating.Hard | typeof Rating.Good | typeof Rating.Easy,
): ResultadoAvaliacao {
    const f = criarFSRS()
    const agora = new Date()

    // O FSRS retorna 4 opções (uma para cada rating), pegamos a que o usuário escolheu
    const resultado = f.repeat(carta.fsrs, agora)
    const escolhido: RecordLogItem = resultado[nota]

    const cartaAtualizada: DyCard = {
        ...carta,
        fsrs: escolhido.card,
        editadoEm: agora.toISOString(),
    }

    const registro: RegistroRevisao = {
        id: gerarId(),
        cartaId: carta.id,
        log: escolhido.log,
        data: agora.toISOString(),
    }

    return { cartaAtualizada, registro }
}

// ── PREVIEW DE INTERVALOS ───────────────────────────────────────

export interface PreviewIntervalos {
    again: string
    hard: string
    good: string
    easy: string
}

/**
 * Mostra ao usuário quanto tempo até a próxima revisão para cada opção.
 * Ex: { again: "1min", hard: "10min", good: "1d", easy: "4d" }
 */
export function previewIntervalos(carta: DyCard): PreviewIntervalos {
    const f = criarFSRS()
    const agora = new Date()
    const resultado = f.repeat(carta.fsrs, agora)

    function formatarIntervalo(item: RecordLogItem): string {
        const due = new Date(item.card.due)
        const diffMs = due.getTime() - agora.getTime()
        const diffMin = Math.round(diffMs / 60000)
        const diffHoras = Math.round(diffMs / 3600000)
        const diffDias = Math.round(diffMs / 86400000)

        if (diffMin < 60) return `${Math.max(1, diffMin)}min`
        if (diffHoras < 24) return `${diffHoras}h`
        if (diffDias < 30) return `${diffDias}d`
        return `${Math.round(diffDias / 30)}m`
    }

    return {
        again: formatarIntervalo(resultado[Rating.Again]),
        hard: formatarIntervalo(resultado[Rating.Hard]),
        good: formatarIntervalo(resultado[Rating.Good]),
        easy: formatarIntervalo(resultado[Rating.Easy]),
    }
}

// Re-exporta Rating para uso nos componentes
export { Rating }
