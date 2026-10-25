import { garmentSvg } from './art.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));

/** Sleeve flaps fold first. Only then does the lower half turn over the upper. */
export function foldedProgressStyles(value) {
  const progress = clamp(value);
  const sides = clamp(progress / .42);
  const bottom = progress === 1 ? 1 : clamp((progress - .34) / .66);
  return { progress, sides, bottom, angle: bottom * 180 };
}

export function setFoldProgress(element, value) {
  const state = foldedProgressStyles(value);
  element.style.setProperty('--fold-progress', state.progress);
  element.style.setProperty('--fold-sides', state.sides);
  element.style.setProperty('--fold-bottom', state.bottom);
  element.style.setProperty('--fold-angle', `${state.angle}deg`);
  return state;
}

function fabricLayers(color) {
  const garment = garmentSvg(color);
  return `<span class="fold-fabric-center">${garment}</span><span class="fold-wing fold-wing-left">${garment}</span><span class="fold-wing fold-wing-right">${garment}</span>`;
}

/** Decorative only: the caller owns gesture handles, instructions and state. */
export function renderFoldableCloth(color = '#ffe14d', { title = '', body = '', mode = 'fold' } = {}) {
  const state = foldedProgressStyles(mode === 'unfold' ? 1 : 0);
  return `<span class="fold-textile" aria-hidden="true" style="--fold-progress:${state.progress};--fold-sides:${state.sides};--fold-bottom:${state.bottom};--fold-angle:${state.angle}deg">
    <span class="fold-fabric-shadow"></span>
    <span class="fold-upper">${fabricLayers(color)}</span>
    <span class="fold-writing"><span class="fold-writing-title">${escapeHtml(title)}</span>${body ? `<span class="fold-writing-body">${escapeHtml(body)}</span>` : ''}</span>
    <span class="fold-lower">${fabricLayers(color)}<span class="fold-lower-back"></span></span>
    <span class="fold-crease fold-crease-left"></span><span class="fold-crease fold-crease-right"></span><span class="fold-crease fold-crease-middle"></span>
    <span class="fold-finished-seam"></span>
  </span>`;
}
