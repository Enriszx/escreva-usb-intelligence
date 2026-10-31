// Renderiza o panorama e corta em 7 slides 1080x1350 para o Instagram
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 7560, height: 1350 } });
  await p.goto('file://' + path.resolve(__dirname, 'carrossel.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'slides/panorama.png' });
  for (let i = 0; i < 7; i++)
    await p.screenshot({ path: `slides/slide-${i + 1}.png`, clip: { x: i * 1080, y: 0, width: 1080, height: 1350 } });
  await b.close();
})();
