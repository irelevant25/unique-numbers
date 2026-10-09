// Prints a series to PDF the way Chrome would, renders the pages to PNG and reports the density.
//   node print.mjs [count ...]       (default: 40 600 2000)
// Writes print-<count>.pdf and print-<count>-p<page>.png into OUT_DIR.

import path from 'node:path';
import { OUT, SAMPLE, launch, desktopPage, blockSaves, openWithNumbers } from './harness.mjs';
import { renderPdf } from './pdf2png.mjs';

const counts = process.argv.slice(2).map(Number).filter(Boolean);
const browser = await launch();
try {
    const page = await desktopPage(browser);
    await blockSaves(page);
    for (const count of counts.length ? counts : [40, 600, 2000]) {
        let seed = count;
        const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
        const numbers = count <= SAMPLE.length ? SAMPLE.slice(0, count) : Array.from({ length: count }, () => Math.floor(random() * 37));
        await openWithNumbers(page, numbers, { name: 'Skúška tlače' });

        await page.emulateMediaType('print');
        const metrics = await page.evaluate(() => {
            const mm = (px) => +(px * 25.4 / 96).toFixed(2);
            const rows = document.querySelectorAll('tbody tr');
            return { tableWidthMm: mm(document.querySelector('.grid').getBoundingClientRect().width), rowHeightMm: mm(rows[Math.max(0, rows.length - 3)].getBoundingClientRect().height) };
        });
        await page.emulateMediaType(null);

        const file = path.join(OUT, `print-${count}.pdf`);
        await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
        const { pages, firstPage, images } = await renderPdf(file, { scale: 2, maxPages: 2 });
        console.log(`${count} numbers -> ${pages} page(s), page 1 holds ${firstPage}`, metrics);
        images.forEach(image => console.log(`   ${image}`));
    }
} finally {
    await browser.close();
}
