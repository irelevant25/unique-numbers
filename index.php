<?php

declare(strict_types=1);

require __DIR__ . '/lib/Storage.php';

$storage = new Storage(__DIR__ . '/data');

/** Sériu je možné otvoriť priamo z adresy: index.php?s=<id> */
$requested = isset($_GET['s']) && is_string($_GET['s']) ? $_GET['s'] : null;
$initial   = $requested !== null ? $storage->load($requested) : null;
$sessions  = $storage->list();
$missing   = isset($_GET['s']) && $initial === null;

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Predvolený názov novej série - aktuálny dátum a čas v slovenskom formáte. */
function defaultSeriesName(): string
{
    return date(Storage::NAME_DATE_FORMAT);
}

$seriesName = $initial ? (string) $initial['name'] : defaultSeriesName();
?>
<!DOCTYPE html>
<html lang="sk">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#ffffff">
    <title>Unikátne čísla<?= $initial ? ' · ' . e($seriesName) : '' ?></title>
    <link rel="stylesheet" href="style.css">
    <script src="logic.js" defer></script>
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
                       placeholder="Názov série" value="<?= e($seriesName) ?>">
            </label>
            <button type="button" id="saveState" class="btn btn--save" data-action="save"
                    data-state="<?= $initial ? 'saved' : 'new' ?>"><?= $initial ? '✓ Uložené' : 'Uložiť' ?></button>
        </div>

        <span id="sessionMeta" class="bar__meta"></span>

        <nav class="bar__group bar__group--actions" aria-label="Akcie">
            <button type="button" class="btn" data-action="new-session">Nová séria</button>
            <button type="button" class="btn" data-action="open">Otvoriť<span id="sessionCount" class="badge"><?= count($sessions) ?></span></button>
            <button type="button" class="btn" data-action="print">Tlačiť</button>
            <button type="button" class="btn" data-action="settings">Nastavenia</button>
        </nav>
    </header>

    <main class="sheet">
        <div class="sheet__head">
            <span class="sheet__name" id="printName"><?= e($seriesName) ?></span>
            <span class="sheet__info">
                <span class="print-only" id="printCount"></span>
                <span class="print-only" id="printSets"></span>
                <span class="sheet__date"><?= e(date('j. n. Y')) ?></span>
            </span>
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

    <dialog id="settingsDialog" class="dlg">
        <div class="dlg__head">
            <strong>Nastavenia</strong>
            <button type="button" class="btn btn--icon" data-action="close-dialog" aria-label="Zavrieť">&times;</button>
        </div>

        <div class="settings">
            <section class="settings__group settings__sound">
                <h2 class="settings__title">Zvuk pri signáli</h2>

                <label class="check">
                    <input type="checkbox" id="soundOn">
                    <span>Pípnuť, keď za sebou príde druhá dvojica rovnakej farby</span>
                </label>

                <div class="stepper">
                    <label class="stepper__label" for="beepMs">Dĺžka pípnutia</label>
                    <div class="stepper__controls">
                        <button type="button" class="btn btn--step" data-setting="beepMs" data-step="-1" aria-label="Kratšie">&minus;</button>
                        <input type="text" id="beepMs" inputmode="numeric" autocomplete="off">
                        <span class="stepper__unit">ms</span>
                        <button type="button" class="btn btn--step" data-setting="beepMs" data-step="1" aria-label="Dlhšie">+</button>
                    </div>
                    <span class="stepper__hint" id="beepSeconds"></span>
                </div>

                <div class="stepper">
                    <label class="stepper__label" for="volume">Hlasitosť</label>
                    <div class="stepper__controls">
                        <button type="button" class="btn btn--step" data-setting="volume" data-step="-1" aria-label="Tichšie">&minus;</button>
                        <input type="text" id="volume" inputmode="numeric" autocomplete="off">
                        <span class="stepper__unit">%</span>
                        <button type="button" class="btn btn--step" data-setting="volume" data-step="1" aria-label="Hlasnejšie">+</button>
                    </div>
                </div>

                <div class="choice" role="radiogroup" aria-labelledby="toneLabel">
                    <span class="stepper__label" id="toneLabel">Tón</span>
                    <label class="check"><input type="radio" name="tone" value="soft"> <span>Jemný</span></label>
                    <label class="check"><input type="radio" name="tone" value="sharp"> <span>Výrazný (hlasnejší)</span></label>
                </div>

                <button type="button" class="btn btn--wide" data-action="test-sound">&#9654; Vyskúšať zvuk</button>
                <p class="settings__note">Celkovú hlasitosť určuje telefón – zosilníte ju tlačidlami na jeho boku. Na novších iPhonoch pípne aj v tichom režime.</p>
            </section>

            <section class="settings__group">
                <h2 class="settings__title">Zobrazenie</h2>
                <label class="check">
                    <input type="checkbox" id="bigText">
                    <span>Väčšie písmo</span>
                </label>
            </section>

            <section class="settings__group">
                <h2 class="settings__title">Táto séria</h2>
                <button type="button" class="btn btn--wide" data-action="generate">Pridať 25 náhodných čísel (na skúšku)</button>
                <button type="button" class="btn btn--wide btn--danger" data-action="clear">Vymazať všetky čísla</button>
            </section>

            <section class="settings__group">
                <h2 class="settings__title">Ako na to</h2>
                <ul class="settings__help">
                    <li>Číslo napíšte do prázdneho riadku a stlačte <b>Enter</b> (na mobile <b>Ďalej</b> alebo šípku dole).</li>
                    <li>Chybné číslo opravíte tak, že naň ťuknete a napíšete správne.</li>
                    <li>Všetko sa ukladá samo. Staršie série nájdete pod tlačidlom <b>Otvoriť</b>.</li>
                    <li><b>Nová séria</b> začne čistý hárok, tá doterajšia zostane uložená.</li>
                </ul>
            </section>
        </div>
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
