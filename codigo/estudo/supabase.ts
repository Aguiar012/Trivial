/*
 * supabase.ts — Cliente Supabase configurado
 *
 * ── COMO FUNCIONA ────────────────────────────────────────────────
 *
 *   Cria e exporta uma instância única do Supabase Client.
 *   As credenciais vêm do .env via variáveis VITE_*.
 *
 *   Vite expõe variáveis que começam com VITE_ no client-side
 *   via import.meta.env.VITE_SUPABASE_URL, etc.
 *
 *   ⚠️ A anon key é segura para expor no frontend — ela só dá
 *   acesso ao que as RLS policies permitem.
 *   A service_role key NUNCA deve ir no frontend.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Faltam variáveis de ambiente do Supabase!\n' +
        'Crie um arquivo .env na raiz do projeto com:\n' +
        '  VITE_SUPABASE_URL=https://xxx.supabase.co\n' +
        '  VITE_SUPABASE_ANON_KEY=eyJ...'
    )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
