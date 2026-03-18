import { chromium } from 'playwright';

(async () => {
  console.log("Launching browser...");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  console.log("Navigating to http://localhost:5173...");
  await page.goto('http://localhost:5173');
  
  // Wait for 3D to render
  console.log("Waiting for load...");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshot_before.png' });
  
  // Click desk (using the developer window hook if available, or just a coordinate)
  console.log("Clicking desk to sit down...");
  // Let's just evaluate a click in the middle-ish where the desk usually is
  // Or we can try to find a way to trigger view = 'desk'
  // Let's use the mouse to click roughly where the desk is on the left side
  await page.mouse.click(300, 300); // adjust coords if needed
  
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot_after.png' });
  
  await browser.close();
  console.log("Done");
})();
