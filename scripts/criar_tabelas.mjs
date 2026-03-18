/*
 * Script para criar as tabelas no Supabase.
 * Executar: node scripts/criar_tabelas.mjs
 */

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxcnJkY29odGpjeWZtZWlhdmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTc1NDIyNywiZXhwIjoyMDgxMzMwMjI3fQ.c2JQYZszDAHy2Kyaq4HiQvFl39cTxR9R1v8PWVgay1g'
const SUPABASE_URL = 'https://tqrrdcohtjcyfmeiavdk.supabase.co'

const statements = [
    // 1. BARALHOS
    `CREATE TABLE IF NOT EXISTS baralhos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome TEXT NOT NULL,
        cor TEXT NOT NULL DEFAULT '#c04050',
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,

    // 2. CARTAS
    `CREATE TABLE IF NOT EXISTS cartas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        baralho_id UUID NOT NULL REFERENCES baralhos(id) ON DELETE CASCADE,
        frente TEXT NOT NULL,
        verso TEXT NOT NULL,
        tags TEXT[] NOT NULL DEFAULT '{}',
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
    )`,

    // 3. REVISÕES
    `CREATE TABLE IF NOT EXISTS revisoes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        carta_id UUID NOT NULL REFERENCES cartas(id) ON DELETE CASCADE,
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
    )`,

    // 4. CONFIG
    `CREATE TABLE IF NOT EXISTS config_estudo (
        id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        cartas_novas_por_dia INT NOT NULL DEFAULT 20,
        revisoes_por_dia INT NOT NULL DEFAULT 100,
        retencao_desejada FLOAT NOT NULL DEFAULT 0.9
    )`,

    `INSERT INTO config_estudo (id) VALUES (1) ON CONFLICT DO NOTHING`,

    // Indices
    `CREATE INDEX IF NOT EXISTS idx_cartas_baralho ON cartas(baralho_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cartas_due ON cartas(fsrs_due)`,
    `CREATE INDEX IF NOT EXISTS idx_cartas_state ON cartas(fsrs_state)`,
    `CREATE INDEX IF NOT EXISTS idx_revisoes_carta ON revisoes(carta_id)`,
    `CREATE INDEX IF NOT EXISTS idx_revisoes_data ON revisoes(data)`,

    // RLS
    `ALTER TABLE baralhos ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE cartas ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE revisoes ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE config_estudo ENABLE ROW LEVEL SECURITY`,

    // Policies (DROP first to be idempotent)
    `DROP POLICY IF EXISTS "allow_all_baralhos" ON baralhos`,
    `CREATE POLICY "allow_all_baralhos" ON baralhos FOR ALL USING (true) WITH CHECK (true)`,
    `DROP POLICY IF EXISTS "allow_all_cartas" ON cartas`,
    `CREATE POLICY "allow_all_cartas" ON cartas FOR ALL USING (true) WITH CHECK (true)`,
    `DROP POLICY IF EXISTS "allow_all_revisoes" ON revisoes`,
    `CREATE POLICY "allow_all_revisoes" ON revisoes FOR ALL USING (true) WITH CHECK (true)`,
    `DROP POLICY IF EXISTS "allow_all_config" ON config_estudo`,
    `CREATE POLICY "allow_all_config" ON config_estudo FOR ALL USING (true) WITH CHECK (true)`,
]

async function run() {
    for (let i = 0; i < statements.length; i++) {
        const sql = statements[i]
        const label = sql.slice(0, 60).replace(/\s+/g, ' ').trim()
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
                method: 'POST',
                headers: {
                    'apikey': SERVICE_KEY,
                    'Authorization': `Bearer ${SERVICE_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: sql }),
            })

            // Try the pg endpoint if rpc doesn't work
            if (res.status === 404) {
                throw new Error('RPC not found')
            }

            const text = await res.text()
            if (res.ok) {
                console.log(`[${i + 1}/${statements.length}] ✓ ${label}`)
            } else {
                console.log(`[${i + 1}/${statements.length}] ✗ ${label} → ${res.status}: ${text.slice(0, 100)}`)
            }
        } catch (err) {
            console.log(`[${i + 1}/${statements.length}] ✗ ${label} → ${err.message}`)
        }
    }
}

run()
