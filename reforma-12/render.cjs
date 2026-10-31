// Renderiza o panorama e corta em 12 slides 1080x1350
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const N = 12, W = 1080, H = 1350;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W * N, height: H } });
  await p.goto('file://' + path.resolve(__dirname, 'carrossel.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1200);
  require('fs').mkdirSync(path.join(__dirname, 'slides'), { recursive: true });
  await p.screenshot({ path: 'slides/panorama.png' });
  for (let i = 0; i < N; i++)
    await p.screenshot({ path: `slides/slide-${String(i + 1).padStart(2, '0')}.png`, clip: { x: i * W, y: 0, width: W, height: H } });
  await b.close();
})();
