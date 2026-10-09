// Shared helpers for the headless-Chrome checks.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:8765/';
export const DATA_DIR = process.env.DATA_DIR ?? path.join(os.tmpdir(), 'unique-numbers-app-8765', 'data');
export const OUT = process.env.OUT_DIR ?? path.join(os.tmpdir(), 'unique-numbers-checks');
fs.mkdirSync(OUT, { recursive: true });

/** A series that makes the alert fire after numbers 21, 25 and 35 (see tests/logic.test.js). */
export const SAMPLE = [20, 34, 10, 30, 31, 4, 35, 20, 26, 22, 29, 20, 21, 19, 22, 34, 22, 31, 4, 36,
    6, 36, 23, 24, 5, 25, 31, 2, 27, 9, 0, 12, 13, 28, 34, 30, 32, 14, 9, 11];

/** Uses CHROME_PATH when set, otherwise the installed stable Chrome. */
export function launch() {
    const executablePath = process.env.CHROME_PATH;
    return puppeteer.launch({
        ...(executablePath ? { executablePath } : { channel: 'chrome' }),
        headless: true,
        args: ['--autoplay-policy=no-user-gesture-required', '--no-first-run'],
    });
}

function report(page) {
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
    return page;
}

export async function phonePage(browser, { width = 390, height = 844, scale = 2 } = {}) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: scale, isMobile: true, hasTouch: true });
    return report(page);
}

export async function desktopPage(browser, { width = 1280, height = 900 } = {}) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    return report(page);
}

/** Keeps the scratch data folder clean: every save request fails. Call before the first goto. */
export async function blockSaves(page) {
    await page.setRequestInterception(true);
    page.on('request', r => (r.url().includes('action=save') ? r.abort() : r.continue()));
}

/** Opens the app with these numbers as an unsaved draft, and optional settings. */
export async function openWithNumbers(page, numbers, { name = 'Skúška', settings = {} } = {}) {
    await page.goto(APP_URL, { waitUntil: 'load' });
    await page.evaluate((numbers, name, settings) => {
        localStorage.clear();
        localStorage.setItem('unique-numbers:draft', JSON.stringify({ id: null, name, numbers }));
        localStorage.setItem('unique-numbers:settings', JSON.stringify(settings));
    }, numbers, name, settings);
    await page.goto(APP_URL, { waitUntil: 'load' });
}

/** Records every oscillator the page starts: [{type, freq, start, stop}] in window.__beeps. */
export async function recordBeeps(page) {
    await page.evaluateOnNewDocument(() => {
        window.__beeps = [];
        const Original = window.AudioContext;
        window.AudioContext = class extends Original {
            createOscillator() {
                const osc = super.createOscillator();
                const start = osc.start.bind(osc);
                const stop = osc.stop.bind(osc);
                const beep = { type: null, freq: null, start: null, stop: null };
                osc.start = (when) => { Object.assign(beep, { type: osc.type, freq: osc.frequency.value, start: when }); window.__beeps.push(beep); return start(when); };
                osc.stop = (when) => { if (beep.stop === null) beep.stop = when; return stop(when); };
                return osc;
            }
        };
    });
}

/** The grid as plain data, one object per row. */
export function readGrid(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('tbody > tr'), tr => {
        const c = tr.cells;
        return {
            value: tr.querySelector('input').value,
            t: c[3].textContent,
            symbol: c[4].textContent,
            left: c[6].className,
            right: c[7].className,
            sets: (c[0].textContent.trim() + ' | ' + c[5].textContent.trim()).replace(/^ \| $/, ''),
            tail: tr.classList.contains('is-tail'),
        };
    }));
}

/** Compares what is painted with what logic.js computes for the same numbers. */
export function gridMismatches(page) {
    return page.evaluate(() => {
        const values = Array.from(document.querySelectorAll('tbody input'), i => (/^\d{1,2}$/.test(i.value) && +i.value <= 36 ? +i.value : null));
        const sheet = UniqueNumbers.computeSheet(values);
        const trs = document.querySelectorAll('tbody > tr');
        const note = (symbol, n) => [symbol && 'has-value', n.bracket && `${n.bracket}-number`, n.color].filter(Boolean).join(' ');
        const bad = [];
        sheet.rows.forEach((row, i) => {
            const c = trs[i].cells;
            if (c[3].textContent !== String(row.t ?? '')) bad.push({ row: i + 1, what: 'T', shown: c[3].textContent, expected: row.t });
            if (c[4].textContent !== row.symbol) bad.push({ row: i + 1, what: 'symbol', shown: c[4].textContent, expected: row.symbol });
            if (c[6].className !== note(row.symbol, row.left)) bad.push({ row: i + 1, what: 'left', shown: c[6].className, expected: note(row.symbol, row.left) });
            if (c[7].className !== note(row.symbol, row.right)) bad.push({ row: i + 1, what: 'right', shown: c[7].className, expected: note(row.symbol, row.right) });
        });
        const setsRow = Array.from(trs).findIndex(tr => tr.cells[0].textContent.trim() !== '');
        if (setsRow !== (sheet.sets?.row ?? -1)) bad.push({ what: 'sets row', shown: setsRow, expected: sheet.sets?.row ?? -1 });
        return bad;
    });
}

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export function savedSeries() {
    return fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')) : [];
}

export function clearSavedSeries() {
    for (const file of savedSeries()) fs.unlinkSync(path.join(DATA_DIR, file));
}

/** Tiny assertion log: check(cond, message, details?) and a summary that sets the exit code. */
export function checker() {
    let failures = 0;
    return {
        check(condition, message, details) {
            console.log(`${condition ? 'PASS' : 'FAIL'}  ${message}`);
            if (!condition) {
                failures++;
                if (details !== undefined) console.log('      ', JSON.stringify(details));
            }
        },
        finish() {
            console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
            process.exitCode = failures ? 1 : 0;
        },
    };
}
