const { chromium } = require('playwright');
const path = require('path');

(async () => {
  // Connect to existing Chrome via CDP
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('Connected to existing browser');
  } catch (e) {
    console.log('Could not connect to browser on port 9222.');
    console.log('Please restart Chrome with remote debugging:');
    console.log('  chrome.exe --remote-debugging-port=9222');
    process.exit(1);
  }

  const contexts = browser.contexts();
  if (contexts.length === 0) {
    console.log('No browser contexts found');
    process.exit(1);
  }

  // Find the Hostinger tab
  let hostingerPage = null;
  for (const context of contexts) {
    for (const page of context.pages()) {
      const url = page.url();
      console.log('Found tab:', url);
      if (url.includes('hostinger') && url.includes('gainaiservices')) {
        hostingerPage = page;
        break;
      }
    }
    if (hostingerPage) break;
  }

  if (!hostingerPage) {
    console.log('Could not find the Hostinger gainaiservices tab. Please make sure it is open.');
    process.exit(1);
  }

  console.log('Found Hostinger tab:', hostingerPage.url());

  // Click on File manager
  console.log('Navigating to File Manager...');
  
  // Look for the File Manager link/button
  await hostingerPage.click('text=File manager');
  
  // Wait for file manager to load - it usually opens in same tab or new tab
  await hostingerPage.waitForTimeout(5000);
  
  // Check if a new tab opened
  const allPages = [];
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      allPages.push(page);
    }
  }
  
  // Find the file manager page (may be a new tab)
  let fmPage = null;
  for (const page of allPages) {
    const url = page.url();
    if (url.includes('files') || url.includes('filemanager') || url.includes('file-manager')) {
      fmPage = page;
      break;
    }
  }
  
  if (!fmPage) {
    // Might still be on the same page or redirecting
    fmPage = hostingerPage;
  }
  
  console.log('File Manager page URL:', fmPage.url());
  console.log('Waiting for File Manager to fully load...');
  await fmPage.waitForTimeout(5000);
  
  // Take a screenshot so we can see what's on screen
  await fmPage.screenshot({ path: 'screenshot-fm.png', fullPage: false });
  console.log('Screenshot saved to screenshot-fm.png');
  
  console.log('Done - check screenshot for current state');
})();
