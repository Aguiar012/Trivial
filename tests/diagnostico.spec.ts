/**
 * Diagnóstico visual: captura screenshots e investiga
 * 1. "barra/cursor sempre fixa no centro"
 * 2. "não dá para selecionar texto, copiar e colar"
 */

import { test, expect } from '@playwright/test'

test.describe('Diagnóstico de bugs', () => {

    test('screenshot: estado inicial e após acionar lápis', async ({ page }) => {
        const consoleLogs: string[] = []
        page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`))

        await page.goto('http://localhost:5174')
        await page.waitForTimeout(3000)

        // Screenshot do estado inicial
        await page.screenshot({ path: 'test-results/diag-01-inicial.png', fullPage: true })

        // Inspecionar o textarea: posição, tamanho, computed style
        const textareaInfo = await page.evaluate(() => {
            const el = document.querySelector('textarea.input-mobile-offscreen') as HTMLTextAreaElement
            if (!el) return { erro: 'textarea não encontrado' }
            const rect = el.getBoundingClientRect()
            const style = window.getComputedStyle(el)
            return {
                // Posição no viewport
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                // Estilos computados relevantes
                position: style.position,
                cssTop: style.top,
                cssLeft: style.left,
                cssOpacity: style.opacity,
                cssPointerEvents: style.pointerEvents,
                cssWidth: style.width,
                cssHeight: style.height,
                // Estado atual
                value: el.value,
                selectionStart: el.selectionStart,
                selectionEnd: el.selectionEnd,
                disabled: el.disabled,
                readOnly: el.readOnly,
                tabIndex: el.tabIndex,
            }
        })
        console.log('TEXTAREA INFO:', JSON.stringify(textareaInfo, null, 2))

        // Inspecionar o container de interação
        const interacaoInfo = await page.evaluate(() => {
            const div = document.querySelector('.tela-interacao') as HTMLElement
            if (!div) return { erro: 'div não encontrado' }
            const rect = div.getBoundingClientRect()
            const style = window.getComputedStyle(div)
            return {
                top: rect.top, left: rect.left,
                width: rect.width, height: rect.height,
                position: style.position,
                cursor: style.cursor,
                userSelect: style.userSelect,
            }
        })
        console.log('INTERACAO INFO:', JSON.stringify(interacaoInfo, null, 2))

        // Aciona o lápis e tira screenshot
        await page.evaluate(() => {
            if (typeof (window as any).__handleClickLapis === 'function') {
                (window as any).__handleClickLapis()
            }
        })
        await page.waitForTimeout(500)
        await page.screenshot({ path: 'test-results/diag-02-apos-lapis.png', fullPage: true })

        // Inspeciona estado após acionamento
        const posLapis = await page.evaluate(() => {
            const el = document.querySelector('textarea.input-mobile-offscreen') as HTMLTextAreaElement
            if (!el) return { erro: 'não encontrado' }
            return {
                isFocused: document.activeElement === el,
                activeElementTag: document.activeElement?.tagName,
                activeElementClass: (document.activeElement as HTMLElement)?.className,
                value: el.value,
            }
        })
        console.log('APÓS LÁPIS:', JSON.stringify(posLapis, null, 2))

        // Digita texto
        const textarea = page.locator('textarea.input-mobile-offscreen')
        await textarea.fill('Texto de teste ABC')
        await page.waitForTimeout(300)
        await page.screenshot({ path: 'test-results/diag-03-apos-digitar.png', fullPage: true })

        // Tenta selecionar tudo e copiar
        await textarea.press('Control+a')
        await page.waitForTimeout(100)
        const selecaoInfo = await page.evaluate(() => {
            const el = document.querySelector('textarea.input-mobile-offscreen') as HTMLTextAreaElement
            return {
                value: el.value,
                selectionStart: el.selectionStart,
                selectionEnd: el.selectionEnd,
            }
        })
        console.log('SELEÇÃO APÓS Ctrl+A:', JSON.stringify(selecaoInfo, null, 2))

        // Log todos os console do browser
        console.log('\nBROWSER CONSOLE LOGS:')
        consoleLogs.forEach(l => console.log(l))

        // O teste passa sempre — é só para coletar evidências
        expect(true).toBe(true)
    })

    test('screenshot: investigar "cursor fixo no centro"', async ({ page }) => {
        await page.goto('http://localhost:5174')
        await page.waitForTimeout(3000)

        // Verifica se há algum elemento HTML 2D que poderia ser um cursor
        const elementosUI = await page.evaluate(() => {
            const todos = Array.from(document.body.querySelectorAll('*'))
            return todos
                .filter(el => {
                    const tag = el.tagName.toLowerCase()
                    // Ignora canvas e os containers conhecidos
                    if (['canvas', 'div', 'html', 'body', 'script', 'style'].includes(tag)) return false
                    const rect = (el as HTMLElement).getBoundingClientRect()
                    return rect.width > 0 && rect.height > 0
                })
                .map(el => ({
                    tag: el.tagName,
                    class: (el as HTMLElement).className,
                    id: el.id,
                    rect: (el as HTMLElement).getBoundingClientRect(),
                    style: (el as HTMLElement).getAttribute('style'),
                }))
        })
        console.log('ELEMENTOS UI VISÍVEIS:', JSON.stringify(elementosUI, null, 2))

        // Verifica a posição REAL do textarea no viewport
        const textareaRect = await page.evaluate(() => {
            const el = document.querySelector('textarea.input-mobile-offscreen') as HTMLElement
            const rect = el?.getBoundingClientRect()
            return rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null
        })
        console.log('TEXTAREA RECT NO VIEWPORT:', JSON.stringify(textareaRect))

        // Verifica se o textarea está REALMENTE fora da tela
        // (position: fixed, top: -9999px deveria dar top ≈ -9999 no viewport)
        const vw = await page.evaluate(() => window.innerWidth)
        const vh = await page.evaluate(() => window.innerHeight)
        console.log(`VIEWPORT: ${vw}x${vh}`)

        await page.screenshot({ path: 'test-results/diag-04-cursor-check.png', fullPage: true })

        // Captura screenshot com highlight do textarea para ver onde está
        await page.evaluate(() => {
            const el = document.querySelector('textarea.input-mobile-offscreen') as HTMLElement
            if (el) {
                el.style.cssText = 'position:fixed;top:50%;left:50%;width:200px;height:50px;opacity:1;z-index:9999;background:red;'
            }
        })
        await page.screenshot({ path: 'test-results/diag-05-textarea-highlighted.png', fullPage: true })

        expect(true).toBe(true)
    })
})
