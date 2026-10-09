// Screenshots of the app on phones (360 and 390 px wide, normal and bigger text),
// the settings dialog, and a desktop. Also reports any horizontal overflow.
//   node shots.mjs                   -> PNG files in OUT_DIR, paths printed

import path from 'node:path';
import { OUT, SAMPLE, launch, phonePage, desktopPage, blockSaves, openWithNumbers } from './harness.mjs';

const browser = await launch();
const shots = [];
try {
    for (const width of [360, 390]) {
        for (const bigText of [false, true]) {
            const page = await phonePage(browser, { width, height: 760 });
            await blockSaves(page);
            await openWithNumbers(page, SAMPLE, { name: '9. 10. 2026 18:05', settings: { bigText } });
            const overflow = await page.evaluate(() => {
                const sheet = document.querySelector('.sheet');
                return { page: document.documentElement.scrollWidth - innerWidth, grid: sheet.scrollWidth - sheet.clientWidth };
            });
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            const file = path.join(OUT, `phone-${width}-${bigText ? 'big' : 'normal'}.png`);
            await page.screenshot({ path: file });
            shots.push(file);
            const fits = overflow.page <= 0 && overflow.grid <= 0;
            console.log(`${fits ? 'PASS' : 'FAIL'}  ${width}px ${bigText ? 'bigger text' : 'normal'}: no sideways scrolling`, fits ? '' : overflow);
            await page.close();
        }
    }

    const page = await phonePage(browser, { width: 390, height: 844 });
    await blockSaves(page);
    await openWithNumbers(page, SAMPLE);
    await page.click('[data-action="settings"]');
    await page.waitForSelector('#settingsDialog[open]');
    shots.push(path.join(OUT, 'phone-settings.png'));
    await page.screenshot({ path: shots.at(-1) });

    const desktop = await desktopPage(browser);
    await blockSaves(desktop);
    await openWithNumbers(desktop, SAMPLE);
    shots.push(path.join(OUT, 'desktop.png'));
    await desktop.screenshot({ path: shots.at(-1) });
} finally {
    await browser.close();
}
shots.forEach(file => console.log(`   ${file}`));
