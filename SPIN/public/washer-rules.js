/** Physical loading is allowed only through an open, unoccupied washer. */
export function getWasherDropError({ doorOpen = false, activeNoteId = null, noteId, noteStatus } = {}) {
  if (typeof noteId !== 'string' || !noteId.trim() || typeof noteStatus !== 'string' || !noteStatus) {
    return '이 메모를 찾을 수 없어요.';
  }
  if (noteStatus === 'done') return '완료한 옷은 바구니로 다시 꺼낸 뒤 세탁해주세요.';
  if (activeNoteId !== null && activeNoteId !== undefined) {
    return activeNoteId === noteId
      ? '이미 세탁 중인 옷이에요.'
      : '세탁 중인 옷을 먼저 마치거나 멈춰주세요.';
  }
  if (!doorOpen) return '세탁기 문을 먼저 열어주세요.';
  return null;
}

/** A rectangular hit box is insufficient: loading must land inside the round drum. */
export function pointInDrum(x, y, rect) {
  if (!rect) return false;
  const { left, top, width, height } = rect;
  if (![x, y, left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return false;
  const horizontal = (x - left - width / 2) / (width / 2);
  const vertical = (y - top - height / 2) / (height / 2);
  return horizontal * horizontal + vertical * vertical <= 1;
}
