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

function transformNumber(number) {
    return Math.ceil(number / 3);
}

function recalculateTNumbers() {
    const rows = document.querySelectorAll('tbody > tr');
    rows.forEach((row, index) => {
        const numberCell = row.querySelector('td:nth-child(2) > input');
        const tNumberCell = row.querySelector('td:nth-child(3)');
        const symbolCell = row.querySelector('td:nth-child(4)');
        const number = Number(numberCell.value);
        const tnumber = transformNumber(number);
        tNumberCell.textContent = tnumber;
        const uniqueNumbers = previousUniqueNumbers(index);
        if (uniqueNumbers && tnumber !== 0) {
            const isIncludes = uniqueNumbers.includes(tnumber);
            symbolCell.textContent = isIncludes ? '-' : '+';
            symbolCell.classList.remove('plus');
            symbolCell.classList.remove('minus');
            if (isIncludes) symbolCell.classList.add('minus');
            else symbolCell.classList.add('plus');
        }
    });
}

function renderRow() {
    const minNumber = 0;
    const maxNumber = 36;
    const inputs = document.querySelectorAll('input');
    const index = inputs.length;
    const tbody = document.querySelector('tbody');
    const row = document.createElement('tr');
    const countCell = document.createElement('td');
    const numberCell = document.createElement('td');
    const tNumberCell = document.createElement('td');
    const symbolCell = document.createElement('td');
    const input = document.createElement('input');
    input.setAttribute('data-index', index);
    // input.setAttribute('type', 'number');
    input.setAttribute('min', minNumber);
    input.setAttribute('max', maxNumber);
    // input.setAttribute('value', number);
    numberCell.appendChild(input);
    countCell.textContent = index + 1;
    // tNumberCell.textContent = number;
    tNumberCell.setAttribute('name', 'tnumber');
    // symbolCell.textContent = '+';
    row.appendChild(countCell);
    row.appendChild(numberCell);
    row.appendChild(tNumberCell);
    row.appendChild(symbolCell);
    tbody.appendChild(row);

    input.addEventListener('keyup', () => {
        // 13 - enter
        if (event.keyCode === 13) {
            console.log(previousUniqueNumbers(index));
            recalculateTNumbers();
            renderRow().input.focus();
            window.scrollTo(0, document.body.scrollHeight);
        }
    });
    input.addEventListener('input', () => {
        const value = input.value;
        if (value < minNumber || value > maxNumber || isNaN(value)) {
            input.value = '';
        }
    });

    return {
        input
    };
}

document.addEventListener('DOMContentLoaded', () => {
    // const data = [];
    // for (let i = 0; i < 50; i++) {
    //     data.push(getRandomInt(0, 36));
    // }

    renderRow();
});