// Renders PDF pages to PNG so they can be looked at with the Read tool.
//   node pdf2png.mjs file.pdf [scale] [maxPages]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const fonts = path.join(path.dirname(fileURLToPath(import.meta.url)), 'node_modules/pdfjs-dist/standard_fonts/');

export async function renderPdf(file, { scale = 1.5, maxPages = 3 } = {}) {
    const data = new Uint8Array(fs.readFileSync(file));
    // glyphs are drawn as paths: Node has no FontFace, and boxes are all you get otherwise
    const doc = await pdfjs.getDocument({ data, disableFontFace: true, standardFontDataUrl: fonts, verbosity: 0 }).promise;
    const images = [];

    // the highest row number ("576.") printed on page 1 is how many numbers a full page holds
    const text = await (await doc.getPage(1)).getTextContent();
    const rowNumbers = text.items.map(item => /^(\d+)\.$/.exec(item.str.trim())?.[1]).filter(Boolean).map(Number);
    const firstPage = rowNumbers.length ? Math.max(...rowNumbers) : 0;

    for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
        const page = await doc.getPage(p);
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext('2d');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        const out = file.replace(/\.pdf$/, `-p${p}.png`);
        fs.writeFileSync(out, canvas.toBuffer('image/png'));
        images.push(out);
    }

    return { pages: doc.numPages, firstPage, images };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [file, scale = '1.5', maxPages = '3'] = process.argv.slice(2);
    const { pages, images } = await renderPdf(file, { scale: Number(scale), maxPages: Number(maxPages) });
    console.log(`${file}: ${pages} page(s)`);
    images.forEach(image => console.log(`   ${image}`));
}
