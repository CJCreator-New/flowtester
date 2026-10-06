import { chromium } from 'playwright';
const b = await chromium.launch();
for (const [name, w, h] of [['desktop', 1280, 900], ['phone', 390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto('http://localhost:3002/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `C:/Users/HP/AppData/Local/Temp/claude/c--Users-HP-OneDrive-Desktop-Projects-AntiGravity---Google---Projects-QA-Tool/facba3d1-63f8-4a77-ae3f-1a35335e44c0/scratchpad/landing-${name}.png`, fullPage: true });
  console.log(name, await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
}
await b.close();
