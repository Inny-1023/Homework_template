import { STATUSES, CLOTH_COLORS, createNote, loadNotes, saveNotes, transitionNote } from './model.js';
import { basketSvg, washerBodySvg, washerDoorSvg, plantSvg } from './art.js';
import { installFoldGestures } from './fold-gestures.js';
import { renderFoldableCloth } from './fold-art.js';
import { getWasherDropError, pointInDrum } from './washer-rules.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iconPaths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-8h6v8"/>',
  archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1.5-1.5 2.5M12 16.5v.1"/>',
  bookmark:'<path d="M6 3h12v18l-6-4-6 4Z"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>', spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 3v4M18 5h4"/>',
  hand:'<path d="M8 12V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v10c0 4-3 6-6 6s-5-2-6-4l-4-5a2 2 0 0 1 3-2Z"/>',
  pause:'<path d="M9 5v14M15 5v14"/>', check:'<path d="m5 12 4 4L19 6"/>', grip:'<circle cx="8" cy="8" r=".7"/><circle cx="12" cy="8" r=".7"/><circle cx="16" cy="8" r=".7"/><circle cx="8" cy="12" r=".7"/><circle cx="12" cy="12" r=".7"/><circle cx="16" cy="12" r=".7"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.spark}</svg>`;
function hydrateIcons(root = document) { $$('[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
hydrateIcons();

let notes = loadNotes();
let editingId = null;
let selectedColor = CLOTH_COLORS[0];
let undoSnapshot = null;
let toastTimer;
let drag = null;
let keyboardMove = null;
let suppressHandleClick = false;
let storageFailed = false;
let washerDoorOpen = false;
const unfoldedArchiveIds = new Set();
let sceneIndex = 0;
let dragSceneTimer;
let dragSceneTarget = null;
const sceneTrack = $('.stations');
const scenePanels = $$('.stations > .station');
const sceneForStatus = {inbox:0,ready:0,washing:1,waiting:2,reference:2};
const destinations = ['inbox', 'ready', 'washing', 'waiting', 'reference', 'done'];
const actionLabels = { inbox:'바구니로', ready:'직접 할 일로', washing:'세탁 시작', waiting:'건조대에 널기', reference:'참고할 생각으로', done:'접어 보관' };
const statusHelp = { inbox:'처리 방법을 아직 정하지 않은 생각이에요.', ready:'지금 내 손으로 할 수 있는 일이에요.', washing:'지금 이 한 벌에 집중하고 있어요.', waiting:'외부의 답변이나 시간이 필요한 일이에요.', reference:'필요할 때 꺼내 볼 생각이에요.', done:'끝낸 일을 잘 개어두었어요.' };
const dateLabel = value => new Intl.DateTimeFormat('ko-KR', {month:'numeric', day:'numeric', timeZone:'Asia/Seoul'}).format(new Date(value));
$('#today').textContent = new Intl.DateTimeFormat('ko-KR', {month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Seoul'}).format(new Date());

function persist() {
  const ok = saveNotes(notes);
  storageFailed = !ok;
  $('#save-label').textContent = ok ? '이 브라우저에 자동 저장됨' : '저장 공간을 확인해주세요';
  $('.save-status').classList.toggle('save-error', !ok);
  if (!ok) notify('브라우저에 저장하지 못했어요. 이 창을 닫기 전에 내용을 복사해주세요.', false);
  return ok;
}

function cloth(note, location) {
  const label = escapeHtml(note.title);
  const ready = location === 'ready' || location === 'reference';
  const textile = renderFoldableCloth(note.color);
  if (ready) return `<article class="compact-note" data-note="${note.id}"><span class="mini-cloth cloth-mini-surface" data-cloth-surface style="--fabric-open:1">${textile}${fabricHem(note)}</span><button class="cloth-handle compact-handle" data-handle="${note.id}" aria-label="${label} 옮기기. 좌우 방향키로 위치 선택, Enter로 이동">${icon('grip')}</button><button class="compact-open" data-open="${note.id}"><span class="compact-title">${label}</span><span class="open-arrow">↗</span></button></article>`;
  return `<article class="cloth ${location === 'washing' ? 'washing-cloth' : ''}" data-note="${note.id}" data-cloth-surface style="--cloth-color:${note.color};--fabric-open:1"><button class="cloth-handle" data-handle="${note.id}" aria-label="${label} 옮기기. 좌우 방향키로 위치 선택, Enter로 이동">${icon('grip')}</button><button class="cloth-open" data-open="${note.id}" ${location==='loading'?`data-load-shirt="${note.id}"`:''} aria-label="${label} ${location==='loading'?'옷을 잡아 드럼에 넣기. 누르면 내용 보기':'내용 보기'}"><span class="cloth-art">${textile}</span><span class="cloth-title">${label}</span>${location==='waiting'?`<span class="cloth-meta">${escapeHtml(note.waitReason || '응답을 기다리는 중')}</span>`:''}</button>${fabricHem(note)}</article>`;
}

function fabricHem(note, mode='fold') {
  const unfold=mode==='unfold';
  return `<span class="fabric-hem" data-${mode}="${note.id}" tabindex="0" role="slider" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${unfold?100:0}" aria-label="${escapeHtml(note.title)} 옷의 밑단. ${unfold?'아래로 끌어 원문 펼치기':'위로 끌어 접기'}" aria-valuetext="${unfold?'접힌 옷':'펼친 옷'}" title="${unfold?'접힌 밑단을 아래로 끌어 펼치세요':'옷 밑단을 위로 끌어 접으세요'}"></span>`;
}

function renderArchive() {
  const done=notes.filter(n=>n.status==='done').sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)));
  for(const id of unfoldedArchiveIds)if(!done.some(n=>n.id===id))unfoldedArchiveIds.delete(id);
  $('#done-notes').innerHTML=done.length?done.map(note=>{
    const open=unfoldedArchiveIds.has(note.id);
    return `<article class="folded-note ${open?'is-unfolded':''}" data-note="${note.id}" data-cloth-surface style="--fabric-open:${open?1:0}"><div class="archive-cloth">${renderFoldableCloth(note.color,{mode:open?'fold':'unfold',title:open?note.title:''})}${fabricHem(note,open?'fold':'unfold')}</div><div class="archive-note-caption"><h3>${escapeHtml(note.title)}</h3><time>${dateLabel(note.completedAt||note.updatedAt)} · 완료 보관</time></div>${open?`<div class="unfolded-memo"><span class="state-chip">완료 기록</span><h3>${escapeHtml(note.title)}</h3><div class="unfolded-memo-body">${escapeHtml(note.body||'자세한 내용이 없는 메모예요.')}</div><details><summary>작업 기록 ${note.history.length}</summary><ol>${note.history.map(h=>`<li><time>${dateLabel(h.at)}</time> ${h.from?escapeHtml(STATUSES[h.from])+' → ':''}${escapeHtml(STATUSES[h.to])}</li>`).join('')}</ol></details><button type="button" class="text-button" data-open="${note.id}">내용 수정 ↗</button><p class="refold-hint">옷 밑단을 위로 끌면 다시 접힙니다.</p></div>`:''}</article>`;
  }).join(''):'<p class="empty-note archive-empty">옷 밑단을 위로 끌어 접으면 완료한 메모가 여기에 보관됩니다.</p>';
  $('#archive-nav-count').textContent=done.length;
  $('#completion-message').textContent=done.length?`지금까지 ${done.length}벌의 생각을 정리했어요. 잘하고 있어요 ☺`:'오늘의 첫 번째 정리를 시작해볼까요?';
}

function render() {
  for (const status of destinations) {
    const count = notes.filter(n => n.status === status).length;
    $$(`[data-count="${status}"]`).forEach(el => { el.textContent = String(count).padStart(2,'0'); });
  }
  for (const status of ['inbox','ready','waiting','reference']) {
    const items = notes.filter(n => n.status === status);
    const empty = {inbox:'바구니가 가벼워졌어요',ready:'옷을 여기로 옮겨 분류해보세요',waiting:'지금은 기다리는 일이 없어요',reference:'기억하고 싶은 생각을 놓아주세요'};
    $(`#${status}-notes`).innerHTML = items.length ? items.map(n => cloth(n,status)).join('') : `<p class="empty-note">${empty[status]}</p>`;
  }
  $('#basket-art').innerHTML = basketSvg();
  $('#plant-art').innerHTML = plantSvg();
  renderWasher();
  renderArchive();
}

function renderWasher() {
  const washing=notes.find(n=>n.status==='washing');
  if(washing)washerDoorOpen=false;
  $('.washer-scene').classList.toggle('is-running',Boolean(washing));
  $('.washer-scene').classList.toggle('is-door-open',washerDoorOpen);
  $('#washer-art').innerHTML=washerBodySvg(Boolean(washing));
  $('#washer-door').innerHTML=washerDoorSvg();
  $('#washer-door').setAttribute('aria-expanded',String(washerDoorOpen));
  $('#washer-door').setAttribute('aria-disabled',String(Boolean(washing)));
  $('#washer-door').setAttribute('aria-label',washing?'세탁 중인 문: 잠시 멈추기를 누르면 잠금이 풀려요':washerDoorOpen?'세탁기 문 닫기':'세탁기 문 손잡이를 눌러 열기');
  $('#washer-drum-target').setAttribute('aria-label',washerDoorOpen?'열린 세탁기 드럼 안쪽: 여기에 옷을 놓으세요':'닫힌 세탁기 드럼: 문을 먼저 열어주세요');
  $('#machine-screen').textContent=washing?'IN PROGRESS':washerDoorOpen?'OPEN':'READY';
  $('#washer-content').innerHTML=washing?cloth(washing,'washing'):`<div class="drum-empty"><span>${washerDoorOpen?'↓':'↗'}</span><p>${washerDoorOpen?'옷을 드럼 안에<br>놓아주세요':'문을 먼저<br>열어주세요'}</p></div>`;
  const queue=notes.filter(n=>n.status==='ready'||n.status==='inbox').sort((a,b)=>(a.status==='ready'?0:1)-(b.status==='ready'?0:1));
  $('#washer-loading-notes').innerHTML=queue.length?queue.map(n=>cloth(n,'loading')).join(''):'<p class="empty-note">직접 할 일로 분류한 옷이 여기에 놓입니다. 바구니에서 옷을 잡은 채 화면을 넘겨 가져올 수도 있어요.</p>';
  $('#door-hint').textContent=washing?'세탁 중에는 문이 잠겨요. 작업을 멈추면 옷을 다시 꺼낼 수 있어요.':washerDoorOpen?'옆의 옷을 열린 드럼 안에 놓으면 문이 닫히고 세탁이 시작돼요.':'둥근 문의 손잡이를 눌러 연 뒤, 옆의 옷을 드럼 안으로 옮겨주세요.';
  $('#washer-actions').innerHTML=washing?`<button class="secondary" data-machine="ready">${icon('pause')}잠시 멈추기</button><p class="physical-fold-hint">꺼낸 옷의 밑단을 접으면 완료 보관됩니다.</p>`:'<span class="machine-idle-label"><i></i>문 열기 → 옷 넣기 → 세탁 시작</span>';
  $('#washer-footnote').innerHTML=washing?`<span class="active-work-title">${escapeHtml(washing.title)}</span>`:`${icon('spark')}한 번에 한 벌, 내 속도대로.`;
}

function loadWasher(id) {
  const note=notes.find(n=>n.id===id);
  const error=getWasherDropError({doorOpen:washerDoorOpen,activeNoteId:notes.find(n=>n.status==='washing')?.id,noteId:note?.id,noteStatus:note?.status});
  if(error){notify(error);return false;}
  washerDoorOpen=false;
  return moveNote(id,'washing',{fromDrum:true});
}

$('#washer-door').addEventListener('click',()=>{
  if(notes.some(n=>n.status==='washing')){notify('세탁 중인 문은 잠겨 있어요. 잠시 멈추기를 먼저 눌러주세요.');return;}
  washerDoorOpen=!washerDoorOpen;
  renderWasher();
  notify(washerDoorOpen?'문을 열었어요. 옆의 티셔츠를 열린 드럼 안에 넣어주세요.':'세탁기 문을 닫았어요.');
});

function notify(message, canUndo = false, persistent = false) {
  clearTimeout(toastTimer);
  if (storageFailed && !message.includes('저장하지 못')) message += ' 브라우저에 저장하지 못했어요. 내용을 복사해두세요.';
  $('#toast-text').textContent = message;
  $('#undo').hidden = !canUndo;
  $('#toast').classList.add('visible');
  if (!persistent) toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 6500);
}

function moveNote(id, target, {fromDrum=false}={}) {
  if(target==='washing'&&!fromDrum){notify('세탁기 문을 열고 옷을 드럼 안으로 직접 넣어주세요.');return false;}
  const before = notes;
  const original = notes.find(n => n.id === id);
  if (!original || original.status === target) return;
  const result = transitionNote(notes,id,target);
  if (result.error) { notify(result.error); return false; }
  undoSnapshot = before;
  notes = result.notes;
  render(); persist();
  if (Object.hasOwn(sceneForStatus,target)) goToScene(sceneForStatus[target]);
  if (target === 'inbox') $('#inbox-notes').scrollTo({left:$('#inbox-notes').scrollWidth,behavior:'smooth'});
  const messages = { inbox:'생각 바구니에 다시 담았어요.',ready:original.status === 'washing' ? '작업을 잠시 멈췄어요. 기록은 남아 있어요.' : '직접 할 일로 분류했어요.', washing:'세탁을 시작했어요. 이 한 벌에 집중해봐요.',waiting:'건조대에 널었어요. 답변이 오면 다시 꺼내요.',reference:'언젠가 꺼낼 생각으로 모아두었어요.',done:'잘 마쳤어요! 접어서 보관했어요.' };
  notify(messages[target],true);
  return true;
}

function formValues() {
  return {title:$('#memo-title').value.trim(), body:$('#memo-body').value, color:selectedColor, waitReason:$('#wait-reason').value.trim()};
}

function saveEditor(close = true) {
  const values = formValues();
  if (!values.title) { $('#form-error').textContent = '메모의 제목을 적어주세요.'; $('#memo-title').focus(); return false; }
  const now = new Date().toISOString();
  undoSnapshot = notes;
  if (editingId) notes = notes.map(n => n.id === editingId ? {...n,...values,updatedAt:now} : n);
  else notes = [...notes,{...createNote(values),waitReason:values.waitReason}];
  render(); persist();
  if (!editingId) { goToScene(0); $('#inbox-notes').scrollTo({left:$('#inbox-notes').scrollWidth,behavior:'smooth'}); }
  if (close) { $('#memo-dialog').close(); notify(editingId ? '펼친 메모를 저장했어요.' : '새로운 생각 한 벌을 바구니에 담았어요.',true); }
  return true;
}

function showEditor(id = null) {
  editingId = id;
  const note = notes.find(n => n.id === id);
  selectedColor = note?.color || CLOTH_COLORS[0];
  $('#memo-title').value = note?.title || '';
  $('#memo-body').value = note?.body || '';
  $('#wait-reason').value = note?.waitReason || '';
  $('#memo-state').textContent = note ? STATUSES[note.status] : '새로운 생각';
  $('#memo-dialog-title').textContent = note?.status === 'done' ? '잘 개어둔 생각을 펼쳐요' : note ? '생각을 펼쳐보세요' : '어떤 생각이 떠올랐나요?';
  $('#editor-subtitle').textContent = note ? statusHelp[note.status] : '분류는 나중에. 우선 가볍게 담아보세요.';
  $('#save-memo').innerHTML = note ? `수정 내용 저장 ${icon('check')}` : `바구니에 담기 <span>↗</span>`;
  $('#delete-note').hidden = !note;
  $('#waiting-field').hidden = note?.status !== 'waiting';
  $('#form-error').textContent = '';
  renderColorOptions();
  $('#history-area').innerHTML = note ? `<details class="history-details"><summary>작업 기록 <span>${note.history.length}</span></summary><ol>${note.history.map(h => `<li><time>${dateLabel(h.at)}</time><span>${h.from ? escapeHtml(STATUSES[h.from])+' → ' : ''}${escapeHtml(STATUSES[h.to])}</span></li>`).join('')}</ol></details>` : '';
  const options = note ? (note.status==='done' ? ['ready','inbox'] : destinations.filter(s => s !== note.status && s !== 'done' && s !== 'washing')) : [];
  $('#memo-transitions').innerHTML = note ? `<span class="transition-label">이 메모를 어디에 둘까요?</span><div>${options.map(s => `<button type="button" class="transition-button" data-transition="${s}">${s==='done'?'⌑ ':''}${actionLabels[s]}</button>`).join('')}</div>` : '';
  $('#memo-dialog').showModal();
  $('#memo-title').focus({preventScroll:true});
}

function renderColorOptions() {
  const colorNames = ['살구 분홍','세이지 초록','크림 노랑','하늘 파랑','라벤더 보라','따뜻한 주황'];
  $('#color-options').innerHTML = CLOTH_COLORS.map((c,i) => `<button type="button" class="color-option ${c===selectedColor?'selected':''}" style="--swatch:${c}" data-color="${c}" aria-label="${colorNames[i]}" aria-pressed="${c===selectedColor}">${c===selectedColor?icon('check'):''}</button>`).join('');
  const note = notes.find(n=>n.id===editingId);
  $('#editor-garment').removeAttribute('aria-hidden');
  $('#editor-garment').setAttribute('data-cloth-surface','');
  $('#editor-garment').style.setProperty('--fabric-open','1');
  $('#editor-garment').innerHTML = renderFoldableCloth(selectedColor)+(note?fabricHem(note):'');
}

document.addEventListener('click', e => {
  const open = e.target.closest('[data-open]');
  const handle = e.target.closest('[data-handle]');
  if (open && !suppressHandleClick) showEditor(open.dataset.open);
  else if (handle && !suppressHandleClick && !keyboardMove) showEditor(handle.dataset.handle);
  const machine = e.target.closest('[data-machine]');
  if (machine) { const n=notes.find(n=>n.status==='washing'); if(n) moveNote(n.id,machine.dataset.machine); }
  const color=e.target.closest('[data-color]');
  if(color) {selectedColor=color.dataset.color;renderColorOptions();}
  const transition=e.target.closest('[data-transition]');
  if(transition && editingId) {
    const target=transition.dataset.transition;
    const current = notes.find(n=>n.id===editingId);
    const validation = transitionNote(notes,editingId,target);
    if(validation.error){$('#form-error').textContent=validation.error;return;}
    if(saveEditor(false) && moveNote(current.id,target)) $('#memo-dialog').close();
  }
});
$$('.new-note').forEach(b=>b.addEventListener('click',()=>showEditor()));
$$('.dialog-close').forEach(b=>b.addEventListener('click',()=>$('#memo-dialog').close()));
$('#memo-dialog').addEventListener('close',()=>{
  const returnTarget = editingId ? ($(`#scene-${sceneIndex} [data-open="${editingId}"]`)||$(`#done-notes [data-open="${editingId}"]`)||$(`[data-open="${editingId}"]`)) : null;
  const panel = returnTarget?.closest('.station');
  if (panel) goToScene(scenePanels.indexOf(panel),false);
  (returnTarget || $('.new-note')).focus({preventScroll:true});
});
$('#memo-form').addEventListener('submit',e=>{e.preventDefault();saveEditor();});
$('#delete-note').addEventListener('click',()=>{
  undoSnapshot=notes; notes=notes.filter(n=>n.id!==editingId);render();persist();$('#memo-dialog').close();notify('메모를 삭제했어요.',true);
});
$('#undo').addEventListener('click',()=>{if(!undoSnapshot)return;notes=undoSnapshot;undoSnapshot=null;render();persist();notify('이전 상태로 되돌렸어요.');});
for(const id of ['guide-open','guide-quick']) $('#'+id).addEventListener('click',()=>$('#guide-dialog').showModal());
$$('.guide-close').forEach(b=>b.addEventListener('click',()=>$('#guide-dialog').close()));
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('#nav-room').addEventListener('click',()=>{$('#nav-room').classList.add('active');$('#nav-archive').classList.remove('active');goToScene(0);window.scrollTo({top:0,behavior:'smooth'});});
$('#nav-archive').addEventListener('click',()=>{$('#nav-room').classList.remove('active');$('#nav-archive').classList.add('active');$('#done-notes').hidden=false;$('#archive-toggle').setAttribute('aria-expanded','true');$('#archive-section').scrollIntoView({behavior:'smooth',block:'center'});});
$('#archive-toggle').addEventListener('click',()=>{const closed=!$('#done-notes').hidden;$('#done-notes').hidden=closed;$('#archive-toggle').setAttribute('aria-expanded',String(!closed));$('#archive-toggle').innerHTML=`${closed?'기록 보기':'기록 숨기기'} ${icon('chevron')}`;});

function destinationAt(x,y) {
  const drum=$('#washer-drum-target');
  const track=sceneTrack.getBoundingClientRect();
  if(x>=track.left&&x<=track.right&&y>=track.top&&y<=track.bottom&&pointInDrum(x,y,drum.getBoundingClientRect()))return drum;
  const target=document.elementFromPoint(x,y)?.closest('[data-drop]');
  return target?.dataset.drop==='washing'?null:target;
}
function clearDropHighlights() {$$('.drop-target,.keyboard-target,.drop-rejected,.door-closed').forEach(el=>el.classList.remove('drop-target','keyboard-target','drop-rejected','door-closed'));}
function cleanDrag() {
  if(!drag)return;
  drag.ghost?.remove();drag.source?.classList.remove('drag-source');
  document.body.classList.remove('is-dragging');clearDropHighlights();drag=null;
  clearTimeout(dragSceneTimer);dragSceneTarget=null;syncSceneNavigation();
}
document.addEventListener('pointerdown',e=>{
  const handle=e.target.closest('[data-handle],[data-load-shirt]');
  if(!handle||e.button!==0)return;
  cancelKeyboardMove();
  const source=handle.closest('[data-note]');
  const rect=source.getBoundingClientRect();
  drag={id:handle.dataset.handle||handle.dataset.loadShirt,handle,source,startX:e.clientX,startY:e.clientY,offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,width:rect.width,height:rect.height,pointerId:e.pointerId,active:false};
  handle.setPointerCapture(e.pointerId);
});
document.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pointerId)return;
  if(!drag.active && Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<6)return;
  if(!drag.active){
    drag.active=true;
    drag.ghost=document.createElement('div');drag.ghost.className='drag-ghost';drag.ghost.innerHTML=drag.source.outerHTML;drag.ghost.style.width=`${drag.width}px`;document.body.append(drag.ghost);
    drag.source.classList.add('drag-source');document.body.classList.add('is-dragging');
    scenePanels.forEach(panel=>{panel.inert=false;});
  }
  const left=Math.max(0,Math.min(window.innerWidth-drag.width,e.clientX-drag.offsetX));
  const top=Math.max(0,Math.min(window.innerHeight-drag.height,e.clientY-drag.offsetY));
  drag.ghost.style.transform=`translate(${left}px,${top}px) rotate(-5deg)`;
  clearDropHighlights();const target=destinationAt(e.clientX,e.clientY);
  if(target){
    const rejected=target.hasAttribute('data-washer-drum')&&(!washerDoorOpen||notes.some(n=>n.status==='washing'));
    target.classList.add(rejected?'drop-rejected':'drop-target');
    if(rejected)$('.washer-scene').classList.add('door-closed');
  }
  const hoveredStep=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-scene]');
  let nextScene=hoveredStep?Number(hoveredStep.dataset.scene):null;
  const trackRect=sceneTrack.getBoundingClientRect();
  if(nextScene===null && e.clientY>trackRect.top && e.clientY<trackRect.bottom){
    if(e.clientX>trackRect.right-65 && sceneIndex<2)nextScene=sceneIndex+1;
    else if(e.clientX<trackRect.left+65 && sceneIndex>0)nextScene=sceneIndex-1;
  }
  if(nextScene!==dragSceneTarget){
    clearTimeout(dragSceneTimer);dragSceneTarget=nextScene;
    if(nextScene!==null && nextScene!==sceneIndex)dragSceneTimer=setTimeout(()=>{goToScene(nextScene);},450);
  }
  // Allow a long touch/mouse drag to reach the archive on smaller screens.
  if(e.clientY>window.innerHeight-55)window.scrollBy(0,12);
  else if(e.clientY<55)window.scrollBy(0,-12);
});
document.addEventListener('pointerup',e=>{
  if(!drag||e.pointerId!==drag.pointerId)return;
  const active=drag.active;const id=drag.id;const target=active?destinationAt(e.clientX,e.clientY)?.dataset.drop:null;
  const onNavigation=Boolean(document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-scene]'));
  cleanDrag();
  if(active){
    suppressHandleClick=true;setTimeout(()=>suppressHandleClick=false,300);
    if(target==='washing')loadWasher(id);
    else if(target)moveNote(id,target);
    else notify(onNavigation?'탭은 화면만 바꿔요. 옷은 열린 드럼이나 실제 바구니·건조대 위에 놓아주세요.':washerDoorOpen?'옷을 둥근 드럼 안쪽에 놓아야 세탁이 시작돼요.':'세탁하려면 문을 먼저 열고, 둥근 드럼 안쪽에 옷을 놓아주세요.');
  }
});
document.addEventListener('pointercancel',cleanDrag);
document.addEventListener('lostpointercapture',cleanDrag);
window.addEventListener('blur',()=>{cleanDrag();cancelKeyboardMove();});
function cancelKeyboardMove(){if(!keyboardMove)return;keyboardMove=null;clearDropHighlights();$('#toast').classList.remove('visible');}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){cleanDrag();cancelKeyboardMove();return;}
  const handle=e.target.closest('[data-handle]');if(!handle)return;
  if(['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(e.key)){
    e.preventDefault();const n=notes.find(n=>n.id===handle.dataset.handle);
    if(!keyboardMove)keyboardMove={id:n.id,index:destinations.indexOf(n.status)};
    keyboardMove.index=(keyboardMove.index+(['ArrowRight','ArrowDown'].includes(e.key)?1:5))%destinations.length;
    clearDropHighlights();const target=destinations[keyboardMove.index];
    $(`[data-drop="${target}"]`)?.classList.add('keyboard-target');notify(`${STATUSES[target]} 선택. ${target==='washing'?'문을 먼저 연 뒤 Enter로 드럼에 넣어요.':'Enter로 옮기고 Esc로 취소해요.'}`,false,true);
  }else if((e.key==='Enter'||e.key===' ')&&keyboardMove){
    e.preventDefault();const {id,index}=keyboardMove;cancelKeyboardMove();
    if(destinations[index]==='washing')loadWasher(id);else moveNote(id,destinations[index]);
    const replacement=$(`#scene-${sceneIndex} [data-handle="${id}"]`)||$(`#scene-${sceneIndex} [data-open="${id}"]`)||$(`[data-handle="${id}"]`);replacement?.focus();
  }
});
document.addEventListener('focusout',e=>{if(keyboardMove&&e.target.closest('[data-handle]'))cancelKeyboardMove();});

function syncSceneNavigation(){
  $$('.scene-step').forEach((button,index)=>{
    const active=index===sceneIndex;
    button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
  });
  scenePanels.forEach((panel,index)=>{panel.inert=Boolean(index!==sceneIndex&&!drag?.active);});
  $('#scene-prev').disabled=sceneIndex===0;$('#scene-next').disabled=sceneIndex===2;
  $('.scene-counter').textContent=`0${sceneIndex+1} / 03`;
}
function goToScene(index, smooth=true){
  sceneIndex=Math.max(0,Math.min(2,index));
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  sceneTrack.scrollTo({left:sceneIndex*sceneTrack.clientWidth,behavior:smooth&&!reduce?'smooth':'instant'});
  syncSceneNavigation();
}
$$('.scene-step').forEach(button=>{
  button.addEventListener('click',()=>goToScene(Number(button.dataset.scene)));
  button.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?2:sceneIndex+(event.key==='ArrowRight'?1:-1);
    goToScene(next);$(`[data-scene="${sceneIndex}"]`).focus();
  });
});
$('#scene-prev').addEventListener('click',()=>goToScene(sceneIndex-1));
$('#scene-next').addEventListener('click',()=>goToScene(sceneIndex+1));
sceneTrack.addEventListener('keydown',event=>{
  if(event.target!==sceneTrack || !['ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();goToScene(sceneIndex+(event.key==='ArrowRight'?1:-1));
});
let scrollFrame;
sceneTrack.addEventListener('scroll',()=>{
  cancelAnimationFrame(scrollFrame);
  scrollFrame=requestAnimationFrame(()=>{
    const index=Math.round(sceneTrack.scrollLeft/sceneTrack.clientWidth);
    if(index!==sceneIndex){sceneIndex=Math.max(0,Math.min(2,index));syncSceneNavigation();}
  });
},{passive:true});
let swipe=null;
sceneTrack.addEventListener('pointerdown',event=>{
  if(event.pointerType!=='mouse'||event.button!==0||event.target.closest('button,input,textarea,select,a,[data-note]'))return;
  swipe={x:event.clientX,left:sceneTrack.scrollLeft,pointerId:event.pointerId,moved:false,index:sceneIndex,delta:0};
  sceneTrack.setPointerCapture(event.pointerId);
});
sceneTrack.addEventListener('pointermove',event=>{
  if(!swipe||event.pointerId!==swipe.pointerId)return;
  const delta=event.clientX-swipe.x;
  if(Math.abs(delta)<6&&!swipe.moved)return;
  swipe.moved=true;swipe.delta=delta;sceneTrack.classList.add('is-swiping');
  sceneTrack.scrollLeft=swipe.left-delta;
});
function finishSwipe(){
  if(!swipe)return;
  const current=swipe;swipe=null;sceneTrack.classList.remove('is-swiping');
  if(current.moved)goToScene(Math.abs(current.delta)>70?current.index+(current.delta<0?1:-1):Math.round(sceneTrack.scrollLeft/sceneTrack.clientWidth));
}
sceneTrack.addEventListener('pointerup',finishSwipe);
sceneTrack.addEventListener('pointercancel',finishSwipe);
sceneTrack.addEventListener('lostpointercapture',finishSwipe);
window.addEventListener('resize',()=>goToScene(sceneIndex,false));
window.addEventListener('storage',e=>{if(e.key==='neolda.laundry-room.v1'&&!$('#memo-dialog').open&&!drag){notes=loadNotes();render();notify('다른 탭의 변경 내용을 반영했어요.');}});
render();persist();syncSceneNavigation();
installFoldGestures({
  getNote(id){
    const note=notes.find(n=>n.id===id);
    if(note&&editingId===id&&$('#memo-dialog').open)return {...note,...formValues()};
    return note;
  },
  onFold(id){
    if(editingId===id&&$('#memo-dialog').open&&!saveEditor(false))return false;
    const note=notes.find(n=>n.id===id);
    if(!note)return false;
    if(note.status==='done'){
      unfoldedArchiveIds.delete(id);renderArchive();
      notify('원문과 완료 기록을 그대로 접어두었어요.');
    }else if(!moveNote(id,'done'))return false;
    if($('#memo-dialog').open)$('#memo-dialog').close();
    $('#done-notes').hidden=false;
    $('#archive-toggle').setAttribute('aria-expanded','true');
    $('#archive-toggle').innerHTML=`기록 숨기기 ${icon('chevron')}`;
    requestAnimationFrame(()=>{
      $(`[data-unfold="${id}"]`)?.focus({preventScroll:true});
      $('#archive-section').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
    });
    return true;
  },
  onUnfold(id){
    if(!notes.some(n=>n.id===id))return false;
    unfoldedArchiveIds.add(id);renderArchive();
    $(`#done-notes [data-note="${id}"] [data-fold]`)?.focus({preventScroll:true});
    notify('옷을 펼쳤어요. 같은 자리에서 원문을 확인하세요.');
    return true;
  },
  onHint:message=>notify(message),
});
