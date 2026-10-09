---
name: change-logic
description: >
  Safely change the numbers rules of unique-numbers: the T transform, the six-unique window, the +/−/0
  symbols, the L/R brackets, blue/gray pair colours, the beep (same-colour repeat) rule, or the staré/nové
  sets. Use whenever a request touches how results are calculated or when the alert should fire,
  e.g. "beep only when...", "change the pairing", "count zeros differently", "the colours are wrong".
---

# Changing the numbers logic

The rules are subtle and the owner relies on them. Read `.claude/knowledge/domain.md` first - it is
the specification in prose, including the open questions.

## Where things live

- **`logic.js`** - the only place rules exist. Pure functions, no DOM, works in the browser
  (`window.UniqueNumbers`) and in Node (`require('./logic.js')`). `computeSheet(values)` returns
  `{rows: [{t, symbol, left, right}], sets, repeats}`.
- **`index.js`** - paints that result (`paint`, `paintNote`, `paintSets`) and turns new `repeats`
  into a beep (`announceRepeats`). Never compute rules here.
- **`tests/logic.test.js`** - unit tests plus a golden snapshot.

## Steps

1. Confirm the intended rule with the owner when it is ambiguous - e.g. "second pair of the same
   colour": touching groups only, or also after a gap? Write the agreed rule down before coding.
2. Write a failing test in `tests/logic.test.js` that states the new rule on a small, readable series.
   To find a series with a property, search with a short `node -e` loop over seeded random series
   (see how the zero-wildcard test was found) instead of guessing by hand.
3. Change `logic.js`. Keep it pure.
4. Run `node --test`. If the **golden** test changes, inspect the diff row by row and only update the
   expected strings when every difference is intended. State in the commit message that the golden
   output changed and why.
5. Replay the alert on the sample: `alertsWhileTyping(SAMPLE)` in the test file shows after which
   numbers it beeps. Report how often the alert fires on random spins (one-liner in `domain.md`) when
   the beep rule changes - the owner's friend hears every one of them.
6. Run the `browser-check` skill (`smoke.mjs` uses `gridMismatches` to prove the page paints exactly
   what `logic.js` computes).
7. Update `.claude/knowledge/domain.md`, the README section *Zvuk* or *Výpočet* (Slovak, for the
   owner), and add a line to `.claude/knowledge/decisions.md`.

## Invariants that must keep holding

- A blank row (`null`) is never a zero: no T, no symbol, skipped by the window and by pairing.
- `0` is a wildcard only when comparing pairs; it never enters the six-unique window.
- Symbols are `'+'`, `'−'` (real minus) and `'0'` - use the exported `PLUS`/`MINUS`/`ZERO`.
- Repeat ids must stay stable while earlier rows do not change, or old repeats beep again.
- The sets sit on the last filled row, never on the empty input row.
