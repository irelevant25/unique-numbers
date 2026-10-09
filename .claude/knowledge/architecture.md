# Architecture

Plain PHP 8.1+ and vanilla JavaScript. No build step, no framework, no database, and no npm
packages in the app itself (the only ones belong to the browser checks in
`.claude/skills/browser-check/scripts`, git-ignored).

## Files

| File | Role |
| --- | --- |
| `index.php` | Renders the page and all dialogs; preloads a series from `?s=<id>`; hands `bootstrapData` (series, list, limits) to JS as JSON |
| `api.php` | JSON API (below) |
| `lib/Storage.php` | One JSON file per series in `data/`; validation; Europe/Bratislava fallback timezone |
| `logic.js` | The numbers rules, pure → `window.UniqueNumbers` in the browser, `module.exports` in Node |
| `index.js` | Everything on the page: rows, painting, autosave, drafts, settings, sound, dialogs, print sync |
| `style.css` | Mobile-first screen styles, the "Väčšie písmo" variables, the print stylesheet |
| `tests/` | `logic.test.js` (`node --test`), `storage-test.php` |
| `data/` | Saved series - git-ignored, `.htaccess` denies direct web access |
| `bootstrap.min.css`, `bootstrap.bundle.min.js` | Unused leftovers from the first commit, not referenced by the page |

Scripts load with `defer` in this order: `logic.js`, then `index.js`.

## Painting the grid

`input` / `change` / Enter → `recalculate()` → `rowValues()` (anything not 0–36 becomes `null`) →
`computeSheet()` → `paint()` → `announceRepeats()`.

- `recalculate()` is idempotent - keyed on the values - so a `change` event and an Enter key for the
  same number do not double-beep.
- `renderRows(numbers)` replaces the body with one `innerHTML` write. The values are forced through
  `Number.isInteger` first, so nothing from storage can inject markup. `renderRow()` appends one
  empty row.
- Cells are reached by position: `tr.cells[COL.x]`. `rowHtml()` and `COL` must list the columns in
  the same order: set-old, #, number, T, ±, set-new, L, R.
- Trailing empty rows get `tr.is-tail` (hidden in print).

## Entering numbers

| Event | Handler | Why |
| --- | --- | --- |
| Enter keydown, or keyup when keydown did not report it | `submitRow` | validate, recalculate, focus the next row (create it if needed) |
| `change` (leaving the field) | `onRowChange` | iPhone number pads have no Enter; their "next field" arrow and "Hotovo" leave the field |
| `input` | `onRowInput` | strip non-digits; mark 37–99 red (`is-invalid`, treated as blank); add a spare empty row when typing into the last one, so the iPhone "next field" arrow has a target; mark dirty |
| `focusin` | select the content | typing over a number replaces it, like a spreadsheet cell |

## Saving (autosave since 2026-10-09)

- `markDirty()` writes a local draft at once and schedules `saveNow()` 1 s later.
- `saveNow()` runs **one request at a time** (`while (saving.inFlight) await ...`): two parallel saves
  of a new series would create two files.
- A series without an id and without numbers is never saved (no empty files from "Nová séria").
- On failure: one error toast, the button turns "⚠ Neuložené", retry every 10 s and on `online`.
  The draft stays until a save succeeds. A tap on the button saves immediately.
- `leaveCurrentSeries()` saves before "Nová séria" or opening another series; if that fails, the
  user must confirm that the changes will be lost.
- Deleting the series on screen starts a clean one - otherwise autosave would bring it back.
- `adoptSession()` takes the server's id/date without overwriting a name that is being typed.

Save button `#saveState[data-state]`: `new` · `saving` · `saved` · `error`. The server renders the
first state, JS keeps it up to date in `renderSaveState()`.

## Start-up (`start()` in index.js)

1. URL names a series and the draft belongs to it → restore the draft (unsaved changes win) and save.
2. URL names a series → show it; a draft of another series is saved quietly (`rescueDraft`).
3. No series in the URL, a draft exists → restore it and save.
4. Otherwise reopen the last series (`unique-numbers:last`) if it still exists.
5. Otherwise an empty sheet named with the current date and time.

## Browser storage

| Key | Content |
| --- | --- |
| `unique-numbers:draft` | `{id, name, numbers}` - exists only while there are unsaved changes |
| `unique-numbers:last` | id of the series to reopen on start-up |
| `unique-numbers:settings` | `{sound, beepMs: 100–5000, volume: 10–100, tone: 'soft'\|'sharp', bigText}` |
| `unique-numbers:sound`, `unique-numbers:density` | legacy toggles, read once as defaults for `sound` and `bigText` |

All access goes through `storageGet` / `storageSet`, which swallow errors (private mode, full storage).

## Sound

Web Audio oscillator at 1500 Hz: sine for "Jemný", square at 0.8 for "Výrazný" (louder at the same
level). The level holds for the whole length with a 10 ms fade-in and a fade-out of at most 60 ms;
a new beep stops the previous one. The audio context is created on the first tap or key press (iOS
unlock) and sets `navigator.audioSession.type = 'playback'` where supported, so iPhones beep in
silent mode. Between beeps the context is suspended (`idleAudio`, 0.5 s after a beep ends) so that
"playback" does not hold the friend's music paused while the page is open; every beep resumes it,
always from inside a key or tap handler, which iOS requires. Settings changes play a preview 250 ms
after the last tap - `previewBeep()` wakes the audio inside the tap for the same reason.

Before 2026-10-09 the gain decayed exponentially over the whole 160 ms from 0.22: rendered offline it
was ~20 ms near its peak at 0.12 RMS. Now: ~770 ms at 0.71 RMS by default (+15 dB).

## Print

- `@page`: A4 portrait, 7 mm margins, page counter `n / total` in the `@bottom-right` margin box.
- `.sheet` becomes a multicol container (`columns: auto 23mm; column-fill: auto`). Chrome fragments
  the table across columns and pages and repeats the header row in every column.
- Hidden: toolbar, dialogs, the two set columns (the sets print once in the header with the count),
  trailing empty rows, the inputs (replaced by `numberPrint` text mirrors; `syncPrintMirrors()` runs
  on `beforeprint` and before `window.print()`).
- 7 pt text, 5.5 pt row numbers, 3.3 mm rows → 7 columns × ~82 rows = **576 numbers on a full page**;
  2000 numbers fit on 4 pages (41 per page before).
- The table (≈ 22 mm) must stay narrower than one column (≈ 26 mm), or columns overlap. Measure with
  the `browser-check` skill (`print.mjs`) after any print CSS change.

## API

| Request | Body | Answer |
| --- | --- | --- |
| `GET api.php?action=list` | | `{ok, sessions: [...]}` newest first, without numbers |
| `GET api.php?action=load&id=<id>` | | `{ok, session}` or 404 |
| `POST api.php?action=save` | `{id?, name, numbers}` | `{ok, session, sessions}`; an unknown id creates a new series |
| `POST api.php?action=delete` | `{id}` | `{ok, sessions}` or 404 |

POST bodies must be `Content-Type: application/json` (415 otherwise) - a plain HTML form on another
site cannot send that, so it cannot save or delete. Errors: `{ok: false, error: "<Slovak message>"}`.

## Storage

`data/<16 lowercase hex>.json`: `{id, name, rows, filled, numbers, createdAt, updatedAt}`, written
with `LOCK_EX`. Ids are checked against `/^[0-9a-f]{16}$/` before any file access, so a crafted id
cannot leave `data/`. Limits: 1000 series, 2000 rows, names of 80 characters (cut with PCRE, so
ext-mbstring is not needed). The list is sorted by `strtotime(updatedAt)`.

## Security model

There is **no authentication**: whoever can reach the URL can read, change and delete every series.
That is fine on a private network or behind HTTP basic auth; tell the owner before suggesting a public
host without either.
