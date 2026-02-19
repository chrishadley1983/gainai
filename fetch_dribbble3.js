const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // Fetch the second design image
  await page.goto('https://cdn.dribbble.com/userupload/45245268/file/ca083d7a1d3a84f413823ae68e4c517e.png', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'dribbble_design2.png', fullPage: true });
  console.log('Second design image saved');
  await browser.close();
})();
