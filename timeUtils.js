// ══════════════════════════════════════════
// TIME UTILS — 시간 관련 순수 유틸리티
// ══════════════════════════════════════════
// 이 모듈은 시간 및 날짜 관련 순수 함수들을 제공합니다.
// 모든 함수는 외부 상태에 의존하지 않으며, 재사용 가능합니다.

/**
 * 시작 시간을 분 단위로 변환합니다.
 * @param {number} startH - 시작 시간 (0-24 시)
 * @returns {number} 시작 시간의 분 단위 값
 * @example viewMin(9) // 540 (9시 = 540분)
 */
function viewMin(startH) { return startH * 60; }

/**
 * 종료 시간을 분 단위로 변환합니다.
 * @param {number} endH - 종료 시간 (0-24 시)
 * @returns {number} 종료 시간의 분 단위 값
 * @example viewMax(18) // 1080 (18시 = 1080분)
 */
function viewMax(endH)   { return endH   * 60; }

/**
 * 주어진 분 값을 뷰 범위 내 백분율로 변환합니다.
 * 범위를 벗어나면 0-100 사이로 클램핑합니다.
 * @param {number} m - 변환할 분 값
 * @param {number} startH - 뷰 시작 시간 (0-24 시)
 * @param {number} endH - 뷰 종료 시간 (0-24 시)
 * @returns {number} 뷰 내 백분율 (0-100)
 * @example minToViewPct(720, 0, 24) // 50 (12시는 24시간 중 50%)
 */
function minToViewPct(m, startH, endH) {
  const vMin = viewMin(startH), vMax = viewMax(endH), span = vMax - vMin;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(100, (m - vMin) / span * 100));
}

/**
 * 오늘 날짜를 'YYYY-MM-DD' 형식의 문자열로 반환합니다.
 * @returns {string} 오늘 날짜 문자열
 * @example todayStr() // "2026-04-10"
 */
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * 분 값을 'HH:MM' 형식의 시간 문자열로 변환합니다.
 * 하루를 넘는 값은 자동으로 wrap 처리합니다.
 * @param {number} m - 변환할 분 값
 * @returns {string} 'HH:MM' 형식의 시간 문자열
 * @example minToStr(750) // "12:30"
 */
function minToStr(m) {
  const wrapped = ((m % 1440) + 1440) % 1440;
  return String(Math.floor(wrapped / 60)).padStart(2, '0') + ':' + String(wrapped % 60).padStart(2, '0');
}

/**
 * 'HH:MM' 형식의 시간 문자열을 분 값으로 변환합니다.
 * 유효하지 않은 입력은 null을 반환합니다.
 * @param {string} t - 'HH:MM' 형식의 시간 문자열
 * @returns {number|null} 분 값 또는 null
 * @example parseMin("12:30") // 750
 */
function parseMin(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * 시작과 종료 시간 사이의 시간 세그먼트를 반환합니다.
 * 자정을 넘는 경우 두 개의 세그먼트로 분할합니다.
 * @param {number|null} s - 시작 분 값
 * @param {number|null} e - 종료 분 값
 * @returns {Array<Array<number>>} 시간 세그먼트 배열 [[start, end], ...]
 * @example segs(1320, 60) // [[1320, 1440], [0, 60]] (22:00-24:00, 00:00-01:00)
 */
function segs(s, e) {
  if (s === null || e === null) return [];
  if (e > s) return [[s, e]];
  if (e < s) return [[s, 1440], [0, e]];
  return [];
}

/**
 * 현재 시간을 분 값으로 반환합니다.
 * @returns {number} 현재 시간의 분 값
 * @example nowMin() // 780 (현재 13:00이라면)
 */
function nowMin() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

/**
 * 'YYYY-MM-DD' 형식의 날짜 문자열을 Date 객체로 변환합니다.
 * 로컬 타임존을 기준으로 하며, timezone 오차가 없습니다.
 * @param {string} str - 'YYYY-MM-DD' 형식의 날짜 문자열
 * @returns {Date} 변환된 Date 객체
 * @example parseDate("2026-04-10") // Date 객체
 */
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * 'YYYY-MM-DD' 형식의 날짜 문자열을 한국어 표시 형식으로 변환합니다.
 * @param {string} str - 'YYYY-MM-DD' 형식의 날짜 문자열
 * @returns {string} 'YYYY년 MM월 DD일' 형식의 문자열
 * @example formatDateDisplay("2026-04-10") // "2026년 4월 10일"
 */
function formatDateDisplay(str) {
  const d = parseDate(str);
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
}

/**
 * 입력 필드의 값을 자동으로 'HH:MM' 형식으로 포맷팅합니다.
 * 콜론을 추가하고 커서 위치를 유지합니다.
 * @param {HTMLInputElement} input - 포맷팅할 입력 요소
 * @example formatTime(document.getElementById('timeInput'))
 */
function formatTime(input) {
  const pos = input.selectionStart;
  const prev = input.value;
  let v = prev.replace(/\D/g, '');
  if (v.length >= 3) v = v.slice(0, 2) + ':' + v.slice(2, 4);
  if (v === prev) return;
  input.value = v;
  const colonAdded = v.includes(':') && !prev.includes(':');
  const newPos = colonAdded ? pos + 1 : pos;
  input.setSelectionRange(newPos, newPos);
}
