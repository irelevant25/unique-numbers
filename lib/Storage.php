<?php

declare(strict_types=1);

/**
 * Flat-file storage for saved number series.
 *
 * One JSON document per session, kept in the data directory. No database and
 * no extensions beyond ext-json are required, so the app can be dropped onto
 * any PHP host as-is.
 */
final class Storage
{
    public const MAX_SESSIONS = 200;
    public const MAX_ROWS     = 2000;
    public const MAX_NAME_LEN = 80;
    public const MIN_NUMBER   = 0;
    /** Slovak day. month. year hour:minute - matches the client's sk-SK formatting. */
    public const NAME_DATE_FORMAT = 'j. n. Y H:i';
    public const MAX_NUMBER   = 36;

    private string $dir;

    public function __construct(string $dir)
    {
        $this->dir = rtrim($dir, "/\\");
    }

    /** @return array<int, array<string, mixed>> Sessions without their numbers, newest first. */
    public function list(): array
    {
        $sessions = [];
        foreach (glob($this->dir . '/*.json') ?: [] as $file) {
            $session = $this->decode($file);
            if ($session === null) continue;
            unset($session['numbers']);
            $sessions[] = $session;
        }

        usort($sessions, static fn(array $a, array $b) => strcmp((string) $b['updatedAt'], (string) $a['updatedAt']));

        return $sessions;
    }

    /** @return array<string, mixed>|null */
    public function load(string $id): ?array
    {
        if (!self::isValidId($id)) return null;

        return $this->decode($this->path($id));
    }

    /**
     * Creates a session, or overwrites the one matching $id when it still exists.
     *
     * @param  array<int, int|null> $numbers
     * @return array<string, mixed>
     * @throws StorageException
     */
    public function save(?string $id, string $name, array $numbers): array
    {
        $name    = self::normaliseName($name);
        $numbers = self::normaliseNumbers($numbers);

        $existing = $id !== null ? $this->load($id) : null;

        if ($existing === null) {
            if (count($this->list()) >= self::MAX_SESSIONS) {
                throw new StorageException(sprintf('Dosiahnutý limit sérií (%d). Najprv niektorú vymažte.', self::MAX_SESSIONS), 409);
            }
            $id = self::newId();
        }

        $now     = date(DATE_ATOM);
        $session = [
            'id'        => $id,
            'name'      => $name,
            'rows'      => count($numbers),
            'filled'    => count(array_filter($numbers, static fn($n) => $n !== null)),
            'numbers'   => $numbers,
            'createdAt' => $existing['createdAt'] ?? $now,
            'updatedAt' => $now,
        ];

        $json = json_encode($session, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false || file_put_contents($this->path($id), $json, LOCK_EX) === false) {
            throw new StorageException('Sériu sa nepodarilo uložiť na disk.', 500);
        }

        return $session;
    }

    public function delete(string $id): bool
    {
        if (!self::isValidId($id) || !is_file($this->path($id))) return false;

        return unlink($this->path($id));
    }

    public function ensureWritable(): void
    {
        if (!is_dir($this->dir) && !mkdir($this->dir, 0775, true) && !is_dir($this->dir)) {
            throw new StorageException('Priečinok s dátami sa nepodarilo vytvoriť.', 500);
        }
        if (!is_writable($this->dir)) {
            throw new StorageException('Do priečinka s dátami sa nedá zapisovať.', 500);
        }
    }

    public static function isValidId(string $id): bool
    {
        return preg_match('/^[0-9a-f]{16}$/', $id) === 1;
    }

    /**
     * @param  mixed $numbers
     * @return array<int, int|null> Values are 0..36 or null for a blank row; trailing blanks are dropped.
     * @throws StorageException
     */
    public static function normaliseNumbers(mixed $numbers): array
    {
        if (!is_array($numbers)) {
            throw new StorageException('Pole „numbers“ musí byť zoznam.', 422);
        }
        if (count($numbers) > self::MAX_ROWS) {
            throw new StorageException(sprintf('Príliš veľa riadkov (max %d).', self::MAX_ROWS), 422);
        }

        $clean = [];
        foreach (array_values($numbers) as $i => $value) {
            if ($value === null || $value === '') {
                $clean[] = null;
                continue;
            }
            if (!is_int($value) && !(is_string($value) && preg_match('/^\d+$/', $value) === 1)) {
                throw new StorageException(sprintf('Riadok %d nie je celé číslo.', $i + 1), 422);
            }
            $number = (int) $value;
            if ($number < self::MIN_NUMBER || $number > self::MAX_NUMBER) {
                throw new StorageException(
                    sprintf('Riadok %d je mimo rozsahu (%d – %d).', $i + 1, self::MIN_NUMBER, self::MAX_NUMBER),
                    422
                );
            }
            $clean[] = $number;
        }

        while ($clean !== [] && end($clean) === null) {
            array_pop($clean);
        }

        return array_values($clean);
    }

    public static function normaliseName(string $name): string
    {
        $name = trim(preg_replace('/\s+/u', ' ', $name) ?? '');
        if ($name === '') {
            $name = date(self::NAME_DATE_FORMAT);
        }

        return mb_substr($name, 0, self::MAX_NAME_LEN);
    }

    private static function newId(): string
    {
        return bin2hex(random_bytes(8));
    }

    private function path(string $id): string
    {
        return $this->dir . '/' . $id . '.json';
    }

    /** @return array<string, mixed>|null */
    private function decode(string $file): ?array
    {
        if (!is_file($file)) return null;

        $raw = file_get_contents($file);
        if ($raw === false) return null;

        $data = json_decode($raw, true);

        return is_array($data) && isset($data['id']) && self::isValidId((string) $data['id']) ? $data : null;
    }
}

final class StorageException extends RuntimeException
{
    public function __construct(string $message, private int $status = 400)
    {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->status;
    }
}
