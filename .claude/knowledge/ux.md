# Audience and UX rules

## Who uses it

The owner built this for a friend: about 55 years old, not technical, Slovak, mostly on a phone.
He types a live series of numbers (0–36) one by one and must not miss the alert. The owner sets
things up for him and tests on his own phone and PC.

Everything visible is judged by one question: *would he manage this alone, without calling the owner?*

## Rules

- **Slovak, plain everyday words.** No "draft", "server", "localStorage", "JSON", "sync", "ms" without
  a translation (the beep length shows `800 ms` and `0,8 s`). Error messages say what to do.
- **Text labels on every button.** Icons alone only where universal (×). The old ♪ and ↕ icon toggles
  were replaced by the *Nastavenia* dialog for this reason.
- **Nothing is ever lost silently.** Autosave plus a local draft; `confirm()` before every destructive
  or surprising action (clearing numbers, deleting a series, adding random test numbers).
- **Test tools stay out of the way.** "Pridať 25 náhodných čísel (na skúšku)" lives in *Nastavenia*,
  not in the toolbar, so a stray tap cannot pollute a real series.
- **Sizes.** Touch targets at least 38 px on phones; number inputs at least 16 px font (iOS zooms the
  page otherwise). Both text sizes must fit a 360 px wide phone without sideways scrolling.
- **The alert must be impossible to miss.** Long and loud by default (800 ms, 100 %), adjustable,
  plus a big "Pozor" message at the **top** of the screen - the phone keyboard covers the bottom.
- **Print as dense as possible.** The owner asked for "very very compact - as many numbers with
  results on one page as possible" (2026-10-09). Do not trade density for looks; 7 pt is the floor
  for text, and a change that fits fewer than 576 numbers on a full A4 page is a regression.
- **Mistakes are easy to fix.** Tapping a number selects it, so typing replaces it. An impossible
  number (37+) stays visible in red with an explanation instead of vanishing.
- **Resume where he left off.** Opening the plain address reopens the last series.

## Slovak details

- Plurals: 1 číslo, 2–4 čísla, 0 and 5+ čísel - use `countNumbers()` in index.js.
- Dates: `9. 10. 2026 18:05` - PHP `j. n. Y H:i` and JS `toLocaleString('sk-SK', …)` must match.
- Quotes: „…“. Ellipsis: … (one character). Minus in results: − (U+2212).

## Vocabulary on screen

séria · číslo / čísla / čísel · Uložiť / Ukladám… / ✓ Uložené / ⚠ Neuložené · Nová séria · Otvoriť ·
Tlačiť · Nastavenia · staré / nové · Pípnuť · Dĺžka pípnutia · Hlasitosť · Tón: Jemný / Výrazný ·
Väčšie písmo · Pozor: druhá dvojica rovnakej farby za sebou.
