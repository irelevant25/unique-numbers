/* ==================================================================
   Unikátne čísla - the numbers logic

   Pure functions, no DOM: index.js paints whatever computeSheet()
   returns, and tests/logic.test.js checks it under Node.
   ================================================================== */

(function (root) {
    'use strict';

    const UNIQUE_COUNT = 6;
    const ALL_T = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    const PLUS = '+';
    const MINUS = '−'; // a real minus sign - a hyphen is too thin to read at a glance
    const ZERO = '0';

    /** 0 stays 0; 1-3 become 1, 4-6 become 2 ... 34-36 become 12. */
    function transform(number) {
        return Math.ceil(number / 3);
    }

    /**
     * The six most recent different T values before row `end`, skipping zeros
     * and blank rows, newest first - or null while there are not six yet.
     *
     * @param {(number|null)[]} ts
     */
    function lastUnique(ts, end) {
        const unique = new Set();

        for (let i = end - 1; i >= 0 && unique.size < UNIQUE_COUNT; i--) {
            if (ts[i]) unique.add(ts[i]); // null (blank) and 0 are both skipped
        }

        return unique.size === UNIQUE_COUNT ? Array.from(unique) : null;
    }

    /** Two symbols match when they are equal; a zero matches anything. */
    function samePair(a, b) {
        return a === b || a === ZERO || b === ZERO;
    }

    /**
     * Compares each pair with the pair four places further on: 1-2 with 5-6
     * (blue), 3-4 with 7-8 (gray), then the same again from 5 on.
     *
     * @param {string[]} symbols the column's symbols, blank rows already left out
     * @param {string[]} colors  filled in place, one entry per symbol
     * @returns {{at: number, color: string}[]} the groups it coloured, in order.
     */
    function markPairs(symbols, colors, start) {
        const groups = [];

        for (let i = start; i + 5 < symbols.length; i += 4) {
            if (samePair(symbols[i], symbols[i + 4]) && samePair(symbols[i + 1], symbols[i + 5])) {
                [i, i + 1, i + 4, i + 5].forEach(k => { colors[k] = 'blue'; });
                groups.push({ at: i, color: 'blue' });
            }
            if (i + 7 >= symbols.length) continue;
            if (samePair(symbols[i + 2], symbols[i + 6]) && samePair(symbols[i + 3], symbols[i + 7])) {
                [i + 2, i + 3, i + 6, i + 7].forEach(k => { colors[k] = 'gray'; });
                groups.push({ at: i + 2, color: 'gray' });
            }
        }

        return groups;
    }

    /**
     * Groups chain: each one shares its last two cells with the next. When the
     * next coloured group has the same colour as the one before it, that is
     * the "second pair of the same colour" the beep announces.
     *
     * @returns {string[]} one id per repeat, stable while earlier rows do not change.
     */
    function sameColourRepeats(groups, column) {
        const repeats = [];

        for (let i = 1; i < groups.length; i++) {
            if (groups[i].color === groups[i - 1].color) {
                repeats.push(`${column}:${groups[i].color}:${groups[i].at}`);
            }
        }

        return repeats;
    }

    /**
     * Everything the sheet shows, derived from the numbers alone.
     *
     * @param {(number|null)[]} values one per row, null for a blank row
     * @returns {{
     *   rows: {t: number|null, symbol: string,
     *          left: {bracket: string, color: string}, right: {bracket: string, color: string}}[],
     *   sets: {row: number, old: number[], fresh: number[]}|null,
     *   repeats: string[],
     * }}
     */
    function computeSheet(values) {
        const ts = values.map(value => (value === null || value === undefined ? null : transform(value)));
        const rows = ts.map(t => ({
            t,
            symbol: '',
            left: { bracket: '', color: '' },
            right: { bracket: '', color: '' },
        }));

        // + the T value is new, − it is one of the last six different ones, 0 a zero
        ts.forEach((t, i) => {
            if (t === null) return;
            const unique = lastUnique(ts, i);
            if (!unique) return;
            rows[i].symbol = t === 0 ? ZERO : unique.includes(t) ? MINUS : PLUS;
        });

        // the two note columns repeat the symbol; only rows that have one take part
        const marked = rows.filter(row => row.symbol !== '');
        const last = marked.length - 1;

        marked.forEach((row, k) => {
            // left: brackets around 0-1, 4-5, 8-9 ... (a lone last top is left out)
            if (!(k === last && k % 2 === 0)) {
                if (k % 4 === 0) row.left.bracket = 'top';
                else if (k % 4 === 1) row.left.bracket = 'bottom';
            }
            // right: shifted by one row (posunuté o jeden riadok) - 1-2, 5-6, 9-10 ...
            if (k !== 0 && !(k === last && k % 2 === 1)) {
                if (k % 4 === 1) row.right.bracket = 'top';
                else if (k % 4 === 2) row.right.bracket = 'bottom';
            }
        });

        const symbols = marked.map(row => row.symbol);
        const leftColors = [];
        const rightColors = [];
        const leftGroups = markPairs(symbols, leftColors, 0);
        const rightGroups = markPairs(symbols, rightColors, 1);
        marked.forEach((row, k) => {
            row.left.color = leftColors[k] ?? '';
            row.right.color = rightColors[k] ?? '';
        });

        // the old/new sets belong on the last filled row: they tell what the next number would be
        let lastFilled = -1;
        for (let i = ts.length - 1; i >= 0; i--) {
            if (ts[i] !== null) {
                lastFilled = i;
                break;
            }
        }
        const unique = lastFilled >= 0 ? lastUnique(ts, lastFilled + 1) : null;
        const sets = unique
            ? { row: lastFilled, old: [...unique].sort((a, b) => a - b), fresh: ALL_T.filter(t => !unique.includes(t)) }
            : null;

        return {
            rows,
            sets,
            repeats: [...sameColourRepeats(leftGroups, 'L'), ...sameColourRepeats(rightGroups, 'R')],
        };
    }

    const api = { UNIQUE_COUNT, PLUS, MINUS, ZERO, transform, lastUnique, computeSheet };

    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.UniqueNumbers = api;
})(typeof window !== 'undefined' ? window : globalThis);
