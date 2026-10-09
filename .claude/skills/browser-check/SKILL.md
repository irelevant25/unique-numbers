---
name: browser-check
description: >
  Run the unique-numbers app in headless Chrome and verify it really works: typing numbers on a phone
  (Enter, iPhone next-field arrow, Android keyup), corrections, the empty last row, autosave and outages,
  the beep (count and length), settings, start-up, and print density (pages, numbers per page) with
  rendered PNGs and phone/desktop screenshots. Use after any change to index.js, logic.js, index.php,
  style.css or the print/sound behaviour, or when asked to "test in the browser", "check the print",
  "take screenshots", "does it work on a phone".
---

# Browser check

The app has no build step, so "it works" means: PHP serves it, Chrome runs it, and the result looks
right. These scripts do exactly that against a **scratch copy** of the app, so real saved series in
`data/` are never touched.

## Setup (once per machine)

```sh
cd .claude/skills/browser-check/scripts
npm install          # puppeteer-core, pdfjs-dist, @napi-rs/canvas - node_modules is git-ignored
```

Needs PHP 8.1+ and Node 22+ on PATH and an installed Chrome. If Chrome is not found, set
`CHROME_PATH` (on this machine: `C:/Program Files/Google/Chrome/Application/chrome.exe`).

## Run

1. Start the server **in the background** (Bash `run_in_background: true`, long timeout). It copies the
   app into a temp folder with its own empty `data/` and prints `APP_URL` and `DATA_DIR`:
   ```sh
   node .claude/skills/browser-check/scripts/serve.mjs 8765
   ```
   It copies the files once at start: **restart it after every code change** (stop the task, start again).
2. From `.claude/skills/browser-check/scripts`, run what the change needs:

   | Script | Checks | Output |
   | --- | --- | --- |
   | `DATA_DIR=<printed> node smoke.mjs` | ~40 end-to-end checks, exit 1 on failure | PASS/FAIL lines |
   | `node print.mjs [count ...]` | PDF of 40 / 600 / 2000 numbers, pages and numbers on page 1 | `print-*.pdf`, `print-*-p1.png` |
   | `node shots.mjs` | 360/390 px phones, normal and bigger text, settings, desktop; sideways scrolling | `phone-*.png`, `desktop.png` |
   | `node pdf2png.mjs file.pdf [scale] [pages]` | any PDF to PNG | PNG next to the PDF |

   Images go to `OUT_DIR` (default: `<os temp>/unique-numbers-checks`). **Look at them with the Read
   tool** - a passing script does not prove a layout looks right.
3. Stop the server task when done.

## Expected results (2026-10-09)

- `smoke.mjs`: ALL PASSED. The "status of 500" console line is the simulated outage, not a bug.
- `print.mjs`: 40 → 1 page; 600 → 2 pages, page 1 holds **576**; 2000 → 4 pages. Table ≈ 22 mm wide,
  rows ≈ 3.3 mm. Fewer numbers on page 1 after a CSS change is a regression - the owner wants the print
  as dense as possible.
- `shots.mjs`: PASS for all four phone variants (no sideways scrolling).

## Writing a new scenario

Put one-off scripts in `OUT_DIR` or the session scratchpad, not in the repo, and import the helpers:

```js
import { APP_URL, SAMPLE, launch, phonePage, recordBeeps, readGrid, gridMismatches, blockSaves,
    openWithNumbers, sleep, checker } from '<repo>/.claude/skills/browser-check/scripts/harness.mjs';
```

- `openWithNumbers(page, numbers, {settings})` loads numbers as a local draft - fastest way to a state.
- `blockSaves(page)` before the first `goto` keeps the scratch `data/` empty (every save fails).
- `recordBeeps(page)` before `goto`; then `window.__beeps` holds `{type, freq, start, stop}` per beep.
- `gridMismatches(page)` compares the painted grid with `logic.js` - it should always be `[]`.
- Puppeteer pitfall: never call `setRequestInterception(false)` while a request handler is attached -
  later requests then throw "Request Interception is not enabled". Leave it on and let the handler continue.

Typing like a user: `page.focus('tbody tr:last-child input')`, `page.keyboard.type('17')`,
`page.keyboard.press('Enter')`. The iPhone keypad has no Enter: simulate its "next field" arrow by
focusing the next input (`element.focus()`), which fires `change` on the row that was left.
