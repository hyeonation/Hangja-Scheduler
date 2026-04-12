// ══════════════════════════════════════════
// STATE  — 앱 전역 상태 변수
// ══════════════════════════════════════════

// 인원 목록: { id, name, position, note }
let personnel = JSON.parse(localStorage.getItem('personnel') || '[]');
// 직책 목록 (직책 관리 탭에서 편집)
let positions = JSON.parse(localStorage.getItem('positions') || '["행자","스탭","바라지"]');
// 인원 등록 폼에서 현재 선택된 직책
let selectedPos = positions[0] || ''; // 기본값: 직책 목록 첫 번째, 없으면 빈 값

// ── 표시 시간 범위 (시 단위, 0–24) ──
// overview·gantt가 동일한 범위를 공유한다.
// ovStartH / ganttStartH 는 하위 호환성을 위한 별칭(alias)이다.
let viewStartH  = parseInt(localStorage.getItem('viewStartH') || '0');
let viewEndH    = parseInt(localStorage.getItem('viewEndH')   || '24');
let ovStartH    = viewStartH,  ovEndH    = viewEndH;   // overview용 alias
let ganttStartH = viewStartH,  ganttEndH = viewEndH;   // gantt용 alias

// 시간 범위를 localStorage에 저장
function saveTimeRange() {
  localStorage.setItem('viewStartH', viewStartH);
  localStorage.setItem('viewEndH',   viewEndH);
}

// ── 뷰 범위 → 분(minutes) 변환 헬퍼 ──
// Imported from timeUtils.js

// 표시 범위 셀렉트 변경 핸들러 — overview·gantt 동시 갱신
function onViewRangeChange() {
  const s = parseInt(document.getElementById('viewStartH').value);
  const e = parseInt(document.getElementById('viewEndH').value);
  if (s >= e) { toast('⚠ 시작 시간이 종료 시간보다 작아야 합니다.'); return; }
  viewStartH = s; viewEndH = e;
  ovStartH = s; ovEndH = e;       // alias 동기화
  ganttStartH = s; ganttEndH = e;
  saveTimeRange();
  renderOverview();
  const ganttPage = document.getElementById('page1');
  if (ganttPage && ganttPage.classList.contains('active')) refreshGantt();
}

// 표시 범위를 0–24시(전체)로 초기화
function resetViewRange() {
  viewStartH = 0; viewEndH = 24;
  ovStartH = 0; ovEndH = 24;
  ganttStartH = 0; ganttEndH = 24;
  saveTimeRange();
  syncViewSelects();
  renderOverview();
  const ganttPage = document.getElementById('page1');
  if (ganttPage && ganttPage.classList.contains('active')) refreshGantt();
}

// 하위 호환성 alias — 구버전 HTML onclick 속성에서 호출될 수 있음
function onTimeRangeChange()      { onViewRangeChange(); }
function onGanttTimeRangeChange() { onViewRangeChange(); }
function resetTimeRange()         { resetViewRange(); }
function resetGanttTimeRange()    { resetViewRange(); }

// 모든 시간 범위 <select> 요소를 현재 viewStartH / viewEndH 값으로 동기화
function syncViewSelects() {
  const els = ['viewStartH','viewEndH','ovStartH','ovEndH','ganttStartH','ganttEndH'];
  els.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = id.includes('End') ? viewEndH : viewStartH;
  });
}
function syncOvSelects()    { syncViewSelects(); } // alias
function syncGanttSelects() { syncViewSelects(); } // alias

// ── 날짜별 데이터 키 ──
// 소임 데이터는 날짜별로 저장된다: 'dutyRows_YYYY-MM-DD'
// todayStr() is provided by timeUtils.js
// 현재 보고 있는 날짜 (앱 시작 시 마지막으로 열었던 날짜 복원, 없으면 오늘)
let currentDate = localStorage.getItem('currentDate') || todayStr();
// 현재 날짜의 소임 목록: { id, start, end, duty, assigned[] }
let dutyRows    = JSON.parse(localStorage.getItem('dutyRows_'+currentDate) || '[]');

// ── Undo / Redo 히스토리 ──
const MAX_UNDO    = 30;           // 최대 되돌리기 단계 수
const MINS_IN_DAY = 1440;        // 하루 총 분(分) — 시간 계산 전반에 사용
let undoStack = []; // 변경 직전 dutyRows의 JSON 스냅샷을 쌓는다
let redoStack = []; // undo 직전 상태를 쌓아 redo에 활용한다

// 현재 dutyRows 상태를 undoStack에 저장 (변경 작업 전에 호출)
function snapshot() {
  undoStack.push(JSON.stringify(dutyRows));
  if (undoStack.length > MAX_UNDO) undoStack.shift(); // 한도 초과 시 가장 오래된 것 제거
  redoStack = []; // 새 변경이 생기면 redo 히스토리는 초기화
  updateHistoryBtns();
}

// 되돌리기/다시실행 버튼과 뱃지를 현재 스택 상태에 맞게 갱신
function updateHistoryBtns() {
  _setHistoryBtn('undoBtn', 'undoBadge', undoStack.length);
  _setHistoryBtn('redoBtn', 'redoBadge', redoStack.length);
}
// 버튼 비활성화·뱃지 표시를 처리하는 내부 헬퍼
function _setHistoryBtn(btnId, badgeId, count) {
  const btn   = document.getElementById(btnId);
  const badge = document.getElementById(badgeId);
  if (!btn) return;
  btn.disabled = count === 0;
  if (badge) {
    badge.style.display = count > 0 ? 'flex' : 'none';
    badge.textContent   = count;
  }
}
function updateUndoBtn() { updateHistoryBtns(); } // 하위 호환성 alias

// 가장 최근 변경을 되돌린다 (Ctrl+Z)
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(dutyRows)); // 현재 상태를 redo 스택에 보관
  dutyRows = JSON.parse(undoStack.pop());
  save();
  rebuildDutyTable();
  refreshAllChipsConflicts();
  renderOverview();
  updateHistoryBtns();
  toast('↩ 되돌리기');
}

// undo를 취소하고 다시 앞으로 돌아간다 (Ctrl+Y / Ctrl+Shift+Z)
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(dutyRows)); // 현재 상태를 undo 스택에 보관
  dutyRows = JSON.parse(redoStack.pop());
  save();
  rebuildDutyTable();
  refreshAllChipsConflicts();
  renderOverview();
  updateHistoryBtns();
  toast('↪ 다시실행');
}

// ── 행 선택 상태 ──
// 현재 체크박스로 선택된 소임 행들의 id Set
const selectedIds = new Set();

// 필터: 선택 가능한 필터 목록을 배열로 저장합니다.
// 가능한 값: 'all' (전원 참여), 'partial' (개별 참여), 'noneAssigned' (참여 없음)
// 비어있으면 필터 없음(모두 표시)
let selectedFilters = JSON.parse(localStorage.getItem('selectedFilters') || '[]');

function getVisibleDutyRows() {
  if (!selectedFilters || !selectedFilters.length) return dutyRows;
  const out = [];
  dutyRows.forEach(r => {
    const isAll = isAllPersonnel(r);
    const hasAssigned = r.assigned && r.assigned.length > 0;
    if (selectedFilters.includes('all') && isAll) out.push(r);
    else if (selectedFilters.includes('partial') && hasAssigned && !isAll) out.push(r);
    else if (selectedFilters.includes('noneAssigned') && !hasAssigned) out.push(r);
  });
  return out;
}

// ── 마우스 드래그로 여러 행 선택 ──
// tbody 위에서 마우스를 드래그하면 지나간 행들이 일괄 선택/해제된다.
(function() {
  let dragging = false;
  let dragSelectMode = null; // true = 선택 모드, false = 해제 모드

  // 화면 좌표(x, y)에서 #dutyBody 내부의 <tr>을 반환
  function getRowFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    return el.closest('#dutyBody tr');
  }

  // 특정 행을 mode(true=선택, false=해제)에 따라 처리
  function applyToRow(tr, mode) {
    if (!tr || !tr.dataset.id) return;
    const id = parseInt(tr.dataset.id);
    const cb = tr.querySelector('.row-select-cb');
    if (!cb) return;
    if (mode === true && !selectedIds.has(id)) {
      selectedIds.add(id);
      cb.checked = true;
      tr.classList.add('selected-row');
    } else if (mode === false && selectedIds.has(id)) {
      selectedIds.delete(id);
      cb.checked = false;
      tr.classList.remove('selected-row');
    }
  }

  // 마우스 버튼을 누를 때: 드래그 시작 여부 결정
  document.addEventListener('mousedown', e => {
    if (e.button !== 0) return; // 좌클릭만 처리
    const tr = getRowFromPoint(e.clientX, e.clientY);
    if (!tr || !tr.closest('#dutyBody')) return;
    // 입력 요소나 특정 영역 클릭은 드래그 선택 시작하지 않음
    const tag = e.target.tagName;
    if (['INPUT','BUTTON','SELECT','LABEL','svg','circle','path','rect'].includes(tag)) return;
    if (e.target.closest('.chip-area, .action-cell, .drag-handle, .bulk-toolbar')) return;

    dragging = true;
    const id = parseInt(tr.dataset.id);
    // 이미 선택된 행이면 해제 모드, 아니면 선택 모드
    dragSelectMode = !selectedIds.has(id);
    applyToRow(tr, dragSelectMode);
    updateBulkToolbar();
    updateSelectAllCb();
    e.preventDefault(); // 텍스트 드래그 방지
  });

  // 마우스를 이동할 때: 드래그 중이면 지나가는 행에 선택/해제 적용
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const tr = getRowFromPoint(e.clientX, e.clientY);
    if (!tr || !tr.closest('#dutyBody')) return;
    applyToRow(tr, dragSelectMode);
    updateBulkToolbar();
    updateSelectAllCb();
  });

  // 마우스 버튼을 뗄 때: 드래그 종료
  document.addEventListener('mouseup', () => {
    dragging = false;
    dragSelectMode = null;
  });
})();

// 체크박스 onChange 핸들러 — 선택 상태를 Set에 반영하고 UI 갱신
function onRowSelectChange(rowId, checked) {
  if (checked) selectedIds.add(rowId);
  else         selectedIds.delete(rowId);
  updateBulkToolbar();
  updateSelectAllCb();
}

// 헤더 체크박스로 전체 선택/해제
function toggleSelectAll(cb) {
  const checked = cb._wasIndeterminate ? false : cb.checked;  // indeterminate 상태에서 클릭하면 전체 선택이 아니라 전체 해제가 되도록
  cb.checked = cb._wasIndeterminate ? false : cb.checked;     // 체크박스 상태 복원 (toggleSelectAll이 호출된 시점에서는 아직 checked가 변경되지 않았기 때문)
  dutyRows.forEach(r => {
    if (checked) selectedIds.add(r.id);
    else         selectedIds.delete(r.id);
  });
  document.querySelectorAll('#dutyBody .row-select-cb').forEach(cb => cb.checked = checked);
  document.querySelectorAll('#dutyBody tr').forEach(tr => tr.classList.toggle('selected-row', checked));
  updateBulkToolbar();
}

// 선택을 모두 해제하고 UI 초기화
function clearSelection() {
  selectedIds.clear();
  document.querySelectorAll('#dutyBody .row-select-cb').forEach(cb => cb.checked = false);
  document.querySelectorAll('#dutyBody tr').forEach(tr => tr.classList.remove('selected-row'));
  updateBulkToolbar();
  updateSelectAllCb();
}

// 하단 고정 bulk 툴바 표시/숨김 + 선택 행 수 라벨 갱신
function updateBulkToolbar() {
  const n   = selectedIds.size;
  const bar = document.getElementById('bulkToolbar');
  const lbl = document.getElementById('bulkLabel');
  bar.classList.toggle('visible', n > 0);
  if (lbl) lbl.textContent = n + '행 선택됨';
}

// 헤더 체크박스의 checked/indeterminate 상태를 현재 선택 상태와 동기화
function updateSelectAllCb() {
  const cb = document.getElementById('selectAllCb');
  if (!cb) return;
  const n     = selectedIds.size;
  const total = dutyRows.length;
  cb.checked       = total > 0 && n === total; // 전체 선택
  cb.indeterminate = n > 0 && n < total;        // 일부 선택
}

// ── Bulk 액션: 시작/종료 시간 일괄 이동 ──
// sign: +1 이면 앞으로, -1 이면 뒤로
function applyNudge(sign) {
  if (selectedIds.size === 0) { toast('⚠ 이동할 행을 선택하세요.'); return; }
  const mins = parseInt(document.getElementById('nudgeInput').value) || 0;
  if (mins <= 0) { toast('⚠ 이동할 분(分)을 1 이상으로 입력하세요.'); return; }
  const delta = sign * mins;

  snapshot();

  dutyRows.forEach(row => {
    if (!selectedIds.has(row.id)) return;
    const s = parseMin(row.start), e = parseMin(row.end);
    if (s !== null) row.start = minToStr(s + delta);
    if (e !== null) row.end   = minToStr(e + delta);
  });

  save();
  rebuildDutyTable();
  // 리빌드 후 선택 상태 복원 (rebuildDutyTable이 DOM을 새로 만들기 때문)
  dutyRows.forEach(row => {
    if (!selectedIds.has(row.id)) return;
    const tr = document.querySelector(`#dutyBody tr[data-id="${row.id}"]`);
    if (tr) { tr.classList.add('selected-row'); const cb=tr.querySelector('.row-select-cb'); if(cb) cb.checked=true; }
  });
  updateBulkToolbar(); updateSelectAllCb();
  renderOverview(); refreshAllChipsConflicts(); refreshAlertPanel();
  toast(`${sign > 0 ? '＋' : '−'}${mins}분 이동 완료`);
}

// ── Bulk 액션: 소요시간 일괄 조정 ──
// sign: +1 이면 늘리기, -1 이면 줄이기 (종료시간만 변경, 시작시간 고정)
function applyDurNudge(sign) {
  if (selectedIds.size === 0) { toast('⚠ 소요시간을 바꿀 행을 선택하세요.'); return; }
  const mins = parseInt(document.getElementById('durNudgeInput').value) || 0;
  if (mins <= 0) { toast('⚠ 소요시간 조정값을 1 이상으로 입력하세요.'); return; }

  snapshot();

  let hitZero = false; // 소요시간이 0이 된 행 존재 여부

  dutyRows.forEach(row => {
    if (!selectedIds.has(row.id)) return;
    const s = parseMin(row.start);
    const e = parseMin(row.end);
    if (s === null || e === null) return;

    // 현재 소요시간 계산 (자정 wrap 처리)
    let dur    = ((e - s) + MINS_IN_DAY) % MINS_IN_DAY;
    let newDur = dur + sign * mins;

    if (newDur <= 0) { newDur = 0; hitZero = true; }

    // 소요시간이 0이면 종료 = 시작, 아니면 시작 + 새 소요시간
    row.end = (newDur === 0) ? row.start : minToStr(s + newDur);
  });

  save();
  rebuildDutyTable();
  // 리빌드 후 선택 상태 복원
  dutyRows.forEach(row => {
    if (!selectedIds.has(row.id)) return;
    const tr = document.querySelector(`#dutyBody tr[data-id="${row.id}"]`);
    if (tr) { tr.classList.add('selected-row'); const cb = tr.querySelector('.row-select-cb'); if (cb) cb.checked = true; }
  });
  updateBulkToolbar(); updateSelectAllCb();
  renderOverview(); refreshAllChipsConflicts(); refreshAlertPanel();

  toast(hitZero ? '⚠ 소요시간이 0분이 된 소임이 있습니다.'
                : `소요시간 ${sign > 0 ? '＋' : '−'}${mins}분 조정 완료`);
}

// ── Bulk 액션: 선택 행 일괄 삭제 ──
function bulkDelete() {
  if (selectedIds.size === 0) { toast('⚠ 삭제할 행을 선택하세요.'); return; }
  snapshot();
  dutyRows = dutyRows.filter(r => !selectedIds.has(r.id));
  selectedIds.clear();
  save();
  rebuildDutyTable();
  updateBulkToolbar();
  updateSelectAllCb();
  renderOverview();
  refreshAllChipsConflicts();
  refreshAlertPanel();
  toast(`🗑 삭제 완료`);
}

// bulk 툴바의 시작시간 입력 포맷 핸들러 — 숫자만 남기고 3자리부터 콜론 삽입
function formatBulkTime(input) {
  let v = input.value.replace(/\D/g, '');
  if (v.length >= 3) v = v.slice(0,2) + ':' + v.slice(2,4);
  input.value = v;
}

// ── Bulk 액션: 선택 행 시작시간 일괄 변경 ──
// 소요시간(duration)을 유지한 채 시작시간만 변경하고 종료시간을 자동 조정한다.
function applyBulkShift() {
  if (selectedIds.size === 0) { toast('⚠ 이동할 행을 선택하세요.'); return; }

  const raw      = document.getElementById('bulkStartInput').value.trim();
  const newStart = parseMin(raw);
  if (newStart === null) { toast('⚠ 시작시간을 입력하세요. (예: 08:30)'); return; }

  snapshot();

  dutyRows.forEach(row => {
    if (!selectedIds.has(row.id)) return;
    const s = parseMin(row.start), e = parseMin(row.end);
    if (s === null) { row.start = minToStr(newStart); return; } // 기존 시작 없으면 단순 대입
    const delta = newStart - s; // 이동량 = 새 시작 - 기존 시작
    row.start = minToStr(newStart);
    if (e !== null) row.end = minToStr(e + delta); // 종료시간도 같은 양만큼 이동
  });

  save();
  rebuildDutyTable();
  // 리빌드 후 선택 상태 복원
  dutyRows.forEach(row => {
    if (!selectedIds.has(row.id)) return;
    const tr = document.querySelector(`#dutyBody tr[data-id="${row.id}"]`);
    if (tr) {
      tr.classList.add('selected-row');
      const cb = tr.querySelector('.row-select-cb');
      if (cb) cb.checked = true;
    }
  });
  updateBulkToolbar();
  updateSelectAllCb();
  renderOverview();
  refreshAllChipsConflicts();
  refreshAlertPanel();
  toast(`✓ ${selectedIds.size}개 행 시작시간 → ${minToStr(newStart)} 변경`);
}

// tbody를 비우고 dutyRows 전체를 다시 렌더링한다
// 데이터 변경(undo/redo, 날짜 전환 등) 후 전체 갱신이 필요할 때 호출
function rebuildDutyTable() {
  const tbody = document.getElementById('dutyBody');
  tbody.innerHTML = '';
  const rows = (typeof getVisibleDutyRows === 'function') ? getVisibleDutyRows() : dutyRows;
  rows.forEach(row => renderDutyRow(row));
  updateDutyEmpty();
  renumberRows();
  refreshAlertPanel();
}

// ── 키보드 단축키 ──
document.addEventListener('keydown', e => {
  const ctrl    = e.ctrlKey || e.metaKey;
  const page0   = document.getElementById('page0');
  const inPage0 = page0 && page0.classList.contains('active');

  // Ctrl+Z: 되돌리기 (탭 무관하게 항상 동작)
  if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  // Ctrl+Y 또는 Ctrl+Shift+Z: 다시실행 (탭 무관하게 항상 동작)
  if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }

  // 이하 단축키는 소임 기준 배치표(page0) 탭에서만 동작
  if (!inPage0) return;

  // Ctrl+Enter: 새 소임 행 추가 후 마지막 행 시작시간 칸에 포커스
  if (ctrl && e.key === 'Enter') {
    e.preventDefault();
    addDutyRow();
    const rows = document.querySelectorAll('#dutyBody tr');
    if (rows.length) {
      const inp = rows[rows.length - 1].querySelector('.input-time');
      if (inp) inp.focus();
    }
    return;
  }

  // Ctrl+D: 선택 행 있으면 선택 행 전체 복사, 없으면 커서가 있는 행 복사
  if (ctrl && e.key === 'd') {
    e.preventDefault();
    if (selectedIds.size > 0) {
      // 각 행 바로 아래에 복사본을 삽입 (인원 배치는 초기화)
      snapshot();
      const now = Date.now();
      const toInsert = [];
      dutyRows.forEach(r => {
        if (!selectedIds.has(r.id)) return;
        toInsert.push({ after: r.id, newRow: { id: now + toInsert.length, start: r.start, end: r.end, duty: r.duty, assigned: [] } });
      });
      // 뒤에서부터 삽입해야 인덱스가 밀리지 않아 순서가 유지된다
      toInsert.reverse().forEach(({ after, newRow }) => {
        const idx = dutyRows.findIndex(r => r.id === after);
        if (idx !== -1) dutyRows.splice(idx + 1, 0, newRow);
      });
      save(); rebuildDutyTable(); renderOverview();
      toast(`✓ ${toInsert.length}개 행 복사`);
    } else {
      // 커서가 있는 행을 복사하고 복사본으로 포커스 이동
      const focused = document.activeElement;
      const tr = focused ? focused.closest('#dutyBody tr') : null;
      if (tr && tr.dataset.id) {
        copyDutyRow(parseInt(tr.dataset.id));
        const rows   = Array.from(document.querySelectorAll('#dutyBody tr'));
        const srcIdx = rows.findIndex(r => r.dataset.id == tr.dataset.id);
        const newTr  = rows[srcIdx + 1];
        if (newTr) { const inp = newTr.querySelector('.input-time'); if (inp) inp.focus(); }
      }
    }
    return;
  }

  // Ctrl+X: 선택 행 있으면 선택 행 전체 삭제, 없으면 커서 행 삭제
  if (ctrl && e.key === 'x') {
    if (selectedIds.size > 0) {
      e.preventDefault();
      bulkDelete();
    } else {
      const focused = document.activeElement;
      const tr = focused ? focused.closest('#dutyBody tr') : null;
      if (tr && tr.dataset.id) {
        e.preventDefault();
        const rows   = Array.from(document.querySelectorAll('#dutyBody tr'));
        const idx    = rows.findIndex(r => r.dataset.id == tr.dataset.id);
        const nextTr = rows[idx + 1] || rows[idx - 1]; // 삭제 후 포커스 이동할 인접 행
        snapshot();
        deleteDutyRow(parseInt(tr.dataset.id), tr);
        renderOverview(); refreshAllChipsConflicts(); refreshAlertPanel();
        if (nextTr) { const inp = nextTr.querySelector('.input-time'); if (inp) inp.focus(); }
      }
    }
  }
});

// ── 데이터 저장 ──
// personnel, positions, 현재 날짜의 dutyRows, currentDate를 localStorage에 저장
function save() {
  localStorage.setItem('personnel',              JSON.stringify(personnel));
  localStorage.setItem('dutyRows_'+currentDate,  JSON.stringify(dutyRows));
  localStorage.setItem('positions',              JSON.stringify(positions));
  localStorage.setItem('currentDate',            currentDate);
}

