/*
 * store.ts — Persistência com Supabase (PostgreSQL)
 *
 * ── O QUE FAZ ───────────────────────────────────────────────────
 *
 *   Salva e carrega cartas, baralhos e revisões do Supabase.
 *   Cada função faz uma query direta via @supabase/supabase-js.
 *
 *   Tabelas no banco:
 *     baralhos      → Baralho
 *     cartas        → CartaRow → convertido para DyCard
 *     revisoes      → RegistroRevisao
 *     config_estudo → ConfigEstudo
 *
 * ── CONVERSÃO DE NOMES ──────────────────────────────────────────
 *
 *   Banco (snake_case) ↔ App (camelCase):
 *     baralho_id  ↔ baralhoId
 *     criado_em   ↔ criadoEm
 *     fsrs_due    ↔ fsrs.due
 *     etc.
 *
 *   As funções rowParaDyCard/dyCardParaRow em tipos.ts fazem essa conversão.
 */

import { supabase } from './supabase'
import type { DyCard, Baralho, ConfigEstudo, CartaRow } from './tipos'
import { rowParaDyCard, dyCardParaRow, CONFIG_PADRAO, CORES_BARALHO } from './tipos'
import type { ReviewLog } from 'ts-fsrs'

// ── CARTAS ──────────────────────────────────────────────────────

export async function carregarCartas(): Promise<DyCard[]> {
    const { data, error } = await supabase
        .from('cartas')
        .select('*')
        .order('criado_em', { ascending: true })

    if (error) {
        console.error('Erro ao carregar cartas:', error)
        return []
    }

    return (data as CartaRow[]).map(rowParaDyCard)
}

export async function adicionarCarta(carta: DyCard): Promise<DyCard[]> {
    const row = dyCardParaRow(carta)

    const { error } = await supabase
        .from('cartas')
        .insert(row)

    if (error) {
        console.error('Erro ao adicionar carta:', error)
    }

    return carregarCartas()
}

export async function atualizarCarta(cartaAtualizada: DyCard): Promise<DyCard[]> {
    const row = dyCardParaRow(cartaAtualizada)

    const { error } = await supabase
        .from('cartas')
        .update(row)
        .eq('id', cartaAtualizada.id)

    if (error) {
        console.error('Erro ao atualizar carta:', error)
    }

    return carregarCartas()
}

export async function removerCarta(cartaId: string): Promise<DyCard[]> {
    const { error } = await supabase
        .from('cartas')
        .delete()
        .eq('id', cartaId)

    if (error) {
        console.error('Erro ao remover carta:', error)
    }

    return carregarCartas()
}

// ── BARALHOS ────────────────────────────────────────────────────

export async function carregarBaralhos(): Promise<Baralho[]> {
    const { data, error } = await supabase
        .from('baralhos')
        .select('*')
        .order('criado_em', { ascending: true })

    if (error) {
        console.error('Erro ao carregar baralhos:', error)
        return []
    }

    return (data ?? []).map((row: { id: string; nome: string; cor: string; criado_em: string }) => ({
        id: row.id,
        nome: row.nome,
        cor: row.cor,
        criadoEm: row.criado_em,
    }))
}

export async function criarBaralho(nome: string): Promise<Baralho> {
    const baralhos = await carregarBaralhos()
    const cor = CORES_BARALHO[baralhos.length % CORES_BARALHO.length]

    const { data, error } = await supabase
        .from('baralhos')
        .insert({ nome, cor })
        .select()
        .single()

    if (error) {
        console.error('Erro ao criar baralho:', error)
        throw error
    }

    return {
        id: data.id,
        nome: data.nome,
        cor: data.cor,
        criadoEm: data.criado_em,
    }
}

/**
 * Garante que existe pelo menos um baralho padrão.
 * Chamado na inicialização do app.
 */
export async function garantirBaralhoPadrao(): Promise<Baralho> {
    const baralhos = await carregarBaralhos()
    if (baralhos.length > 0) return baralhos[0]

    return criarBaralho('Geral')
}

// ── REVISÕES ────────────────────────────────────────────────────

export async function salvarRevisao(cartaId: string, log: ReviewLog): Promise<void> {
    const { error } = await supabase
        .from('revisoes')
        .insert({
            carta_id: cartaId,
            rating: log.rating,
            state: log.state,
            due: log.due instanceof Date ? log.due.toISOString() : String(log.due),
            stability: log.stability,
            difficulty: log.difficulty,
            elapsed_days: log.elapsed_days,
            last_elapsed_days: log.last_elapsed_days,
            scheduled_days: log.scheduled_days,
            learning_steps: log.learning_steps,
            review: log.review instanceof Date ? log.review.toISOString() : String(log.review),
        })

    if (error) {
        console.error('Erro ao salvar revisão:', error)
    }
}

// ── CONFIGURAÇÃO ────────────────────────────────────────────────

export async function carregarConfig(): Promise<ConfigEstudo> {
    const { data, error } = await supabase
        .from('config_estudo')
        .select('*')
        .eq('id', 1)
        .single()

    if (error || !data) {
        console.warn('Usando config padrão (erro ao carregar):', error?.message)
        return CONFIG_PADRAO
    }

    return {
        cartasNovasPorDia: data.cartas_novas_por_dia,
        revisoesPorDia: data.revisoes_por_dia,
        retencaoDesejada: data.retencao_desejada,
    }
}

export async function salvarConfig(config: ConfigEstudo): Promise<void> {
    const { error } = await supabase
        .from('config_estudo')
        .upsert({
            id: 1,
            cartas_novas_por_dia: config.cartasNovasPorDia,
            revisoes_por_dia: config.revisoesPorDia,
            retencao_desejada: config.retencaoDesejada,
        })

    if (error) {
        console.error('Erro ao salvar config:', error)
    }
}

// ── ESTATÍSTICAS RÁPIDAS ────────────────────────────────────────

export interface EstatisticasHoje {
    revisadasHoje: number
    criadasTotal: number
}

/** Calcula estatísticas básicas para exibir na UI */
export async function estatisticasHoje(): Promise<EstatisticasHoje> {
    const hoje = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"

    const { count: revisadasHoje } = await supabase
        .from('revisoes')
        .select('*', { count: 'exact', head: true })
        .gte('data', `${hoje}T00:00:00`)
        .lt('data', `${hoje}T23:59:59`)

    const { count: criadasTotal } = await supabase
        .from('cartas')
        .select('*', { count: 'exact', head: true })

    return {
        revisadasHoje: revisadasHoje ?? 0,
        criadasTotal: criadasTotal ?? 0,
    }
}
