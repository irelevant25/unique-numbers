---
name: run-checks
description: >
  Fast automated checks for unique-numbers without a browser: logic tests (node --test), storage tests
  (also on a PHP without php.ini), PHP syntax and JS syntax. Takes seconds. Use before every commit,
  after any code change, or when asked "run the tests", "is everything OK", "check it".
---

# Run checks

Run all of these from the repository root. Every line must succeed; report any failure verbatim.

```sh
node --test                              # tests/logic.test.js - the numbers rules, golden snapshot
php tests/storage-test.php               # storage, validation, ids, save/load/delete
php -n tests/storage-test.php            # same on a bare PHP: no mbstring, no timezone
php -l index.php && php -l api.php && php -l lib/Storage.php
node --check index.js && node --check logic.js
```

What they protect:

- **`node --test`** - the domain rules in `logic.js`. The *golden* test pins the exact output for a
  40-number series that was verified against the original DOM-based code. If it fails, either the
  change broke the rules or the rules were changed on purpose (then follow the `change-logic` skill).
- **`php -n tests/storage-test.php`** - hosts without `php.ini`. Using `mb_*` functions or relying on
  a configured timezone fails here (both happened before 2026-10-09).
- **`php -l`** only checks syntax for the PHP running it (8.5 here). The target is PHP **8.1**, so
  also make sure no newer features slipped in: typed class constants (`const int X`, 8.3),
  `readonly class` (8.2), `#[\Override]` (8.3), `json_validate` (8.3), DNF types (8.2).

These checks do not cover the page itself. For anything in `index.js`, `index.php` or `style.css`,
also run the `browser-check` skill.
