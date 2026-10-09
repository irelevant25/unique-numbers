// End-to-end checks in headless Chrome against the app served by serve.mjs.
//   node smoke.mjs            -> PASS/FAIL lines, exit code 1 on any failure
// Needs DATA_DIR to point at the served copy's data folder (serve.mjs prints it).

import path from 'node:path';
import fs from 'node:fs';
import {
    APP_URL, DATA_DIR, OUT, SAMPLE, launch, phonePage, recordBeeps, readGrid, gridMismatches,
    sleep, savedSeries, clearSavedSeries, checker,
} from './harness.mjs';

const { check, finish } = checker();
const AUTOSAVE_WAIT = 1800; // autosave runs 1 s after the last change

async function enter(page, value) {
    await page.keyboard.type(String(value));
    await page.keyboard.press('Enter');
}

clearSavedSeries();
const browser = await launch();
try {
    const page = await phonePage(browser);
    await recordBeeps(page);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(APP_URL, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(APP_URL, { waitUntil: 'load' });

    // typing with Enter
    await page.focus('tbody input');
    for (const n of SAMPLE) await enter(page, n);
    let grid = await readGrid(page);
    check(grid.length === SAMPLE.length + 1 && grid.at(-1).value === '' && grid.at(-1).t === '', 'typing: exactly one empty row at the end, with no T');
    check((await gridMismatches(page)).length === 0, 'typing: the grid matches logic.js', await gridMismatches(page));

    // alert
    const beeps = await page.evaluate(() => window.__beeps);
    check(beeps.length === 3, `alert: 3 beeps while typing the sample (${beeps.length})`);
    const length = beeps[0] ? Math.round((beeps[0].stop - beeps[0].start) * 1000) : 0;
    check(length >= 800 && length <= 830, `alert: the default beep lasts about 800 ms (${length} ms, ${beeps[0]?.type} ${beeps[0]?.freq} Hz)`);

    // autosave
    await sleep(AUTOSAVE_WAIT);
    check(savedSeries().length === 1, `autosave: one series saved (${savedSeries().length})`);
    check(await page.$eval('#saveState', b => b.dataset.state) === 'saved', 'autosave: the button shows "✓ Uložené"');
    check(/\?s=[0-9a-f]{16}$/.test(page.url()), 'autosave: the address carries the series id');
    const file = JSON.parse(fs.readFileSync(path.join(DATA_DIR, savedSeries()[0]), 'utf8'));
    check(file.numbers.join(',') === SAMPLE.join(','), 'autosave: the saved numbers are the typed ones');

    // correcting an earlier row: tap, type over, Enter
    await (await page.$$('tbody input'))[2].tap();
    await enter(page, 17);
    grid = await readGrid(page);
    check(grid[2].value === '17', `correction: typing over a number replaces it ("${grid[2].value}")`);
    check(grid.at(-1).t === '' && grid.at(-1).symbol === '', 'correction: the empty last row gets no phantom 0');
    check((await gridMismatches(page)).length === 0, 'correction: the grid matches logic.js', await gridMismatches(page));

    // out of range
    await page.focus('tbody tr:last-child input');
    await page.keyboard.type('37');
    const invalid = await page.evaluate(() => ({ value: document.activeElement.value, marked: document.activeElement.classList.contains('is-invalid') }));
    check(invalid.value === '37' && invalid.marked, '37: stays visible and is marked red');
    await page.keyboard.press('Enter');
    check(await page.evaluate(() => document.activeElement.value === '37'), '37: Enter does not move on');
    check((await page.$eval('#toast', t => t.textContent)).includes('od 0 do 36'), '37: a message explains the range');
    await page.keyboard.press('Backspace');
    await enter(page, 5);

    // iPhone: no Enter key on the number pad; the "next field" arrow moves focus down
    const before = (await readGrid(page)).length;
    await page.focus('tbody tr:last-child input');
    await page.keyboard.type('8');
    check((await readGrid(page)).length === before + 1, 'iPhone: a spare row appears as soon as a digit is typed');
    await page.evaluate(() => document.querySelector('tbody tr:last-child input').focus());
    grid = await readGrid(page);
    check(grid[before - 1].value === '8' && grid[before - 1].t === '3', 'iPhone: moving to the next field takes the number');

    // some Android keyboards report Enter only on keyup
    await page.keyboard.type('6');
    const focusBefore = await page.evaluate(() => Array.from(document.querySelectorAll('tbody input')).indexOf(document.activeElement));
    await page.evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true })));
    const focusAfter = await page.evaluate(() => Array.from(document.querySelectorAll('tbody input')).indexOf(document.activeElement));
    check(focusAfter === focusBefore + 1, 'Android: Enter reported only on keyup still moves on');
    check((await gridMismatches(page)).length === 0, 'phone flows: the grid matches logic.js', await gridMismatches(page));

    // start-up reopens the last series
    await sleep(AUTOSAVE_WAIT);
    const id = new URL(page.url()).searchParams.get('s');
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    check(new URL(page.url()).searchParams.get('s') === id, 'start-up: the plain address reopens the last series');
    check((await readGrid(page)).filter(r => r.value !== '').length === SAMPLE.length + 3, 'start-up: every number is back');

    // unsaved changes survive a reload even when the save fails
    await page.setRequestInterception(true);
    let failSaves = true;
    page.on('request', r => (failSaves && r.url().includes('action=save')
        ? r.respond({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"Skúšobný výpadok."}' })
        : r.continue()));
    await page.focus('tbody tr:last-child input');
    await enter(page, 33);
    await sleep(AUTOSAVE_WAIT);
    check(await page.$eval('#saveState', b => b.dataset.state) === 'error', 'outage: the button shows "⚠ Neuložené"');
    await page.reload({ waitUntil: 'load' });
    grid = await readGrid(page);
    check(grid.some(r => r.value === '33'), 'outage: a reload keeps the unsaved number (local draft)');
    failSaves = false;
    await page.click('#saveState');
    await sleep(800);
    check(await page.$eval('#saveState', b => b.dataset.state) === 'saved', 'outage: one tap saves once the server is back');
    check(await page.evaluate(() => localStorage.getItem('unique-numbers:draft')) === null, 'outage: the draft is cleared after saving');

    // new series, then reopen the first one from the list
    await page.click('[data-action="new-session"]');
    await sleep(400);
    grid = await readGrid(page);
    check(grid.length === 1 && !page.url().includes('?s='), 'new series: a clean sheet with no id');
    await page.focus('tbody input');
    await enter(page, 7);
    await sleep(AUTOSAVE_WAIT);
    check(savedSeries().length === 2, 'new series: saved after its first number');
    await page.click('[data-action="open"]');
    await page.waitForSelector('#sessionsDialog[open]');
    const items = await page.$$('.sessions__open');
    await items[1].click(); // newest first: [1] is the first series
    await sleep(600);
    check((await readGrid(page)).filter(r => r.value !== '').length === SAMPLE.length + 4, 'open: the earlier series comes back from the list');

    // deleting the series on screen starts a clean one
    await page.click('[data-action="open"]');
    await page.waitForSelector('#sessionsDialog[open]');
    page.once('dialog', d => d.accept());
    await page.click('.sessions__item.is-current .btn--danger');
    await sleep(600);
    check(savedSeries().length === 1 && (await readGrid(page)).length === 1, 'delete: the series is gone and the sheet is clean');

    // settings
    await page.click('[data-action="settings"]');
    await page.waitForSelector('#settingsDialog[open]');
    const beepCount = await page.evaluate(() => window.__beeps.length);
    await page.click('[data-setting="beepMs"][data-step="1"]');
    await page.click('[data-setting="beepMs"][data-step="1"]');
    await sleep(500);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('unique-numbers:settings')));
    check(stored.beepMs === 1000, `settings: two taps on + make it 1000 ms (${stored.beepMs})`);
    const preview = await page.evaluate(() => window.__beeps.at(-1));
    check(await page.evaluate(() => window.__beeps.length) === beepCount + 1 && Math.round((preview.stop - preview.start) * 1000) >= 1000, 'settings: the new length is played once as a preview');
    await page.$eval('#beepMs', i => { i.value = '99999'; i.dispatchEvent(new Event('change')); });
    check(await page.evaluate(() => JSON.parse(localStorage.getItem('unique-numbers:settings')).beepMs) === 5000, 'settings: a typed length is clamped to 5000 ms');
    await page.click('input[name="tone"][value="sharp"]');
    await page.click('[data-action="test-sound"]');
    check(await page.evaluate(() => window.__beeps.at(-1).type) === 'square', 'settings: "Výrazný" plays a square wave');
    await page.click('#bigText');
    check(await page.evaluate(() => document.body.classList.contains('is-big')), 'settings: bigger text applies at once');
    await page.screenshot({ path: path.join(OUT, 'smoke-settings.png') });

    // audio is released between beeps (so music on the phone is not held paused)
    await page.$eval('#beepMs', i => { i.value = '300'; i.dispatchEvent(new Event('change')); });
    await page.click('[data-action="test-sound"]');
    check(await page.evaluate(() => audioContext.state) === 'running', 'audio: running while it beeps');
    await sleep(1500);
    check(await page.evaluate(() => audioContext.state) === 'suspended', 'audio: suspended again after the beep');
    await page.click('[data-action="test-sound"]');
    await sleep(100);
    check(await page.evaluate(() => audioContext.state) === 'running', 'audio: the next beep wakes it up');
    await page.click('#settingsDialog [data-action="close-dialog"]');

    // a draft of another series is saved once when a link to a series is opened - not on every reload
    await page.focus('tbody tr:last-child input');
    await enter(page, 12);
    await sleep(AUTOSAVE_WAIT);
    const target = new URL(page.url()).searchParams.get('s');
    const filesBefore = savedSeries().length;
    await page.evaluate(() => localStorage.setItem('unique-numbers:draft', JSON.stringify({ id: null, name: 'Záchrana', numbers: [1, 2, 3] })));
    await page.goto(`${APP_URL}?s=${target}`, { waitUntil: 'networkidle0' });
    await sleep(500);
    check(savedSeries().length === filesBefore + 1, `draft rescue: the other series' draft became one series (${savedSeries().length - filesBefore})`);
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(500);
    check(savedSeries().length === filesBefore + 1, 'draft rescue: reloading does not save it again');

    check(errors.length === 0, 'no JavaScript errors on the page', errors);
} finally {
    await browser.close();
    clearSavedSeries();
}
finish();
