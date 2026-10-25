const INK = '#181818';
const safeColor = (value, fallback = '#ffe14d') => /^#[\da-f]{3,8}$/i.test(value ?? '') ? value : fallback;
const svg = (viewBox, body, className = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true" focusable="false" class="${className}">${body}</svg>`;

export function garmentSvg(color = '#ffe14d', kind = 'shirt') {
  const fill = safeColor(color);
  if (kind === 'towel') {
    return svg('0 0 220 240', `
      <path d="M38 26 Q110 16 182 26 L178 216 Q111 230 42 216 Z" fill="${fill}" stroke="${INK}" stroke-width="2.7" stroke-linejoin="round"/>
      <path d="M47 35 Q110 26 173 35 M47 206 Q110 217 171 205" fill="none" stroke="${INK}" stroke-width="2"/>
      <path d="M55 27 L58 215 M165 27 L162 216" fill="none" stroke="${INK}" stroke-width="2"/>
      <path d="M44 216 L42 223 M54 219 L53 226 M65 221 L64 228 M76 222 L76 230 M88 224 L88 231 M101 224 L101 232 M114 224 L114 232 M127 224 L127 232 M140 223 L140 231 M152 221 L153 228 M164 219 L166 226 M175 217 L177 224" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
    `, 'garment-art towel-art');
  }
  return svg('0 0 220 240', `
    <path d="M75 26 Q88 33 110 33 Q132 33 145 26 L166 35 Q176 39 181 48 L207 89 Q210 94 205 97 L175 114 Q171 116 168 112 L159 99 L163 214 Q110 226 57 214 L61 99 L52 112 Q49 116 45 114 L15 97 Q10 94 13 89 L39 48 Q44 39 54 35 Z" fill="${fill}" stroke="${INK}" stroke-width="2.9" stroke-linejoin="round"/>
    <path d="M75 26 Q82 60 110 61 Q138 60 145 26 L134 29 Q130 49 110 50 Q90 49 86 29 Z" fill="#fff8ec" stroke="${INK}" stroke-width="2"/>
    <path d="M61 99 L64 76 M159 99 L156 76 M21 90 L49 106 M171 106 L199 90 M58 205 Q110 215 162 205" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
  `, 'garment-art shirt-art');
}

export function basketSvg() {
  const ribs = Array.from({ length: 17 }, (_, i) => {
    const top = 26 + i * 16.75;
    const bottom = 49 + i * 13.9;
    return `<path d="M${top} 33 L${bottom} 134"/>`;
  }).join('');
  const weaves = [49, 65, 81, 97, 113, 129].map((y) => `<path d="M${26 + (y - 33) * .22} ${y} Q160 ${y + 8} ${294 - (y - 33) * .22} ${y}"/>`).join('');
  return svg('0 0 320 160', `
    <path d="M21 27 L46 131 Q48 143 62 144 L258 144 Q272 143 274 131 L299 27 Z" fill="#f1d28b" stroke="${INK}" stroke-width="2.9" stroke-linejoin="round"/>
    <g fill="none" stroke="#181818" stroke-width="2.7">${ribs}${weaves}</g>
    <path d="M27 33 Q160 43 293 33 M45 133 Q160 146 275 133" fill="none" stroke="${INK}" stroke-width="2.7"/>
    <rect x="15" y="19" width="290" height="18" rx="8" fill="#fff1cc" stroke="${INK}" stroke-width="2.9"/>
    <path d="M26 24 H294" stroke="#fff8ec" stroke-width="2.7" stroke-linecap="round"/>
    <path d="M133 74 H187 Q191 74 191 79 V89 Q191 94 186 94 H134 Q129 94 129 89 V79 Q129 74 133 74 Z" fill="#fff8ec" stroke="#181818" stroke-width="2"/>
    <path d="M144 83 H176" stroke="#181818" stroke-width="2.7" stroke-linecap="round"/>
  `, 'basket-art');
}

function washerBodyMarkup(active = false) {
  const perforations = Array.from({length:14},(_,index)=>{
    const angle=index*Math.PI*2/14;
    return `<circle cx="${(160+51*Math.cos(angle)).toFixed(2)}" cy="${(169+51*Math.sin(angle)).toFixed(2)}" r="1.5" fill="#a5c7cd" opacity=".55"/>`;
  }).join('');
  return `
    <rect x="39" y="316" width="29" height="14" rx="3" fill="#181818" stroke="${INK}" stroke-width="2.5"/>
    <rect x="252" y="316" width="29" height="14" rx="3" fill="#181818" stroke="${INK}" stroke-width="2.5"/>
    <path d="M32 17 Q32 7 42 7 H278 Q288 7 288 17 V310 Q288 320 278 320 H42 Q32 320 32 310 Z" fill="#fff8ec" stroke="${INK}" stroke-width="2.9"/>
    <path d="M43 10 H276 Q285 10 285 19 V60 H35 V19 Q35 10 43 10" fill="#36b7d5"/>
    <path d="M33 64 H287 M33 278 H287" stroke="${INK}" stroke-width="2.3"/>
    <rect x="47" y="24" width="64" height="22" rx="3" fill="#fff8ec" stroke="${INK}" stroke-width="2"/>
    <path d="M61 34 H96" stroke="#181818" stroke-width="3" stroke-linecap="round"/>
    <path d="M124 27 H145 M124 34 H139 M124 41 H145" stroke="#181818" stroke-width="2.7" stroke-linecap="round"/>
    <circle cx="212" cy="35" r="16" fill="#ffe14d" stroke="${INK}" stroke-width="2.3"/>
    <circle cx="212" cy="35" r="11" fill="#fff8ec"/>
    <path d="M212 35 L217 26" stroke="${INK}" stroke-width="2.7" stroke-linecap="round"/>
    <circle cx="263" cy="35" r="5" fill="${active ? '#54c5a4' : '#ff86ba'}" stroke="${INK}" stroke-width="2"/>
    <path d="M263 16 V20 M243 35 H247 M279 35 H283" stroke="#181818" stroke-width="2" stroke-linecap="round"/>
    <circle cx="160" cy="169" r="83" fill="#fff8ec" stroke="${INK}" stroke-width="2.7"/>
    <circle cx="160" cy="169" r="72" fill="#acbcc1" stroke="${INK}" stroke-width="2.2"/>
    <circle cx="160" cy="169" r="66" fill="#142938" stroke="${INK}" stroke-width="2.7"/>
    <circle cx="160" cy="169" r="59" fill="#223f56"/>
    <g class="washer-drum" style="transform-origin:160px 169px">
      ${perforations}
      <path d="M117 201 Q160 217 203 201" fill="none" stroke="#8ab8bc" stroke-width="2" opacity=".45"/>
      ${active ? '<circle cx="124" cy="145" r="4" fill="none" stroke="#fff8ec" stroke-width="1.5"/><circle cx="184" cy="199" r="3" fill="none" stroke="#fff8ec" stroke-width="1.5"/><circle cx="193" cy="139" r="2" fill="#fff8ec"/>' : ''}
    </g>
    <rect x="66" y="142" width="9" height="54" rx="3" fill="#acbcc1" stroke="${INK}" stroke-width="2"/>
    <rect x="54" y="290" width="50" height="15" rx="3" fill="#54c5a4" stroke="#181818" stroke-width="2"/>
    <path d="M62 297 H96 M253 291 H270 M253 297 H270 M253 303 H270" stroke="#181818" stroke-width="2.1" stroke-linecap="round"/>
  `;
}

function washerDoorMarkup() {
  return `
    <circle cx="160" cy="169" r="85.5" fill="none" stroke="#ff8b76" stroke-width="11"/>
    <circle cx="160" cy="169" r="91" fill="none" stroke="${INK}" stroke-width="2.7"/>
    <circle cx="160" cy="169" r="73" fill="none" stroke="#fff8ec" stroke-width="14"/>
    <circle cx="160" cy="169" r="80" fill="none" stroke="${INK}" stroke-width="2.2"/>
    <circle cx="160" cy="169" r="66" fill="#223f56" fill-opacity=".28" stroke="${INK}" stroke-width="2.7"/>
    <path d="M121 126 Q103 147 107 170" stroke="#fff8ec" stroke-width="9" stroke-linecap="round" fill="none" opacity=".82"/>
    <path d="M132 117 L141 114" stroke="#fff8ec" stroke-width="7" stroke-linecap="round" opacity=".82"/>
    <path d="M230 147 Q238 145 238 153 V183 Q238 190 230 188" fill="#ffe14d" stroke="${INK}" stroke-width="2.2"/>
    <path d="M235 154 V182" stroke="#fff8ec" stroke-width="2" stroke-linecap="round"/>
  `;
}

/** Rear appliance and exposed drum. The live UI overlays washerDoorSvg(). */
export function washerBodySvg(active = false) {
  return svg('0 0 320 345',washerBodyMarkup(active),`washer-art washer-body-art${active ? ' is-active' : ''}`);
}

/** Actual front door leaf: hinge is the left midpoint of this viewBox. */
export function washerDoorSvg() {
  return svg('69 78 182 182',washerDoorMarkup(),'washer-door-art');
}

/** Complete illustration retained for callers that do not use a separate door. */
export function washerSvg(active = false, doorOpen = false) {
  const door = doorOpen
    ? `<g transform="translate(69 0) scale(-.25 1) translate(-69 0)">${washerDoorMarkup()}</g>`
    : washerDoorMarkup();
  return svg('0 0 320 345',washerBodyMarkup(active)+door,`washer-art${active ? ' is-active' : ''}${doorOpen ? ' is-door-open' : ''}`);
}

export function foldedSvg(color = '#ffe14d') {
  const fill = safeColor(color);
  return svg('0 0 200 92', `
    <path d="M24 29 Q24 22 32 22 H165 Q175 23 176 33 L180 67 Q181 76 171 77 H29 Q20 77 21 68 Z" fill="${fill}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M24 56 Q100 64 178 55 M28 66 Q100 74 176 66" stroke="${INK}" stroke-width="2" fill="none"/>
    <path d="M42 22 L47 56 M157 22 L153 57 M49 27 H151" fill="none" stroke="${INK}" stroke-width="2"/>
    <path d="M86 22 Q100 37 114 22" fill="none" stroke="${INK}" stroke-width="2.2"/>
  `, 'folded-art');
}

export function plantSvg() {
  return svg('0 0 140 200', `
    <path d="M72 150 Q61 112 70 79 Q77 48 69 20 M68 103 Q44 87 33 61 M69 80 Q91 64 105 44 M66 121 Q91 111 103 85" fill="none" stroke="#181818" stroke-width="2.7" stroke-linecap="round"/>
    <path d="M68 30 Q48 25 53 9 Q70 9 68 30 M72 49 Q90 44 85 27 Q70 30 72 49 M68 72 Q48 67 51 48 Q69 51 68 72 M70 91 Q90 91 91 73 Q74 71 70 91 M49 85 Q28 89 22 73 Q39 65 49 85 M35 66 Q16 65 18 47 Q33 48 35 66 M88 63 Q85 43 103 37 Q110 54 88 63 M99 53 Q110 60 119 44 Q107 32 99 53 M86 115 Q85 94 102 90 Q109 109 86 115 M99 98 Q101 76 116 78 Q121 95 99 98 M65 130 Q44 127 45 108 Q65 108 65 130" fill="#54c5a4" stroke="#181818" stroke-width="2" stroke-linejoin="round"/>
    <path d="M46 147 H98 L92 180 Q91 188 83 188 H61 Q53 188 52 180 Z" fill="#ff8b42" stroke="${INK}" stroke-width="2.4"/>
    <rect x="42" y="140" width="60" height="11" rx="3" fill="#ffe14d" stroke="${INK}" stroke-width="2.4"/>
    <path d="M54 157 L57 178" stroke="#fff8ec" stroke-width="2.7" stroke-linecap="round"/>
  `, 'plant-art');
}
