const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://dribbble.com/shots/26630438-Online-Banking-SaaS-Landing-Page-UI', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'dribbble_banking_saas2.png', fullPage: true });
  console.log('Screenshot saved');

  // Get all large images
  const imgs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(e => ({
      src: e.src,
      alt: e.alt,
      w: e.naturalWidth,
      h: e.naturalHeight
    })).filter(i => i.w > 400);
  });
  console.log('Large images:', JSON.stringify(imgs, null, 2));

  // Get page title
  const title = await page.title();
  console.log('Page title:', title);

  // Get main content text
  const text = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Page text:', text);

  await browser.close();
})();
