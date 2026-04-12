// ══════════════════════════════════════════
// COLORS  — 소임별 색상 팔레트
// ══════════════════════════════════════════
// 소임 이름마다 고유한 색상을 순차적으로 배정한다.
// 각 항목: { bg: 배경색, b: 테두리색, t: 텍스트색 }
const PALETTE = [
  {bg:'#1f4e6e',b:'#58a6ff',t:'#cae8ff'},
  {bg:'#3b2070',b:'#bc8cff',t:'#e2d9ff'},
  {bg:'#4a1e1e',b:'#f85149',t:'#ffd0cc'},
  {bg:'#4a3800',b:'#e3b341',t:'#fff0b3'},
  {bg:'#1a4a23',b:'#3fb950',t:'#ccffd6'},
  {bg:'#1e3a4a',b:'#39c5cf',t:'#c8f5f8'},
  {bg:'#4a2a00',b:'#ff8c42',t:'#ffe8cc'},
  {bg:'#3a1e3e',b:'#e896d8',t:'#f8d6f4'},
  {bg:'#1a3a3a',b:'#56d4a0',t:'#c8f5e4'},
  {bg:'#3a3020',b:'#c8a86a',t:'#f0e4c0'},
];
const colorMap = {}; // 소임 이름 → PALETTE 항목 매핑 캐시
let colorIdx   = 0;  // 다음에 배정할 팔레트 인덱스

// 소임 이름에 대응하는 색상을 반환 (처음 요청 시 새 색상 배정)
function getColor(name) {
  if (!name) name = '(미입력)';
  if (!colorMap[name]) { colorMap[name] = PALETTE[colorIdx % PALETTE.length]; colorIdx++; }
  return colorMap[name];
}
// Escape HTML special chars for safe insertion into innerHTML
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// 색상 매핑 초기화 — renderOverview / refreshGantt 호출 전에 실행하여 색상을 일관되게 유지
function resetColors() { Object.keys(colorMap).forEach(k => delete colorMap[k]); colorIdx = 0; }

// ── 시간 유틸리티 ──

// 분(分) 값을 'HH:MM' 형식 문자열로 변환
// 음수나 MINS_IN_DAY 이상의 값도 자동으로 wrap 처리한다.

// ══════════════════════════════════════════
// DATE BAR  — 상단 날짜 표시줄
// ══════════════════════════════════════════
const KO_DAYS_FULL  = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
const KO_DAYS_SHORT = ['일','월','화','수','목','금','토'];
// 요일별 텍스트·배경 인라인 스타일 (일=빨강, 토=파랑, 나머지=기본)
const DAY_COLORS = {
  0: 'color:#f85149;background:rgba(248,81,73,.12)',   // 일요일
  6: 'color:#58a6ff;background:rgba(88,166,255,.12)',  // 토요일
};

// 'YYYY-MM-DD' 문자열을 Date 객체로 변환 (로컬 타임존 기준, timezone 오차 없음)

// 날짜 표시줄 전체를 현재 날짜에 맞게 갱신 (날짜 텍스트, 요일 뱃지, 오늘 버튼)
function renderDateBar() {
  const d   = parseDate(currentDate);
  const dow = d.getDay();

  document.getElementById('dateDisplayText').textContent = formatDateDisplay(currentDate);

  const dayEl = document.getElementById('dateDisplayDay');
  dayEl.textContent = KO_DAYS_FULL[dow];
  dayEl.style.cssText = DAY_COLORS[dow] || 'color:var(--text-muted);background:var(--surface2)';

  const todayBtn = document.getElementById('dateTodayBtn');
  const isToday  = currentDate === todayStr();
  todayBtn.classList.toggle('is-today', isToday);
  todayBtn.textContent = isToday ? '✓ 오늘' : '오늘';

  document.getElementById('dateNative').value = currentDate;
  document.title = `소임 배치표 · ${formatDateDisplay(currentDate)}`; // 브라우저 탭 제목
}

// 현재 날짜를 delta일만큼 앞/뒤로 이동
function changeDate(delta) {
  const d = parseDate(currentDate);
  d.setDate(d.getDate() + delta);
  const newStr = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  switchDate(newStr);
}

// 오늘 날짜로 이동
function goToday() { switchDate(todayStr()); }

// ── 날짜 선택 달력 모달 ──
// 날짜 표시 버튼 클릭 시 열리는 캘린더 팝업 (날짜복사 달력과 동일 UI)
let dpYear, dpMonth; // 달력 현재 표시 연/월

// 달력 모달을 현재 날짜 기준으로 초기화하고 열기
function openDatePickerModal() {
  const base = parseDate(currentDate);
  dpYear  = base.getFullYear();
  dpMonth = base.getMonth();
  renderDatePickerCalendar();
  const overlay = document.getElementById('datePickerOverlay');
  overlay.classList.add('open');
  // Compute and fix the modal top position so subsequent calendar re-renders
  // (different number of weeks) only grow downward.
  const modal = overlay.querySelector('.copy-modal');
  if (modal) {
    // allow layout to settle
    requestAnimationFrame(() => {
      const vh = window.innerHeight;
      const mh = Math.min(modal.offsetHeight, Math.floor(vh * 0.9));
      const top = Math.max(12, Math.floor((vh - mh) / 2));
      overlay.style.setProperty('--datePickerTop', top + 'px');
    });
  }
}

// 달력 모달 닫기 (오버레이 클릭 또는 직접 호출)
function closeDatePicker(e) {
  if (!e || e.target === document.getElementById('datePickerOverlay')) {
    document.getElementById('datePickerOverlay').classList.remove('open');
  }
}

// 달력 월 이동 (delta: -1 = 이전달, +1 = 다음달)
function datePickerNav(delta) {
  dpMonth += delta;
  if (dpMonth < 0)  { dpMonth = 11; dpYear--; }
  if (dpMonth > 11) { dpMonth = 0;  dpYear++; }
  renderDatePickerCalendar();
}

// 날짜 선택 달력을 dpYear/dpMonth 기준으로 렌더링
function renderDatePickerCalendar() {
  const KO_DOW = ['일','월','화','수','목','금','토'];
  const today  = todayStr();
  const label  = document.getElementById('datePickerMonthLabel');
  const grid   = document.getElementById('datePickerGrid');
  label.textContent = `${dpYear}년 ${dpMonth + 1}월`;
  grid.innerHTML = '';

  // 요일 헤더 (일–토)
  KO_DOW.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'cal-dow' + (i===0?' sun':i===6?' sat':'');
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay = new Date(dpYear, dpMonth, 1).getDay();  // 1일의 요일 (0=일)
  const lastDate = new Date(dpYear, dpMonth + 1, 0).getDate(); // 해당 월의 마지막 날

  // 앞 빈칸: 이전 달 날짜로 채움
  const prevLast = new Date(dpYear, dpMonth, 0).getDate();
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty other-month';
    el.textContent = prevLast - firstDay + 1 + i;
    grid.appendChild(el);
  }

  // 해당 월의 날짜 셀 생성
  for (let d = 1; d <= lastDate; d++) {
    const dateStr = dpYear+'-'+String(dpMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const dow = new Date(dpYear, dpMonth, d).getDay();
    const el  = document.createElement('div');
    let cls   = 'cal-day';
    if (dow === 0) cls += ' sun';          // 일요일
    if (dow === 6) cls += ' sat';          // 토요일
    if (dateStr === today)       cls += ' today';    // 오늘 강조
    if (dateStr === currentDate) cls += ' selected'; // 현재 선택 날짜
    el.className   = cls;
    el.textContent = d;
    el.onclick = () => {
      switchDate(dateStr); // 날짜 이동
      closeDatePicker();
    };
    grid.appendChild(el);
  }

  // 뒤 빈칸: 다음 달 날짜로 채움
  const filled    = firstDay + lastDate;
  const remainder = filled % 7 === 0 ? 0 : 7 - (filled % 7);
  for (let i = 1; i <= remainder; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty other-month';
    el.textContent = i;
    grid.appendChild(el);
  }
}

// 브라우저 기본 date input을 트리거하는 fallback (현재 미사용)
function openDatePicker() {
  const inp = document.getElementById('dateNative');
  inp.style.position='fixed'; inp.style.top='52px'; inp.style.left='80px';
  inp.style.opacity='0'; inp.style.pointerEvents='all';
  inp.style.width='1px'; inp.style.height='1px';
  inp.focus(); inp.click();
  setTimeout(()=>{
    inp.style.pointerEvents='none'; inp.style.position='absolute';
    inp.style.width='0'; inp.style.height='0';
  }, 500);
}

// 브라우저 기본 date input 변경 핸들러
function onNativeDateChange(val) {
  if (val) switchDate(val);
}

// 날짜 전환 — 새 날짜의 데이터를 로드하고 전체 UI를 갱신한다
function switchDate(newDate) {
  if (newDate === currentDate) return; // 이미 같은 날짜면 무시
  currentDate = newDate;
  dutyRows    = JSON.parse(localStorage.getItem('dutyRows_'+currentDate) || '[]');
  // Ensure assigned names are in sync with current `personnel` (remove unknown names,
  // update count pills). This recalculates "전원 소임" correctly for the new date.
  try { refreshAllChips(); } catch (e) { /* ignore if function not ready */ }
  undoStack   = [];
  redoStack   = [];
  selectedIds.clear();
  updateHistoryBtns();
  // 시간 범위 alias 동기화
  ovStartH = viewStartH; ovEndH = viewEndH;
  ganttStartH = viewStartH; ganttEndH = viewEndH;
  renderDateBar();
  rebuildDutyTable();
  renderOverview();
  const ganttPage = document.getElementById('page1');
  if (ganttPage.classList.contains('active')) refreshGantt();
  // ensure selection UI resets when switching dates
  try { updateBulkToolbar(); updateSelectAllCb(); } catch (e) { /* functions may live in state.js; ignore if not ready */ }
  save();
}

// ══════════════════════════════════════════
// TABS  — 탭 전환
// ══════════════════════════════════════════
// i: 0=소임 기준 배치표, 1=인원 기준 배치표, 2=인원 등록
function switchTab(i) {
  document.querySelectorAll('.tab').forEach((t,j)  => t.classList.toggle('active', i===j));
  document.querySelectorAll('.page').forEach((p,j) => p.classList.toggle('active', i===j));
  setAlertPanelVisibilityByTab(i);
  if (i===0) renderOverview(); // 소임 탭으로 돌아올 때 overview 갱신
  if (i===1) refreshGantt();   // gantt 탭 진입 시 갱신
}

// 화면 하단에 잠깐 표시되는 알림 토스트
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

// 토글: 전원 배치된 소임만 보기
// Cycle filter: none -> all -> partial -> none
function toggleShowAllAssigned(e) {
  // open/close the filter popover
  const existing = document.getElementById('filterMenu');
  if (existing) { existing.remove(); return; }
  showFilterMenu(e && e.currentTarget ? e.currentTarget : document.getElementById('showAllAssignedBtn'));
}

function applyShowAssignedFilter(silent) {
  const btn = document.getElementById('showAllAssignedBtn');
  const icon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M3 4h18v2H3z"></path><path d="M6 10h12v2H6z"></path><path d="M10 16h4v2h-4z"></path></svg>';
  if (btn) {
    // active visual when any filter applied
    btn.classList.toggle('btn-filter-active', selectedFilters && selectedFilters.length > 0);
    // label: single selection shows its name, multiple -> '필터 적용'
    const labels = { all: '전원 참여', partial: '개별 참여', noneAssigned: '참여 없음' };
    let label = '필터 없음';
    if (selectedFilters && selectedFilters.length === 1) label = labels[selectedFilters[0]] || '필터';
    else if (selectedFilters && selectedFilters.length > 1) label = '필터 적용';
    btn.innerHTML = icon + '<span style="margin-left:6px">' + label + '</span>';
  }

  // Re-render views respecting the filter
  try { rebuildDutyTable(); } catch (e) {}
  try { renderOverview(); } catch (e) {}
  try {
    const ganttPage = document.getElementById('page1');
    if (ganttPage && ganttPage.classList.contains('active')) refreshGantt();
  } catch (e) {}

  if (!silent) {
    if (selectedFilters && selectedFilters.length === 1) {
      const s = selectedFilters[0];
      if (s === 'all') toast('전원 배치된 소임만 표시함');
      else if (s === 'partial') toast('개별 참여 소임만 표시함');
      else if (s === 'noneAssigned') toast('참여자 없는 소임만 표시함');
    } else if (selectedFilters && selectedFilters.length > 1) {
      toast('여러 필터가 적용됨');
    } else {
      toast('전체 소임 보기로 복원');
    }
  }
}

// show a small popover menu to select filters (checkboxes)
function showFilterMenu(anchorEl) {
  // remove existing
  const existing = document.getElementById('filterMenu'); if (existing) existing.remove();
  const menu = document.createElement('div'); menu.id = 'filterMenu';
  menu.style.cssText = 'position:fixed;z-index:510;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 20px rgba(0,0,0,.6);min-width:180px';

  const makeItem = (key, text) => {
    const id = 'filter_' + key;
    const wrap = document.createElement('label'); wrap.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 8px;cursor:pointer';
    const cb = document.createElement('input'); cb.type='checkbox'; cb.id = id; cb.checked = (selectedFilters || []).includes(key);
    cb.onchange = () => {
      const arr = new Set(selectedFilters || []);
      if (cb.checked) arr.add(key); else arr.delete(key);
      selectedFilters = Array.from(arr);
      try { localStorage.setItem('selectedFilters', JSON.stringify(selectedFilters)); } catch(e){}
      applyShowAssignedFilter();
    };
    const span = document.createElement('span'); span.textContent = text; span.style.color='var(--text)';
    wrap.appendChild(cb); wrap.appendChild(span);
    return wrap;
  };

  menu.appendChild(makeItem('all','전원 참여'));
  menu.appendChild(makeItem('partial','개별 참여'));
  menu.appendChild(makeItem('noneAssigned','참여 없음'));

  // click outside to close
  setTimeout(()=>{
    const onDoc = (ev) => { if (!menu.contains(ev.target) && ev.target !== anchorEl) { menu.remove(); document.removeEventListener('mousedown', onDoc); } };
    document.addEventListener('mousedown', onDoc);
  },0);

  document.body.appendChild(menu);
  // position under anchorEl
  if (anchorEl) {
    const r = anchorEl.getBoundingClientRect();
    menu.style.left = (r.right - menu.offsetWidth) + 'px';
    menu.style.top  = (r.bottom + 8) + 'px';
  }
}

// ── 전원 소임 판단 ──
// 등록된 모든 인원이 해당 row.assigned에 포함되어 있으면 '전원 소임'으로 간주
function isAllPersonnel(row) {
  if (!personnel.length) return false;
  return personnel.every(p => row.assigned.includes(p.name));
}
// 전원 소임 표시용 흰색 계열 컬러 (개별 소임과 구분)
const ALL_COLOR = { bg:'rgba(255,255,255,.12)', b:'rgba(255,255,255,.85)', t:'#ffffff' };

// ══════════════════════════════════════════
// OVERVIEW  — 24시간 배치 현황 패널
// ══════════════════════════════════════════

// ── Overview 상단 고정(핀) 기능 ──
let overviewPinned = localStorage.getItem('overviewPinned') === 'true'; // 저장된 상태 복원

// 핀 버튼 클릭 시 고정 여부를 토글하고 상태를 저장
function toggleOverviewPin() {
  overviewPinned = !overviewPinned;
  localStorage.setItem('overviewPinned', overviewPinned);
  applyOverviewPin();
}

// 현재 overviewPinned 값에 따라 CSS 클래스·CSS 변수를 적용한다.
// 고정 시: overview 패널에 sticky 클래스 + toolbar/thead top 값 조정
function applyOverviewPin() {
  const panel   = document.getElementById('overviewPanel');
  const btn     = document.getElementById('ovPinBtn');
  const toolbar = document.querySelector('#page0 .toolbar');
  if (!panel || !btn) return;
  panel.classList.toggle('pinned', overviewPinned);
  btn.classList.toggle('active', overviewPinned);
  btn.title = overviewPinned ? 'Overview 고정 해제' : 'Overview 상단 고정';
  // 고정 시 toolbar가 overview 바로 아래에 붙도록 CSS 변수 업데이트
  const ovH = overviewPinned ? panel.offsetHeight : 0;
  document.documentElement.style.setProperty('--toolbar-top', ovH + 'px');
  if (toolbar) {
    const toolbarH = toolbar.offsetHeight;
    document.documentElement.style.setProperty('--thead-top', (ovH + toolbarH) + 'px');
  }
}

// Overview 패널 전체 렌더링
// 소임 바, 현재 시각선, 시간 눈금, 범례를 모두 그린다.
function renderOverview() {
  resetColors(); // 색상 일관성을 위해 먼저 초기화
  const track  = document.getElementById('ovTrack');
  const legend = document.getElementById('ovLegend');
  const ruler  = document.getElementById('ovRuler');
  track.innerHTML = ''; legend.innerHTML = ''; ruler.innerHTML = '';

  // 소임 이름 순서대로 색상을 미리 배정 (범례와 바 색상이 일치하도록)
  const visRows = (typeof getVisibleDutyRows === 'function') ? getVisibleDutyRows() : dutyRows;
  [...new Set(visRows.map(r => r.duty||'(미입력)'))].forEach(dn => getColor(dn));

  // 범례 항목 생성 (소임 이름 + 색상 점)
  [...new Set(visRows.map(r => r.duty||'(미입력)'))].forEach(dn => {
    const c    = getColor(dn);
    const item = document.createElement('div');
    item.className = 'ov-legend-item';
    item.innerHTML = `<span class="ov-legend-dot" style="background:${c.b}"></span>${dn}`;
    legend.appendChild(item);
  });

  // ── 레인(lane) 배정 ──
  // 시간이 겹치는 소임 바들이 겹쳐 보이지 않도록 레인을 나눠 배치한다.
  // Greedy 방식: 각 소임을 순서대로 처리하며, 충돌 없는 가장 낮은 레인에 배정한다.
  const LANE_H   = 26;  // 레인 높이 (px)
  const LANE_GAP = 3;   // 레인 간 간격 (px)
  const PAD_TOP  = 3;   // 트랙 상단 패딩 (px)

  // laneRanges[i] = 레인 i에 이미 배치된 세그먼트 { st, en }들의 배열
  const laneRanges = [];

  // 특정 레인에 세그먼트 [st, en]이 겹치는지 확인
  function segOverlapsLane(lane, st, en) {
    if (!laneRanges[lane]) return false;
    for (const r of laneRanges[lane]) {
      if (!(en <= r.st || st >= r.en)) return true; // 겹침 판정
    }
    return false;
  }

  // 각 dutyRow에 레인 번호 배정
  const rowLanes = {};
  visRows.forEach(row => {
    const s = parseMin(row.start), e = parseMin(row.end);
    if (s === null || e === null) return;
    const rowSegs = segs(s, e);
    // 이 행의 모든 세그먼트와 충돌 없는 가장 낮은 레인 탐색
    let assignedLane = -1;
    for (let lane = 0; ; lane++) {
      if (rowSegs.every(([st, en]) => !segOverlapsLane(lane, st, en))) {
        assignedLane = lane; break;
      }
    }
    rowLanes[row.id] = assignedLane;
    if (!laneRanges[assignedLane]) laneRanges[assignedLane] = [];
    rowSegs.forEach(([st, en]) => laneRanges[assignedLane].push({ st, en }));
  });

  // 레인 수에 따라 트랙 높이 결정
  const numLanes = laneRanges.length || 1;
  const trackH   = PAD_TOP + numLanes * LANE_H + (numLanes - 1) * LANE_GAP + PAD_TOP;
  track.style.height = trackH + 'px';

  // 각 소임의 바 렌더링
  visRows.forEach(row => {
    const s = parseMin(row.start), e = parseMin(row.end);
    if (s === null || e === null) return;
    const allFlag     = isAllPersonnel(row);
    const col         = allFlag ? ALL_COLOR : getColor(row.duty||'(미입력)');
    const label       = row.duty || '(미입력)';
    const assignedText = allFlag ? '전원' : (row.assigned.length ? sortAssigned(row.assigned).join(', ') : '미배치');
    const lane  = rowLanes[row.id] ?? 0;
    const topPx = PAD_TOP + lane * (LANE_H + LANE_GAP);

    segs(s, e).forEach(([st, en]) => {
      // 뷰 범위(viewStartH–viewEndH)를 벗어난 부분은 클리핑
      const vMin = viewMin(ovStartH), vMax = viewMax(ovEndH);
      const cSt  = Math.max(st, vMin), cEn = Math.min(en, vMax);
      if (cEn <= cSt) return;
      const lp = minToViewPct(cSt, ovStartH, ovEndH);
      const rp = minToViewPct(cEn, ovStartH, ovEndH);
      const wp = rp - lp;
      if (wp <= 0) return;
      const bar = document.createElement('div');
      bar.className = 'ov-bar';
      bar.style.cssText = `left:${lp}%;width:${wp}%;top:${topPx}px;background:${col.bg};border:1px solid ${col.b};color:${col.t}`;
      bar.title    = `${label}\n${row.start}–${row.end}\n배치: ${assignedText}`;
      bar.textContent = label;
      track.appendChild(bar);
    });
  });

  // ── 현재 시각선 (빨간 수직선) ──
  // 오늘 날짜를 보고 있을 때만 표시
  document.getElementById('ovDateBadge').textContent = formatDateDisplay(currentDate);
  if (currentDate === todayStr()) {
    const nm = nowMin();
    if (nm >= viewMin(ovStartH) && nm <= viewMax(ovEndH)) {
      const nl = document.createElement('div');
      nl.className = 'ov-now';
      nl.style.left = minToViewPct(nm, ovStartH, ovEndH) + '%';
      track.appendChild(nl);
    }
  }

  // ── 시간 눈금 (ruler) ──
  // viewStartH부터 viewEndH까지 1시간 간격으로 눈금 표시
  for (let h = ovStartH; h <= ovEndH; h++) {
    const tick   = document.createElement('div');
    const isEdge = (h === ovStartH || h === ovEndH); // 양쪽 끝 눈금은 스타일 다름
    tick.className = 'ov-tick' + (isEdge ? ' h0' : '');
    tick.style.left = minToViewPct(h*60, ovStartH, ovEndH) + '%';
    tick.innerHTML  = `<span class="ov-tick-label">${h}</span>`;
    ruler.appendChild(tick);
  }
  syncOvSelects();
  applyGridLines();
}

// ══════════════════════════════════════════
// PAGE 0 DUTY TABLE  — 소임 기준 배치표
// ══════════════════════════════════════════

// 새 소임 행 추가
// data가 있으면 해당 데이터로 행을 만들고(CSV 불러오기 등),
// data가 없으면 빈 행을 추가한다.
// 빈 행 추가 시 기존 소임들의 가장 늦은 종료시간을 기본 시작시간으로 설정한다.
function addDutyRow(data) {
  const id = data?.id || Date.now();

  // 새 빈 행 추가 시: 등록된 소임 중 가장 늦은 종료시간을 시작시간 기본값으로
  let defaultStart = '';
  if (!data) {
    const ends = dutyRows.map(r => parseMin(r.end)).filter(m => m !== null);
    if (ends.length) {
      const latestMin = Math.max(...ends);
      defaultStart = String(Math.floor(latestMin/60)).padStart(2,'0') + ':' + String(latestMin%60).padStart(2,'0');
    }
  }

  const row = { id, start: data?.start||defaultStart, end: data?.end||'', duty: data?.duty||'', assigned: data?.assigned||[], noConflict: !!data?.noConflict };
  if (!data) { snapshot(); dutyRows.push(row); save(); } // 신규 추가만 저장
  renderDutyRow(row);
  updateDutyEmpty();
  renderOverview();
}

// 소임 행을 현재 위치 바로 아래에 복사 (인원 배치는 초기화)
function copyDutyRow(rowId) {
  const src = dutyRows.find(r => r.id==rowId); if (!src) return;
  snapshot();
  const srcIdx = dutyRows.findIndex(r => r.id==rowId);
  const newRow = { id: Date.now(), start: src.start, end: src.end, duty: src.duty, assigned: !!src.noConflict ? [...src.assigned] : [], noConflict: !!src.noConflict };
  dutyRows.splice(srcIdx+1, 0, newRow); // 원본 바로 아래에 삽입
  save();
  rebuildDutyTable();
  renderOverview();
  // 새로 추가된 행에 파란 flash 애니메이션 적용
  const tbody = document.getElementById('dutyBody');
  const newTr = tbody.querySelector(`tr[data-id="${newRow.id}"]`);
  if (newTr) { newTr.classList.add('flash-copied'); setTimeout(() => newTr.classList.remove('flash-copied'), 600); }
  toast('행 복사 완료');
}

// 새 소임 행을 주어진 행(rowId) 바로 아래에 삽입한다.
// 삽입되는 행의 시작시간은 원본 행의 종료시간(start = src.end)이고,
// 소요시간은 원본 행의 소요를 복사하거나 기본값(30분)을 사용한다.
function insertDutyRowAfter(rowId, opts = {}) {
  const copyDuration = opts.copyDuration !== false; // 기본: 복사
  const defaultDur = typeof opts.defaultDur === 'number' ? opts.defaultDur : 30;
  const srcIdx = dutyRows.findIndex(r => r.id == rowId);
  if (srcIdx === -1) return;
  const src = dutyRows[srcIdx];
  // 우선 source의 end를 새 시작으로 사용
  let srcEndMin = parseMin(src.end);
  const srcStartMin = parseMin(src.start);
  // duration 계산: 가능한 경우 원본 소요 복사
  let dur = defaultDur;
  if (srcStartMin !== null && srcEndMin !== null) {
    dur = ((srcEndMin - srcStartMin) + MINS_IN_DAY) % MINS_IN_DAY;
    if (dur === 0) dur = defaultDur;
  } else if (srcStartMin !== null && copyDuration) {
    // 종료가 없고 시작만 있는 경우, 사용자가 원하면 기본 길이로 생성
    dur = defaultDur;
    if (srcEndMin === null) srcEndMin = (srcStartMin + dur) % MINS_IN_DAY;
  }

  // 새 시작이 없으면 시작을 source.start로 하거나 09:00으로 기본화
  let newStartMin;
  if (srcEndMin !== null) newStartMin = srcEndMin;
  else if (srcStartMin !== null) newStartMin = (srcStartMin + dur) % MINS_IN_DAY;
  else newStartMin = 9 * 60; // 09:00 fallback

  const newEndMin = (newStartMin + dur) % MINS_IN_DAY;
  const newRow = {
    id: Date.now(),
    start: String(Math.floor(newStartMin/60)).padStart(2,'0') + ':' + String(newStartMin%60).padStart(2,'0'),
    end:   String(Math.floor(newEndMin/60)).padStart(2,'0') + ':' + String(newEndMin%60).padStart(2,'0'),
    duty:  '',
    assigned: [],
    noConflict: false
  };

  snapshot();
  dutyRows.splice(srcIdx+1, 0, newRow);
  save();
  rebuildDutyTable();
  renderOverview();

  // 포커스: 새로 생성된 행의 시작시간 입력에 포커스하고 전체 선택
  const tbody = document.getElementById('dutyBody');
  const newTr = tbody.querySelector(`tr[data-id="${newRow.id}"]`);
  if (newTr) {
    newTr.classList.add('flash-added'); setTimeout(()=>newTr.classList.remove('flash-added'),550);
    const startInp = newTr.querySelector('input[data-col="start"]');
    if (startInp) { startInp.focus(); startInp.select(); }
  }
  toast('행 삽입 완료');
}

// Shift+Enter: 커서가 놓인 소임 바로 아래에 새 행 추가
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter' || !e.shiftKey) return;
  const active = document.activeElement;
  if (!active) return;
  const tr = active.closest && active.closest('tr');
  if (!tr) return;
  // 이 핸들러는 소임 테이블(#dutyBody) 내부에서만 동작
  if (!tr.closest || !tr.closest('#dutyBody')) return;
  e.preventDefault();
  insertDutyRowAfter(tr.dataset.id);
});

// ── 셀 키보드 내비게이션 ──
// 소임 목록 테이블에서 ↑/↓ 키로 같은 컬럼의 위아래 행으로 포커스를 이동한다.
// data-col 속성으로 컬럼을 식별한다 (start / end / dur / duty).
function navigateDutyCell(currentInp, direction) {
  const col = currentInp.dataset.col;
  if (!col) return false;
  const rows      = Array.from(document.querySelectorAll('#dutyBody tr'));
  const currentTr = currentInp.closest('tr');
  const idx       = rows.indexOf(currentTr);
  const targetIdx = direction === 'down' ? idx + 1 : idx - 1;
  if (targetIdx < 0 || targetIdx >= rows.length) return false;
  const targetInp = rows[targetIdx].querySelector(`[data-col="${col}"]`);
  if (targetInp) { targetInp.focus(); targetInp.select(); return true; }
  return false;
}

// ── 소임 행 DOM 생성 및 이벤트 바인딩 ──
// dutyRows의 각 row 객체에 대응하는 <tr>을 만들어 tbody에 추가한다.
// 시작시간, 종료시간, 소요시간, 소임명, 인원 칩, 액션 버튼 등 모든 셀을 포함한다.
function renderDutyRow(row) {
  const tbody = document.getElementById('dutyBody');
  const tr    = document.createElement('tr');
  tr.dataset.id = row.id;
  tr.draggable  = true;
  if (selectedIds.has(row.id)) tr.classList.add('selected-row');

  // ① 체크박스 셀 — 행 선택/해제
  const tdCb  = document.createElement('td'); tdCb.style.cssText='padding:0 8px;width:36px;text-align:center';
  const rowCb = document.createElement('input'); rowCb.type='checkbox'; rowCb.className='row-select-cb';
  rowCb.checked = selectedIds.has(row.id);
  rowCb.onchange = e => { onRowSelectChange(row.id, e.target.checked); tr.classList.toggle('selected-row', e.target.checked); };
  rowCb.addEventListener('mousedown', e => e.stopPropagation()); // 체크박스 클릭이 드래그 선택을 시작하지 않도록
  tdCb.appendChild(rowCb); tr.appendChild(tdCb);

  // ② 드래그 핸들 셀 — 행 순서 변경용
  const tdDrag = document.createElement('td'); tdDrag.style.cssText='padding:0 4px;width:28px';
  const handle = document.createElement('div'); handle.className='drag-handle'; handle.title='드래그하여 순서 변경';
  handle.innerHTML='<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="3" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/><circle cx="3" cy="6" r="1.5"/><circle cx="7" cy="6" r="1.5"/><circle cx="3" cy="10" r="1.5"/><circle cx="7" cy="10" r="1.5"/><circle cx="3" cy="14" r="1.5"/><circle cx="7" cy="14" r="1.5"/></svg>';
  tdDrag.appendChild(handle); tr.appendChild(tdDrag);

  // ③ 행 번호 셀
  const tdN = document.createElement('td'); tdN.className='row-num'; tdN.textContent=tbody.children.length+1; tr.appendChild(tdN);

  // ④ 시작시간 입력 셀
  // - oninput: 자동 포맷(formatTime) + 데이터 저장
  // - onblur:  입력 완료 후 소요시간을 유지하며 종료시간도 함께 이동
  // - onkeydown: ↑↓ = 행 이동, Shift+↑↓ = ±5분 조정 (종료시간 연동)
  const tdStart = document.createElement('td'); tdStart.style.textAlign='center';
  const inpStart = document.createElement('input');
  inpStart.type='text'; inpStart.className='input input-time'; inpStart.dataset.col='start';
  inpStart.value=row.start; inpStart.placeholder='00:00'; inpStart.maxLength=5;
  inpStart.dataset.prev = row.start; // onblur 시 변경 전 값과 비교하기 위해 저장
  inpStart.onfocus = () => { snapshot(); }; // 편집 시작 전 스냅샷 저장
  inpStart.oninput = e => {
    formatTime(e.target);
    updateRowData(row.id, 'start', e.target.value);
    renderOverview(); refreshAllChipsConflicts();
  };
  inpStart.title = '↑↓ : 위아래 행 이동\nShift+↑↓ : ±5분 조정 (종료시간 함께 이동)';
  inpStart.onkeydown = e => {
    if (e.key==='ArrowUp' || e.key==='ArrowDown') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+방향키: 소요시간을 유지하면서 시작시간·종료시간 ±5분
        const curRow = dutyRows.find(r => r.id==row.id); if (!curRow) return;
        const s = parseMin(curRow.start), en = parseMin(curRow.end);
        if (s === null) return;
        const delta = e.key==='ArrowUp' ? 5 : -5;
        const newS  = ((s+delta)%MINS_IN_DAY+MINS_IN_DAY)%MINS_IN_DAY;
        const toStr = m => String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
        curRow.start = toStr(newS);
        inpStart.value = curRow.start;
        inpStart.dataset.prev = curRow.start;
        if (en !== null) {
          const newE = ((en+delta)%MINS_IN_DAY+MINS_IN_DAY)%MINS_IN_DAY;
          curRow.end = toStr(newE);
          const endInp = tr.querySelector('.inp-end'); if (endInp) endInp.value = curRow.end;
        }
        updateRowData(row.id, 'start', curRow.start);
        save(); renderOverview(); refreshAllChipsConflicts();
      } else {
        navigateDutyCell(inpStart, e.key==='ArrowDown' ? 'down' : 'up');
      }
    }
  };
  inpStart.onblur = e => {
    // 입력 완료 후: 시작시간이 실제로 바뀐 경우에만 종료시간도 같은 양만큼 이동
    const newVal  = e.target.value;
    const prevS   = parseMin(e.target.dataset.prev);
    const newS    = parseMin(newVal);
    const curRow  = dutyRows.find(r => r.id==row.id);
    if (prevS !== null && newS !== null && curRow && prevS !== newS) {
      const curE = parseMin(curRow.end);
      if (curE !== null) {
        const delta     = newS - prevS;
        let newE        = ((curE+delta)%MINS_IN_DAY+MINS_IN_DAY)%MINS_IN_DAY;
        const hh        = String(Math.floor(newE/60)).padStart(2,'0');
        const mm        = String(newE%60).padStart(2,'0');
        const newEndStr = hh+':'+mm;
        curRow.end = newEndStr; save();
        const endInp = tr.querySelector('.inp-end');
        if (endInp) endInp.value = newEndStr;
        // 소요시간 표시도 함께 갱신
        const durInp2 = tr.querySelector('.inp-dur');
        if (durInp2) {
          const ns=parseMin(newVal), ne=parseMin(newEndStr);
          if (ns!==null && ne!==null) { const d=((ne-ns)+MINS_IN_DAY)%MINS_IN_DAY; durInp2.value=d>0?d:''; }
        }
        renderOverview(); refreshAllChipsConflicts();
      }
    }
    e.target.dataset.prev = newVal; // 다음 blur 비교를 위해 갱신
  };
  tdStart.appendChild(inpStart); tr.appendChild(tdStart);

  // ⑤ 종료시간 입력 셀
  // - oninput: 자동 포맷 + 소요시간 자동 계산
  // - onkeydown: ↑↓ = 행 이동, Shift+↑↓ = ±5분 조정 (시작시간 고정, 소요시간 연동)
  const tdEnd  = document.createElement('td'); tdEnd.style.textAlign='center';
  const inpEnd = document.createElement('input');
  inpEnd.type='text'; inpEnd.className='input input-time inp-end'; inpEnd.dataset.col='end';
  inpEnd.value=row.end; inpEnd.placeholder='00:00'; inpEnd.maxLength=5;
  inpEnd.onfocus = () => { snapshot(); };
  inpEnd.oninput = e => {
    formatTime(e.target);
    updateRowData(row.id, 'end', e.target.value);
    // 종료시간 변경 시 소요시간(분) 자동 계산
    const s = parseMin(row.start), en = parseMin(e.target.value);
    const durInp = tr.querySelector('.inp-dur');
    if (durInp && s!==null && en!==null) {
      const dur = ((en-s)+MINS_IN_DAY)%MINS_IN_DAY;
      durInp.value = dur>0 ? dur : '';
    }
    renderOverview(); refreshAllChipsConflicts();
  };
  inpEnd.onblur = () => {};
  inpEnd.title = '↑↓ : 위아래 행 이동\nShift+↑↓ : ±5분 조정';
  inpEnd.onkeydown = e => {
    if (e.key==='ArrowUp' || e.key==='ArrowDown') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+방향키: 종료시간만 ±5분 (시작시간 고정, 소요시간 연동 갱신)
        const curRow = dutyRows.find(r => r.id==row.id); if (!curRow) return;
        const en = parseMin(curRow.end); if (en === null) return;
        const delta = e.key==='ArrowUp' ? 5 : -5;
        const newE  = ((en+delta)%MINS_IN_DAY+MINS_IN_DAY)%MINS_IN_DAY;
        const toStr = m => String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
        curRow.end = toStr(newE);
        inpEnd.value = curRow.end;
        // 소요시간 표시 갱신
        const s      = parseMin(curRow.start);
        const durInp = tr.querySelector('.inp-dur');
        if (durInp && s!==null) { const d=((newE-s)+MINS_IN_DAY)%MINS_IN_DAY; durInp.value=d>0?d:''; }
        updateRowData(row.id, 'end', curRow.end);
        save(); renderOverview(); refreshAllChipsConflicts();
      } else {
        navigateDutyCell(inpEnd, e.key==='ArrowDown' ? 'down' : 'up');
      }
    }
  };
  tdEnd.appendChild(inpEnd); tr.appendChild(tdEnd);

  // ⑥ 소요시간(분) 입력 셀
  // - oninput: 입력한 분으로 종료시간 자동 계산
  // - keydown: ↑↓ = 행 이동, Shift+↑↓ = ±5분 조정
  const tdDur  = document.createElement('td'); tdDur.style.cssText='text-align:center';
  const inpDur = document.createElement('input');
  inpDur.type='text'; inpDur.className='input inp-dur'; inpDur.dataset.col='dur';
  inpDur.maxLength=4;
  inpDur.style.cssText="width:68px;text-align:center;padding:0 6px;font-family:'JetBrains Mono',monospace;font-size:12px";
  inpDur.placeholder='분';
  inpDur.title = '↑↓ : 위아래 행 이동\nShift+↑↓ : ±5분 조정';
  // 초기값: start·end 모두 있을 때 소요시간 계산
  (()=>{ const s=parseMin(row.start),e=parseMin(row.end); if(s!==null&&e!==null){const d=((e-s)+MINS_IN_DAY)%MINS_IN_DAY; if(d>0) inpDur.value=d;} })();
  inpDur.onfocus = () => { snapshot(); };
  inpDur.oninput = e => {
    // 시작/종료 입력칸과 동일하게 text 타입을 유지하면서 숫자만 허용
    const digits = (e.target.value || '').replace(/[^0-9]/g, '').slice(0, 4);
    if (e.target.value !== digits) e.target.value = digits;
    const mins   = parseInt(digits, 10);
    const curRow = dutyRows.find(r => r.id==row.id);
    if (!curRow) return;
    const s = parseMin(curRow.start);
    if (s===null || isNaN(mins) || mins<=0) return;
    if (mins > MINS_IN_DAY) {
      e.target.value = String(MINS_IN_DAY);
    }
    const safeMins = Math.min(mins, MINS_IN_DAY);
    // 소요시간 입력 → 종료시간 역산
    const newE      = ((s+safeMins)%MINS_IN_DAY+MINS_IN_DAY)%MINS_IN_DAY;
    const hh        = String(Math.floor(newE/60)).padStart(2,'0');
    const mm        = String(newE%60).padStart(2,'0');
    const newEndStr = hh+':'+mm;
    curRow.end = newEndStr; save();
    const endInp = tr.querySelector('.inp-end');
    if (endInp) endInp.value = newEndStr;
    renderOverview(); refreshAllChipsConflicts();
  };
  inpDur.onblur = () => {};
  inpDur.addEventListener('keydown', e => {
    if (e.key==='ArrowUp' || e.key==='ArrowDown') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+방향키: ±5분 조정 (input 이벤트를 dispatch해 종료시간도 연동)
        const cur = parseInt(inpDur.value) || 0;
        inpDur.value = e.key==='ArrowUp' ? cur+5 : Math.max(1, cur-5);
        inpDur.dispatchEvent(new Event('input'));
      } else {
        navigateDutyCell(inpDur, e.key==='ArrowDown' ? 'down' : 'up');
      }
    }
  });
  tdDur.appendChild(inpDur); tr.appendChild(tdDur);

  // ⑦ 소임명 입력 셀
  // - oninput: 데이터 저장 + overview 갱신 (색상·범례가 소임명 기준이므로)
  // - keydown: ↑↓ = 행 이동
  const tdD = document.createElement('td');
  const inD = document.createElement('input');
  inD.type='text'; inD.className='input input-duty'; inD.dataset.col='duty';
  inD.value=row.duty; inD.placeholder='예) 대강당 방석 깔기';
  inD.onfocus = () => { snapshot(); };
  inD.oninput = e => { updateRowData(row.id, 'duty', e.target.value); renderOverview(); };
  inD.onblur  = () => {};
  inD.onkeydown = e => {
    if (e.key==='ArrowDown') { e.preventDefault(); navigateDutyCell(inD, 'down'); }
    else if (e.key==='ArrowUp') { e.preventDefault(); navigateDutyCell(inD, 'up'); }
  };
  tdD.appendChild(inD); tr.appendChild(tdD);

  // ⑧ 총 인원 수 표시 셀 (pill 뱃지)
  const tdCount = document.createElement('td'); tdCount.className='count-cell'; tdCount.dataset.countId=row.id;
  const pill    = document.createElement('span');
  pill.className  = 'count-pill' + (row.assigned.length===0 ? ' zero' : '');
  pill.textContent = row.assigned.length===0 ? '0명' : row.assigned.length+'명';
  tdCount.appendChild(pill);
  tr.appendChild(tdCount);

  // ⑨ 인원 칩(chip) 셀 — 인원별 배치 토글 체크박스들
  const tdP = document.createElement('td'); tdP.className='chip-cell'; tdP.dataset.rowId=row.id;
  renderChips(tdP, row, pill); tr.appendChild(tdP);

  // ⑩ 액션 버튼 셀 — 행 복사 / 행 삭제
  const tdAct  = document.createElement('td');
  const actCell = document.createElement('div'); actCell.className='action-cell';
  // 충돌 무시 아이콘 토글 (버튼)
  const noBtn = document.createElement('button');
  noBtn.type = 'button';
  noBtn.className = 'action-btn no-conflict-btn' + (row.noConflict ? ' active' : '');
  noBtn.title = row.noConflict ? '충돌무시: 켜짐' : '충돌무시: 꺼짐';
  noBtn.setAttribute('aria-pressed', row.noConflict ? 'true' : 'false');
  // shield icon
  noBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l7 3v5c0 5-3.7 9.7-7 11-3.3-1.3-7-6-7-11V5l7-3z"></path><path d="M9 12l2 2 4-4"></path></svg>';
  noBtn.onclick = () => {
    row.noConflict = !row.noConflict;
    noBtn.classList.toggle('active', !!row.noConflict);
    noBtn.title = row.noConflict ? '충돌무시: 켜짐' : '충돌무시: 꺼짐';
    noBtn.setAttribute('aria-pressed', row.noConflict ? 'true' : 'false');
    save();
    refreshAllChipsConflicts();
    renderOverview();
    refreshAlertPanel();
  };
  actCell.appendChild(noBtn);

  const copyBtn = document.createElement('button');
  copyBtn.className='action-btn copy-btn'; copyBtn.title='행 복사 (Ctrl+D)';
  copyBtn.innerHTML='<svg width="13" height="14" viewBox="0 0 13 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="4.5" width="7" height="8" rx="1.2"/><path d="M2.5 9.5H2A1.5 1.5 0 0 1 .5 8V2A1.5 1.5 0 0 1 2 .5h6A1.5 1.5 0 0 1 9.5 2v2"/></svg>';
  copyBtn.onclick = () => copyDutyRow(row.id);
  actCell.appendChild(copyBtn);

  const dBtn = document.createElement('button');
  dBtn.className='action-btn del-btn2'; dBtn.title='행 삭제 (Ctrl+X)';
  dBtn.innerHTML='<svg width="12" height="13" viewBox="0 0 12 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 3h10M4 3V2h4v1M2 3l.8 8.2A1 1 0 0 0 3.8 12h4.4a1 1 0 0 0 1-.8L10 3"/></svg>';
  dBtn.onclick = () => { snapshot(); deleteDutyRow(row.id, tr); renderOverview(); };
  actCell.appendChild(dBtn);

  tdAct.appendChild(actCell); tr.appendChild(tdAct);

  // 드래그 앤 드롭 이벤트 바인딩 (행 순서 변경)
  tr.addEventListener('dragstart', dragStart);
  tr.addEventListener('dragover',  dragOver);
  tr.addEventListener('dragleave', dragLeave);
  tr.addEventListener('drop',      dragDrop);
  tr.addEventListener('dragend',   dragEnd);

  tbody.appendChild(tr);
  renumberRows(); // 모든 행의 번호(#) 재계산
}

// ══════════════════════════════════════════
// CHIPS & CONFLICT  — 인원 칩 렌더링 및 시간 충돌 감지
// ══════════════════════════════════════════

// 모든 소임 행의 칩(chip) UI를 최신 충돌 상태로 새로고침한다.
// assigned 데이터는 변경하지 않고 UI 표시만 갱신한다.
function refreshAllChipsConflicts() {
  dutyRows.forEach(row => {
    const pillTd = document.querySelector(`td.count-cell[data-count-id="${row.id}"]`);
    const pill   = pillTd ? pillTd.querySelector('.count-pill') : null;
    if (pill) updateCountPill(pill, row.assigned.length);
    const chipTd = document.querySelector(`td.chip-cell[data-row-id="${row.id}"]`);
    if (chipTd) renderChips(chipTd, row, pill);
  });
}

// currentRow보다 앞에 위치한 행 중, 시간이 겹치면서 이미 배치된 인원 이름을 Set으로 반환한다.
// 이 인원들은 현재 행에서 '충돌(conflict)' 상태로 표시되어 선택할 수 없다.
function getConflictNames(currentRow) {
  const s1 = parseMin(currentRow.start);
  const e1 = parseMin(currentRow.end);
  const conflicted = new Set();
  // If this row is marked to ignore conflicts, it never shows conflicts
  if (currentRow.noConflict) return conflicted;

  const currentIdx = dutyRows.findIndex(r => r.id == currentRow.id);

  dutyRows.forEach((row, idx) => {
    // 자기 자신 제외, 현재 행보다 앞에 있는 행만
    if (row.id == currentRow.id || idx >= currentIdx) return;
    // Skip rows that are marked to ignore conflicts (they do not cause conflicts)
    if (row.noConflict) return;

    const s2 = parseMin(row.start);
    const e2 = parseMin(row.end);
    if (s1 === null || e1 === null || s2 === null || e2 === null) return;

    // 시간 겹침 판단 (자정 넘김 포함)
    if (timeOverlap(s1, e1, s2, e2)) {
      row.assigned.forEach(name => conflicted.add(name));
    }
  });

  return conflicted;
}

// 두 시간 구간 [s1,e1], [s2,e2]가 겹치는지 판단한다 (분 단위, 자정 wrap 처리).
// 각 구간을 세그먼트로 변환 후 교차 여부를 검사한다.
function timeOverlap(s1, e1, s2, e2) {
  // 각 구간을 분 단위 세그먼트 배열로 변환
  const segs1 = s1 === e1 ? [] : (e1 > s1 ? [[s1,e1]] : [[s1,MINS_IN_DAY],[0,e1]]);
  const segs2 = s2 === e2 ? [] : (e2 > s2 ? [[s2,e2]] : [[s2,MINS_IN_DAY],[0,e2]]);
  for (const [a,b] of segs1) {
    for (const [c,d] of segs2) {
      if (a < d && c < b) return true;
    }
  }
  return false;
}

// 특정 소임 행(row)의 인원 칩 목록을 container에 렌더링한다.
// 칩은 인원별 체크박스 형태이며, 시간 충돌 인원은 비활성화+중복 뱃지로 표시된다.
function renderChips(container, row, pill) {
  container.innerHTML='';
  const area=document.createElement('div'); area.className='chip-area';

  // 이 행보다 앞에서 이미 중복 시간대에 배치된 인원 계산
  const conflicted = getConflictNames(row);

  const modeSelected = (typeof personnelViewMode !== 'undefined' && personnelViewMode === 'selected');
  const modeHidden = (typeof personnelViewMode !== 'undefined' && personnelViewMode === 'hidden');
  const allChip=document.createElement('span'); allChip.className='chip-all';
  // 전체선택은 충돌 없는 인원 기준으로만 체크 여부 판단
  const availablePersonnel = personnel.filter(p => !conflicted.has(p.name));
  const isAll = availablePersonnel.length > 0 && availablePersonnel.every(p => row.assigned.includes(p.name));
  if(isAll) allChip.classList.add('all-checked');
  allChip.innerHTML=`<span class="chip-dot"></span> 전체선택`;
  allChip.onclick=()=>toggleAllChips(row.id, allChip, conflicted);
  // in 'selected' mode we hide unchecked personnel; skip adding the "전체선택" button
  if (!modeSelected) area.appendChild(allChip);

  if(!modeSelected && personnel.length>0){
    const sep=document.createElement('span');
    sep.style.cssText='width:1px;height:20px;background:var(--border);margin:0 2px';
    area.appendChild(sep);
  }

  personnel.forEach(p=>{
    // if we're in 'selected' mode and this person is not assigned to the row, skip rendering
    if (modeSelected && !row.assigned.includes(p.name)) return;   // 'selected' 모드에서는 배치된 인원만 보이도록
    if (modeHidden) return;                                       // 'hidden' 모드에서는 인원 칩 자체를 숨김
    const isConflict = conflicted.has(p.name);
    const lbl=document.createElement('label');
    let cls = 'chip-label';
    if (row.assigned.includes(p.name)) cls += ' checked';
    if (isConflict) cls += ' conflict';
    lbl.className = cls;

    const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=row.assigned.includes(p.name);
    if (isConflict) cb.disabled = true;

    if (!isConflict) {
      cb.onchange=()=>toggleChip(row.id,p.name,cb.checked,lbl,allChip,pill);

    }

    const dot=document.createElement('span'); dot.className='chip-dot';
    const txt=document.createElement('span');
    txt.textContent=p.name;
    lbl.appendChild(cb); lbl.appendChild(dot); lbl.appendChild(txt);

    // 충돌 표시 뱃지
    if (isConflict) {
      const tip=document.createElement('span'); tip.className='chip-conflict-tip';
      // 어느 소임에서 겹치는지 힌트
      const conflictRow = dutyRows.find((r,idx) => {
        if (r.id == row.id) return false;
        const ri = dutyRows.findIndex(x=>x.id==row.id);
        if (idx >= ri) return false;
        return r.assigned.includes(p.name) && timeOverlap(
          parseMin(row.start), parseMin(row.end),
          parseMin(r.start),   parseMin(r.end)
        );
      });
      tip.textContent = conflictRow ? (conflictRow.duty||'중복') : '중복';
      lbl.title = `${p.name}은(는) '${tip.textContent}' 소임과 시간이 겹칩니다`;
      lbl.appendChild(tip);
    }

    area.appendChild(lbl);
  });

  if(!personnel.length){
    const h=document.createElement('span');
    h.style.cssText='font-size:12px;color:var(--text-dim)';
    h.textContent='인원 등록 탭에서 먼저 인원을 추가하세요';
    area.appendChild(h);
  }
  container.appendChild(area);
}

// 총 인원 수 뱃지(pill)의 텍스트와 스타일을 갱신한다.
function updateCountPill(pill, count) {
  if (!pill) return;
  pill.textContent = count===0?'0명':count+'명';
  pill.classList.toggle('zero', count===0);
}

// 개별 인원 칩 체크박스 토글 처리
// checked: true=배치 추가, false=배치 제거
// 변경 후 전체선택 상태·인원 수 뱃지·하위 행 충돌 상태를 갱신한다.
function toggleChip(rowId,name,checked,lbl,allChip,pill){
  const row=dutyRows.find(r=>r.id==rowId); if(!row) return;
  if(checked){if(!row.assigned.includes(name)){row.assigned.push(name); row.assigned=sortAssigned(row.assigned);}}
  else row.assigned=row.assigned.filter(n=>n!==name);
  lbl.classList.toggle('checked',checked);
  const cf = getConflictNames(row);
  const available = personnel.filter(p=>!cf.has(p.name));
  const all = available.length>0 && available.every(p=>row.assigned.includes(p.name));
  allChip.classList.toggle('all-checked',all);
  updateCountPill(pill, row.assigned.length);
  save();
  // 이 행 이후 행들의 충돌 상태도 갱신
  refreshDownstreamChips(rowId);
  refreshAlertPanel();
}

// changedRowId 이후에 위치한 행들의 칩 UI를 다시 렌더링한다.
// 인원 배치가 변경되면 이후 행들의 충돌 판정이 달라질 수 있기 때문이다.
function refreshDownstreamChips(changedRowId) {
  const changedIdx = dutyRows.findIndex(r => r.id == changedRowId);
  dutyRows.forEach((row, idx) => {
    if (idx <= changedIdx) return; // 이전 행은 영향 없음
    const pillTd = document.querySelector(`td.count-cell[data-count-id="${row.id}"]`);
    const pill   = pillTd ? pillTd.querySelector('.count-pill') : null;
    const chipTd = document.querySelector(`td.chip-cell[data-row-id="${row.id}"]`);
    if (chipTd) renderChips(chipTd, row, pill);
  });
}

// '전체선택' 칩 토글 처리
// 충돌 중인 인원은 제외하고 나머지 인원을 일괄 선택/해제한다.
function toggleAllChips(rowId, allChip, conflicted){
  const row=dutyRows.find(r=>r.id==rowId); if(!row) return;
  // 전체선택/해제는 충돌 없는 인원에만 적용
  const cf = conflicted || getConflictNames(row);
  const available = personnel.filter(p => !cf.has(p.name));
  const allSelected = available.length > 0 && available.every(p => row.assigned.includes(p.name));
  if (allSelected) {
    // 해제: 충돌없는 인원만 해제 (충돌 인원은 원래 배치되지 않으므로 무관)
    row.assigned = row.assigned.filter(n => {
      const p = personnel.find(p=>p.name===n);
      return p && cf.has(p.name); // 충돌 인원이었으면 유지 (사실 없음)
    });
    // 사실상 충돌 없는 인원 전부 제거
    row.assigned = row.assigned.filter(n => cf.has(n));
  } else {
    // 선택: 충돌 없는 인원만 추가
    available.forEach(p => { if(!row.assigned.includes(p.name)) row.assigned.push(p.name); });
    row.assigned = sortAssigned(row.assigned);
  }
  save();
  const pillTd=document.querySelector(`td.count-cell[data-count-id="${rowId}"]`);
  const pill=pillTd?pillTd.querySelector('.count-pill'):null;
  updateCountPill(pill, row.assigned.length);
  const chipTd=document.querySelector(`td.chip-cell[data-row-id="${rowId}"]`);
  if(chipTd) renderChips(chipTd,row,pill);
  // 이 행 이후 행들의 충돌 상태도 갱신
  refreshDownstreamChips(rowId);
  refreshAlertPanel();
}

// 특정 소임 행의 단일 필드 값을 업데이트하고 저장한다.
function updateRowData(rowId,field,value){
  const row=dutyRows.find(r=>r.id==rowId);
  if(row){row[field]=value;save();}
}

// 특정 소임 행을 dutyRows에서 제거하고 DOM에서도 삭제한다.
function deleteDutyRow(rowId,trEl){
  dutyRows=dutyRows.filter(r=>r.id!=rowId);
  // If this row was selected, remove from selected set and update bulk UI
  if (selectedIds.has(rowId)) {
    selectedIds.delete(rowId);
    updateBulkToolbar();
    updateSelectAllCb();
  }
  trEl.remove(); renumberRows(); updateDutyEmpty(); save();
}

// ══════════════════════════════════════════
// DRAG & DROP  — 소임 행 순서 변경
// ══════════════════════════════════════════
// HTML5 Drag and Drop API를 이용해 소임 행을 드래그로 재정렬한다.
// dragSrcId: 현재 드래그 중인 행의 id
let dragSrcId = null;

// 드래그 시작: 드래그 중인 행 id 기록 + 시각적 스타일 적용
function dragStart(e) {
  dragSrcId = this.dataset.id;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragSrcId);
}

// 드래그 중: 드롭 위치(위/아래)에 따라 시각적 가이드라인 표시
function dragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (this.dataset.id === dragSrcId) return;
  const rect = this.getBoundingClientRect();
  const mid  = rect.top + rect.height / 2;
  this.classList.remove('drag-over-top','drag-over-bottom');
  this.classList.add(e.clientY < mid ? 'drag-over-top' : 'drag-over-bottom');
}

// 드래그가 대상 행을 벗어날 때 가이드라인 제거
function dragLeave() {
  this.classList.remove('drag-over-top','drag-over-bottom');
}

// 드롭: 드래그한 행을 드롭 위치에 삽입하고 데이터·UI 갱신
function dragDrop(e) {
  e.preventDefault();
  const targetId = this.dataset.id;
  if (!dragSrcId || dragSrcId === targetId) return;

  snapshot();

  const srcIdx = dutyRows.findIndex(r=>r.id==dragSrcId);
  const tgtIdx = dutyRows.findIndex(r=>r.id==targetId);
  const rect   = this.getBoundingClientRect();
  const after  = e.clientY >= rect.top + rect.height / 2;

  const [moved] = dutyRows.splice(srcIdx, 1);
  let insertAt = dutyRows.findIndex(r=>r.id==targetId);
  if (after) insertAt++;
  dutyRows.splice(insertAt, 0, moved);

  save();
  rebuildDutyTable();
  refreshAllChipsConflicts();
  renderOverview();
  // flash moved row
  const tbody = document.getElementById('dutyBody');
  const movedTr = tbody.querySelector(`tr[data-id="${moved.id}"]`);
  if (movedTr) { movedTr.classList.add('flash-added'); setTimeout(()=>movedTr.classList.remove('flash-added'),550); }
}

// 드래그 종료: id 초기화 + 모든 드래그 관련 CSS 클래스 제거
function dragEnd() {
  dragSrcId = null;
  document.querySelectorAll('#dutyBody tr').forEach(r=>{
    r.classList.remove('dragging','drag-over-top','drag-over-bottom');
  });
}

// Move selected rows together as a single block (preserve relative order).
function moveSelectedBlock(direction) {
  if (!selectedIds || selectedIds.size === 0) return;
  snapshot();
  const selectedSet = new Set(Array.from(selectedIds));
  const idxs = dutyRows.map((r,i) => selectedSet.has(r.id) ? i : -1).filter(i=>i!==-1).sort((a,b)=>a-b);
  if (!idxs.length) return;
  const firstIdx = idxs[0];
  const lastIdx  = idxs[idxs.length-1];

  // build block (in original order)
  const block = idxs.map(i => dutyRows[i]);
  // remaining rows (remove selected)
  const remaining = dutyRows.filter(r => !selectedSet.has(r.id));

  // Build contiguous segments from selected indices, e.g. [[2,3],[6,6],...]
  const segments = [];
  let segStart = idxs[0], segPrev = idxs[0];
  for (let k = 1; k < idxs.length; k++) {
    const cur = idxs[k];
    if (cur === segPrev + 1) {
      segPrev = cur; // extend
    } else {
      segments.push({ start: segStart, end: segPrev });
      segStart = cur; segPrev = cur;
    }
  }
  segments.push({ start: segStart, end: segPrev });

  // Operate on a copy to avoid mid-loop index confusion
  let result = dutyRows.slice();
  const n = result.length;
  if (direction < 0) {
    // Move each segment up by one; process ascending so earlier moves don't affect later indices
    for (const seg of segments) {
      const s = seg.start, e = seg.end;
      if (s === 0) continue; // can't move this segment up
      // swap the block [s..e] with the single item at s-1
      const block = result.slice(s, e + 1);
      const before = result[s - 1];
      // replace range [s-1 .. e] with block then before
      result.splice(s - 1, block.length + 1, ...block, before);
    }
  } else {
    // Move segments down by one; process descending so later moves don't affect earlier indices
    for (let si = segments.length - 1; si >= 0; si--) {
      const seg = segments[si];
      const s = seg.start, e = seg.end;
      if (e === n - 1) continue; // can't move this segment down
      const block = result.slice(s, e + 1);
      const after = result[e + 1];
      // replace range [s .. e+1] with after then block
      result.splice(s, block.length + 1, after, ...block);
    }
  }

  dutyRows = result;

  
  save();
  rebuildDutyTable();

  // restore selection UI
  dutyRows.forEach(r => {
    if (!selectedSet.has(r.id)) return;
    const tr = document.querySelector(`#dutyBody tr[data-id="${r.id}"]`);
    if (tr) {
      tr.classList.add('selected-row');
      const cb = tr.querySelector('.row-select-cb'); if (cb) cb.checked = true;
    }
  });

  updateBulkToolbar(); updateSelectAllCb();
  renderOverview(); refreshAllChipsConflicts(); refreshAlertPanel();
  toast('✓ 선택 행 이동');
}

function moveSelectedUp() { moveSelectedBlock(-1); }
function moveSelectedDown() { moveSelectedBlock(+1); }

// 모든 행의 번호(#) 셀을 현재 순서에 맞게 1부터 다시 매긴다.
function renumberRows(){
  document.querySelectorAll('#dutyBody tr').forEach((tr,i)=>{
    const td=tr.querySelector('.row-num'); if(td) td.textContent=i+1;
  });
}

// 소임이 없을 때 빈 화면 안내 메시지를 표시하고, 있을 때는 테이블을 표시한다.
function updateDutyEmpty(){
  const has=document.getElementById('dutyBody').children.length>0;
  document.getElementById('dutyEmpty').style.display=has?'none':'block';
  document.getElementById('dutyTable').style.display=has?'table':'none';
}


// 인원 목록이 변경된 후(인원 추가/삭제/편집) 모든 소임 행의 칩을 동기화한다.
// 더 이상 존재하지 않는 인원은 assigned에서 제거한다.
function refreshAllChips(){
  dutyRows.forEach(row=>{
    row.assigned=row.assigned.filter(n=>personnel.some(p=>p.name===n));
    const pillTd=document.querySelector(`td.count-cell[data-count-id="${row.id}"]`);
    const pill=pillTd?pillTd.querySelector('.count-pill'):null;
    updateCountPill(pill, row.assigned.length);
    const chipTd=document.querySelector(`td.chip-cell[data-row-id="${row.id}"]`);
    if(chipTd) renderChips(chipTd,row,pill);
  });
  save();
}

// 현재 날짜의 소임 데이터와 인원 데이터를 CSV 파일로 내보낸다.
// [소임] / [인원] 두 섹션으로 구성되며, 동일한 파일을 가져오기로 다시 불러올 수 있다.
function exportCSV(){
  if(!dutyRows.length && !personnel.length){toast('내보낼 데이터가 없습니다.');return;}
  const d = parseDate(currentDate);
  const fileName = d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'_소임배치표.csv';

  let csv='\uFEFF';

  // ── 소임 섹션 ──
  csv+='[소임]\n';
  csv+='시작시간,종료시간,소요(분),소임,인원,충돌무시\n';
  dutyRows.forEach(r=>{
    const allNames = personnel.map(p=>p.name);
    const isAll = allNames.length > 0 && allNames.every(n=>r.assigned.includes(n));
    const personnelOrder = personnel.map(p=>p.name);
    const sortedAssigned = [...r.assigned].sort((a,b)=>{
      const ia=personnelOrder.indexOf(a), ib=personnelOrder.indexOf(b);
      if(ia===-1&&ib===-1) return a.localeCompare(b,'ko');
      if(ia===-1) return 1; if(ib===-1) return -1;
      return ia-ib;
    });
    const assignedText = isAll ? '전원' : sortedAssigned.join(' / ');
    const s=parseMin(r.start),e=parseMin(r.end);
    const dur=(s!==null&&e!==null)?((e-s+MINS_IN_DAY)%MINS_IN_DAY):'';
    csv+=`"${r.start}","${r.end}","${dur}","${r.duty}","${assignedText}","${r.noConflict?1:''}"\n`;
  });

  // ── 인원 섹션 ──
  // 직책 섹션 (직책 관리의 순서를 보존하기 위해 별도 섹션으로 출력)
  csv+='\n[직책]\n';
  csv+='직책\n';
  positions.forEach(pos => { csv+=`"${pos}"\n`; });

  // ── 인원 섹션 ──
  csv+='\n[인원]\n';
  csv+='이름,직책,특이사항\n';
  personnel.forEach(p=>{
    csv+=`"${p.name}","${p.position||''}","${p.note||''}"\n`;
  });

  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=fileName; a.click();
  toast('✓ CSV 저장 완료 (소임 + 인원)');
}

// ══════════════════════════════════════════
// CSV IMPORT  — CSV 파일 가져오기
// ══════════════════════════════════════════
// CSV 파일을 읽어 소임·인원 데이터를 교체한다.
// 기존 데이터가 있으면 확인창을 띄운 후 진행한다.
function importCSV(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result.replace(/^\uFEFF/, '');
    const allLines = text.split(/\r?\n/);

    // ── 섹션 분리: [소임] / [직책] / [인원] 구분자 지원 ──
    let dutyLines = [], positionsLines = [], personnelLines = [];
    let mode = null; // null | 'duty' | 'positions' | 'personnel'
    let hasSections = false;

    for (const raw of allLines) {
      const line = raw.trim();
      if (line === '[소임]')      { mode = 'duty';      hasSections = true; continue; }
      if (line === '[직책]')    { mode = 'positions'; hasSections = true; continue; }
      if (line === '[인원]')      { mode = 'personnel'; hasSections = true; continue; }
      if (!line) continue;
      if (hasSections) {
        if (mode === 'duty')      dutyLines.push(line);
        else if (mode === 'positions') positionsLines.push(line);
        else if (mode === 'personnel') personnelLines.push(line);
      } else {
        // 섹션 구분자 없는 구형 CSV: 헤더로 타입 판별
        if (dutyLines.length === 0 && personnelLines.length === 0) {
          const h = parseCSVLine(line);
          if (h.some(c => c.includes('시작'))) mode = 'duty';
          else if (h.some(c => c === '이름'))  mode = 'personnel';
        }
        if (mode === 'duty')      dutyLines.push(line);
        else if (mode === 'personnel') personnelLines.push(line);
      }
    }

    // 헤더 파싱 헬퍼
    function getIdx(header, ...keywords) {
      return header.findIndex(h => keywords.some(k => h.includes(k)));
    }

    const hasDutyData      = dutyLines.length > 1;
    const hasPositionsData = positionsLines.length > 1;
    const hasPersonnelData = personnelLines.length > 1;

    if (!hasDutyData && !hasPersonnelData && !hasPositionsData) {
      toast('⚠ 유효한 CSV 파일이 아닙니다.'); return;
    }

    // 기존 데이터 확인 메시지 (기존 데이터 전부 삭제 후 교체)
    const hasExisting = (hasDutyData && dutyRows.length > 0) || (hasPersonnelData && personnel.length > 0);
    if (hasExisting) {
      const parts = [];
      if (hasDutyData && dutyRows.length > 0)      parts.push(`소임 ${dutyRows.length}개`);
      if (hasPersonnelData && personnel.length > 0) parts.push(`인원 ${personnel.length}명`);
      const confirmed = confirm(
        `⚠ 주의\n\n` +
        `CSV를 업로드하면 다음 데이터가 모두 삭제됩니다.\n\n` +
        `  • 현재 날짜(${currentDate})의 소임 데이터 전체\n` +
        `  • 등록된 인원 데이터 전체\n\n` +
        `삭제 후 CSV 파일의 데이터로 교체됩니다.\n` +
        `(다른 날짜의 소임 데이터는 유지됩니다)\n` +
        `이 작업은 되돌릴 수 없습니다.\n\n` +
        `계속하시겠습니까?`
      );
      if (!confirmed) { toast('취소되었습니다.'); return; }
    }

    let dutyAdded = 0, personnelAdded = 0;

    // ── positions 섹션이 있으면 먼저 파싱하여 순서를 복원
    if (hasPositionsData) {
      // positionsLines[0] expected to be header, subsequent lines are position names
      const posList = [];
      for (let i = 1; i < positionsLines.length; i++) {
        const cols = parseCSVLine(positionsLines[i]);
        const pos = (cols[0] || '').trim();
        if (pos) posList.push(pos);
      }
      if (posList.length) {
        positions = posList.slice();
        selectedPos = positions[0] || '';
      }
    }

    // ── 인원 파싱 먼저 (소임의 '전원' 처리가 personnel을 참조하므로) ──
    if (hasPersonnelData) {
      const pHeader = parseCSVLine(personnelLines[0]);
      const iName = getIdx(pHeader, '이름');
      const iPos  = getIdx(pHeader, '직책');
      const iNote = getIdx(pHeader, '특이사항', '메모');
      if (iName !== -1) {
        personnel = []; // 기존 인원 전체 삭제
        // collect positions in CSV order (unique)
        const posOrder = [];
        const posSet = new Set();
        for (let i = 1; i < personnelLines.length; i++) {
          const cols = parseCSVLine(personnelLines[i]);
          const name = (cols[iName] || '').trim();
          if (!name) continue;
          const position = iPos  !== -1 ? (cols[iPos]  || '').trim() : '';
          const note     = iNote !== -1 ? (cols[iNote] || '').trim() : '';
          personnel.push({ id: Date.now() + i * 1000, name, position, note });
          personnelAdded++;
          if (position && !posSet.has(position)) { posSet.add(position); posOrder.push(position); }
        }
        // If CSV defined positions (from personnel table) and no explicit [직책] section,
        // replace current positions list with CSV order
        if (!hasPositionsData && posOrder.length) {
          positions = posOrder.slice();
          selectedPos = positions[0] || '';
        }
        save();
        renderPersonnelList();
        renderPositionButtons();
      }
    }

    // ── 소임 파싱 (인원 파싱 후 실행하여 '전원' 처리 정확히 반영) ──
    if (hasDutyData) {
      const dHeader = parseCSVLine(dutyLines[0]);
      const iStart     = getIdx(dHeader, '시작');
      const iEnd       = getIdx(dHeader, '종료');
      const iDuty      = getIdx(dHeader, '소임');
      const iAssign    = getIdx(dHeader, '인원');
      const iNoConflict= getIdx(dHeader, '충돌', '충돌무시');
      if (iStart !== -1 && iDuty !== -1) {
        snapshot();
        dutyRows = []; // 기존 소임 전체 삭제
        for (let i = 1; i < dutyLines.length; i++) {
          const cols = parseCSVLine(dutyLines[i]);
          const start = (cols[iStart] || '').trim();
          const end   = (cols[iEnd]   || '').trim();
          const duty  = (cols[iDuty]  || '').trim();
          if (!start && !duty) continue;
          const assignRaw = iAssign !== -1 ? (cols[iAssign] || '').trim() : '';
          let assigned = [];
          if (assignRaw === '전원') {
            assigned = personnel.map(p => p.name); // 이미 파싱된 인원 사용
          } else if (assignRaw) {
            assigned = assignRaw.split('/').map(s => s.trim()).filter(Boolean);
          }
          // parse noConflict flag if present
          let noConflict = false;
          if (iNoConflict !== -1) {
            const rawNc = (cols[iNoConflict] || '').trim();
            noConflict = /^(1|true|yes|y|예)$/i.test(rawNc);
          }
          dutyRows.push({ id: Date.now() + i, start, end, duty, assigned, noConflict });
          dutyAdded++;
        }
        save();
        rebuildDutyTable();
        refreshAllChipsConflicts();
        renderOverview();
        refreshAlertPanel();
      }
    }

    // 인원 관련 UI 최종 갱신
    if (hasPersonnelData) {
      refreshAllChips();
      renderOverview();
    }

    const msgs = [];
    if (dutyAdded)      msgs.push(`소임 ${dutyAdded}개`);
    if (personnelAdded) msgs.push(`인원 ${personnelAdded}명`);
    toast('✓ ' + (msgs.length ? msgs.join(', ') + ' 불러오기 완료' : '변경 없음'));
  };
  reader.readAsText(file, 'UTF-8');
}

// CSV 한 줄을 컬럼 배열로 파싱 (따옴표 처리 포함)
function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      result.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

// ══════════════════════════════════════════
// GANTT
// ══════════════════════════════════════════
// ══════════════════════════════════════════
// GANTT  — 인원 기준 타임라인 배치표
// ══════════════════════════════════════════

// 시간 눈금(ruler) 렌더링 — ganttStartH~ganttEndH 범위를 1시간 간격으로 표시
function buildRuler(){
  const ruler=document.getElementById('timeRuler'); ruler.innerHTML='';
  for(let h=ganttStartH;h<=ganttEndH;h++){
    const tick=document.createElement('div');
    const isEdge=(h===ganttStartH||h===ganttEndH);
    tick.className='ruler-tick'+(isEdge?' h0':'');
    tick.style.left=minToViewPct(h*60,ganttStartH,ganttEndH)+'%';
    tick.innerHTML=`<div class="ruler-tick-line"></div><div class="ruler-tick-label">${h}</div>`;
    ruler.appendChild(tick);
  }
  if (currentDate === todayStr()) {
    const nm=nowMin();
    if(nm>=viewMin(ganttStartH)&&nm<=viewMax(ganttEndH)){
      const nl=document.createElement('div'); nl.className='now-line';
      nl.style.left=minToViewPct(nm,ganttStartH,ganttEndH)+'%';
      ruler.appendChild(nl);
    }
  }
  syncGanttSelects();
}

// 인원 기준 Gantt 차트 전체 재렌더링
// 인원별로 한 행씩 그리며, 배치된 소임을 가로 바(bar)로 표시한다.
// '전원 소임'은 모든 인원 행에 걸쳐 반투명 오버레이로 별도 표시된다.
function refreshGantt(){
  resetColors();
  const rowsEl=document.getElementById('ganttRows');
  const emptyEl=document.getElementById('ganttEmpty');
  const legend=document.getElementById('ganttLegend');
  rowsEl.innerHTML=''; legend.innerHTML='<span style="font-size:11px;color:var(--text-dim)">소임 범례</span>';

  if(!personnel.length){ emptyEl.style.display='block'; return; }
  buildRuler();

  const visRows = (typeof getVisibleDutyRows === 'function') ? getVisibleDutyRows() : dutyRows;
  [...new Set(visRows.map(r=>r.duty||'(미입력)'))].forEach(dn=>getColor(dn));
  [...new Set(visRows.map(r=>r.duty||'(미입력)'))].forEach(dn=>{
    const c=getColor(dn);
    const item=document.createElement('div'); item.className='legend-item';
    item.style.cssText=`background:${c.bg};border-color:${c.b};color:${c.t}`;
    item.innerHTML=`<span class="legend-dot" style="background:${c.b}"></span>${dn}`;
    legend.appendChild(item);
  });

  // update date label
  const ganttDateLabel = document.getElementById('ganttDateLabel');
  if (ganttDateLabel) {
    const d = parseDate(currentDate);
    ganttDateLabel.textContent = formatDateDisplay(currentDate)+' ('+KO_DAYS_FULL[d.getDay()]+')';
  }

  const isToday = currentDate === todayStr();
  const nm=isToday ? nowMin() : -1;
  const nmInView = nm>=0 && nm>=viewMin(ganttStartH) && nm<=viewMax(ganttEndH);

  // 전원 소임 오버레이: 개인 행들이 모두 렌더링된 후 높이 측정해서 그림
  const allDuties = visRows.filter(r => isAllPersonnel(r));

  // 빈 상태: 표시할 소임이 하나도 없으면 empty 표시
  if (!visRows.length) { emptyEl.style.display = 'block'; return; }
  emptyEl.style.display = 'none';

  // 개인 행: 항상 모든 인원을 고정으로 렌더링하되, 각 인원에 대해 현재 필터에 해당하는 소임만 표시
  personnel.forEach(p=>{
    const myDuties=visRows.filter(r=>r.assigned.includes(p.name) && !isAllPersonnel(r));
    const row=document.createElement('div'); row.className='gantt-row';
    const nc=document.createElement('div'); nc.className='gantt-person';
    // wrap name in a span to avoid layout collisions with position span
    const nameHtml = `<span class="gantt-person-main">${escapeHtml(p.name)}</span>`;
    const posHtml = p.position ? `<span class="gantt-person-pos">${escapeHtml(p.position)}</span>` : '';
    const noteHtml = p.note ? `<div class="gantt-person-note" title="${escapeHtml(p.note)}">⚑ ${escapeHtml(p.note)}</div>` : '';
    nc.innerHTML = `<div class="gantt-person-name"><div class="gantt-person-inner">${noteHtml}${nameHtml}</div>${posHtml}</div>`;
    row.appendChild(nc);
    const tl=document.createElement('div'); tl.className='gantt-timeline';
    if (nmInView) {
      const nl=document.createElement('div'); nl.className='now-line';
      nl.style.left=minToViewPct(nm,ganttStartH,ganttEndH)+'%';
      tl.appendChild(nl);
    }
    myDuties.forEach(dr=>{
      const s=parseMin(dr.start),e=parseMin(dr.end);
      const col=getColor(dr.duty||'(미입력)');
      segs(s,e).forEach(([st,en])=>{
        const vMin=viewMin(ganttStartH),vMax=viewMax(ganttEndH);
        const cSt=Math.max(st,vMin),cEn=Math.min(en,vMax);
        if(cEn<=cSt) return;
        const lp=minToViewPct(cSt,ganttStartH,ganttEndH);
        const rp=minToViewPct(cEn,ganttStartH,ganttEndH);
        const wp=rp-lp;
        if(wp<=0) return;
        const bar=document.createElement('div'); bar.className='gantt-bar';
        bar.style.cssText=`left:${lp}%;width:${wp}%;background:${col.bg};border:1px solid ${col.b};color:${col.t}`;
        bar.title=`${dr.duty||'(미입력)'}\n${dr.start}–${dr.end}`;
        bar.innerHTML=`<span class="gantt-bar-label">${dr.duty||'(미입력)'}</span>`;
        tl.appendChild(bar);
      });
    });
    row.appendChild(tl); rowsEl.appendChild(row);
  });
  applyGridLines();

  // 전원 소임 오버레이 렌더: 레이아웃 확정 후 다음 프레임에 실행
  setTimeout(() => renderAllOverlay(), 50);
}

// '전원 소임' 오버레이 렌더링
// 등록된 모든 인원이 배치된 소임을 Gantt 전체 높이에 걸쳐 반투명 블록으로 표시한다.
// 개인 행 렌더링이 완료된 후(setTimeout) 높이를 측정하여 그린다.
function renderAllOverlay() {
  const overlay = document.getElementById('ganttAllOverlay');
  if (!overlay) return;
  overlay.innerHTML = '';

  // always compute from the currently visible rows so the overlay follows the filter
  const visRows = (typeof getVisibleDutyRows === 'function') ? getVisibleDutyRows() : dutyRows;
  const allDuties = visRows.filter(r => isAllPersonnel(r));
  if (!allDuties.length) return;

  const rowsEl = document.getElementById('ganttRows');
  if (!rowsEl || !rowsEl.children.length) return;

  const totalH = rowsEl.offsetHeight;
  if (totalH <= 0) return;

  const PAD = 4;

  allDuties.forEach(dr => {
    const s = parseMin(dr.start), e = parseMin(dr.end);
    segs(s, e).forEach(([st, en]) => {
      const vMin = viewMin(ganttStartH), vMax = viewMax(ganttEndH);
      const cSt  = Math.max(st, vMin), cEn = Math.min(en, vMax);
      if (cEn <= cSt) return;
      const lp = minToViewPct(cSt, ganttStartH, ganttEndH);
      const wp = minToViewPct(cEn, ganttStartH, ganttEndH) - lp;
      if (wp <= 0) return;

      const bar = document.createElement('div');
      bar.className = 'gantt-bar-all';
      bar.style.cssText = `left:${lp}%;width:${wp}%;top:${PAD}px;height:${totalH - PAD*2}px`;
      bar.title = `[전원 ${personnel.length}명] ${dr.duty||'(미입력)'}\n${dr.start}–${dr.end}`;
      bar.innerHTML = `<span class="gantt-bar-all-label">${dr.duty||'(미입력)'}</span>`;
      overlay.appendChild(bar);
    });
  });

  overlay.style.height = totalH + 'px';
}

// ══════════════════════════════════════════
// PAGE 2 : 인원 등록
// ══════════════════════════════════════════
// ══════════════════════════════════════════
// PERSONNEL  — 인원 등록 및 관리
// ══════════════════════════════════════════

// 직책 버튼 목록을 렌더링한다.
// - 인원 등록 폼의 직책 선택 버튼 (posGroup)
// - 직책 관리 패널의 삭제 버튼 포함 태그 (posManageGroup)
function renderPositionButtons(){
  // 등록 폼 직책 선택
  const pg=document.getElementById('posGroup'); pg.innerHTML='';
  positions.forEach(pos=>{
    const btn=document.createElement('button');
    btn.className='tag-btn'+(selectedPos===pos?' sel':'');
    btn.dataset.pos=pos;
    btn.textContent=pos;
    btn.onclick=()=>togglePos(btn,pos);
    pg.appendChild(btn);
  });

  // 직책 관리
  const mg=document.getElementById('posManageGroup'); mg.innerHTML='';
  positions.forEach(pos=>{
    const wrap=document.createElement('span'); wrap.className='pos-manage-tag';
    wrap.draggable = true;
    wrap.dataset.pos = pos;

    const drag=document.createElement('span'); drag.className='pos-drag';
    drag.title='드래그하여 순서 변경';
    drag.innerHTML='<svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor"><circle cx="2" cy="1.5" r="1.1"/><circle cx="6" cy="1.5" r="1.1"/><circle cx="2" cy="5" r="1.1"/><circle cx="6" cy="5" r="1.1"/><circle cx="2" cy="8.5" r="1.1"/><circle cx="6" cy="8.5" r="1.1"/></svg>';
    drag.addEventListener('mousedown', e=>e.stopPropagation());

    const span=document.createElement('span'); span.textContent=pos;
    const del=document.createElement('button'); del.className='pos-del-btn'; del.textContent='×';
    del.title=`"${pos}" 삭제`; del.onclick=()=>deletePosition(pos);
    del.addEventListener('mousedown', e=>e.stopPropagation());
    wrap.appendChild(drag);
    wrap.appendChild(span);
    wrap.appendChild(del);

    wrap.addEventListener('dragstart', e=>{
      e.dataTransfer.effectAllowed='move';
      e.dataTransfer.setData('text/plain', pos);
      setTimeout(()=>wrap.classList.add('p-dragging'),0);
    });
    wrap.addEventListener('dragend', ()=>{
      wrap.classList.remove('p-dragging');
      mg.querySelectorAll('.pos-manage-tag').forEach(el=>el.classList.remove('p-drag-over'));
    });
    wrap.addEventListener('dragover', e=>{
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      mg.querySelectorAll('.pos-manage-tag').forEach(el=>el.classList.remove('p-drag-over'));
      wrap.classList.add('p-drag-over');
    });
    wrap.addEventListener('dragleave', ()=>wrap.classList.remove('p-drag-over'));
    wrap.addEventListener('drop', e=>{
      e.preventDefault();
      wrap.classList.remove('p-drag-over');
      const fromPos = e.dataTransfer.getData('text/plain');
      const toPos = pos;
      if (!fromPos || fromPos === toPos) return;
      const fromIdx = positions.indexOf(fromPos);
      const toIdx = positions.indexOf(toPos);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = positions.splice(fromIdx, 1);
      positions.splice(toIdx, 0, moved);
      save();
      renderPositionButtons();
    });

    mg.appendChild(wrap);
  });
}

// 직책 선택 버튼 토글 — 이미 선택된 직책을 다시 누르면 선택 해제
function togglePos(btn,pos){
  document.querySelectorAll('#posGroup .tag-btn').forEach(b=>b.classList.remove('sel'));
  if(selectedPos===pos){selectedPos='';}
  else{selectedPos=pos;btn.classList.add('sel');}
}

// 직책 관리 패널에서 새 직책을 추가한다.
function addPosition(){
  const inp=document.getElementById('newPosInput');
  const val=inp.value.trim();
  if(!val) return;
  if(positions.includes(val)){toast('⚠ 이미 있는 직책입니다.');return;}
  positions.push(val); save(); inp.value='';
  renderPositionButtons();
  toast(`✓ 직책 "${val}" 추가`);
}

// 직책을 목록에서 삭제한다. 현재 선택 중이던 직책이면 선택 초기화.
function deletePosition(pos){
  const holders = personnel.filter(p => p.position === pos);
  if (holders.length) {
    const names = holders.map(p => p.name).join(', ');
    alert(`"${pos}" 직책은 삭제할 수 없습니다.\n\n현재 해당 직책 인원: ${names}`);
    toast(`⚠ "${pos}" 직책 사용 중 (${holders.length}명)`);
    return;
  }
  if(!confirm(`"${pos}" 직책을 삭제하시겠습니까?`)) return;
  positions=positions.filter(p=>p!==pos);
  if(selectedPos===pos) selectedPos='';
  save(); renderPositionButtons();
}

// 인원 등록 폼에서 새 인원을 추가한다.
function addPersonnel(){
  const nameEl=document.getElementById('pName');
  const noteEl=document.getElementById('pNote');
  const name=nameEl.value.trim();
  if(!name){toast('⚠ 이름을 입력하세요.');nameEl.focus();return;}
  if(personnel.some(p=>p.name===name)){toast('⚠ 이미 등록된 이름입니다.');return;}
  const p={id:Date.now(),name,position:selectedPos,note:noteEl.value.trim()};
  personnel.push(p); save();
  nameEl.value=''; noteEl.value='';
  selectedPos = positions[0] || '';
  renderPositionButtons();
  renderPersonnelList(); refreshAllChips(); renderOverview();
  toast(`✓ ${p.position?p.position+' ':''}${p.name} 등록 완료`);
}

// 특정 인원을 목록에서 삭제하고 소임 배치에서도 제거한다.
function deletePersonnel(id,e){
  const p=personnel.find(p=>p.id===id); if(!p) return;
  if(!confirm(`"${p.name}을(를)" 삭제하시겠습니까?`)) return;
  e&&e.stopPropagation();
  personnel=personnel.filter(p=>p.id!==id);
  save(); renderPersonnelList(); refreshAllChips(); renderOverview();
  toast(`삭제: ${p.name}`);
}

// 등록된 인원 목록 패널을 현재 personnel 배열로 다시 렌더링한다.
function renderPersonnelList(){
  const list=document.getElementById('personnelList');
  list.innerHTML='';
  if(!personnel.length){
    list.innerHTML='<div style="padding:24px;text-align:center;color:var(--text-dim);font-size:13px">등록된 인원이 없습니다.</div>';
  } else {
    personnel.forEach(p=>{
      const div=document.createElement('div'); div.className='personnel-item';
      div.dataset.pid=p.id;
      div.draggable=true;

      // 드래그 핸들 (클릭은 모달로, 드래그는 순서 변경)
      const handle=document.createElement('span'); handle.className='p-drag'; handle.title='드래그하여 순서 변경';
      handle.innerHTML='<svg width="9" height="14" viewBox="0 0 9 14" fill="currentColor"><circle cx="2.5" cy="2" r="1.4"/><circle cx="6.5" cy="2" r="1.4"/><circle cx="2.5" cy="5.5" r="1.4"/><circle cx="6.5" cy="5.5" r="1.4"/><circle cx="2.5" cy="9" r="1.4"/><circle cx="6.5" cy="9" r="1.4"/><circle cx="2.5" cy="12.5" r="1.4"/><circle cx="6.5" cy="12.5" r="1.4"/></svg>';
      handle.addEventListener('mousedown', e=>e.stopPropagation());
      div.appendChild(handle);

      const body=document.createElement('div');
      body.style.cssText='display:flex;align-items:center;gap:10px;flex:1;min-width:0;cursor:pointer';
      body.onclick=()=>openModal(p.id);
      body.innerHTML=`
        <span class="p-pos">${p.position||'직책없음'}</span>
        <span class="p-name">${p.name}</span>
        ${p.note?`<span class="p-note" title="특이사항: ${p.note}">${p.note}</span>`:''}
        <span class="p-info-icon">ⓘ</span>
      `;
      div.appendChild(body);

      const delBtn=document.createElement('button'); delBtn.className='p-del'; delBtn.title='삭제'; delBtn.textContent='×';
      delBtn.onclick=e=>deletePersonnel(p.id,e);
      div.appendChild(delBtn);

      // 드래그 이벤트
      div.addEventListener('dragstart', e=>{
        e.dataTransfer.effectAllowed='move';
        e.dataTransfer.setData('text/plain', p.id);
        setTimeout(()=>div.classList.add('p-dragging'),0);
      });
      div.addEventListener('dragend', ()=>div.classList.remove('p-dragging'));
      div.addEventListener('dragover', e=>{
        e.preventDefault(); e.dataTransfer.dropEffect='move';
        // 드래그 중인 항목 위치에 따라 위/아래 표시
        list.querySelectorAll('.personnel-item').forEach(el=>el.classList.remove('p-drag-over'));
        div.classList.add('p-drag-over');
      });
      div.addEventListener('dragleave', ()=>div.classList.remove('p-drag-over'));
      div.addEventListener('drop', e=>{
        e.preventDefault();
        div.classList.remove('p-drag-over');
        const fromId = parseInt(e.dataTransfer.getData('text/plain'));
        const toId   = p.id;
        if (fromId === toId) return;
        const fromIdx = personnel.findIndex(x=>x.id===fromId);
        const toIdx   = personnel.findIndex(x=>x.id===toId);
        if (fromIdx===-1||toIdx===-1) return;
        const [moved] = personnel.splice(fromIdx, 1);
        personnel.splice(toIdx, 0, moved);
        save();
        renderPersonnelList();
        refreshAllChips();
        toast('✓ 인원 순서 변경');
      });

      list.appendChild(div);
    });
  }
  document.getElementById('pCount').textContent=`총 ${personnel.length}명`;
}

// ══════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════
// ══════════════════════════════════════════
// MODAL  — 인원 상세/편집 모달
// ══════════════════════════════════════════

// 특정 인원의 상세 정보·편집 폼·배치 현황을 모달로 표시한다.
function openModal(id){
  const p=personnel.find(p=>p.id===id); if(!p) return;

  document.getElementById('modalAvatar').textContent=p.name[0]||'?';
  document.getElementById('modalName').textContent=p.name;
  document.getElementById('modalSub').textContent=[p.position,p.note].filter(Boolean).join(' · ')||'직책·특이사항 없음';

  const myRows=dutyRows.filter(r=>r.assigned.includes(p.name));
  const body=document.getElementById('modalBody'); body.innerHTML='';

  // ── 편집 폼 ──
  const sec1=document.createElement('div'); sec1.className='modal-section';

  const titleRow=document.createElement('div'); titleRow.className='modal-section-title';
  titleRow.textContent='기본 정보 편집';
  sec1.appendChild(titleRow);

  // 이름
  const nameRow=document.createElement('div'); nameRow.className='modal-edit-row';
  nameRow.innerHTML=`<span class="modal-edit-label">이름</span>`;
  const nameInp=document.createElement('input'); nameInp.className='modal-edit-input';
  nameInp.value=p.name; nameInp.placeholder='이름';
  nameRow.appendChild(nameInp); sec1.appendChild(nameRow);

  // 직책 (tag buttons)
  const posRow=document.createElement('div'); posRow.className='modal-edit-row'; posRow.style.alignItems='flex-start';
  posRow.innerHTML=`<span class="modal-edit-label" style="margin-top:4px">직책</span>`;
  const posTagsWrap=document.createElement('div'); posTagsWrap.className='modal-pos-tags';
  let editPos=p.position||'';
  positions.forEach(pos=>{
    const btn=document.createElement('button');
    btn.className='tag-btn'+(editPos===pos?' sel':'');
    btn.textContent=pos; btn.type='button';
    btn.onclick=()=>{
      editPos=(editPos===pos)?'':pos;
      posTagsWrap.querySelectorAll('.tag-btn').forEach(b=>b.classList.toggle('sel', b.textContent===editPos));
    };
    posTagsWrap.appendChild(btn);
  });
  posRow.appendChild(posTagsWrap); sec1.appendChild(posRow);

  // 특이사항
  const noteRow=document.createElement('div'); noteRow.className='modal-edit-row';
  noteRow.innerHTML=`<span class="modal-edit-label">특이사항</span>`;
  const noteInp=document.createElement('input'); noteInp.className='modal-edit-input';
  noteInp.value=p.note||''; noteInp.placeholder='메모 (선택 사항)';
  noteRow.appendChild(noteInp); sec1.appendChild(noteRow);

  // 통계 카드
  const divider=document.createElement('div'); divider.className='modal-divider'; sec1.appendChild(divider);
  const statsGrid=document.createElement('div'); statsGrid.className='modal-info-grid';
  statsGrid.innerHTML=`
    <div class="modal-info-card">
      <div class="modal-info-card-label">배치 소임 수</div>
      <div class="modal-info-card-value" style="color:var(--accent)">${myRows.length}건</div>
    </div>
    <div class="modal-info-card">
      <div class="modal-info-card-label">총 배치 시간</div>
      <div class="modal-info-card-value" style="color:var(--blue)">${calcTotalHours(myRows)}</div>
    </div>`;
  sec1.appendChild(statsGrid);

  // 저장 버튼
  const saveBtn=document.createElement('button'); saveBtn.className='modal-save-btn';
  saveBtn.textContent='저장';
  saveBtn.onclick=()=>{
    const newName=nameInp.value.trim();
    if(!newName){ toast('⚠ 이름을 입력하세요.'); return; }
    // name change: update dutyRows assigned arrays too
    const oldName=p.name;
    if(newName!==oldName && personnel.some(x=>x.id!==p.id && x.name===newName)){
      toast('⚠ 이미 등록된 이름입니다.'); return;
    }
    if(newName!==oldName){
      dutyRows.forEach(r=>{
        const idx=r.assigned.indexOf(oldName);
        if(idx!==-1) r.assigned[idx]=newName;
      });
    }
    p.name=newName;
    p.position=editPos;
    p.note=noteInp.value.trim();
    save();
    // update header
    document.getElementById('modalAvatar').textContent=p.name[0]||'?';
    document.getElementById('modalName').textContent=p.name;
    document.getElementById('modalSub').textContent=[p.position,p.note].filter(Boolean).join(' · ')||'직책·특이사항 없음';
    renderPersonnelList();
    refreshAllChips();
    refreshAllChipsConflicts();
    toast(`✓ ${p.name} 정보 저장`);
    document.getElementById('modalOverlay').classList.remove('open');
  };
  sec1.appendChild(saveBtn);
  body.appendChild(sec1);

  // 배치된 소임 목록
  const sec2=document.createElement('div'); sec2.className='modal-section';
  sec2.innerHTML=`<div class="modal-section-title">배치된 소임</div>`;

  if(!myRows.length){
    sec2.innerHTML+=`<div class="modal-empty">배치된 소임이 없습니다.</div>`;
  } else {
    // seed colors same order
    resetColors();
    [...new Set(dutyRows.map(r=>r.duty||'(미입력)'))].forEach(dn=>getColor(dn));

    myRows.forEach(dr=>{
      const c=getColor(dr.duty||'(미입력)');
      const row=document.createElement('div'); row.className='modal-duty-row';
      row.style.cssText=`background:${c.bg};border-color:${c.b};color:${c.t}`;
      row.innerHTML=`
        <span class="modal-duty-time">${dr.start||'?'}–${dr.end||'?'}</span>
        <span class="modal-duty-name">${dr.duty||'(미입력)'}</span>
        <span class="modal-duty-count">${dr.assigned.length}명 배치</span>
      `;
      sec2.appendChild(row);
    });

    // mini timeline
    const tlLabel=document.createElement('div');
    tlLabel.style.cssText='font-size:11px;color:var(--text-muted);margin-top:14px;margin-bottom:5px';
    tlLabel.textContent='타임라인';
    sec2.appendChild(tlLabel);

    const tl=document.createElement('div'); tl.className='modal-mini-tl';
    myRows.forEach(dr=>{
      const s=parseMin(dr.start),e=parseMin(dr.end);
      const c=getColor(dr.duty||'(미입력)');
      segs(s,e).forEach(([st,en])=>{
        const bar=document.createElement('div');
        bar.style.cssText=`position:absolute;top:3px;bottom:3px;left:${(st/1440)*100}%;width:${((en-st)/1440)*100}%;background:${c.bg};border:1px solid ${c.b};border-radius:3px;z-index:1`;
        bar.title=`${dr.duty||'(미입력)'} ${dr.start}–${dr.end}`;
        tl.appendChild(bar);
      });
    });
    const nlEl=document.createElement('div');
    nlEl.style.cssText=`position:absolute;top:0;bottom:0;width:2px;background:var(--red);opacity:.7;left:${(nowMin()/1440)*100}%;z-index:2`;
    tl.appendChild(nlEl);
    sec2.appendChild(tl);
  }
  body.appendChild(sec2);

  document.getElementById('modalOverlay').classList.add('open');
}

// 소임 목록에서 총 소요시간(분)을 합산하여 반환한다.
function calcTotalHours(rows){
  let total=0;
  rows.forEach(r=>{
    const s=parseMin(r.start),e=parseMin(r.end);
    if(s===null||e===null) return;
    total+=(e>s)?e-s:(e<s?1440-s+e:0);
  });
  const h=Math.floor(total/60), m=total%60;
  return h>0?(m>0?`${h}시간 ${m}분`:`${h}시간`):(m>0?`${m}분`:'0분');
}

// 모달 닫기 (오버레이 클릭 또는 직접 호출)
function closeModal(e){
  if(!e||e.target===document.getElementById('modalOverlay'))
    document.getElementById('modalOverlay').classList.remove('open');
}


// ══════════════════════════════════════════
// 특이사항 알림 패널
// ══════════════════════════════════════════
let alertPanelOpen = false;
let prevConflictTotal = 0;  // 이전 충돌 건수 추적

// ══════════════════════════════════════════
// ALERT PANEL  — 특이사항·충돌 알림 패널
// ══════════════════════════════════════════

// FAB(우하단 알림 버튼)에 흔들기 + 펄스 애니메이션 적용 (새 알림 발생 시)
function triggerFabShake() {
  const fab = document.getElementById('alertFab');
  if (!fab) return;
  fab.classList.remove('shake');
  // reflow trick to restart animation
  void fab.offsetWidth;
  fab.classList.add('shake');
  setTimeout(() => fab.classList.remove('shake'), 550);
}

// FAB 알림 뱃지에 팝(pop) 애니메이션 적용
function triggerBadgePop() {
  const badge = document.getElementById('alertBadge');
  if (!badge) return;
  badge.classList.remove('pop');
  void badge.offsetWidth;
  badge.classList.add('pop');
  setTimeout(() => badge.classList.remove('pop'), 350);
}

// 알림 패널 열기/닫기 토글
function toggleAlertPanel() {
  alertPanelOpen = !alertPanelOpen;
  document.getElementById('alertPanel').classList.toggle('collapsed', !alertPanelOpen);
  const fab = document.getElementById('alertFab');
  if (fab) {
    fab.classList.toggle('panel-open', alertPanelOpen);
    fab.title = alertPanelOpen ? '특이사항 패널 닫기' : '특이사항 패널 열기';
    const icon = document.getElementById('alertFabIcon');
    if (icon) icon.textContent = alertPanelOpen ? '✕' : '⚠';
  }
}

// 현재 탭에 따라 특이사항 FAB/패널 표시 여부를 제어한다.
// 인원 등록 탭(page2)에서는 우측 삭제 버튼과 겹치지 않도록 숨긴다.
function setAlertPanelVisibilityByTab(tabIndex) {
  const fab = document.getElementById('alertFab');
  const panel = document.getElementById('alertPanel');
  if (!fab || !panel) return;

  // 인원 탭에서는 FAB과 패널 모두 숨김, 그 외 탭에서는 표시
  // tabIndex === 2 는 인원 등록 탭을 의미 (0: 배치표, 1: 소임 등록, 2: 인원 등록)
  const hideOnPersonnelTab = tabIndex === 2;
  fab.classList.toggle('tab-hidden', hideOnPersonnelTab);
  panel.classList.toggle('tab-hidden', hideOnPersonnelTab);

  // 숨김 해제 시에는 사용자가 마지막으로 선택한 열림/닫힘 상태를 복원한다.
  if (!hideOnPersonnelTab) {
    panel.classList.toggle('collapsed', !alertPanelOpen);
  }
}

// 전체 충돌 계산 후 패널 갱신
// 알림 패널 내용을 특이사항 + 시간 충돌 목록으로 갱신한다.
function refreshAlertPanel() {
  const conflicts = getAllConflicts();
  const body    = document.getElementById('alertBody');
  const badge   = document.getElementById('alertBadge');
  const countEl = document.getElementById('alertCount');
  const footer  = document.getElementById('alertFooter');
  const total   = conflicts.length;

  // badge
  badge.textContent = total > 9 ? '9+' : total;
  badge.classList.toggle('hidden', total === 0);
  // FAB 강조
  const fab = document.getElementById('alertFab');
  if (fab) fab.classList.toggle('has-alerts', total > 0);

  // count chip
  countEl.textContent = total === 0 ? '이상 없음' : total + '건';
  countEl.classList.toggle('zero', total === 0);

  // body
  body.innerHTML = '';
  if (total === 0) {
    body.innerHTML = `
      <div class="alert-empty">
        <div class="alert-empty-icon">✅</div>
        배치 충돌이 없습니다.
      </div>`;
  } else {
    // 충돌 0→1 이상 될 때마다 패널 자동 오픈
    if (!alertPanelOpen && prevConflictTotal === 0) {
      alertPanelOpen = true;
      document.getElementById('alertPanel').classList.remove('collapsed');
      const fab = document.getElementById('alertFab');
      if (fab) {
        fab.classList.add('panel-open');
        fab.title = '충돌감지 패널 닫기';
        const icon = document.getElementById('alertFabIcon');
        if (icon) icon.textContent = '✕';
      }
    }

    // group by person name
    const byPerson = {};
    conflicts.forEach(c => {
      if (!byPerson[c.name]) byPerson[c.name] = [];
      byPerson[c.name].push(c);
    });

    Object.entries(byPerson).forEach(([name, items]) => {
      const item = document.createElement('div');
      item.className = 'alert-item';

      const nameRow = document.createElement('div');
      nameRow.className = 'alert-item-name';
      nameRow.innerHTML = `<span>⚠</span><span>${name}</span>`;
      item.appendChild(nameRow);

      const detail = document.createElement('div');
      detail.className = 'alert-item-detail';

      // group by pair of rows
      const pairs = new Map(); // key: sorted ids
      items.forEach(c => {
        const key = [c.rowA_id, c.rowB_id].sort().join('_');
        if (!pairs.has(key)) pairs.set(key, c);
      });

      pairs.forEach(c => {
        const timeA = c.rowA_start && c.rowA_end ? ` <span class="duty-tag">${c.rowA_start}–${c.rowA_end}</span>` : '';
        const timeB = c.rowB_start && c.rowB_end ? ` <span class="duty-tag">${c.rowB_start}–${c.rowB_end}</span>` : '';
        detail.innerHTML += `<b>${c.dutyA}</b>${timeA} ↔ <b>${c.dutyB}</b>${timeB}<br>`;
      });

      item.appendChild(detail);
      body.appendChild(item);
    });
  }

  const now = new Date();
  footer.textContent = `마지막 업데이트: ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  // 충돌 증가 시 shake + badge pop
  if (total > prevConflictTotal) {
    triggerFabShake();
    triggerBadgePop();
  }
  prevConflictTotal = total;
}

// 모든 충돌 쌍 수집 — 양방향 (상위→하위, 하위→상위 모두)
// 전체 소임 행을 탐색하여 시간 겹침 + 동일 인원 중복 배치된 경우를 모두 수집한다.
function getAllConflicts() {
  const conflicts = [];

  for (let i = 0; i < dutyRows.length; i++) {
    for (let j = i + 1; j < dutyRows.length; j++) {
      const rowA = dutyRows[i];
      const rowB = dutyRows[j];

      const sA = parseMin(rowA.start), eA = parseMin(rowA.end);
      const sB = parseMin(rowB.start), eB = parseMin(rowB.end);
      // Skip rows that are marked to ignore conflicts
      if (rowA.noConflict || rowB.noConflict) continue;
      if (sA === null || eA === null || sB === null || eB === null) continue;
      if (!timeOverlap(sA, eA, sB, eB)) continue;

      // 두 행의 시간이 겹치고 같은 인원이 양쪽 모두 assigned에 있으면 충돌
      rowA.assigned.forEach(name => {
        if (rowB.assigned.includes(name)) {
          conflicts.push({
            name,
            rowA_id: rowA.id,  rowB_id: rowB.id,
            dutyA: rowA.duty || '(소임 미입력)',
            dutyB: rowB.duty || '(소임 미입력)',
            rowA_start: rowA.start, rowA_end: rowA.end,
            rowB_start: rowB.start, rowB_end: rowB.end,
          });
        }
      });
    }
  }

  return conflicts;
}


// ── PERSONNEL VISIBILITY ──
// personnel view modes: 'all' | 'hidden' | 'selected'
// Always default to 'all' on load and do not reuse any previous value.
let personnelViewMode = 'all';
localStorage.setItem('personnelViewMode', personnelViewMode);

function applyPersonnelViewMode() {
  const table = document.getElementById('dutyTable');
  table.classList.toggle('hide-personnel', personnelViewMode === 'hidden');
  table.classList.toggle('show-selected-only', personnelViewMode === 'selected');
  updatePersonnelBtn();
  // re-render chips so JS-driven '선택 인원만' filtering takes effect immediately
  try { refreshAllChips(); } catch (e) { /* safe fallback if functions not ready */ }
}

function updatePersonnelBtn() {
  const btn = document.getElementById('togglePersonnelBtn');
  const svgPathOpenedEye = '<circle cx="7" cy="6" r="3"/><path d="M1 6s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z"/>';
  const svgPathClosedEye = '<path d="M1 1l12 12M5.5 5.5A3 3 0 0 0 9 9M2.5 3.5C1.5 4.5 1 6 1 6s2 4 6 4c.9 0 1.7-.2 2.4-.5M6 2.1C6.3 2 6.7 2 7 2c4 0 6 4 6 4s-.5 1.3-1.5 2.4"/>';
  if (!btn) return;
  btn.classList.remove('active');
  // show exact mode name as label
  if (personnelViewMode === 'all') {
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">${svgPathOpenedEye}</svg> 인원 보이기`;
  } else if (personnelViewMode === 'hidden') {
    btn.classList.add('active');
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">${svgPathClosedEye}</svg> 인원 감추기`;
  } else if (personnelViewMode === 'selected') {
    btn.classList.add('active');
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">${svgPathOpenedEye}</svg> 선택 인원만`;
  }
}

// cycle modes: all -> selected -> hidden -> all
function togglePersonnelView() {
  if (personnelViewMode === 'all') personnelViewMode = 'selected';
  else if (personnelViewMode === 'selected') personnelViewMode = 'hidden';
  else personnelViewMode = 'all';
  localStorage.setItem('personnelViewMode', personnelViewMode);
  applyPersonnelViewMode();
}

// initialize on load (call immediately if DOM already ready)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyPersonnelViewMode);
} else {
  applyPersonnelViewMode();
}

// initialize showAssignedFilter button state on load as well
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => applyShowAssignedFilter(true));
} else {
  applyShowAssignedFilter(true);
}


// ══════════════════════════════════════════
// 날짜 복사 모달
// ══════════════════════════════════════════
let copyTargetDate = null;

// 달력 상태
let calYear = 0, calMonth = 0;

// ══════════════════════════════════════════
// DATE COPY MODAL  — 선택 소임 날짜 복사
// ══════════════════════════════════════════

// 선택된 소임 행들을 다른 날짜로 복사하는 모달을 열기
function openCopyModal() {
  if (selectedIds.size === 0) { toast('⚠ 복사할 행을 먼저 선택하세요.'); return; }
  copyTargetDate = null;
  document.getElementById('copyModalInfo').textContent =
    `${selectedIds.size}개 소임을 선택한 날짜로 복사합니다. (인원 이름 유지)`;
  document.getElementById('copyConfirmBtn').disabled = true;
  document.getElementById('copyConfirmBtn').textContent = '복사하기';

  // 달력을 현재 날짜 기준으로 초기화
  const base = parseDate(currentDate);
  calYear  = base.getFullYear();
  calMonth = base.getMonth();
  renderCopyCalendar();

  document.getElementById('copyModalOverlay').classList.add('open');
}

// 날짜 복사 달력의 월 이동 (delta: -1=이전달, +1=다음달)
function calNav(delta) {
  calMonth += delta;
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0;  calYear++; }
  renderCopyCalendar();
}

// 날짜 복사 달력을 calYear/calMonth 기준으로 렌더링
function renderCopyCalendar() {
  const KO_DOW = ['일','월','화','수','목','금','토'];
  const today  = todayStr();
  const label  = document.getElementById('calMonthLabel');
  const grid   = document.getElementById('calGrid');
  label.textContent = `${calYear}년 ${calMonth + 1}월`;
  grid.innerHTML = '';

  // 요일 헤더
  KO_DOW.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'cal-dow' + (i===0?' sun':i===6?' sat':'');
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=일
  const lastDate = new Date(calYear, calMonth + 1, 0).getDate();

  // 앞 빈칸
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty other-month';
    // 이전 달 날짜 표시
    const prevLast = new Date(calYear, calMonth, 0).getDate();
    el.textContent = prevLast - firstDay + 1 + i;
    grid.appendChild(el);
  }

  // 날짜
  for (let d = 1; d <= lastDate; d++) {
    const dateStr = calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const dow = new Date(calYear, calMonth, d).getDay();
    const isToday    = dateStr === today;
    const isCurrent  = dateStr === currentDate;
    const isSelected = dateStr === copyTargetDate;

    const el = document.createElement('div');
    let cls = 'cal-day';
    if (dow === 0) cls += ' sun';
    if (dow === 6) cls += ' sat';
    if (isToday)    cls += ' today';
    if (isSelected) cls += ' selected';
    if (isCurrent)  cls += ' disabled';
    el.className = cls;
    el.textContent = d;

    if (!isCurrent) {
      el.onclick = () => selectCalDay(dateStr);
    }
    grid.appendChild(el);
  }

  // 뒤 빈칸
  const filled = firstDay + lastDate;
  const remainder = filled % 7 === 0 ? 0 : 7 - (filled % 7);
  for (let i = 1; i <= remainder; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty other-month';
    el.textContent = i;
    grid.appendChild(el);
  }
}

// 달력에서 날짜를 선택하면 복사 확인 버튼을 활성화한다.
function selectCalDay(dateStr) {
  copyTargetDate = dateStr;
  renderCopyCalendar(); // 선택 표시 갱신
  const d = parseDate(dateStr);
  const KO_DAYS = ['일','월','화','수','목','금','토'];
  const btn = document.getElementById('copyConfirmBtn');
  btn.disabled = false;
  btn.textContent = `${d.getMonth()+1}월 ${d.getDate()}일 (${KO_DAYS[d.getDay()]})로 복사하기`;
}

function onCustomCopyDateInput(val) {
  // 하위 호환성 유지 (현재 미사용)
}

// 선택된 소임들을 copyTargetDate로 실제 복사 실행
function executeCopy() {
  if (!copyTargetDate) return;
  if (copyTargetDate === currentDate) { toast('⚠ 현재 날짜와 동일합니다.'); return; }

  // get selected rows
  const rowsToCopy = dutyRows.filter(r => selectedIds.has(r.id));
  if (!rowsToCopy.length) { toast('⚠ 복사할 행이 없습니다.'); return; }

  // load target date rows
  const targetRows = JSON.parse(localStorage.getItem('dutyRows_'+copyTargetDate) || '[]');

  // append copies (new ids, keep assigned)
  const now = Date.now();
  rowsToCopy.forEach((r, i) => {
    targetRows.push({
      id: now + i,
      start: r.start,
      end: r.end,
      duty: r.duty,
      assigned: [...r.assigned],
    });
  });

  localStorage.setItem('dutyRows_'+copyTargetDate, JSON.stringify(targetRows));

  const d = parseDate(copyTargetDate);
  const label = `${d.getMonth()+1}/${d.getDate()}`;
  toast(`✓ ${rowsToCopy.length}개 소임 → ${label} 복사 완료`);
  closeCopyModal();
}

// 바로 오늘 날짜로 선택된 소임들을 복사합니다.
function copyToToday() {
  const today = todayStr();
  if (today === currentDate) { toast('⚠ 현재 날짜와 동일합니다.'); return; }
  if (selectedIds.size === 0) { toast('⚠ 복사할 행을 먼저 선택하세요.'); return; }
  copyTargetDate = today;
  // call executeCopy which performs validation and the copy
  executeCopy();
}

// 날짜 복사 모달 닫기
function closeCopyModal(e) {
  if (!e || e.target === document.getElementById('copyModalOverlay')) {
    document.getElementById('copyModalOverlay').classList.remove('open');
  }
}


// ── GRID LINE HELPER ──
// 표시 범위 시간 수(span)에 맞는 CSS repeating-gradient 문자열 반환
// ══════════════════════════════════════════
// GRID LINES  — 시간 격자선
// ══════════════════════════════════════════

// span 시간 구간에 맞는 CSS repeating-gradient 문자열을 생성한다.
// overview·gantt의 시간 격자선에 사용된다.
function makeGridLines(span) {
  if (span <= 0) return 'none';
  const pct = (100 / span).toFixed(6);
  return `repeating-linear-gradient(to right,var(--border2) 0,var(--border2) 1px,transparent 1px,transparent ${pct}%)`;
}

// overview track과 gantt timeline들에 그리드 주입
// overview 트랙과 gantt 타임라인에 시간 격자선 CSS 변수를 주입한다.
function applyGridLines() {
  const ovSpan = viewEndH - viewStartH;
  const gridVal = makeGridLines(ovSpan);

  // overview track
  const ovTrack = document.getElementById('ovTrack');
  if (ovTrack) ovTrack.style.setProperty('--grid-lines', gridVal);

  // gantt timelines
  document.querySelectorAll('.gantt-timeline').forEach(el => {
    el.style.setProperty('--grid-lines', gridVal);
  });
}




// ── LIVE CLOCK ──
// ══════════════════════════════════════════
// LIVE CLOCK & NOW LINE  — 실시간 시계·현재 시각선
// ══════════════════════════════════════════

// 상단 날짜바의 현재 시각 표시를 매초 갱신한다.
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  document.getElementById('clockH').textContent = h;
  document.getElementById('clockM').textContent = m;
}

// ── LIVE NOW-LINE (1분마다 overview 빨간선 위치 업데이트) ──
// overview·gantt의 현재 시각선(빨간 수직선) 위치를 갱신한다.
// 오늘 날짜를 보고 있을 때만 동작하며, 뷰 범위 밖이면 선을 제거한다.
function updateNowLine() {
  if (currentDate !== todayStr()) return;
  const nm = nowMin();
  const track = document.getElementById('ovTrack');
  if (!track) return;
  let nl = track.querySelector('.ov-now');
  const inView = nm >= viewMin(ovStartH) && nm <= viewMax(ovEndH);
  if (!inView) { if (nl) nl.remove(); return; }
  if (!nl) { nl = document.createElement('div'); nl.className = 'ov-now'; track.appendChild(nl); }
  nl.style.left = minToViewPct(nm, ovStartH, ovEndH) + '%';

  // gantt now-line도 함께 업데이트
  document.querySelectorAll('.gantt-timeline .now-line').forEach(el => {
    el.style.left = minToViewPct(nm, ganttStartH, ganttEndH) + '%';
  });
}

// 매분 정각에 맞춰 실행 후 60초마다 반복
// 현재 시각선 업데이트 스케줄러
// 즉시 한 번 실행 후, 다음 정각(0초)에 맞춰 시작하여 이후 60초마다 반복한다.
// 이렇게 하면 시각선이 항상 분(分) 단위 변경 시점과 정확히 일치한다.
function scheduleNowLine() {
  updateNowLine();
  const msToNextMin = (60 - new Date().getSeconds()) * 1000;
  setTimeout(() => {
    updateNowLine();
    setInterval(updateNowLine, 60000);
  }, msToNextMin);
}

updateClock();
setInterval(updateClock, 1000);
scheduleNowLine();


// assigned 배열을 personnel 등록 순서 기준으로 정렬하여 반환한다.
// 목록에 없는 이름은 뒤로 밀고, 없는 것끼리는 가나다 순으로 정렬한다.
function sortAssigned(arr) {
  const order = personnel.map(p => p.name);
  return [...arr].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, 'ko');
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// ══════════════════════════════════════════
// INIT  — 앱 초기화
// ══════════════════════════════════════════
// 페이지 로드 시 한 번 실행되는 초기화 IIFE (즉시 실행 함수)
// 상태 복원 → UI 렌더링 → sticky 오프셋 계산 순으로 진행한다.
(function init(){
  renderPositionButtons();
  renderPersonnelList();
  renderDateBar();
  syncViewSelects();
  dutyRows.forEach(row=>renderDutyRow(row));
  updateDutyEmpty();
  renderOverview();
  applyGridLines();
  updateUndoBtn();
  refreshAlertPanel();
  setAlertPanelVisibilityByTab(0);
  applyOverviewPin();
  // ── Sticky 오프셋 동적 계산 ──
  // overview 고정 여부·toolbar 높이·bulk toolbar 표시 여부에 따라
  // CSS 변수 --toolbar-top, --thead-top, table-wrap 하단 패딩을 동적으로 계산한다.
  // ResizeObserver/MutationObserver로 크기·클래스 변화를 감지해 자동 갱신한다.
  (function setStickyOffsets() {
    const toolbar   = document.querySelector('#page0 .toolbar');
    const bulk      = document.getElementById('bulkToolbar');
    const tableWrap = document.querySelector('#page0 .table-wrap');
    const panel     = document.getElementById('overviewPanel');
    if (!toolbar) return;

    const update = () => {
      const ovH      = (overviewPinned && panel) ? panel.offsetHeight : 0;
      const toolbarH = toolbar.offsetHeight;
      document.documentElement.style.setProperty('--toolbar-top', ovH + 'px');
      document.documentElement.style.setProperty('--thead-top', (ovH + toolbarH) + 'px');
      // bulk toolbar 표시 중이면 table-wrap 하단에 여백 추가
      if (tableWrap && bulk) {
        tableWrap.style.paddingBottom = bulk.classList.contains('visible')
          ? bulk.offsetHeight + 16 + 'px'
          : '32px';
      }
    };

    update();
    new ResizeObserver(update).observe(toolbar);
    if (panel) new ResizeObserver(update).observe(panel);
    if (bulk) {
      new ResizeObserver(update).observe(bulk);
      new MutationObserver(update).observe(bulk, { attributes: true, attributeFilter: ['class'] });
    }
    // overview pin 상태 변화 감지
    if (panel) new MutationObserver(update).observe(panel, { attributes: true, attributeFilter: ['class'] });
  })();
})();