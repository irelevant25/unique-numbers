<?php

// Run with: php tests/storage-test.php
// Also run it as `php -n tests/storage-test.php`: that is a host with no php.ini,
// so no mbstring and no timezone - the storage must still work there.

declare(strict_types=1);

require __DIR__ . '/../lib/Storage.php';

$failures = 0;

function check(bool $condition, string $message): void
{
    global $failures;
    echo ($condition ? 'PASS  ' : 'FAIL  ') . $message . PHP_EOL;
    if (!$condition) $failures++;
}

/** @return int|null the HTTP status the StorageException carries, or null when nothing was thrown */
function thrownStatus(callable $fn): ?int
{
    try {
        $fn();
    } catch (StorageException $e) {
        return $e->status();
    }

    return null;
}

// --- numbers -------------------------------------------------------

check(Storage::normaliseNumbers([1, '2', null, '', 36, 0]) === [1, 2, null, null, 36, 0], 'numbers: ints, digit strings and blanks are accepted');
check(Storage::normaliseNumbers([5, null, null]) === [5], 'numbers: trailing blanks are dropped');
check(thrownStatus(fn() => Storage::normaliseNumbers([37])) === 422, 'numbers: 37 is out of range');
check(thrownStatus(fn() => Storage::normaliseNumbers(['-1'])) === 422, 'numbers: negative numbers are rejected');
check(thrownStatus(fn() => Storage::normaliseNumbers([1.5])) === 422, 'numbers: fractions are rejected');
check(thrownStatus(fn() => Storage::normaliseNumbers('1,2')) === 422, 'numbers: must be a list');
check(thrownStatus(fn() => Storage::normaliseNumbers(array_fill(0, Storage::MAX_ROWS + 1, 1))) === 422, 'numbers: at most MAX_ROWS rows');

// --- names ---------------------------------------------------------

check(Storage::normaliseName("  Večer \n v  kasíne ") === 'Večer v kasíne', 'name: whitespace is collapsed and trimmed');
check(preg_match('/^\d{1,2}\. \d{1,2}\. \d{4} \d{2}:\d{2}$/', Storage::normaliseName('   ')) === 1, 'name: an empty name becomes the date and time');
$long = Storage::normaliseName(str_repeat('ž', 100));
check(preg_match('//u', $long) === 1 && strlen($long) === Storage::MAX_NAME_LEN * 2, 'name: cut to MAX_NAME_LEN characters, never in the middle of one');
check(date_default_timezone_get() !== 'UTC' || ini_get('date.timezone') === 'UTC', 'time zone: falls back to Europe/Bratislava when none is configured');

// --- ids -----------------------------------------------------------

check(Storage::isValidId('0123456789abcdef'), 'id: 16 lowercase hex characters');
foreach (['../../etc/passwd', '0123456789ABCDEF', '0123456789abcde', '0123456789abcdef0', ''] as $bad) {
    check(!Storage::isValidId($bad), "id: rejects '{$bad}'");
}

// --- files ---------------------------------------------------------

$dir = sys_get_temp_dir() . '/unique-numbers-test-' . bin2hex(random_bytes(4));
$storage = new Storage($dir);
$storage->ensureWritable();

$first = $storage->save(null, 'Prvá', [1, 2, 3]);
check(Storage::isValidId($first['id']) && $first['filled'] === 3, 'save: a new series gets an id');
$again = $storage->save($first['id'], 'Prvá', [1, 2, 3, null, 4]);
check($again['id'] === $first['id'] && $again['rows'] === 5 && $again['filled'] === 4, 'save: the same id overwrites, rows and filled are counted');
check($storage->load($first['id'])['numbers'] === [1, 2, 3, null, 4], 'load: returns what was saved');
check($storage->load('../' . $first['id']) === null, 'load: a crafted id cannot leave the data folder');

sleep(1); // updatedAt has one-second resolution
$second = $storage->save(null, 'Druhá', [7]);
$list = $storage->list();
check(count($list) === 2 && $list[0]['id'] === $second['id'], 'list: newest first');
check(!isset($list[0]['numbers']), 'list: leaves the numbers out');

$ghost = $storage->save('ffffffffffffffff', 'Zmazaná medzitým', [9]);
check($ghost['id'] !== 'ffffffffffffffff', 'save: an id that no longer exists becomes a new series');

check($storage->delete($first['id']) && $storage->load($first['id']) === null, 'delete: removes the series');
check(!$storage->delete($first['id']), 'delete: a second delete reports nothing to delete');

array_map('unlink', glob($dir . '/*.json') ?: []);
rmdir($dir);

echo PHP_EOL . ($failures === 0 ? 'ALL PASSED' : "{$failures} FAILED") . PHP_EOL;
exit($failures === 0 ? 0 : 1);
