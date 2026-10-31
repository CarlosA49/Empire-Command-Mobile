import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const candidates = process.platform === 'win32'
  ? [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ]
  : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const executablePath = candidates.find(existsSync);
if (!executablePath) throw new Error('Chrome, Edge, or Chromium is required for the browser smoke test.');

const artifacts = resolve('artifacts');
mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  hasTouch: true,
  isMobile: true
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});

try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4177/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: resolve(artifacts, 'mobile-title.png') });
  await page.getByRole('button', { name: 'New Campaign' }).click();
  await page.locator('#new-game-sheet:not(.hidden)').waitFor();
  await page.screenshot({ path: resolve(artifacts, 'mobile-new-game.png') });
  await page.getByRole('button', { name: 'Found Your Empire' }).click();
  await page.locator('#research-sheet:not(.hidden)').waitFor();
  await page.locator('#research-list .info-card:not(.locked)').first().click();
  await page.locator('#game-screen:not(.hidden)').waitFor();
  await page.screenshot({ path: resolve(artifacts, 'mobile-game.png') });
  await page.locator('#map').tap({ position: { x: 195, y: 422 } });
  await page.locator('#selection-panel:not(.empty)').waitFor();
  const selectedName = await page.locator('#selection-name').textContent();
  const turn = await page.locator('#turn-label').textContent();
  const goldBefore = await page.locator('#gold-value').textContent();
  await page.locator('#cheat-button').click();
  await page.locator('#cheat-sheet:not(.hidden)').waitFor();
  await page.screenshot({ path: resolve(artifacts, 'mobile-command-console.png') });
  await page.locator('[data-cheat="gold"]').click();
  const goldAfter = await page.locator('#gold-value').textContent();
  const savedGold = await page.evaluate(() => JSON.parse(localStorage.getItem('empire-command-mobile-save-v1')).factions[0].gold);
  await page.locator('#cheat-sheet .sheet-close').click();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('#menu-new-game').click();
  const seedInput = page.locator('#seed-input');
  await seedInput.click();
  await seedInput.pressSequentially('cr-audit-seed');
  const seedValue = await seedInput.inputValue();
  const newGameStillOpen = await page.locator('#new-game-sheet').evaluate(element => !element.classList.contains('hidden'));
  await page.locator('#new-game-sheet .sheet-close').click();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('#return-title').click();
  await page.locator('#start-screen:not(.hidden)').waitFor();
  await page.locator('#continue-button').click();
  await page.locator('#game-screen:not(.hidden)').waitFor();
  const goldAfterReload = await page.locator('#gold-value').textContent();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: resolve(artifacts, 'mobile-game-landscape.png') });
  if (turn !== 'Turn 1') throw new Error(`Expected Turn 1, received ${turn}.`);
  if (selectedName !== 'Dawnspire') throw new Error(`Touch selection expected Dawnspire, received ${selectedName}.`);
  if (savedGold !== 100120 || goldBefore === goldAfter) throw new Error('Gold command did not update and save exactly 100,000 gold.');
  if (goldAfterReload !== goldAfter) throw new Error('Saved campaign did not restore the command-console change.');
  if (seedValue !== 'cr-audit-seed' || !newGameStillOpen) throw new Error('Keyboard shortcuts interrupted world-seed entry.');
  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({
    ok: true,
    viewports: ['390x844 touch', '844x390 touch'],
    turn,
    touchSelection: selectedName,
    goldBefore,
    goldAfter,
    savedGold,
    restored: true,
    keyboardSeedEntry: seedValue,
    screenshots: 5
  }, null, 2));
} finally {
  await browser.close();
}
