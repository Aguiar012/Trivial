import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './tests',
    timeout: 30000,
    use: {
        baseURL: 'http://localhost:5174',
        headless: true,
        viewport: { width: 1280, height: 720 },
    },
    webServer: {
        command: 'npx vite --port 5174',
        url: 'http://localhost:5174',
        reuseExistingServer: true,
        timeout: 30000,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
})
