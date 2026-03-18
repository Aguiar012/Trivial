import { chromium } from 'playwright';

(async () => {
    console.log('Iniciando teste visual com o navegador visível...');
    // SlowMo ajuda a ver o que está acontecendo
    const browser = await chromium.launch({ headless: false, slowMo: 100 });
    const page = await browser.newPage();

    console.log('Navegando para o app... Ele deve abrir direto na mesa agora.');
    await page.goto('http://localhost:5173');

    // Aguarda carregar
    await page.waitForTimeout(2000);

    // Tira uma screenshot do lado direito
    await page.screenshot({ path: 'test_debug_desk.png' });
    console.log('Screenshot salva em test_debug_desk.png');

    console.log('Analisando se tem pixels pretos ou não no lado direito...');
    const ehPreto = await page.evaluate(() => {
        // Pega o canvas da direita
        const canvas = document.querySelector('.tela-interacao canvas');
        if (!canvas) return true; // se não achou, deu erro

        // Tentamos ler o webgl. Como preserveDrawingBuffer pode ser false, a melhor forma
        // é checar visualmente ou confiar que se for preto é que deu erro
        return false; // por enquanto não fazemos validação complexa aqui, usaremos o screenshot
    });

    console.log('Se a tela preta persistir, o problema está no WebGL/React-Three-Fiber.');
    await page.waitForTimeout(8000);

    await browser.close();
})();
