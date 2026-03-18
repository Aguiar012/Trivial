-- ══════════════════════════════════════════════════════════════
-- TABELAS DO DYCARD — Sistema de Flashcards com FSRS-6
-- Execute no Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. BARALHOS (Decks)
CREATE TABLE IF NOT EXISTS baralhos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    cor TEXT NOT NULL DEFAULT '#c04050',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. CARTAS (Flashcards)
CREATE TABLE IF NOT EXISTS cartas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    baralho_id UUID NOT NULL REFERENCES baralhos(id) ON DELETE CASCADE,
    frente TEXT NOT NULL,
    verso TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',

    -- Dados do FSRS-6
    fsrs_due TIMESTAMPTZ NOT NULL DEFAULT now(),
    fsrs_stability FLOAT NOT NULL DEFAULT 0,
    fsrs_difficulty FLOAT NOT NULL DEFAULT 0,
    fsrs_elapsed_days INT NOT NULL DEFAULT 0,
    fsrs_scheduled_days INT NOT NULL DEFAULT 0,
    fsrs_learning_steps INT NOT NULL DEFAULT 0,
    fsrs_reps INT NOT NULL DEFAULT 0,
    fsrs_lapses INT NOT NULL DEFAULT 0,
    fsrs_state INT NOT NULL DEFAULT 0,
    fsrs_last_review TIMESTAMPTZ,

    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    editado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. REVISÕES (Review Log)
CREATE TABLE IF NOT EXISTS revisoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carta_id UUID NOT NULL REFERENCES cartas(id) ON DELETE CASCADE,

    -- Log do FSRS
    rating INT NOT NULL,
    state INT NOT NULL,
    due TIMESTAMPTZ NOT NULL,
    stability FLOAT NOT NULL,
    difficulty FLOAT NOT NULL,
    elapsed_days INT NOT NULL DEFAULT 0,
    last_elapsed_days INT NOT NULL DEFAULT 0,
    scheduled_days INT NOT NULL,
    learning_steps INT NOT NULL DEFAULT 0,
    review TIMESTAMPTZ NOT NULL,

    data TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. CONFIGURAÇÃO (singleton — sempre id=1)
CREATE TABLE IF NOT EXISTS config_estudo (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    cartas_novas_por_dia INT NOT NULL DEFAULT 20,
    revisoes_por_dia INT NOT NULL DEFAULT 100,
    retencao_desejada FLOAT NOT NULL DEFAULT 0.9
);

-- Insere config padrão
INSERT INTO config_estudo (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- ÍNDICES
-- ══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_cartas_baralho ON cartas(baralho_id);
CREATE INDEX IF NOT EXISTS idx_cartas_due ON cartas(fsrs_due);
CREATE INDEX IF NOT EXISTS idx_cartas_state ON cartas(fsrs_state);
CREATE INDEX IF NOT EXISTS idx_revisoes_carta ON revisoes(carta_id);
CREATE INDEX IF NOT EXISTS idx_revisoes_data ON revisoes(data);

-- ══════════════════════════════════════════════════════════════
-- RLS — policies abertas (sem auth por enquanto)
-- ══════════════════════════════════════════════════════════════
ALTER TABLE baralhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartas ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_estudo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_baralhos" ON baralhos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_cartas" ON cartas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_revisoes" ON revisoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_config" ON config_estudo FOR ALL USING (true) WITH CHECK (true);
