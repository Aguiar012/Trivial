# Projeto Trivial – CLAUDE.md

## Stack Principal
- **Framework**: Next.js 14+ App Router (TypeScript)
- **3D**: Three.js + React Three Fiber (R3F) + @react-three/drei
- **Estilização**: Tailwind CSS + Custom CSS 3D
- **Animação**: GSAP + ScrollTrigger
- **Banco de dados**: Supabase (Postgres)
- **Deploy**: Vercel / Cloudflare

## Bancos Disponíveis via MCP
- `trivial-supabase-readonly`: banco do projeto Trivial
- `rattati-supabase-readonly`: banco do projeto Rattati (ratos)

## MCPs Ativos
- `sequential-thinking`: raciocínio encadeado para tarefas complexas
- `github`: acesso ao repositório
- `mirix-metacognition`: memória persistente (ver CLAUDE.md global)
- `trivial-supabase-readonly` + `rattati-supabase-readonly`

---

## 🗂️ Estrutura Next.js

Server Components por padrão. `'use client'` somente quando necessário.

| Arquivo | Propósito |
|---|---|
| `page.tsx` | Route UI |
| `layout.tsx` | Shared layout |
| `loading.tsx` | Loading state (Suspense) |
| `error.tsx` | Error boundary |
| `route.ts` | API endpoint |

Data fetching: colocar onde é usado. Usar `Suspense` + streaming para dados lentos.
Mutations: Server Actions com `'use server'` + validação de input.
Cache: `revalidateTag` / `revalidatePath` para invalidação.

---

## 🎮 Three.js / R3F

### Seleção de stack 3D
| Tool | Melhor para |
|---|---|
| Spline | Protótipos rápidos |
| React Three Fiber | Apps React, cenas complexas |
| Three.js vanilla | Máximo controle/performance |

### Pipeline de modelos
1. Reduzir poly count (< 100K para web)
2. Export GLB
3. Comprimir com `gltf-transform --compress draco --texture-compress webp`
4. Target < 5MB

### Padrões críticos
- Sempre `<Suspense>` com fallback no carregamento de modelos
- `useGLTF` + `useProgress` do drei
- Scroll: `ScrollControls` do drei ou GSAP ScrollTrigger
- Mobile: fallback estático para dispositivos low-end

### AnimationMixer (GLTF)
```js
const mixer = new THREE.AnimationMixer(model);
// Atualizar no loop: mixer.update(clock.getDelta())
// Crossfade: action1.crossFadeTo(action2, 0.5, true)
```

### Interação / Raycasting
```js
raycaster.setFromCamera(mouse, camera);
const intersects = raycaster.intersectObjects(clickables, false);
// Throttle mousemove: max 20fps para hover effects
```

---

## 🧩 React UI Patterns

Ordem de checagem de estado:
```
error? → mostrar ErrorState com retry
loading && !data? → mostrar skeleton/spinner
data vazia? → mostrar EmptyState
data com itens? → renderizar
```

Regras críticas:
- NUNCA engolir erros silenciosamente — sempre toast/feedback visual
- SEMPRE desabilitar botões durante operações async
- Toda lista DEVE ter empty state

---

## 🔧 Debugging Rápido

Quando travar, checar na ordem:
- [ ] Typos em nomes de variáveis
- [ ] null/undefined inesperado
- [ ] Problema de async timing (race condition)
- [ ] Environment variables ausentes
- [ ] Cache stale (limpar cache)
- [ ] Import faltando

Se custou 3+ turns → salvar no mirix com `store_mistake()`
