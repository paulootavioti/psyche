import { spawn } from 'node:child_process';

const processes = [
  spawn(process.execPath, ['server/start.js'], { stdio: 'inherit', env: process.env }),
  spawn('npm', ['run', 'dev:web'], { stdio: 'inherit', env: process.env })
];

let stopping = false;
const stop = signal => {
  if (stopping) return;
  stopping = true;
  for (const child of processes) if (!child.killed) child.kill(signal);
  setTimeout(() => process.exit(0), 300).unref();
};

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

for (const child of processes) {
  child.on('exit', code => {
    if (!stopping && code) {
      console.error(`Um dos serviços encerrou com código ${code}.`);
      stop('SIGTERM');
    }
  });
}
