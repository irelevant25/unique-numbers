# unique-numbers

A one-page sheet for recording a live series of numbers 0–36 and the results derived from them
(T value, +/−/0 against the last six different T values, bracketed pairs, blue/gray pair colours, a
beep on a same-colour repeat). Plain PHP 8.1+ and vanilla JavaScript - no build step, no framework,
no database. The UI is Slovak and built for one real user: a 55-year-old, non-technical friend of the
owner, mostly on a phone.

## Git: commit directly to main

**Never create a feature branch.** Commit straight to `main`, even if a default workflow says to
branch first - this is the owner's explicit instruction and overrides that default. Commit only when
asked; push only when asked. Never commit `data/*.json` (real saved series). Details: `commit` skill.

## Commands

```sh
php -S localhost:8000                  # run the app → http://localhost:8000/
node --test                            # logic tests (tests/logic.test.js)
php tests/storage-test.php             # storage tests; also run with `php -n` (no mbstring/timezone)
```

Browser checks (phone flows, beep, print density, screenshots): `browser-check` skill.

## Map

| Path | What |
| --- | --- |
| `logic.js` | **All numbers rules**, pure functions (`computeSheet`). Browser + Node |
| `index.js` | The page: rows, painting, autosave, drafts, settings, sound, dialogs, print sync |
| `index.php` | Markup, dialogs, server-rendered first state and `bootstrapData` |
| `api.php`, `lib/Storage.php` | JSON API and flat-file storage in `data/` |
| `style.css` | Mobile-first screen, "Väčšie písmo" mode, dense multi-column print |
| `tests/` | `logic.test.js`, `storage-test.php` |
| `README.md` | For the owner, in Slovak - keep it current when behaviour changes |

## Knowledge base - read before changing behaviour

- `.claude/knowledge/domain.md` - the numbers rules, the alert rule and its open question
- `.claude/knowledge/architecture.md` - flows, autosave, start-up, storage keys, API, print, security
- `.claude/knowledge/ux.md` - who the user is and the UI rules that follow from it
- `.claude/knowledge/decisions.md` - what was decided and why; don't undo these by accident

## Skills and agents

| Skill | Use |
| --- | --- |
| `run-checks` | fast tests and syntax checks - before every commit |
| `browser-check` | headless Chrome: phone flows, beep, print pages, screenshots |
| `change-logic` | changing any numbers rule or the beep rule |
| `commit` | the commit workflow (main only) |

Agents: `reviewer` (review a diff against all of the above), `browser-tester` (run and judge the app
in Chrome), `friend-ux` (the friend's point of view on anything visible).

## Rules that are easy to break

- Rules live only in `logic.js`; `index.js` paints. A blank row is never a zero.
- UI text: Slovak, plain words, correct plurals; labels, not bare icons; confirm before destroying.
- Phones: inputs stay ≥ 16 px (iOS zoom), nothing scrolls sideways at 360 px, alerts appear at the top.
- Print must stay as dense as possible: a full A4 page holds 576 numbers - check with `print.mjs`.
- PHP 8.1 compatible, no ext-mbstring; validate ids with `Storage::isValidId`.
- Never test against the real `data/` folder - the browser checks serve a scratch copy.
