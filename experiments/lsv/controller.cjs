(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BG3LsvController = api;
})(typeof globalThis === 'object' ? globalThis : self, function (root) {
  'use strict';
  const HARD_LIMITS = Object.freeze({ fileBytes: 128 * 1024 * 1024, timeoutMs: 30000 });
  const MESSAGES = Object.freeze({
    aborted: 'The current attempt was cancelled.', timeout: 'The active worker execution budget was exhausted.',
    'size-limit': 'The selected file exceeds the allowed size.', 'invalid-input': 'Select a supported local file or byte buffer.',
    'worker-failed': 'The parser worker failed.', 'worker-unavailable': 'A dedicated parser worker is unavailable.',
    'no-active-package': 'Select and inspect a package before reading a member.', busy: 'The worker is already processing a request.',
    'member-not-found': 'Select a member listed in this package.', 'bad-magic': 'The package magic is invalid.',
    'unsupported-version': 'The package version is unsupported.', 'unsupported-codec': 'The selected codec is unsupported.',
    'unsupported-package': 'Split or solid packages are unsupported.', 'invalid-offset': 'The package contains invalid member offsets.',
    truncated: 'The package is truncated.', 'duplicate-member': 'The package contains duplicate member names.',
    'unsafe-path': 'The package contains unsafe member names.', 'invalid-structure': 'The package structure is invalid.',
    'unsupported-resource': 'The selected resource layout is unsupported.', 'invalid-resource': 'The selected resource structure is invalid.',
    'report-limit': 'The structural report exceeds the allowed size.'
  });
  let attemptSerial = 0;
  const workerURL = root.document && root.document.currentScript && root.document.currentScript.src
    ? new URL('./worker.cjs', root.document.currentScript.src).href : './worker.cjs';
  function errorFor(code) {
    const safeCode = Object.hasOwn(MESSAGES, code) ? code : 'worker-failed';
    const error = new Error(MESSAGES[safeCode]);
    error.code = safeCode;
    if (safeCode === 'aborted') error.name = 'AbortError';
    return error;
  }
  function createController(options = {}) {
    const sourceTimers = options.timers || {};
    const timers = {
      now: typeof sourceTimers.now === 'function' ? sourceTimers.now : () => root.performance ? root.performance.now() : Date.now(),
      setTimeout: typeof sourceTimers.setTimeout === 'function' ? sourceTimers.setTimeout.bind(sourceTimers) : root.setTimeout.bind(root),
      clearTimeout: typeof sourceTimers.clearTimeout === 'function' ? sourceTimers.clearTimeout.bind(sourceTimers) : root.clearTimeout.bind(root)
    };
    const timeoutMs = options.timeoutMs === undefined ? HARD_LIMITS.timeoutMs : options.timeoutMs;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > HARD_LIMITS.timeoutMs) throw errorFor('size-limit');
    const WorkerFactory = options.WorkerFactory || (() => {
      if (typeof root.Worker !== 'function') throw errorFor('worker-unavailable');
      return new root.Worker(workerURL);
    });
    let active = null, requestSerial = 0;
    let state = { status: 'idle', attemptId: null, inspection: null, error: null, elapsedMs: 0 };
    function publish(next) {
      state = next;
      if (typeof options.onState === 'function') {
        try { options.onState({ ...state }); } catch (_) { /* A view callback cannot extend worker execution. */ }
      }
    }
    function accountOperation(attempt) {
      const pending = attempt.pending;
      if (!pending) return;
      timers.clearTimeout(pending.timer);
      const spent = timers.now() - pending.started;
      attempt.elapsedMs += Number.isFinite(spent) ? Math.max(0, spent) : timeoutMs;
      attempt.pending = null;
    }
    function detach(attempt) {
      if (typeof attempt.worker.removeEventListener === 'function') {
        attempt.worker.removeEventListener('message', attempt.onMessage);
        attempt.worker.removeEventListener('error', attempt.onError);
        attempt.worker.removeEventListener('messageerror', attempt.onError);
      }
      try { attempt.worker.terminate(); } catch (_) { /* The attempt is already inactive. */ }
    }
    function stop(code, status) {
      const attempt = active;
      active = null;
      if (attempt) {
        const pending = attempt.pending;
        accountOperation(attempt);
        detach(attempt);
        if (pending) pending.reject(errorFor(code));
      }
      publish({ status, attemptId: null, inspection: null, error: status === 'error' ? { code, message: errorFor(code).message } : null, elapsedMs: attempt ? attempt.elapsedMs : 0 });
    }
    function cancel() { stop('aborted', 'cancelled'); }
    function submit(attempt, type, extra, transfer) {
      if (attempt.pending) return Promise.reject(errorFor('busy'));
      const remaining = timeoutMs - attempt.elapsedMs;
      if (remaining <= 0) { stop('timeout', 'error'); return Promise.reject(errorFor('timeout')); }
      return new Promise((resolve, reject) => {
        const requestId = ++requestSerial;
        const pending = { requestId, expected: type === 'inspect' ? 'inspection' : 'member', resolve, reject, started: timers.now(), timer: null };
        attempt.pending = pending;
        pending.timer = timers.setTimeout(() => { if (active === attempt && attempt.pending === pending) stop('timeout', 'error'); }, remaining);
        publish({ status: type === 'inspect' ? 'inspecting' : 'reading', attemptId: attempt.id, inspection: attempt.inspection, error: null, elapsedMs: attempt.elapsedMs });
        try { attempt.worker.postMessage({ type, attemptId: attempt.id, requestId, ...extra }, transfer || []); }
        catch (_) { if (active === attempt) stop('worker-failed', 'error'); }
      });
    }
    function inspect(input) {
      if (active) cancel();
      let byteLength;
      if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) byteLength = input.byteLength;
      else if (input && typeof input.size === 'number') byteLength = input.size;
      if (!Number.isSafeInteger(byteLength) || byteLength < 1) return Promise.reject(errorFor('invalid-input'));
      if (byteLength > HARD_LIMITS.fileBytes) return Promise.reject(errorFor('size-limit'));
      let transferableInput = input, transfer = [];
      if (ArrayBuffer.isView(input)) {
        if (!(input.buffer instanceof ArrayBuffer)) return Promise.reject(errorFor('invalid-input'));
        transferableInput = input.byteOffset === 0 && input.byteLength === input.buffer.byteLength
          ? input.buffer : input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
        transfer = [transferableInput];
      } else if (input instanceof ArrayBuffer) transfer = [input];
      else if (!input || typeof input.arrayBuffer !== 'function' || typeof input.slice !== 'function') return Promise.reject(errorFor('invalid-input'));
      let worker;
      try { worker = WorkerFactory(); }
      catch (error) { return Promise.reject(errorFor(error && error.code === 'worker-unavailable' ? 'worker-unavailable' : 'worker-failed')); }
      if (!worker || typeof worker.postMessage !== 'function' || typeof worker.terminate !== 'function' || typeof worker.addEventListener !== 'function') return Promise.reject(errorFor('worker-unavailable'));
      const attempt = { id: `lsv-${Date.now().toString(36)}-${++attemptSerial}`, worker, elapsedMs: 0, pending: null, inspection: null };
      attempt.onMessage = event => {
        const message = event && event.data, pending = attempt.pending;
        if (active !== attempt || !pending || !message || message.attemptId !== attempt.id || message.requestId !== pending.requestId) return;
        if (message.type !== pending.expected && message.type !== 'error') return;
        const spent = timers.now() - pending.started;
        if (!Number.isFinite(spent) || attempt.elapsedMs + Math.max(0, spent) >= timeoutMs) { stop('timeout', 'error'); return; }
        accountOperation(attempt);
        if (message.type === 'error') {
          const error = errorFor(message.error && message.error.code);
          publish({ status: 'error', attemptId: attempt.id, inspection: attempt.inspection, error: { code: error.code, message: error.message }, elapsedMs: attempt.elapsedMs });
          pending.reject(error);
        } else {
          if (message.type === 'inspection') attempt.inspection = message.result;
          publish({ status: 'ready', attemptId: attempt.id, inspection: attempt.inspection, error: null, elapsedMs: attempt.elapsedMs });
          pending.resolve(message.result);
        }
      };
      attempt.onError = () => { if (active === attempt) stop('worker-failed', 'error'); };
      worker.addEventListener('message', attempt.onMessage);
      worker.addEventListener('error', attempt.onError);
      worker.addEventListener('messageerror', attempt.onError);
      active = attempt;
      return submit(attempt, 'inspect', { input: transferableInput, limits: options.limits }, transfer);
    }
    function readMember(memberName) {
      if (!active || !active.inspection) return Promise.reject(errorFor('no-active-package'));
      if (typeof memberName !== 'string' || !active.inspection.entries.some(entry => entry.name === memberName)) return Promise.reject(errorFor('member-not-found'));
      return submit(active, 'read-member', { memberName }, []);
    }
    return Object.freeze({ inspect, readMember, cancel, dispose: cancel, getState: () => ({ ...state }) });
  }
  return Object.freeze({ createController, HARD_LIMITS });
});
