<?php

declare(strict_types=1);

require __DIR__ . '/lib/Storage.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

/** @param array<string, mixed> $payload */
function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $status = 400): never
{
    respond(['ok' => false, 'error' => $message], $status);
}

/** @return array<string, mixed> */
function body(): array
{
    // a plain HTML form from another site cannot send this, so it cannot save or delete here
    $type = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
    if (!str_starts_with($type, 'application/json')) fail('Požiadavka musí byť vo formáte JSON.', 415);

    $raw = file_get_contents('php://input') ?: '';
    if (trim($raw) === '') return [];

    $data = json_decode($raw, true);
    if (!is_array($data)) fail('Telo požiadavky nie je platný JSON.', 400);

    return $data;
}

function requirePost(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') fail('Táto akcia vyžaduje POST.', 405);
}

$storage = new Storage(__DIR__ . '/data');
$action  = (string) ($_GET['action'] ?? '');

try {
    switch ($action) {
        case 'list':
            respond(['ok' => true, 'sessions' => $storage->list()]);

        case 'load':
            $session = $storage->load((string) ($_GET['id'] ?? ''));
            if ($session === null) fail('Táto séria už neexistuje.', 404);
            respond(['ok' => true, 'session' => $session]);

        case 'save':
            requirePost();
            $storage->ensureWritable();
            $input = body();
            $id    = isset($input['id']) && is_string($input['id']) && $input['id'] !== '' ? $input['id'] : null;
            if ($id !== null && !Storage::isValidId($id)) fail('Neznáme ID série.', 422);
            $session = $storage->save($id, (string) ($input['name'] ?? ''), $input['numbers'] ?? []);
            respond(['ok' => true, 'session' => $session, 'sessions' => $storage->list()]);

        case 'delete':
            requirePost();
            $input = body();
            if (!$storage->delete((string) ($input['id'] ?? ''))) fail('Táto séria už neexistuje.', 404);
            respond(['ok' => true, 'sessions' => $storage->list()]);

        default:
            fail('Neznáma akcia.', 404);
    }
} catch (StorageException $e) {
    fail($e->getMessage(), $e->status());
} catch (Throwable $e) {
    error_log('unique-numbers api: ' . $e->getMessage());
    fail('Neočakávaná chyba servera.', 500);
}
