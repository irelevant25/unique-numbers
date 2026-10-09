// Copies the app into a scratch folder and serves it with PHP's built-in server.
// The copy has its own empty data/ folder, so checks never touch real saved series.
//
//   node serve.mjs [port]        (default 8765; run it in the background)
//
// Prints the URL and the scratch data folder, then keeps serving until killed.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2] ?? process.env.APP_PORT ?? 8765);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const target = path.join(os.tmpdir(), `unique-numbers-app-${port}`);

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(path.join(target, 'lib'), { recursive: true });
fs.mkdirSync(path.join(target, 'data'), { recursive: true });
for (const file of ['index.php', 'api.php', 'index.js', 'logic.js', 'style.css', 'lib/Storage.php', 'data/.htaccess']) {
    fs.copyFileSync(path.join(repo, file), path.join(target, file));
}

console.log(`APP_URL=http://127.0.0.1:${port}/`);
console.log(`DATA_DIR=${target.replaceAll('\\', '/')}/data`);

const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', target], { stdio: 'inherit' });
server.on('exit', code => process.exit(code ?? 0));
