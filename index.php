<?php

declare(strict_types=1);

require __DIR__ . '/lib/Storage.php';

$storage = new Storage(__DIR__ . '/data');

/** Sériu je možné otvoriť priamo z adresy: index.php?s=<id> */
$initial  = isset($_GET['s']) ? $storage->load((string) $_GET['s']) : null;
$sessions = $storage->list();
$missing  = isset($_GET['s']) && $initial === null;

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function shortDate(?string $iso): string
{
    $time = $iso !== null ? strtotime($iso) : false;

    return $time === false ? '—' : date('j. n. Y, H:i', $time);
}

/** Predvolený názov novej série - aktuálny dátum a čas v slovenskom formáte. */
function defaultSeriesName(): string
{
    return date(Storage::NAME_DATE_FORMAT);
}
?>
<!DOCTYPE html>
<html lang="sk">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#ffffff">
    <title>Unikátne čísla<?= $initial ? ' · ' . e((string) $initial['name']) : '' ?></title>
    <link rel="stylesheet" href="style.css">
    <script src="index.js" defer></script>
</head>

<body>
    <header class="bar">
        <h1 class="bar__title">Unikátne čísla</h1>

        <div class="bar__group bar__group--session">
            <label class="field">
                <span class="field__label">Séria</span>
                <input id="sessionName" type="text" maxlength="<?= Storage::MAX_NAME_LEN ?>"
                       autocomplete="off" autocapitalize="sentences" spellcheck="false"
                       placeholder="Bez názvu" value="<?= e($initial ? (string) $initial['name'] : defaultSeriesName()) ?>">
            </label>
            <button type="button" class="btn btn--primary" data-action="save">Uložiť</button>
        </div>

        <span id="sessionMeta" class="bar__meta"><?= $initial ? e(shortDate($initial['updatedAt'] ?? null)) : 'neuložené' ?></span>

        <div class="bar__group bar__group--actions">
            <button type="button" class="btn" data-action="generate">Generovať</button>
            <button type="button" class="btn" data-action="clear">Vyčistiť</button>
            <button type="button" class="btn" data-action="open">Otvoriť<span id="sessionCount" class="badge"><?= count($sessions) ?></span></button>
            <button type="button" class="btn" data-action="print">Tlačiť</button>
            <button type="button" class="btn btn--icon" data-action="density" title="Prepnúť hustotu riadkov" aria-pressed="false">&#8597;</button>
        </div>
    </header>

    <main class="sheet">
        <div class="sheet__head">
            <span class="sheet__name" id="printName"><?= e($initial ? (string) $initial['name'] : defaultSeriesName()) ?></span>
            <span class="sheet__date"><?= e(date('j. n. Y')) ?></span>
        </div>

        <table class="grid">
            <thead>
                <tr>
                    <th scope="col" class="col-set"><span class="sr-only">Staré unikátne čísla</span></th>
                    <th scope="col" class="col-idx">#</th>
                    <th scope="col" class="col-num">Č</th>
                    <th scope="col" class="col-t">T</th>
                    <th scope="col" class="col-sym">&plusmn;</th>
                    <th scope="col" class="col-set col-set--right"><span class="sr-only">Nové unikátne čísla</span></th>
                    <th scope="col" class="col-note"><span class="sr-only">Ľavý stĺpec</span></th>
                    <th scope="col" class="col-note"><span class="sr-only">Pravý stĺpec</span></th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </main>

    <dialog id="sessionsDialog" class="dlg">
        <div class="dlg__head">
            <strong>Uložené série</strong>
            <div class="dlg__head-actions">
                <button type="button" class="btn" data-action="new-session">Nová séria</button>
                <button type="button" class="btn btn--icon" data-action="close-dialog" aria-label="Zavrieť">&times;</button>
            </div>
        </div>
        <ul id="sessionList" class="sessions"></ul>
    </dialog>

    <div id="toast" class="toast" role="status" aria-live="polite"></div>

    <script id="bootstrapData" type="application/json"><?= json_encode([
        'session'  => $initial,
        'sessions' => $sessions,
        'missing'  => $missing,
        'maxRows'  => Storage::MAX_ROWS,
        'min'      => Storage::MIN_NUMBER,
        'max'      => Storage::MAX_NUMBER,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
</body>

</html>
