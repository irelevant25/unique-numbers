# Decisions

Newest first. Read before changing behaviour - these were deliberate, and some were the owner's
explicit wishes. Add a dated line whenever you make a decision a later session might undo by accident.

## 2026-10-09

- **Commit straight to `main`, never a feature branch.** Owner's instruction, after a session left
  work on `feature/save-load-print-slovak` that he had to merge by hand.
- **Print in newspaper columns** (owner: "very very compact, as many numbers with results on one page
  as possible"). 7 columns × ~82 rows = 576 numbers per A4 page instead of 41. Set columns move into
  the header. 7 pt is the floor.
- **The beep holds its level** for the whole length (default 800 ms, 100 %, 1500 Hz) and the length is
  adjustable in ms (owner: "not long or loud enough... add a setting for the beep length in ms").
  Also volume and tone (Jemný = sine, Výrazný = square). The old one decayed to near silence in ~20 ms.
- **Autosave replaced the "Uložiť" button as the way to save** - the button now shows the state and
  saves at once when tapped. Reason: a non-technical user forgets to save, and "Nová séria" or
  opening another series used to discard unsaved numbers without asking.
- **The app reopens the last series** on the plain address, as phone apps do.
- **Settings dialog instead of ♪ / ↕ icon buttons**, with plain labels; "Väčšie písmo" replaces the
  roomy/compact toggle (old preference migrated).
- **Generovať and Vyčistiť moved into Nastavenia** (renamed, with confirmations) - one stray tap on
  "Generovať" used to append 25 random numbers to a real series with no undo.
- **Blank rows are not zeros.** A blank used to count as 0, a pairing wildcard: it put a phantom `0`
  into the empty last row after a correction and could colour pairs or beep falsely.
- **Numbers are taken when the field is left, not only on Enter** - iPhone number pads have no Enter
  key. A spare empty row appears while typing so the keypad's "next field" arrow works.
- **Typing over a number replaces it; 37+ stays visible in red** instead of the field silently
  emptying itself.
- **Messages at the top of the screen** - at the bottom the phone keyboard hid them.
- **Real minus sign (−)** in results - the hyphen was too thin to read at a glance, especially in print.
- **logic.js split out of index.js** as pure functions with Node tests. Verified identical to the old
  DOM code on 400 random series before anything else changed.
- **Beep rule left as it was** - a same-colour group counts even after uncoloured groups in between.
  It fires about once every 11 numbers on random spins. Open question for the owner (see domain.md).
- **Server**: Europe/Bratislava when PHP has no timezone; names cut with PCRE because ext-mbstring is
  not always installed (saving crashed without it); 1000 series instead of 200 (autosave keeps
  everything); POST must be JSON.
- **Left alone**: the unused `bootstrap.min.css` / `bootstrap.bundle.min.js` files - not referenced,
  but deleting the owner's vendored files is his call.

## 2026-09-06

- PHP flat-file save/load, Slovak mobile-first UI, A4 printing (`ad6d47a`).
- Beep when the next coloured group repeats the previous colour (`acdbbea`).

## 2025–2026 (owner)

- The original sheet: unique numbers, T transform, +/− symbols, L/R brackets, blue/gray pairs with
  0 as a wildcard (`2b912e6` … `8c98a78`).
