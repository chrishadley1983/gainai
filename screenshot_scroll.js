const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://gainaiservices.co.uk', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Scroll through the page to trigger IntersectionObserver animations
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const step = 400;
  for (let y = 0; y < totalHeight; y += step) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(200);
  }

  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);

  // Take full page screenshot
  await page.screenshot({ path: 'gainai_live_scrolled.png', fullPage: true });
  console.log('Screenshot saved');

  // Also take a hero-only screenshot
  await page.screenshot({ path: 'gainai_hero.png' });
  console.log('Hero screenshot saved');

  // Scroll to services
  await page.evaluate(() => {
    var el = document.getElementById('services');
    if (el) el.scrollIntoView();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'gainai_services.png' });
  console.log('Services screenshot saved');

  // Scroll to pricing
  await page.evaluate(() => {
    var el = document.getElementById('pricing');
    if (el) el.scrollIntoView();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'gainai_pricing.png' });
  console.log('Pricing screenshot saved');

  await browser.close();
})();
