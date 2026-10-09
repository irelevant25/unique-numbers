/* ------------------------------------------------------------------ *
 * Configuration and small helpers
 * ------------------------------------------------------------------ */

const boot = JSON.parse(document.getElementById('bootstrapData')?.textContent || '{}');
const { computeSheet, PLUS, MINUS } = window.UniqueNumbers;

const MIN_NUMBER = boot.min ?? 0;
const MAX_NUMBER = boot.max ?? 36;
const MAX_ROWS = boot.maxRows ?? 2000;
const BATCH_SIZE = 25;
const AUTOSAVE_DELAY = 1000;
const RETRY_DELAY = 10000;
const DRAFT_KEY = 'unique-numbers:draft';
const LAST_KEY = 'unique-numbers:last';
const SETTINGS_KEY = 'unique-numbers:settings';
const UNTITLED = 'Séria bez názvu';

/** Column order of a grid row, so cells can be reached through tr.cells. */
const COL = { oldSet: 0, index: 1, number: 2, t: 3, symbol: 4, newSet: 5, left: 6, right: 7 };

const tbody = document.querySelector('tbody');

const $ = (selector) => document.querySelector(selector);
const gridInputs = () => Array.from(tbody.querySelectorAll('input'));

const formatDate = (value) => new Date(value).toLocaleString('sk-SK', {
    day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

/** Predvolený názov novej série - rovnaký tvar ako na strane servera. */
const defaultName = () => formatDate(Date.now());

function getRandomInt(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}

/** 1 číslo, 2 – 4 čísla, 0 or 5 and more čísel. */
function countNumbers(count) {
    const word = count === 1 ? 'číslo' : count >= 2 && count <= 4 ? 'čísla' : 'čísel';
    return `${count} ${word}`;
}

function storageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key, value) {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
    } catch { /* storage disabled or full - these are conveniences only */ }
}

/* ------------------------------------------------------------------ *
 * Settings, remembered per browser
 * ------------------------------------------------------------------ */

const SETTING_LIMITS = {
    beepMs: { min: 100, max: 5000, step: 100 },
    volume: { min: 10, max: 100, step: 10 },
};

function loadSettings() {
    const defaults = { sound: true, beepMs: 800, volume: 100, tone: 'soft', bigText: false };
    let stored = {};
    try { stored = JSON.parse(storageGet(SETTINGS_KEY) || '{}') ?? {}; } catch { /* ignore */ }

    // the toggles that came before the settings dialog
    if (!('sound' in stored) && storageGet('unique-numbers:sound') === 'off') stored.sound = false;
    if (!('bigText' in stored) && storageGet('unique-numbers:density') === 'roomy') stored.bigText = true;

    const settings = { ...defaults, ...stored };
    for (const [key, { min, max }] of Object.entries(SETTING_LIMITS)) {
        const value = Math.round(Number(settings[key]));
        settings[key] = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : defaults[key];
    }
    if (settings.tone !== 'sharp') settings.tone = 'soft';
    settings.sound = settings.sound !== false;
    settings.bigText = settings.bigText === true;

    return settings;
}

const settings = loadSettings();

function saveSettings() {
    storageSet(SETTINGS_KEY, JSON.stringify(settings));
}

/* ------------------------------------------------------------------ *
 * Calculation and painting
 * ------------------------------------------------------------------ */

function isValidNumber(value) {
    return /^\d{1,2}$/.test(value) && Number(value) >= MIN_NUMBER && Number(value) <= MAX_NUMBER;
}

/** @returns {(number|null)[]} one entry per row, null for a blank or invalid one. */
function rowValues() {
    return Array.from(tbody.rows, tr => {
        const value = tr.querySelector('input').value;
        return isValidNumber(value) ? Number(value) : null;
    });
}

/** @returns {(number|null)[]} like rowValues(), with trailing blanks trimmed. */
function collectNumbers() {
    const numbers = rowValues();
    while (numbers.length && numbers[numbers.length - 1] === null) numbers.pop();
    return numbers;
}

function paintNote(cell, symbol, note) {
    cell.textContent = symbol;
    cell.className = [symbol && 'has-value', note.bracket && `${note.bracket}-number`, note.color]
        .filter(Boolean).join(' ');
}

let setsRow = null;

function paintSets(sets) {
    if (setsRow) {
        setsRow.cells[COL.oldSet].querySelectorAll('span').forEach(span => { span.textContent = ''; });
        setsRow.cells[COL.newSet].querySelectorAll('span').forEach(span => { span.textContent = ''; });
    }
    setsRow = null;
    $('#printSets').textContent = '';
    if (!sets) return;

    setsRow = tbody.rows[sets.row];
    const [oldLabel, oldValues] = setsRow.cells[COL.oldSet].querySelectorAll('span');
    const [newLabel, newValues] = setsRow.cells[COL.newSet].querySelectorAll('span');
    oldLabel.textContent = 'staré';
    oldValues.textContent = sets.old.join(', ');
    newLabel.textContent = 'nové';
    newValues.textContent = sets.fresh.join(', ');
    $('#printSets').textContent = `Staré: ${sets.old.join(', ')} · Nové: ${sets.fresh.join(', ')}`;
}

/** Writes everything computeSheet() derived into the grid. */
function paint(sheet) {
    const trs = tbody.rows;
    let lastFilled = -1;

    for (let i = 0; i < trs.length; i++) {
        const row = sheet.rows[i];
        const cells = trs[i].cells;
        cells[COL.t].textContent = row.t ?? '';
        cells[COL.symbol].textContent = row.symbol;
        cells[COL.symbol].className = row.symbol === PLUS ? 'plus' : row.symbol === MINUS ? 'minus' : '';
        paintNote(cells[COL.left], row.symbol, row.left);
        paintNote(cells[COL.right], row.symbol, row.right);
        if (row.t !== null) lastFilled = i;
    }

    // the empty rows at the end are only there to type into - they do not print
    for (let i = 0; i < trs.length; i++) trs[i].classList.toggle('is-tail', i > lastFilled);

    paintSets(sheet.sets);
    $('#printCount').textContent = countNumbers(sheet.rows.filter(row => row.t !== null).length);
}

let lastComputed = null;

/**
 * Recomputes the sheet from the numbers in the grid. Cheap to call twice:
 * nothing happens unless a number actually changed.
 *
 * @param {{silent?: boolean}} [options] silent skips the alert, for bulk renders
 *        (loading, generating, clearing) where the pairs are not news.
 */
function recalculate({ silent = false } = {}) {
    const values = rowValues();
    const key = values.join(','); // blanks included, so a new empty row repaints too
    if (key === lastComputed) return;
    lastComputed = key;

    const sheet = computeSheet(values);
    paint(sheet);
    announceRepeats(sheet.repeats, silent);
}

/* ------------------------------------------------------------------ *
 * Rows
 * ------------------------------------------------------------------ */

function rowHtml(index, value) {
    const text = value ?? '';
    return `
        <tr>
            <td name="numbers1-container">
                <div class="relative">
                    <span class="absolute" name="numbers1-poznamka"></span>
                    <span name="numbers1"></span>
                </div>
            </td>
            <td name="length">${index + 1}.</td>
            <td class="col-num"><input type="text" pattern="[0-9]*" inputmode="numeric" enterkeyhint="next"
                autocomplete="off" aria-label="Číslo ${index + 1}" value="${text}"><span name="numberPrint" class="print-only">${text}</span></td>
            <td name="tnumber"></td>
            <td name="symbol"></td>
            <td name="numbers2-container">
                <div class="relative">
                    <span class="absolute" name="numbers2-poznamka"></span>
                    <span name="numbers2"></span>
                </div>
            </td>
            <td name="numbersNote1"></td>
            <td name="numbersNote2"></td>
        </tr>`;
}

/** Appends one empty row and returns its input. */
function renderRow() {
    tbody.insertAdjacentHTML('beforeend', rowHtml(tbody.rows.length, null));
    return tbody.lastElementChild.querySelector('input');
}

/** Replaces every row with the given numbers, plus one empty row to type into. */
function renderRows(numbers) {
    const safe = numbers.map(number => (Number.isInteger(number) ? number : null));
    tbody.innerHTML = safe.map((number, index) => rowHtml(index, number)).join('') + rowHtml(safe.length, null);
    lastComputed = null;
    recalculate({ silent: true });
}

function printMirror(input) {
    return input.closest('td').querySelector('[name="numberPrint"]');
}

function setInputValue(input, value) {
    input.value = value;
    input.classList.toggle('is-invalid', value !== '' && !isValidNumber(value));
    printMirror(input).textContent = value;
}

function onRowInput(input) {
    const digits = input.value.replace(/\D+/g, '');
    if (digits !== input.value) input.value = digits;
    setInputValue(input, input.value);

    // a spare empty row below the one being typed into, so the iPhone keypad's
    // "next field" arrow always has somewhere to go
    if (input.value !== '' && input.closest('tr') === tbody.lastElementChild) renderRow();

    markDirty();
}

/** Enter (or "next" on a phone keypad): take the number and move to the row below. */
function submitRow(input) {
    if (input.value === '') return;
    if (!isValidNumber(input.value)) {
        toast(`Zadajte číslo od ${MIN_NUMBER} do ${MAX_NUMBER}.`, 'warn');
        input.select();
        return;
    }
    setInputValue(input, String(Number(input.value))); // "05" becomes "5"
    recalculate();

    const next = input.closest('tr').nextElementSibling?.querySelector('input') ?? renderRow();
    next.focus();
    const inputs = gridInputs();
    inputs[inputs.length - 5]?.scrollIntoView({ block: 'nearest' });
}

/** Leaving a row (tap elsewhere, "Hotovo" on an iPhone) also takes its number. */
function onRowChange(input) {
    if (isValidNumber(input.value)) setInputValue(input, String(Number(input.value)));
    recalculate();
}

/** Appends another batch of random numbers below whatever is already there. */
function generateNumbers() {
    const existing = collectNumbers();
    const room = MAX_ROWS - existing.length;
    if (room <= 0) return toast(`Dosiahnutý limit ${MAX_ROWS} riadkov.`, 'warn');
    if (!confirm(`Pridať ${Math.min(BATCH_SIZE, room)} náhodných čísel na koniec série?`)) return;

    const batch = Array.from({ length: Math.min(BATCH_SIZE, room) }, () => getRandomInt(MIN_NUMBER, MAX_NUMBER));
    renderRows([...existing, ...batch]);
    markDirty();
    closeDialogs();
    gridInputs()[existing.length]?.scrollIntoView({ block: 'center' });
    toast(`Pridaných ${batch.length} čísel.`);
}

/** Empties the sheet but stays in the current series. */
function clearNumbers() {
    if (collectNumbers().length === 0) return toast('Séria je už prázdna.');
    if (!confirm('Vymazať všetky čísla v tejto sérii?')) return;

    renderRows([]);
    markDirty();
    closeDialogs();
    toast('Čísla sú vymazané.');
}

/* ------------------------------------------------------------------ *
 * Series: saved automatically through api.php
 * ------------------------------------------------------------------ */

const session = { id: boot.session?.id ?? null, updatedAt: boot.session?.updatedAt ?? null };
const saving = { dirty: false, revision: 0, inFlight: null, timer: null, failed: false };

async function api(action, { method = 'GET', params = {}, body } = {}) {
    const query = new URLSearchParams({ action, ...params });
    let response;
    try {
        response = await fetch(`api.php?${query}`, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw new Error('Server je nedostupný. Skontrolujte pripojenie na internet.');
    }

    const data = await response.json().catch(() => ({ error: `Server odpovedal so stavom ${response.status}.` }));
    if (!response.ok || data.ok === false) throw new Error(data.error || 'Požiadavka zlyhala.');

    return data;
}

/** Something changed: keep a local copy right away and save to the server shortly. */
function markDirty() {
    saving.dirty = true;
    saving.revision++;
    saveDraft();
    renderSaveState();
    clearTimeout(saving.timer);
    saving.timer = setTimeout(() => saveNow(), AUTOSAVE_DELAY);
}

/**
 * Saves the series now unless there is nothing new to save.
 *
 * @returns {Promise<boolean>} false when the save failed (it is retried later).
 */
async function saveNow({ announce = false } = {}) {
    clearTimeout(saving.timer);
    // one request at a time: two parallel saves of a new series would create it twice
    while (saving.inFlight) await saving.inFlight;
    if (!saving.dirty) {
        if (announce) toast(session.id ? 'Uložené.' : 'Nie je čo uložiť.');
        return true;
    }

    const numbers = collectNumbers();
    if (numbers.length === 0 && !session.id) {
        // an untouched new series is not worth a file of its own
        saving.dirty = false;
        clearDraft();
        renderSaveState();
        if (announce) toast('Nie je čo uložiť.');
        return true;
    }

    const revision = saving.revision;
    saving.inFlight = api('save', {
        method: 'POST',
        body: { id: session.id, name: $('#sessionName').value, numbers },
    }).then(data => {
        adoptSession(data.session);
        renderSessionList(data.sessions);
        saving.failed = false;
        if (saving.revision === revision) {
            saving.dirty = false;
            clearDraft();
        }
        if (announce) toast('Uložené.');
        return true;
    }).catch(error => {
        // say it once; the button keeps showing it while the retries run
        if (!saving.failed || announce) toast(`Neuložené: ${error.message}`, 'error');
        saving.failed = true;
        clearTimeout(saving.timer);
        saving.timer = setTimeout(() => saveNow(), RETRY_DELAY);
        return false;
    }).finally(() => {
        saving.inFlight = null;
        renderSaveState();
    });

    return saving.inFlight;
}

/**
 * Called before the sheet is replaced by another series. True when it is safe
 * to go on: saved, or the person agreed to drop the unsaved changes.
 */
async function leaveCurrentSeries() {
    if (await saveNow()) return true;
    return confirm('Posledné zmeny sa nepodarilo uložiť. Ak budete pokračovať, stratia sa. Pokračovať?');
}

function renderSaveState() {
    const button = $('#saveState');
    let state = 'saved';
    if (saving.inFlight || (saving.dirty && !saving.failed)) state = 'saving';
    else if (saving.failed) state = 'error';
    else if (!session.id) state = 'new';

    const labels = { new: 'Uložiť', saving: 'Ukladám…', saved: '✓ Uložené', error: '⚠ Neuložené' };
    button.dataset.state = state;
    button.textContent = labels[state];
    button.title = state === 'error'
        ? 'Nepodarilo sa uložiť. Ťuknite pre nový pokus.'
        : 'Séria sa ukladá automaticky po každom čísle.';
    $('#sessionMeta').textContent = state === 'saved' && session.updatedAt
        ? `uložené ${formatDate(session.updatedAt)}`
        : state === 'new' ? 'neuložené' : '';
}

/** Takes over what the server saved, without disturbing what is being typed. */
function adoptSession(data) {
    session.id = data.id;
    session.updatedAt = data.updatedAt;
    const name = $('#sessionName');
    // an empty name was filled in by the server - show it unless the field is being edited
    if (name.value.trim() === '' && document.activeElement !== name) {
        name.value = data.name;
        $('#printName').textContent = data.name;
    }
    document.title = `Unikátne čísla · ${data.name}`;
    history.replaceState(null, '', `?s=${data.id}`);
    storageSet(LAST_KEY, data.id);
    highlightCurrentSession();
}

/** Shows a series loaded from the server. */
function showSession(data) {
    adoptSession(data);
    $('#sessionName').value = data.name;
    $('#printName').textContent = data.name;
    saving.dirty = false;
    saving.failed = false;
    renderRows(data.numbers ?? []);
    renderSaveState();
}

async function openSession(id) {
    if (!(await leaveCurrentSeries())) return;

    try {
        const data = await api('load', { params: { id } });
        clearDraft();
        showSession(data.session);
        closeDialogs();
        toast(`Otvorená séria „${data.session.name}“.`);
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function deleteSession(id, name) {
    if (!confirm(`Vymazať sériu „${name}“? Túto akciu nie je možné vrátiť späť.`)) return;

    if (session.id === id) {
        // a save still on its way would bring the series straight back
        clearTimeout(saving.timer);
        while (saving.inFlight) await saving.inFlight;
    }

    try {
        const data = await api('delete', { method: 'POST', body: { id } });
        renderSessionList(data.sessions);
        if (storageGet(LAST_KEY) === id) storageSet(LAST_KEY, null);
        // the series on screen is gone - start a fresh one rather than resurrect it on the next save
        if (session.id === id) startNewSession();
        toast('Vymazané.');
    } catch (error) {
        toast(error.message, 'error');
        if (saving.dirty) saving.timer = setTimeout(() => saveNow(), AUTOSAVE_DELAY);
    }
}

async function newSession() {
    if (!(await leaveCurrentSeries())) return;
    startNewSession();
    toast('Nová séria.');
}

function startNewSession() {
    const name = defaultName();
    session.id = null;
    session.updatedAt = null;
    saving.dirty = false;
    saving.failed = false;
    clearTimeout(saving.timer);
    $('#sessionName').value = name;
    $('#printName').textContent = name;
    document.title = 'Unikátne čísla';
    history.replaceState(null, '', location.pathname);
    storageSet(LAST_KEY, null);
    clearDraft();
    renderRows([]);
    renderSaveState();
    highlightCurrentSession();
    closeDialogs();
    gridInputs()[0]?.focus();
}

function renderSessionList(sessions) {
    const list = $('#sessionList');
    $('#sessionCount').textContent = sessions.length;
    list.replaceChildren();

    if (sessions.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'sessions__empty';
        empty.textContent = 'Zatiaľ nemáte uložené žiadne série.';
        list.append(empty);
        return;
    }

    sessions.forEach(item => {
        const li = document.createElement('li');
        li.className = 'sessions__item';
        li.dataset.id = item.id;

        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'sessions__open';
        open.addEventListener('click', () => openSession(item.id));

        const name = document.createElement('span');
        name.className = 'sessions__name';
        name.textContent = item.name;

        const meta = document.createElement('span');
        meta.className = 'sessions__meta';
        meta.textContent = `${countNumbers(item.filled ?? item.rows)} · ${formatDate(item.updatedAt)}`;

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn btn--icon btn--danger';
        remove.title = 'Vymazať';
        remove.setAttribute('aria-label', `Vymazať sériu ${item.name}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => deleteSession(item.id, item.name));

        open.append(name, meta);
        li.append(open, remove);
        list.append(li);
    });

    highlightCurrentSession();
}

/** Marks the series on screen in the list - it changes without the list being redrawn. */
function highlightCurrentSession() {
    document.querySelectorAll('.sessions__item').forEach(li => {
        li.classList.toggle('is-current', li.dataset.id === session.id);
    });
}

/* ------------------------------------------------------------------ *
 * Local draft: unsaved changes survive a reload or a lost connection
 * ------------------------------------------------------------------ */

function saveDraft() {
    storageSet(DRAFT_KEY, JSON.stringify({
        id: session.id,
        name: $('#sessionName').value,
        numbers: collectNumbers(),
    }));
}

function clearDraft() {
    storageSet(DRAFT_KEY, null);
}

function readDraft() {
    try {
        const draft = JSON.parse(storageGet(DRAFT_KEY) || 'null');
        return Array.isArray(draft?.numbers) ? draft : null;
    } catch {
        return null;
    }
}

/* ------------------------------------------------------------------ *
 * Alert: a beep when a second pair of the same colour is marked
 * ------------------------------------------------------------------ */

let audioContext = null;
let currentBeep = null;
let idleTimer;
/** Repeats already announced, so an existing one never beeps twice. */
let knownRepeats = new Set();

function audio() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;

    if (!audioContext) {
        // on an iPhone, Web Audio is silenced by the ringer switch unless it asks for playback
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* ignore */ }
        audioContext = new Ctor();
    }
    clearTimeout(idleTimer);
    // browsers keep the context suspended until a gesture; typing a number is one
    if (audioContext.state !== 'running') audioContext.resume().catch(() => {});

    return audioContext;
}

/** Between beeps the phone's audio goes back to other apps, so music is not held paused. */
function idleAudio() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        if (!currentBeep && audioContext?.state === 'running') audioContext.suspend().catch(() => {});
    }, 500);
}

function stopBeep() {
    if (!currentBeep) return;
    const { oscillator, gain, context } = currentBeep;
    currentBeep = null;
    try {
        gain.gain.cancelScheduledValues(context.currentTime);
        gain.gain.setTargetAtTime(0, context.currentTime, 0.01);
        oscillator.stop(context.currentTime + 0.05);
    } catch { /* already stopped */ }
}

/** A steady tone for the whole length, with short fades so it does not click. */
function beep({ ms = settings.beepMs, volume = settings.volume, tone = settings.tone } = {}) {
    try {
        const context = audio();
        if (!context) return;
        stopBeep();

        const now = context.currentTime;
        const seconds = ms / 1000;
        // a square wave sounds much louder at the same level; its overshoot needs a little headroom
        const peak = Math.max(0.001, (volume / 100) * (tone === 'sharp' ? 0.8 : 1));
        const attack = 0.01;
        const release = Math.min(0.06, seconds / 4);

        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = tone === 'sharp' ? 'square' : 'sine';
        oscillator.frequency.value = 1500;

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(peak, now + attack);
        gain.gain.setValueAtTime(peak, now + seconds - release);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

        oscillator.connect(gain).connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + seconds + 0.02);

        const beepRef = { oscillator, gain, context };
        currentBeep = beepRef;
        oscillator.onended = () => {
            if (currentBeep === beepRef) currentBeep = null;
            oscillator.disconnect();
            gain.disconnect();
            idleAudio();
        };
    } catch { /* no audio available - the sheet still works */ }
}

/** Alerts once when repeats appear that were not on the sheet before. */
function announceRepeats(repeats, silent) {
    const isNew = repeats.some(id => !knownRepeats.has(id));
    knownRepeats = new Set(repeats);
    if (!isNew || silent) return;

    if (settings.sound) beep();
    toast('Pozor: druhá dvojica rovnakej farby za sebou.', 'signal');
}

/* ------------------------------------------------------------------ *
 * Settings dialog
 * ------------------------------------------------------------------ */

let previewTimer;

/** Lets the change be heard right away, but not once per rapid tap. */
function previewBeep() {
    audio(); // wake the audio inside the tap - an iPhone refuses it a moment later
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => beep(), 250);
}

function renderSettings() {
    $('#soundOn').checked = settings.sound;
    $('#beepMs').value = settings.beepMs;
    $('#beepSeconds').textContent = `${(settings.beepMs / 1000).toLocaleString('sk-SK')} s`;
    $('#volume').value = settings.volume;
    document.querySelectorAll('input[name="tone"]').forEach(radio => { radio.checked = radio.value === settings.tone; });
    $('#bigText').checked = settings.bigText;
    document.querySelector('.settings__sound').classList.toggle('is-off', !settings.sound);
    document.body.classList.toggle('is-big', settings.bigText);
}

function setNumberSetting(key, value) {
    const { min, max } = SETTING_LIMITS[key];
    const number = Math.round(Number(value));
    settings[key] = Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : settings[key];
    saveSettings();
    renderSettings();
}

function bindSettings() {
    $('#soundOn').addEventListener('change', (event) => {
        settings.sound = event.target.checked;
        saveSettings();
        renderSettings();
        if (settings.sound) previewBeep();
    });

    document.querySelectorAll('[data-step]').forEach(button => {
        button.addEventListener('click', () => {
            const key = button.dataset.setting;
            setNumberSetting(key, settings[key] + Number(button.dataset.step) * SETTING_LIMITS[key].step);
            if (settings.sound) previewBeep();
        });
    });

    ['beepMs', 'volume'].forEach(key => {
        $(`#${key}`).addEventListener('change', (event) => {
            setNumberSetting(key, event.target.value);
            if (settings.sound) previewBeep();
        });
    });

    document.querySelectorAll('input[name="tone"]').forEach(radio => {
        radio.addEventListener('change', () => {
            settings.tone = radio.value;
            saveSettings();
            if (settings.sound) previewBeep();
        });
    });

    $('#bigText').addEventListener('change', (event) => {
        settings.bigText = event.target.checked;
        saveSettings();
        renderSettings();
    });
}

/* ------------------------------------------------------------------ *
 * Chrome: toast, dialogs, printing
 * ------------------------------------------------------------------ */

let toastTimer;

function toast(message, kind = 'ok') {
    const element = $('#toast');
    element.textContent = message;
    element.className = `toast toast--${kind} is-visible`;
    // the top of what is actually visible, even with a phone keyboard open
    element.style.top = `${(window.visualViewport?.offsetTop ?? 0) + 10}px`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('is-visible'), kind === 'error' ? 6000 : 3500);
}

function closeDialogs() {
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
}

/** Brings the plain-text copies the print uses up to date, including a number typed but not yet entered. */
function syncPrintMirrors() {
    gridInputs().forEach(input => { printMirror(input).textContent = input.value; });
    $('#printName').textContent = $('#sessionName').value.trim() || UNTITLED;
    recalculate({ silent: true });
}

const actions = {
    save: () => saveNow({ announce: true }),
    'new-session': newSession,
    open: () => $('#sessionsDialog').showModal(),
    print: () => { syncPrintMirrors(); window.print(); },
    settings: () => { renderSettings(); $('#settingsDialog').showModal(); },
    'close-dialog': closeDialogs,
    'test-sound': () => beep(),
    generate: generateNumbers,
    clear: clearNumbers,
};

/* ------------------------------------------------------------------ *
 * Start-up
 * ------------------------------------------------------------------ */

document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action && actions[action]) actions[action]();
});

// a tap on the dimmed backdrop, outside the dialog's box, closes it
document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        const inside = event.clientX >= box.left && event.clientX <= box.right
            && event.clientY >= box.top && event.clientY <= box.bottom;
        if (!inside) dialog.close();
    });
});

document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveNow({ announce: true });
    }
});

$('#sessionName').addEventListener('input', (event) => {
    $('#printName').textContent = event.target.value.trim() || UNTITLED;
    markDirty();
});

tbody.addEventListener('input', (event) => {
    if (event.target instanceof HTMLInputElement) onRowInput(event.target);
});

tbody.addEventListener('change', (event) => {
    if (event.target instanceof HTMLInputElement) onRowChange(event.target);
});

// typing over a number replaces it, the way a spreadsheet cell does
tbody.addEventListener('focusin', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    input.select();
    // a click would otherwise collapse the selection again on mouseup
    input.addEventListener('mouseup', (e) => e.preventDefault(), { once: true });
});

const isEnter = (event) => event.key === 'Enter' || event.keyCode === 13;
let enterHandled = false;

tbody.addEventListener('keydown', (event) => {
    if (!isEnter(event) || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    enterHandled = true;
    submitRow(event.target);
});

tbody.addEventListener('keyup', (event) => {
    if (!isEnter(event)) return;
    // some phone keyboards only report Enter on keyup
    if (!enterHandled && event.target instanceof HTMLInputElement) submitRow(event.target);
    enterHandled = false;
});

window.addEventListener('beforeprint', syncPrintMirrors);
window.addEventListener('online', () => { if (saving.dirty) saveNow(); });

// the first touch or key press unlocks audio, so the first beep is not lost
const unlockAudio = () => {
    if (!settings.sound) return;
    audio();
    idleAudio();
};
document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
document.addEventListener('keydown', unlockAudio, { once: true, capture: true });

bindSettings();
renderSettings();
renderSessionList(boot.sessions ?? []);

/** Unsaved changes from last time: put them back on the sheet and save them. */
function restoreDraft(draft) {
    const name = draft.name?.trim() || defaultName();
    session.id = draft.id ?? null;
    $('#sessionName').value = name;
    $('#printName').textContent = name;
    renderRows(draft.numbers);
    markDirty();
}

/** Unsaved changes of a series other than the one being opened: save them quietly. */
function rescueDraft(draft) {
    const raw = storageGet(DRAFT_KEY);
    if (!draft.id && draft.numbers.length === 0) return clearDraft();

    api('save', { method: 'POST', body: { id: draft.id, name: draft.name, numbers: draft.numbers } })
        .then(data => {
            renderSessionList(data.sessions);
            // saved - unless something newer was typed meanwhile, the draft has done its job
            // (left in place, a draft without an id would become one more series on every reload)
            if (storageGet(DRAFT_KEY) === raw) clearDraft();
        })
        .catch(() => { /* kept: it is tried again the next time the page opens */ });
}

(function start() {
    const draft = readDraft();
    const lastId = storageGet(LAST_KEY);

    if (boot.session) {
        if (draft?.id === boot.session.id) {
            restoreDraft(draft);
        } else {
            if (draft) rescueDraft(draft);
            showSession(boot.session);
        }
    } else if (draft) {
        restoreDraft(draft);
    } else if (!boot.missing && lastId && (boot.sessions ?? []).some(item => item.id === lastId)) {
        // reopen the series from last time, as an app would - with no row to type into until it
        // is there, or a number typed on a slow connection would vanish when it arrives
        renderSaveState();
        api('load', { params: { id: lastId } })
            .then(data => showSession(data.session))
            .catch(() => {
                storageSet(LAST_KEY, null);
                renderRows([]);
            });
    } else {
        renderRows([]);
        renderSaveState();
    }

    if (boot.missing) toast('Táto séria už neexistuje.', 'warn');
})();
