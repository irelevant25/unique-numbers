/* ------------------------------------------------------------------ *
 * Configuration and small helpers
 * ------------------------------------------------------------------ */

const boot = JSON.parse(document.getElementById('bootstrapData')?.textContent || '{}');

const MIN_NUMBER = boot.min ?? 0;
const MAX_NUMBER = boot.max ?? 36;
const MAX_ROWS = boot.maxRows ?? 2000;
const UNIQUE_COUNT = 6;
const BATCH_SIZE = 25;
const ALL_UNIQUE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const DRAFT_KEY = 'unique-numbers:draft';
const DENSITY_KEY = 'unique-numbers:density';
const UNTITLED = 'Séria bez názvu';

const tbody = document.querySelector('tbody');

const rows = () => document.querySelectorAll('tbody > tr');
const gridInputs = () => document.querySelectorAll('tbody input');
const $ = (selector) => document.querySelector(selector);

const formatDate = (value) => new Date(value).toLocaleString('sk-SK', {
    day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

/** Predvolený názov novej série - rovnaký tvar ako na strane servera. */
const defaultName = () => formatDate(Date.now());

function getRandomInt(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}

/* ------------------------------------------------------------------ *
 * Calculation
 * ------------------------------------------------------------------ */

function previousUniqueNumbers(inputIndex) {
    const tnumbers = document.querySelectorAll('[name="tnumber"]');
    const uniqueNumbers = new Set();

    for (let i = inputIndex - 1; i >= 0; i--) {
        if (uniqueNumbers.size === UNIQUE_COUNT) break;
        const number = Number(tnumbers[i].textContent);
        if (number === 0) continue;
        uniqueNumbers.add(number);
    }

    if (uniqueNumbers.size < UNIQUE_COUNT) return null;
    return Array.from(uniqueNumbers);
}

function previousUniqueNumbersComplement(inputNumbers) {
    if (!inputNumbers) return null;
    return ALL_UNIQUE_NUMBERS.filter(x => !inputNumbers.includes(x));
}

function transformNumber(number) {
    return Math.ceil(number / 3);
}

/** Wipes everything derived from the inputs so a recalculation never inherits stale marks. */
function clearDerivedState() {
    rows().forEach(row => {
        const symbol = row.querySelector('[name="symbol"]');
        symbol.textContent = '';
        symbol.classList.remove('plus', 'minus');

        row.querySelectorAll('[name="numbersNote1"], [name="numbersNote2"]').forEach(note => {
            note.textContent = '';
            note.classList.remove('has-value', 'top-number', 'bottom-number', 'blue', 'gray');
        });

        row.querySelector('[name="numbers1"]').textContent = '';
        row.querySelector('[name="numbers2"]').textContent = '';
        row.querySelector('[name="numbers1-poznamka"]').textContent = '';
        row.querySelector('[name="numbers2-poznamka"]').textContent = '';
    });
}

function recalculateTNumbers() {
    clearDerivedState();

    let renderedUniqueNumbers = false;
    const allRows = rows();

    allRows.forEach((row, index) => {
        const numberCell = row.querySelector('input');
        const tNumberCell = row.querySelector('[name="tnumber"]');
        const symbolCell = row.querySelector('[name="symbol"]');
        const numbersNote1 = row.querySelector('[name="numbersNote1"]');
        const numbersNote2 = row.querySelector('[name="numbersNote2"]');
        const number = Number(numberCell.value);
        const tnumber = transformNumber(number);
        tNumberCell.textContent = tnumber;
        row.querySelector('[name="numberPrint"]').textContent = numberCell.value;

        const uniqueNumbers = previousUniqueNumbers(index);
        if (uniqueNumbers) {
            const isIncludes = uniqueNumbers.includes(tnumber);
            symbolCell.textContent = tnumber === 0 ? '0' : isIncludes ? '-' : '+';
            numbersNote1.textContent = symbolCell.textContent;
            numbersNote2.textContent = symbolCell.textContent;
            numbersNote1.classList.add('has-value');
            numbersNote2.classList.add('has-value');
            if (symbolCell.textContent === '-') symbolCell.classList.add('minus');
            else if (symbolCell.textContent === '+') symbolCell.classList.add('plus');
        }

        if (!renderedUniqueNumbers && (index === allRows.length - 1 || numberCell.value === '')) {
            renderedUniqueNumbers = true;
            const rowIndex = index === allRows.length - 1
                ? index
                : Number(row.querySelector('td[name="length"]').textContent) - 1;
            const targetRow = allRows[rowIndex];
            if (targetRow) {
                targetRow.querySelector('[name="numbers1-poznamka"]').textContent = 'staré';
                targetRow.querySelector('[name="numbers2-poznamka"]').textContent = 'nové';

                const uniqueNumbers = previousUniqueNumbers(index + 1);
                targetRow.querySelector('[name="numbers1"]').textContent =
                    uniqueNumbers?.sort((a, b) => a - b).join(', ') ?? '';
                targetRow.querySelector('[name="numbers2"]').textContent =
                    previousUniqueNumbersComplement(uniqueNumbers)?.sort((a, b) => a - b).join(', ') ?? '';
            }
        }
    });

    const numbersNote1WithValueElements = document.querySelectorAll('td[name="numbersNote1"].has-value');
    numbersNote1WithValueElements.forEach((element, index) => {
        if (index === numbersNote1WithValueElements.length - 1 && index % 2 === 0) return;
        if (index % 4 !== 0 && index % 4 !== 1) return;
        if (index % 2 === 0) element.classList.add('top-number');
        else element.classList.add('bottom-number');
    });

    const numbersNote2WithValueElements = document.querySelectorAll('td[name="numbersNote2"].has-value');
    numbersNote2WithValueElements.forEach((element, index) => {
        if (index === 0 || index === numbersNote2WithValueElements.length - 1 && index % 2 !== 0) return;
        if (index % 4 !== 1 && index % 4 !== 2) return;
        if (index % 2 === 0) element.classList.add('bottom-number');
        else element.classList.add('top-number');
    });

    generatePairing();
    saveDraft();
}

function samePair(a, b) {
    return a.textContent === b.textContent || a.textContent === '0' || b.textContent === '0';
}

function markPairs(elements, startIndex) {
    for (let i = startIndex; i < elements.length; i += 4) {
        const [e1, e2, e3, e4, e5, e6, e7, e8] = elements.slice(i, i + 8);
        // 1-2 => 5-6
        if (!e1 || !e2 || !e5 || !e6) continue;
        if (samePair(e1, e5) && samePair(e2, e6)) {
            [e1, e2, e5, e6].forEach(element => element.classList.add('blue'));
        }
        // 3-4 => 7-8
        if (!e3 || !e4 || !e7 || !e8) continue;
        if (samePair(e3, e7) && samePair(e4, e8)) {
            [e3, e4, e7, e8].forEach(element => element.classList.add('gray'));
        }
    }
}

function generatePairing() {
    const leftElements = Array.from(document.querySelectorAll('[name="numbersNote1"]')).filter(x => x.textContent !== '');
    const rightElements = Array.from(document.querySelectorAll('[name="numbersNote2"]')).filter(x => x.textContent !== '');

    // if not enough elements in any of col => return
    if (leftElements.length < UNIQUE_COUNT || rightElements.length < UNIQUE_COUNT) return;

    markPairs(leftElements, 0);
    // right col is shifted by one row (posunute o jeden riadok)
    markPairs(rightElements, 1);
}

/* ------------------------------------------------------------------ *
 * Rows
 * ------------------------------------------------------------------ */

function isValidNumber(value, minNumber, maxNumber) {
    return !(value < minNumber || value > maxNumber || isNaN(value) || value.includes('.') || value.includes(',') || value === '');
}

function renderRow(initNumber) {
    const index = rows().length;
    const rowHtml = `
        <tr>
            <td name="numbers1-container">
                <div class="relative">
                    <span class="absolute" name="numbers1-poznamka"></span>
                    <span name="numbers1"></span>
                </div>
            </td>
            <td name="length">${index + 1}.</td>
            <td class="col-num"><input type="text" step="1" pattern="[0-9]+" inputmode="numeric" enterkeyhint="next"
                aria-label="Číslo ${index + 1}" min="${MIN_NUMBER}" max="${MAX_NUMBER}"
                value="${initNumber ?? ''}"><span name="numberPrint" class="print-only"></span></td>
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
        </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', rowHtml);

    const input = gridInputs()[index];
    input.addEventListener('keyup', (event) => {
        // 13 - enter
        if (event.keyCode === 13) {
            if (!isValidNumber(input.value, MIN_NUMBER, MAX_NUMBER)) return;
            recalculateTNumbers();
            let nextInput;
            if (index === gridInputs().length - 1) nextInput = renderRow();
            else nextInput = gridInputs()[index + 1];
            nextInput.focus();
            const inputs = gridInputs();
            inputs[inputs.length - 5]?.scrollIntoView({ block: 'nearest' });
        }
    });
    input.addEventListener('input', () => {
        if (!isValidNumber(input.value, MIN_NUMBER, MAX_NUMBER)) input.value = '';
        input.closest('tr').querySelector('[name="numberPrint"]').textContent = input.value;
        saveDraft();
    });

    return input;
}

/** Replaces every row with the given numbers, plus one empty row to type into. */
function renderRows(numbers) {
    tbody.replaceChildren();
    numbers.forEach(number => renderRow(number ?? undefined));
    // recalculate first: the unique-number sets belong on the last filled row,
    // exactly where they land when the rows are typed in one at a time
    recalculateTNumbers();
    renderRow();
}

/** @returns {(number|null)[]} one entry per row, null for a blank one, trailing blanks trimmed. */
function collectNumbers() {
    const numbers = Array.from(gridInputs(), input => input.value === '' ? null : Number(input.value));
    while (numbers.length && numbers[numbers.length - 1] === null) numbers.pop();
    return numbers;
}

/** Appends another batch of random numbers below whatever is already there. */
function generateNumber() {
    const existing = collectNumbers();
    const room = MAX_ROWS - existing.length;
    if (room <= 0) return toast(`Dosiahnutý limit ${MAX_ROWS} riadkov.`, 'warn');

    const batch = Array.from({ length: Math.min(BATCH_SIZE, room) }, () => getRandomInt(MIN_NUMBER, MAX_NUMBER));
    renderRows([...existing, ...batch]);
    gridInputs()[existing.length]?.scrollIntoView({ block: 'center' });
    toast(`Pridaných ${batch.length} čísel.`);
}

/** Empties the sheet but stays in the current series. */
function clearNumbers() {
    if (collectNumbers().length === 0) return;
    if (!confirm('Vyčistiť všetky čísla?')) return;

    renderRows([]);
    clearDraft();
    toast('Vyčistené.');
}

/* ------------------------------------------------------------------ *
 * Series: saving and loading through api.php
 * ------------------------------------------------------------------ */

const session = { id: boot.session?.id ?? null };

async function api(action, { method = 'GET', params = {}, body } = {}) {
    const query = new URLSearchParams({ action, ...params });
    const response = await fetch(`api.php?${query}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({ error: `Server odpovedal so stavom ${response.status}.` }));
    if (!response.ok || data.ok === false) throw new Error(data.error || 'Požiadavka zlyhala.');

    return data;
}

async function saveSession() {
    const numbers = collectNumbers();
    if (numbers.length === 0) return toast('Nie je čo uložiť.', 'warn');
    if (numbers.length > MAX_ROWS) return toast(`Príliš veľa riadkov (max ${MAX_ROWS}).`, 'warn');

    try {
        const data = await api('save', {
            method: 'POST',
            body: { id: session.id, name: $('#sessionName').value, numbers },
        });
        applySession(data.session, { rerender: false });
        renderSessionList(data.sessions);
        clearDraft();
        toast('Uložené.');
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function openSession(id) {
    try {
        const data = await api('load', { params: { id } });
        applySession(data.session);
        clearDraft();
        $('#sessionsDialog').close();
        toast(`Načítaná séria „${data.session.name}“.`);
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function deleteSession(id, name) {
    if (!confirm(`Vymazať sériu „${name}“? Túto akciu nie je možné vrátiť späť.`)) return;

    try {
        const data = await api('delete', { method: 'POST', body: { id } });
        if (session.id === id) session.id = null;
        renderSessionList(data.sessions);
        toast('Vymazané.');
    } catch (error) {
        toast(error.message, 'error');
    }
}

function applySession(data, { rerender = true } = {}) {
    session.id = data.id;
    $('#sessionName').value = data.name;
    $('#printName').textContent = data.name;
    $('#sessionMeta').textContent = formatDate(data.updatedAt);
    history.replaceState(null, '', `?s=${data.id}`);
    if (rerender) renderRows(data.numbers ?? []);
}

function newSession() {
    const name = defaultName();
    session.id = null;
    $('#sessionName').value = name;
    $('#printName').textContent = name;
    $('#sessionMeta').textContent = 'neuložené';
    history.replaceState(null, '', location.pathname);
    clearDraft();
    renderRows([]);
    $('#sessionsDialog').close();
    toast('Nová séria.');
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
        li.className = 'sessions__item' + (item.id === session.id ? ' is-current' : '');

        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'sessions__open';
        open.addEventListener('click', () => openSession(item.id));

        const name = document.createElement('span');
        name.className = 'sessions__name';
        name.textContent = item.name;

        const meta = document.createElement('span');
        meta.className = 'sessions__meta';
        meta.textContent = `${item.filled ?? item.rows} čísel · ${formatDate(item.updatedAt)}`;

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
}

/* ------------------------------------------------------------------ *
 * Local draft, so a reload never loses unsaved work
 * ------------------------------------------------------------------ */

let draftTimer;

function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
        try {
            const numbers = collectNumbers();
            if (numbers.length === 0) return clearDraft();
            localStorage.setItem(DRAFT_KEY, JSON.stringify({
                id: session.id,
                name: $('#sessionName').value,
                numbers,
            }));
        } catch { /* storage disabled or full - drafts are a convenience only */ }
    }, 400);
}

function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

function readDraft() {
    try {
        const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        return Array.isArray(draft?.numbers) ? draft : null;
    } catch {
        return null;
    }
}

/* ------------------------------------------------------------------ *
 * Chrome: toast, printing, density
 * ------------------------------------------------------------------ */

let toastTimer;

function toast(message, kind = 'ok') {
    const element = $('#toast');
    element.textContent = message;
    element.className = `toast toast--${kind} is-visible`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('is-visible'), 2600);
}

function syncPrintMirrors() {
    rows().forEach(row => {
        row.querySelector('[name="numberPrint"]').textContent = row.querySelector('input').value;
    });
    $('#printName').textContent = $('#sessionName').value.trim() || UNTITLED;
}

function toggleDensity(force) {
    const roomy = force ?? !document.body.classList.contains('is-roomy');
    document.body.classList.toggle('is-roomy', roomy);
    $('[data-action="density"]').setAttribute('aria-pressed', String(roomy));
    try { localStorage.setItem(DENSITY_KEY, roomy ? 'roomy' : 'compact'); } catch { /* ignore */ }
}

const actions = {
    generate: generateNumber,
    clear: clearNumbers,
    save: saveSession,
    open: () => $('#sessionsDialog').showModal(),
    'close-dialog': () => $('#sessionsDialog').close(),
    'new-session': newSession,
    print: () => { syncPrintMirrors(); window.print(); },
    density: () => toggleDensity(),
};

/* ------------------------------------------------------------------ *
 * Start-up
 * ------------------------------------------------------------------ */

document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action && actions[action]) actions[action]();
});

document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveSession();
    }
});

document.addEventListener('input', (event) => {
    if (event.target.id === 'sessionName') {
        $('#printName').textContent = event.target.value.trim() || UNTITLED;
        saveDraft();
    }
});

window.addEventListener('beforeprint', syncPrintMirrors);

let storedDensity = null;
try { storedDensity = localStorage.getItem(DENSITY_KEY); } catch { /* ignore */ }
toggleDensity(storedDensity === 'roomy');

renderSessionList(boot.sessions ?? []);

if (boot.session) {
    applySession(boot.session);
} else {
    const draft = readDraft();
    if (draft) {
        const name = draft.name?.trim() || defaultName();
        session.id = draft.id ?? null;
        $('#sessionName').value = name;
        $('#printName').textContent = name;
        renderRows(draft.numbers);
        toast('Obnovený neuložený koncept.');
    } else {
        renderRow();
    }
}

if (boot.missing) toast('Táto séria už neexistuje.', 'warn');
