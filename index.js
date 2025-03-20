function getRandomInt(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}

function previousUniqueNumbers(inputIndex) {
    const tnumbers = document.querySelectorAll('[name="tnumber"]');
    const uniqueNumbers = new Set();

    for (let i = inputIndex - 1; i >= 0; i--) {
        if (uniqueNumbers.size === 6) break;
        const number = Number(tnumbers[i].textContent);
        if (number === 0) continue;
        uniqueNumbers.add(Number(tnumbers[i].textContent));
    }

    if (uniqueNumbers.size < 6) return null;
    return Array.from(uniqueNumbers);
}

function previousUniqueNumbersComplement(inputNumbers) {
    if (!inputNumbers) return null;
    const allUniqueNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const result = allUniqueNumbers.filter(x => !inputNumbers.includes(x));
    return result;
}

function transformNumber(number) {
    return Math.ceil(number / 3);
}

function recalculateTNumbers() {
    let renderedUniqueNumbers = false;
    const rows = document.querySelectorAll('tbody > tr');
    rows.forEach((row, index) => {
        const numberCell = row.querySelector('input');
        const tNumberCell = row.querySelector('[name="tnumber"]');
        const symbolCell = row.querySelector('[name="symbol"]');
        const numbersNote1 = row.querySelector('[name="numbersNote1"]');
        const numbersNote2 = row.querySelector('[name="numbersNote2"]');
        const number = Number(numberCell.value);
        const tnumber = transformNumber(number);
        tNumberCell.textContent = tnumber;
        const uniqueNumbers = previousUniqueNumbers(index);
        if (uniqueNumbers && tnumber !== 0) {
            const isIncludes = uniqueNumbers.includes(tnumber);
            symbolCell.textContent = isIncludes ? '-' : '+';
            numbersNote1.textContent = symbolCell.textContent;
            numbersNote2.textContent = symbolCell.textContent;
            symbolCell.classList.remove('plus');
            symbolCell.classList.remove('minus');
            if (isIncludes) symbolCell.classList.add('minus');
            else symbolCell.classList.add('plus');
        }

        if (!renderedUniqueNumbers && (index === rows.length - 1 || numberCell.value === '')) {
            document.querySelectorAll('[name="numbers1"]').forEach(td => td.textContent = '');
            document.querySelectorAll('[name="numbers2"]').forEach(td => td.textContent = '');
            renderedUniqueNumbers = true;
            const rowIndex = index === rows.length - 1 ? index : numberCell.getAttribute('data-index');
            const row = document.querySelectorAll('tbody > tr')[rowIndex];
            if (row) {
                const numbers1 = row.querySelector('[name="numbers1"]');
                const numbers2 = row.querySelector('[name="numbers2"]');
                const uniqueNumbers = previousUniqueNumbers(index);
                numbers1.textContent = uniqueNumbers?.sort((a, b) => a - b).join(', ');
                numbers2.textContent = previousUniqueNumbersComplement(uniqueNumbers)?.sort((a, b) => a - b).join(', ');
            }
        }
    });
    generatePairing();
}

function generatePairing(firstCol = true) {
    let elements;
    if (firstCol) elements = Array.from(document.querySelectorAll('[name="numbersNote1"]')).filter(x => x.textContent !== '');
    else elements = Array.from(document.querySelectorAll('[name="numbersNote2"]')).filter(x => x.textContent !== '');

    elements.forEach(element => {
        element.classList.remove('plus');
        element.classList.remove('minus');
    });

    let startIndex = firstCol ? 0 : 1;
    pairs = [];
    for (let i = startIndex; i < elements.length; i += 4) {
        if (elements.length <= i + 1) break;
        pairs.push(elements[i]);
        pairs.push(elements[i + 1]);
    }
    if (pairs.length < 4) {
        if (firstCol) generatePairing(false);
        return;
    }

    let element1 = pairs[pairs.length - 4];
    let element2 = pairs[pairs.length - 3];
    let element3 = pairs[pairs.length - 2];
    let element4 = pairs[pairs.length - 1];

    if (element1.textContent === element3.textContent && element2.textContent === element4.textContent) {
        element1.classList.add(element1.textContent === '+' ? 'plus' : 'minus');
        element2.classList.add(element2.textContent === '+' ? 'plus' : 'minus');
        element3.classList.add(element3.textContent === '+' ? 'plus' : 'minus');
        element4.classList.add(element4.textContent === '+' ? 'plus' : 'minus');
    }
    else {
        if (firstCol) generatePairing(false);
        return;
    }

    pairs = [];
    for (let i = startIndex + 2; i < elements.length; i += 4) {
        if (elements.length <= i + 1) break;
        pairs.push(elements[i]);
        pairs.push(elements[i + 1]);
    }
    if (pairs.length < 4) {
        if (firstCol) generatePairing(false);
        return;
    }

    element1 = pairs[pairs.length - 4];
    element2 = pairs[pairs.length - 3];
    element3 = pairs[pairs.length - 2];
    element4 = pairs[pairs.length - 1];

    if (element1.textContent === element3.textContent && element2.textContent === element4.textContent || element1.textContent !== element3.textContent && element2.textContent !== element4.textContent) {
        element1.classList.add(element1.textContent === '+' ? 'plus' : 'minus');
        element2.classList.add(element2.textContent === '+' ? 'plus' : 'minus');
        element3.classList.add(element3.textContent === '+' ? 'plus' : 'minus');
        element4.classList.add(element4.textContent === '+' ? 'plus' : 'minus');
    }
    if (firstCol) generatePairing(false);
}

function isValidNumber(value, minNumber, maxNumber) {
    return !(value < minNumber || value > maxNumber || isNaN(value) || value.includes('.') || value.includes(',') || value === '');
}

function renderRow(initNumber) {
    const minNumber = 0;
    const maxNumber = 36;
    const index = document.querySelectorAll('input').length;
    const tbody = document.querySelector('tbody');
    const rowHtml = `
        <tr>
            <td name="numbers1"></td>
            <td>${index + 1}.</td>
            <td><input type="text" step="1" pattern="[0-9]+" inputmode="numeric" min="0" max="36" value="${initNumber ?? ''}"></td>
            <td name="tnumber"></td>
            <td name="symbol"></td>
            <td name="numbers2"></td>
            <td name="numbersNote1"></td>
            <td name="numbersNote2"></td>
        </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', rowHtml);

    const input = tbody.querySelectorAll('input')[index];
    input.addEventListener('keyup', (event) => {
        // 13 - enter
        if (event.keyCode === 13) {
            if (!isValidNumber(input.value, minNumber, maxNumber)) return;
            recalculateTNumbers();
            let nextInput;
            if (index === document.querySelectorAll('input').length - 1) nextInput = renderRow();
            else nextInput = document.querySelectorAll('input')[index + 1];
            nextInput.focus();
            nextInput.scrollIntoView();
        }
    });
    input.addEventListener('input', () => {
        const value = input.value;
        if (!isValidNumber(value, minNumber, maxNumber)) {
            input.value = '';
        }
    });

    return input;
}

function generateNumber() {
    document.querySelectorAll('tbody > tr').forEach(row => row.remove());
    for (let i = 0; i < 20; i++) {
        renderRow(getRandomInt(0, 36));
    }
    recalculateTNumbers();
}

document.addEventListener('DOMContentLoaded', () => {
    renderRow();
});