import { setFoldProgress } from './fold-art.js';

export const FOLD_THRESHOLD = .8;
const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const foldProperties = ['--fold-progress', '--fold-sides', '--fold-bottom', '--fold-angle'];

/** deltaY is positive downwards. Unfolding reveals saved content without changing it. */
export function gestureProgress(mode, deltaY, travel = 120) {
  const distance = Number.isFinite(Number(deltaY)) ? Number(deltaY) : 0;
  const span = Number.isFinite(Number(travel)) ? Math.max(1, Number(travel)) : 120;
  return mode === 'unfold' ? 1 - clamp(distance / span) : clamp(-distance / span);
}

export function gestureComplete(mode, progress) {
  const value = clamp(progress);
  return mode === 'unfold' ? value <= 1 - FOLD_THRESHOLD + 1e-9 : value >= FOLD_THRESHOLD;
}

const readProperty = (element, property) => ({ value:element.style.getPropertyValue(property), priority:element.style.getPropertyPriority(property) });
function restoreProperty(element, property, prior) {
  if (prior.value) element.style.setProperty(property, prior.value, prior.priority);
  else element.style.removeProperty(property);
}

/** Changes the original garment in place. No preview, cloned garment or dialog is created. */
export function installFoldGestures({ getNote, onFold, onUnfold, onHint = () => {} }) {
  if (typeof getNote !== 'function') throw new TypeError('getNote must be a function.');
  const listeners = [];
  let active = null;
  let blockedClickUntil = 0;
  let destroyed = false;

  function listen(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    listeners.push(() => target.removeEventListener(type, callback, options));
  }
  const actionHandle = target => target instanceof Element ? target.closest('[data-fold],[data-unfold]') : null;
  const hintFor = mode => mode === 'unfold'
    ? '접힌 옷의 밑단을 아래로 끌어 원래 메모를 펼쳐보세요.'
    : '옷의 밑단을 위로 끌어 끝까지 접으면 완료 보관돼요.';

  function prepare(handle, input, pointerId = null, startY = 0) {
    if (destroyed || handle.disabled) return null;
    const mode = handle.hasAttribute('data-unfold') ? 'unfold' : 'fold';
    const id = mode === 'unfold' ? handle.dataset.unfold : handle.dataset.fold;
    if (!getNote(id)) { onHint('이 메모를 찾을 수 없어요.'); return null; }
    cancel();
    const source = handle.closest('[data-cloth-surface]');
    const textile = source?.matches('.fold-textile') ? source : source?.querySelector('.fold-textile');
    if (!source || !textile) { onHint('옷의 밑단에서 다시 시도해주세요.'); return null; }
    const rect = textile.getBoundingClientRect();
    const initial = mode === 'unfold' ? 1 : 0;
    const textileStyle = new Map(foldProperties.map(property => [property, readProperty(textile, property)]));
    const sourceOpen = readProperty(source, '--fabric-open');
    const aria = new Map(['aria-valuenow', 'aria-valuetext'].map(name => [name, handle.getAttribute(name)]));
    active = {id, mode, handle, source, textile, input, pointerId, startY, initial, progress:initial,
      travel:Math.max(80, Math.min(160, rect.height * .75)), phase:'armed', started:false,
      timer:null, ready:false, textileStyle, sourceOpen, aria};
    handle.focus({preventScroll:true});
    return active;
  }

  function begin(state) {
    if (state.started) return;
    state.started = true;
    state.phase = 'dragging';
    state.textile.classList.remove('is-settling');
    state.source.classList.add('is-fold-manipulating');
    state.source.classList.toggle('is-unfolding', state.mode === 'unfold');
    state.handle.classList.add('fold-grabbing');
    document.body.classList.add('is-fold-gesturing');
  }

  function update(state, progress, announce = true) {
    state.progress = clamp(progress);
    setFoldProgress(state.textile, state.progress);
    // The existing archive surface can grow as its own fabric opens.
    state.source.style.setProperty('--fabric-open', String(1 - state.progress));
    state.handle.setAttribute('aria-valuenow', String(Math.round(state.progress * 100)));
    state.handle.setAttribute('aria-valuetext', `접힘 ${Math.round(state.progress * 100)}%`);
    const ready = gestureComplete(state.mode, state.progress);
    state.source.classList.toggle('is-fold-ready', ready);
    if (announce && ready !== state.ready) {
      onHint(ready ? (state.mode === 'unfold' ? '손을 놓으면 원래 메모가 보여요.' : '손을 놓으면 접어서 완료 보관해요.') : hintFor(state.mode));
    }
    state.ready = ready;
  }

  function restore(state) {
    for (const [property, prior] of state.textileStyle) restoreProperty(state.textile, property, prior);
    restoreProperty(state.source, '--fabric-open', state.sourceOpen);
    for (const [name, value] of state.aria) {
      if (value === null) state.handle.removeAttribute(name);
      else state.handle.setAttribute(name, value);
    }
  }

  function cleanup(state, shouldRestore = false) {
    if (!state) return;
    clearTimeout(state.timer);
    if (active === state) active = null;
    state.textile.classList.remove('is-settling');
    state.source.classList.remove('is-fold-manipulating', 'is-unfolding', 'is-fold-ready');
    state.handle.classList.remove('fold-grabbing');
    document.body.classList.remove('is-fold-gesturing');
    if (shouldRestore) restore(state);
    if (state.pointerId !== null && state.handle.hasPointerCapture?.(state.pointerId)) state.handle.releasePointerCapture(state.pointerId);
  }

  function finish(commit) {
    const state = active;
    if (!state || state.phase === 'settling') return;
    if (!state.started) { cleanup(state, true); return; }
    state.phase = 'settling';
    state.textile.classList.add('is-settling');
    update(state, commit ? (state.mode === 'fold' ? 1 : 0) : state.initial, false);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    state.timer = setTimeout(() => {
      cleanup(state, !commit);
      if (destroyed || !commit) {
        if (!destroyed && !commit) onHint('원래 모습으로 돌아왔어요. 메모 상태는 바뀌지 않았어요.');
        return;
      }
      const callback = state.mode === 'fold' ? onFold : onUnfold;
      if (typeof callback !== 'function' || callback(state.id) === false) restore(state);
    }, reduced ? 0 : 240);
  }

  function cancel() {
    if (active) cleanup(active, true);
  }

  listen(document, 'pointerdown', event => {
    const handle = actionHandle(event.target);
    if (!handle || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    const state = prepare(handle, 'pointer', event.pointerId, event.clientY);
    if (state) handle.setPointerCapture(event.pointerId);
  }, true);

  listen(document, 'pointermove', event => {
    const state = active;
    if (!state || state.input !== 'pointer' || state.pointerId !== event.pointerId || state.phase === 'settling') return;
    const distance = event.clientY - state.startY;
    if (!state.started && Math.abs(distance) < 6) return;
    event.preventDefault();
    begin(state);
    update(state, gestureProgress(state.mode, distance, state.travel));
  }, {capture:true, passive:false});

  listen(document, 'pointerup', event => {
    const state = active;
    if (!state || state.input !== 'pointer' || state.pointerId !== event.pointerId || state.phase === 'settling') return;
    blockedClickUntil = performance.now() + 500;
    if (!state.started) { const mode=state.mode; cleanup(state, true); onHint(hintFor(mode)); return; }
    update(state, gestureProgress(state.mode, event.clientY - state.startY, state.travel), false);
    finish(gestureComplete(state.mode, state.progress));
  }, true);

  listen(document, 'pointercancel', event => { if (active?.pointerId === event.pointerId) cancel(); }, true);
  listen(document, 'lostpointercapture', event => {
    if (active?.pointerId === event.pointerId && active.phase !== 'settling') cancel();
  }, true);

  listen(document, 'click', event => {
    const handle = actionHandle(event.target);
    if (!handle) return;
    event.preventDefault(); event.stopPropagation();
    if (performance.now() >= blockedClickUntil) onHint(hintFor(handle.hasAttribute('data-unfold') ? 'unfold' : 'fold'));
  }, true);

  listen(document, 'keydown', event => {
    if (event.key === 'Escape' && active) {
      event.preventDefault(); event.stopPropagation(); cancel(); onHint('접기·펼치기를 취소했어요.'); return;
    }
    const handle = actionHandle(event.target);
    if (!handle || !['ArrowUp','ArrowDown','Enter',' '].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Enter' || event.key === ' ') {
      blockedClickUntil = performance.now() + 500;
      if (event.repeat) return;
    }
    const state = active?.handle === handle && active.input === 'keyboard' ? active : prepare(handle, 'keyboard');
    if (!state || state.phase === 'settling') return;
    begin(state);
    if (event.key === 'Enter' || event.key === ' ') { finish(true); return; }
    update(state, state.progress + (event.key === 'ArrowUp' ? .25 : -.25));
  }, true);

  listen(document, 'focusout', event => { if (active?.input === 'keyboard' && event.target === active.handle) cancel(); });
  listen(window, 'blur', cancel);
  listen(document, 'visibilitychange', () => { if (document.hidden) cancel(); });

  return {
    cancel,
    destroy() { destroyed=true; cancel(); listeners.splice(0).forEach(remove => remove()); }
  };
}
