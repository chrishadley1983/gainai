const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // Fetch without resize parameter
  await page.goto('https://cdn.dribbble.com/userupload/45245266/file/0507173cc915475085ecd72c3b0c8f9b.png', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Get the actual image dimensions
  const dims = await page.evaluate(() => {
    const img = document.querySelector('img');
    return img ? { w: img.naturalWidth, h: img.naturalHeight, src: img.src } : null;
  });
  console.log('Image dimensions:', dims);

  // Screenshot just the image
  await page.screenshot({ path: 'dribbble_full_design.png', fullPage: true });
  console.log('Full design saved');

  // Now go back to the shot page and get ALL the text content and structure
  await page.goto('https://dribbble.com/shots/26630438-Online-Banking-SaaS-Landing-Page-UI', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Click accept cookies if present
  try {
    await page.click('text=Accept All', { timeout: 3000 });
  } catch(e) {}

  await page.waitForTimeout(2000);

  // Get the full page text
  const fullText = await page.evaluate(() => document.body.innerText);
  console.log('FULL PAGE TEXT:');
  console.log(fullText);

  // Get all images with reasonable size
  const allImgs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(e => ({
      src: e.src || e.getAttribute('data-src') || '',
      alt: e.alt,
      w: e.naturalWidth,
      h: e.naturalHeight
    })).filter(i => i.w > 200 || i.src.includes('dribbble'));
  });
  console.log('All images:', JSON.stringify(allImgs, null, 2));

  await browser.close();
})();
