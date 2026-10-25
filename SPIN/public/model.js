/** Browser-local data model for the laundry room. No network or DOM dependencies. */
export const STATUSES = Object.freeze({
  inbox: '바구니',
  ready: '직접 할 일',
  washing: '세탁 중',
  waiting: '기다리는 일',
  reference: '나중에 참고',
  done: '접어 둔 메모',
});

export const STORAGE_KEY = 'neolda.laundry-room.v1';
export const CLOTH_COLORS = Object.freeze(['#ff86ba', '#54c5a4', '#ffe14d', '#36b7d5', '#b497f4', '#ff8b42']);
const legacyColors = ['#edb9b7', '#b7cbb7', '#e6cf9d', '#b5c5d6', '#c9bbd4', '#e6bb98'];
const currentColor = (color) => {
  const index = legacyColors.indexOf(typeof color === 'string' ? color.toLowerCase() : color);
  return index < 0 ? color : CLOTH_COLORS[index];
};

const isStatus = (status) => Object.hasOwn(STATUSES, status);
const timestamp = () => new Date().toISOString();
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `memo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const validDate = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const cloneNote = (note) => ({ ...note, history: (note.history ?? []).map((entry) => ({ ...entry })) });

export function createNote({ title, body = '', color = CLOTH_COLORS[0], waitReason = '' }, at = timestamp()) {
  if (typeof title !== 'string' || !title.trim()) throw new Error('메모의 이름을 적어주세요.');
  return {
    id: makeId(),
    title: title.trim(),
    body: String(body),
    waitReason: typeof waitReason === 'string' ? waitReason.trim() : '',
    color: /^#[\da-f]{6}$/i.test(color) ? currentColor(color) : CLOTH_COLORS[0],
    status: 'inbox',
    createdAt: at,
    updatedAt: at,
    completedAt: null,
    history: [{ at, from: null, to: 'inbox' }],
  };
}

export function createSeedNotes() {
  const now = Date.now();
  const seed = [
    ['발표 자료 다듬기', '문제 정의와 사용 흐름을 한눈에 보여주기.\n마지막 장에는 실제 조작 영상을 넣자.', 'inbox', 0],
    ['떠오른 아이디어 적어두기', '작은 행동이 큰 정리로 이어지는 인터페이스.\n접힌 메모를 펼치면 이전 기록을 볼 수 있게.', 'inbox', 2],
    ['프로토타입 인터랙션 만들기', '바구니에서 빨랫감을 꺼내고, 세탁기에 넣는 흐름부터 완성하기.', 'ready', 1],
    ['팀원에게 요청한 이미지', '화면에 들어갈 사진을 요청했다.\n답장이 오면 파일을 확인하고 발표 자료에 반영하기.', 'waiting', 3],
    ['다음 프로젝트에 쓸 참고 자료', '물성으로 상태를 설명하는 제품들.\n손으로 옮기고, 펼치고, 접는 동작을 더 찾아보자.', 'reference', 4],
    ['교수님 피드백 정리하기', '핵심은 인터랙션의 개수보다 동작과 의미의 연결.\n각 동작이 실제 메모 상태를 바꾸도록 설계하기.', 'done', 5],
  ];
  return seed.map(([title, body, status, colorIndex], index) => {
    const createdAt = new Date(now - (index + 1) * 3_600_000).toISOString();
    const note = createNote({ title, body, color: CLOTH_COLORS[colorIndex] }, createdAt);
    note.id = `welcome-${index + 1}`;
    if (status !== 'inbox') {
      note.status = status;
      note.updatedAt = new Date(now - index * 1_800_000).toISOString();
      note.history.push({ at: note.updatedAt, from: 'inbox', to: status });
      if (status === 'done') note.completedAt = note.updatedAt;
    }
    return note;
  });
}

/** Never mutates notes or their histories. A rejected action returns the original array. */
export function transitionNote(notes, id, target, at = timestamp()) {
  const note = notes.find((item) => item.id === id);
  if (!note) return { notes, error: '이 메모를 찾을 수 없어요.' };
  if (!isStatus(target)) return { notes, error: '옮길 수 없는 곳이에요.' };
  if (note.status === target) return { notes, error: null };
  if (note.status === 'done' && target !== 'ready' && target !== 'inbox') {
    return { notes, error: '접어 둔 메모는 먼저 다시 펼쳐주세요.' };
  }
  if (target === 'washing' && notes.some((item) => item.id !== id && item.status === 'washing')) {
    return { notes, error: '한 번에 하나씩 집중해요. 세탁 중인 메모를 먼저 마치거나 멈춰주세요.' };
  }
  return {
    notes: notes.map((item) => item.id !== id ? item : {
      ...cloneNote(item),
      status: target,
      updatedAt: at,
      completedAt: target === 'done' ? at : null,
      history: [...(item.history ?? []).map((entry) => ({ ...entry })), { at, from: item.status, to: target }],
    }),
    error: null,
  };
}

function normalizeNotes(rawNotes) {
  if (!Array.isArray(rawNotes)) return null;
  const usedIds = new Set();
  let hasWashing = false;
  return rawNotes.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || typeof raw.title !== 'string' || !raw.title.trim()) return [];
    const at = timestamp();
    const id = typeof raw.id === 'string' && raw.id && !usedIds.has(raw.id) ? raw.id : makeId();
    usedIds.add(id);
    let status = isStatus(raw.status) ? raw.status : 'inbox';
    const history = Array.isArray(raw.history) ? raw.history.filter((entry) => entry && validDate(entry.at) && (entry.from === null || isStatus(entry.from)) && isStatus(entry.to)).map((entry) => ({ at: entry.at, from: entry.from, to: entry.to })) : [];
    if (status === 'washing') {
      if (hasWashing) {
        status = 'ready';
        history.push({ at, from: 'washing', to: 'ready' });
      } else hasWashing = true;
    }
    const createdAt = validDate(raw.createdAt) ? raw.createdAt : at;
    const updatedAt = validDate(raw.updatedAt) ? raw.updatedAt : createdAt;
    return [{
      id,
      title: raw.title.trim(),
      body: typeof raw.body === 'string' ? raw.body : '',
      waitReason: typeof raw.waitReason === 'string' ? raw.waitReason : '',
      color: typeof raw.color === 'string' && /^#[\da-f]{6}$/i.test(raw.color) ? currentColor(raw.color) : CLOTH_COLORS[0],
      status,
      createdAt,
      updatedAt,
      completedAt: status === 'done' ? (validDate(raw.completedAt) ? raw.completedAt : updatedAt) : null,
      history,
    }];
  });
}

/** Missing or corrupt storage gets a fresh demo; an intentionally empty room stays empty. */
export function loadNotes() {
  try {
    const serialized = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (serialized) {
      const stored = JSON.parse(serialized);
      if (stored?.version === 1) {
        const notes = normalizeNotes(stored.notes);
        if (notes) return notes;
      }
    }
  } catch {
    // Private browsing, disabled storage, malformed data: the room remains usable in memory.
  }
  const notes = createSeedNotes();
  saveNotes(notes);
  return notes;
}

/** Returns false when storage is unavailable or full, so the UI can disclose unsaved work. */
export function saveNotes(notes) {
  try {
    if (!globalThis.localStorage || !Array.isArray(notes)) return false;
    if (notes.some((note) => !isStatus(note.status)) || notes.filter((note) => note.status === 'washing').length > 1) return false;
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, notes }));
    return true;
  } catch {
    return false;
  }
}
