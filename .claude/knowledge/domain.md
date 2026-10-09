# Domain: what the sheet computes

All rules live in `logic.js` → `computeSheet(values)`, pure and free of the DOM. `index.js` only
paints the result. `tests/logic.test.js` pins the behaviour, including a golden snapshot that was
verified against the original DOM-based implementation (400 random series, 31 543 rows, 0 differences).

## Input

One value per row: an integer 0–36, or `null` for a blank row (a cleared cell, an invalid entry such
as 37, or the empty row at the end that exists to type into). **A blank is not a zero.**

## T – the transformed value (column T)

`T = ceil(n / 3)`: 0 → 0, 1–3 → 1, 4–6 → 2, … 34–36 → 12.

## The window: the last six different T values

For row *i*, walk backwards from row *i−1* and collect **different, non-zero** T values (zeros and
blanks are skipped) until there are six. With fewer than six the row gets no symbol - so the first
rows of every series have none; how many depends on repeats and zeros.

## Symbol (column ±)

| Symbol | Meaning | Colour |
| --- | --- | --- |
| `+` | T is not among those six - new | green |
| `−` | T is among them - a repeat (U+2212, a real minus sign) | red |
| `0` | the number is 0 | gray |
| empty | not enough history yet, or a blank row | |

## Note columns L and R

Both repeat the row's symbol. Only rows that have a symbol take part; number them k = 0, 1, 2 …
in order ("marked" rows; blanks and early rows are skipped).

Brackets (a box around two rows, drawn with borders):

- **L**: pairs (0,1), (4,5), (8,9) … → k % 4 = 0 top, k % 4 = 1 bottom.
- **R**: shifted by one row ("posunuté o jeden riadok"): pairs (1,2), (5,6) … → k % 4 = 1 top, k % 4 = 2 bottom.
- A top whose bottom does not exist yet (the last marked row) is left out.

## Colours

In each column the marked symbols form consecutive pairs P0, P1, P2 … starting at k = 0 for L and
k = 1 for R. Each pair is compared with the pair four places further on:

- **blue**: P0 with P2, P2 with P4 … (the bracketed pairs)
- **gray**: P1 with P3, P3 with P5 … (the pairs between the brackets)

Two pairs match when both positions match; **`0` matches anything** (a wildcard, only here - it
never enters the six-unique window). A match colours all four cells: one *group*. Consecutive
groups of one colour share two cells and form a longer coloured run.

## The alert: beep + "Pozor" message

Per column, list the coloured groups in order. A **repeat** is a group whose colour equals the colour
of the group before it *in that list*. Uncoloured gaps in between are ignored. Repeat id:
`L|R:blue|gray:<k of the group's first cell>`.

After each entered number the page compares the current repeat ids with the previous set; any new id
gives **one** beep (if sound is on) and one "Pozor: druhá dvojica rovnakej farby za sebou." message.
Loading, "Pridať 25 náhodných čísel", clearing and printing recompute silently but still update the
known set, so nothing beeps later for a repeat that was already there.

**How often** (measured 2026-10-09, 200 000 fair random spins replayed number by number): the alert
fires about **once every 11 numbers**, and at least a quarter of the repeats come after a gap rather
than from touching groups. An earlier commit message called repeats "rare" - that was wrong.

```sh
node -e "const L=require('./logic.js');let s=7,r=()=>(s=(s*1103515245+12345)%2147483648)/2147483648,n=0,b=0;for(let k=0;k<500;k++){const v=Array.from({length:100},()=>Math.floor(r()*37));let known=new Set();for(let i=1;i<=v.length;i++){const x=L.computeSheet(v.slice(0,i)).repeats;if(x.some(id=>!known.has(id)))b++;known=new Set(x)}n+=v.length}console.log('one alert per',(n/b).toFixed(1),'numbers')"
```

> **Open question for the owner** - should a same-colour group after a gap count, or only one that
> touches the previous group? The code counts both (that is what "the next coloured group has the
> same colour" means). Do not change it without asking.

## Sets: "staré" and "nové"

Shown on the **last filled row**: `staré` = the six different T values looking back from that row
(inclusive), sorted; `nové` = the other six of 1–12. They tell which T would come out as `−` or `+`
for the next number. In print they appear once in the header. With fewer than six different T values
there are no sets and no labels.

## Blank rows

No T, no symbol, no notes; skipped by the window and by pairing; never coloured. Before 2026-10-09 a
blank counted as 0 - a pairing wildcard - which put a phantom `0` into the empty last row after an
earlier number was corrected, and could colour pairs or beep falsely.

## Worked example

The first 12 numbers of the test sample `20 34 10 30 31 4 35 20 26 22 29 20`:

| # | n | T | ± | why |
| --- | --- | --- | --- | --- |
| 1–6 | 20 34 10 30 31 4 | 7 12 4 10 11 2 | | fewer than six different T before them |
| 7 | 35 | 12 | − | window 2, 11, 10, 4, 12, 7 contains 12 |
| 8 | 20 | 7 | − | window 12, 2, 11, 10, 4, 7 |
| 9 | 26 | 9 | + | window 7, 12, 2, 11, 10, 4 |
| 10 | 22 | 8 | + | window 9, 7, 12, 2, 11, 10 |
| 11 | 29 | 10 | + | window 8, 9, 7, 12, 2, 11 - 10 dropped out |
| 12 | 20 | 7 | − | window 10, 8, 9, 7, 12, 2 |
