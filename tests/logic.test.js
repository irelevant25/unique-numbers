// Run with: node --test
// Pure checks of logic.js - no browser, no server, no dependencies.

const test = require('node:test');
const assert = require('node:assert/strict');
const { transform, lastUnique, computeSheet, PLUS, MINUS, ZERO } = require('../logic.js');

/** One compact token per row: value:T symbol, then bracket+colour for the left and right note. */
function render(values) {
    const code = (note) => (note.bracket ? note.bracket[0] : '-') + (note.color ? note.color[0].toUpperCase() : '-');
    return computeSheet(values).rows.map((row, i) => {
        const symbol = row.symbol === MINUS ? '-' : row.symbol || '.';
        return `${values[i] ?? '_'}:${row.t ?? '_'}${symbol}${code(row.left)}${code(row.right)}`;
    });
}

/** Replays typing the numbers one by one; returns after which numbers the alert fires. */
function alertsWhileTyping(values) {
    const alerts = [];
    let known = new Set();
    for (let n = 1; n <= values.length; n++) {
        const repeats = computeSheet(values.slice(0, n)).repeats;
        if (repeats.some(id => !known.has(id))) alerts.push(n);
        known = new Set(repeats);
    }
    return alerts;
}

// T values 1..7, one row each - six different ones are needed before the first symbol
const STAIRS = [1, 4, 7, 10, 13, 16, 19];

// A series known to alert three times; it was checked against the original DOM-based code.
const SAMPLE = [20, 34, 10, 30, 31, 4, 35, 20, 26, 22, 29, 20, 21, 19, 22, 34, 22, 31, 4, 36,
    6, 36, 23, 24, 5, 25, 31, 2, 27, 9, 0, 12, 13, 28, 34, 30, 32, 14, 9, 11];

test('transform maps a number to its row of three: 0 stays 0, 1-3 -> 1 ... 34-36 -> 12', () => {
    assert.deepEqual([0, 1, 3, 4, 6, 7, 33, 34, 36].map(transform), [0, 1, 1, 2, 2, 3, 11, 12, 12]);
});

test('lastUnique collects six different T values backwards, skipping zeros and blanks', () => {
    assert.equal(lastUnique([1, 2, 3, 4, 5], 5), null);
    assert.deepEqual(lastUnique([1, 2, 3, 4, 5, 6], 6), [6, 5, 4, 3, 2, 1]);
    assert.deepEqual(lastUnique([9, 1, 2, 0, 2, null, 3, 4, 5, 6], 10), [6, 5, 4, 3, 2, 1]);
    // only rows before `end` count
    assert.equal(lastUnique([1, 2, 3, 4, 5, 6], 5), null);
});

test('symbols: nothing until six different T values came before, then + new, − repeated, 0 zero', () => {
    const sheet = computeSheet([...STAIRS, 1, 4, 1, 0]);
    assert.deepEqual(sheet.rows.map(row => row.symbol), ['', '', '', '', '', '', PLUS, PLUS, PLUS, MINUS, ZERO]);
});

test('a blank row is not a zero: no T, no symbol, and it does not take part in pairing', () => {
    const sheet = computeSheet([...STAIRS.slice(0, 6), null, 19]);
    assert.equal(sheet.rows[6].t, null);
    assert.equal(sheet.rows[6].symbol, '');
    assert.deepEqual(sheet.rows[6].left, { bracket: '', color: '' });
    assert.equal(sheet.rows[7].symbol, PLUS);
});

test('the empty row at the end stays empty and the sets stay on the last filled row', () => {
    // regression: editing an earlier row used to give the empty last row a T and symbol of 0
    const sheet = computeSheet([...STAIRS, 22, null]);
    assert.equal(sheet.rows[8].t, null);
    assert.equal(sheet.rows[8].symbol, '');
    assert.equal(sheet.sets.row, 7);
});

test('sets: the last six different T values and the rest of 1-12, both sorted', () => {
    const sheet = computeSheet(STAIRS);
    assert.deepEqual(sheet.sets, { row: 6, old: [2, 3, 4, 5, 6, 7], fresh: [1, 8, 9, 10, 11, 12] });
    assert.equal(computeSheet([1, 4, 7]).sets, null);
    assert.equal(computeSheet([]).sets, null);
});

test('brackets: left pairs 0-1, 4-5 ...; right pairs shifted by one; a lone last top is left out', () => {
    // eight rows with a symbol: indexes 0..7 among the marked rows
    const sheet = computeSheet([...STAIRS, ...STAIRS.slice(0, 6), 1]);
    const marked = sheet.rows.filter(row => row.symbol);
    assert.equal(marked.length, 8);
    assert.deepEqual(marked.map(row => row.left.bracket), ['top', 'bottom', '', '', 'top', 'bottom', '', '']);
    assert.deepEqual(marked.map(row => row.right.bracket), ['', 'top', 'bottom', '', '', 'top', 'bottom', '']);

    const odd = computeSheet([...STAIRS, ...STAIRS.slice(0, 4)]).rows.filter(row => row.symbol);
    assert.equal(odd.length, 5);
    assert.equal(odd[4].left.bracket, '', 'the fifth would open a pair that never closes');
});

test('golden: the sample series renders exactly as the original code did', () => {
    assert.deepEqual(render(SAMPLE).join(' '), [
        '20:7.---- 34:12.---- 10:4.---- 30:10.---- 31:11.---- 4:2.---- 35:12-t--- 20:7-b-t-',
        '26:9+--b- 22:8+---- 29:10+t--- 20:7-b-tB 21:7---bB 19:7----- 22:8-t--- 34:12-b-tB',
        '22:8---bB 31:11+---- 4:2+t--- 36:12-b-tB 6:2---bB 36:12----- 23:8-t--- 24:8-b-tB',
        '5:2--GbB 25:9+-G-G 31:11-tB-G 2:1+bBt- 27:9--Gb- 9:3+-G-G 0:00tB-G 12:4+bBt-',
        '13:5+--b- 28:10+---G 34:12+t--G 30:10-b-t- 32:11+--b- 14:5----- 9:3-t--- 11:4-b---',
    ].join(' '));
});

test('alert: fires when the next coloured group repeats the previous colour, once per new repeat', () => {
    assert.deepEqual(computeSheet(SAMPLE).repeats, ['R:blue:9', 'R:blue:13', 'R:gray:23']);
    assert.deepEqual(alertsWhileTyping(SAMPLE), [21, 25, 35]);
});

test('a zero counts as a match for either symbol when pairs are compared', () => {
    // row 21 is a zero, and its blue group exists only because 0 matches anything:
    // put a number there that gives + or − instead, and the colour is gone
    const series = [3, 18, 26, 22, 16, 30, 16, 8, 19, 3, 16, 7, 32, 0, 19, 29, 25, 29, 16, 7, 0, 32, 10, 7];
    const rowWith = (value) => computeSheet([...series.slice(0, 20), value, ...series.slice(21)]).rows[20];

    assert.equal(rowWith(0).symbol, ZERO);
    assert.equal(rowWith(0).left.color, 'blue');
    assert.equal(rowWith(1).symbol, PLUS);
    assert.equal(rowWith(1).left.color, '');
    assert.equal(rowWith(7).symbol, MINUS);
    assert.equal(rowWith(7).left.color, '');
});
