import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log(`
🍕 Starting Olive AI Assistant Monorepo
────────────────────────────────────────────────────
  Backend  : http://localhost:3051
  Frontend : http://localhost:5174 / 5175
────────────────────────────────────────────────────
`);

function runService(name, cwd, color) {
  const child = spawn(npmCmd, ['run', 'dev'], {
    cwd,
    stdio: 'pipe',
    shell: isWin,
    env: { ...process.env, FORCE_COLOR: 'true' },
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      console.log(`${color}[${name}]${'\x1b[0m'} ${line}`);
    }
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      console.error(`${color}[${name} ERR]${'\x1b[0m'} ${line}`);
    }
  });

  child.on('close', (code) => {
    console.log(`${color}[${name}] exited with code ${code}${'\x1b[0m'}`);
  });

  return child;
}

const backend = runService('Backend', path.join(rootDir, 'backend'), '\x1b[35m');
const frontend = runService('Frontend', path.join(rootDir, 'frontend'), '\x1b[36m');

function cleanup() {
  console.log('\nStopping Olive AI services...');
  backend.kill();
  frontend.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
