/**
 * DSH sandbox preload.
 *
 * Vite 8 on Windows probes mapped network drives with `exec("net use")`.
 * The confined session blocks child-process pipes, so that probe aborts the
 * config load. This preload only intercepts that exact command and lets Vite
 * fall back to `fs.realpathSync`; all other child processes are untouched.
 *
 * Usage (from frontend/):
 *   node -r ../scripts/sandbox-preload.cjs node_modules/vite/bin/vite.js build
 */
const childProcess = require('node:child_process')
const originalExec = childProcess.exec

childProcess.exec = function patchedExec(command, options, callback) {
  if (typeof command === 'string' && command.trim() === 'net use') {
    const done = typeof options === 'function' ? options : callback
    if (typeof done === 'function') {
      process.nextTick(() => done(new Error('net use disabled by sandbox preload'), '', ''))
    }
    return {
      pid: 0,
      kill() {},
      on() {},
      once() {},
      stdout: null,
      stderr: null,
    }
  }
  return originalExec.apply(this, arguments)
}
