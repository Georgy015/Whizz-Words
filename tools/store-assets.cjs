// Renders the CrazyGames store covers from tools/cover.html.
// Needs Playwright (npm i -g playwright) and a static server on the repo root:
//   npm start   then   node tools/store-assets.cjs [http://localhost:5173]
const { chromium } = require('playwright');
const path = require('node:path');

const base = process.argv[2] || 'http://localhost:5173';
const out = path.join(__dirname, '..', 'store');
const covers = [['landscape', 1920, 1080], ['portrait', 800, 1200], ['square', 800, 800]];

(async () => {
  const browser = await chromium.launch();
  for (const [shape, width, height] of covers) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(`${base}/tools/cover.html?shape=${shape}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const file = path.join(out, `cover-${shape}-${width}x${height}.png`);
    await page.screenshot({ path: file });
    console.log('wrote', path.relative(process.cwd(), file));
    await page.close();
  }
  await browser.close();
})();
