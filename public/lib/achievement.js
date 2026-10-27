// 성취수준 · 수행평가 점수 · 성취기준 문장 만들기
// 주의: 점수와 성취수준(A~E)은 문장에 적지 않고, 수준에 맞는 '표현의 깊이'에만 반영합니다.
import { THREE_LEVEL_SUBJECTS, LEVEL_CUTS } from './data.js';

export const levelCount = (subject) => (THREE_LEVEL_SUBJECTS.includes(String(subject || '').trim()) ? 3 : 5);
export const levelsFor = (subject) => LEVEL_CUTS[levelCount(subject)].map(([l]) => l);

/** 점수 → 성취수준 (기본 분할점수) */
export function scoreToLevel(score, max, subject) {
  const sc = Number(score);
  const mx = Number(max) || 100;
  if (score === '' || score === null || score === undefined || !Number.isFinite(sc) || sc < 0 || sc > mx) return null;
  const pct = (sc / mx) * 100;
  for (const [l, cut] of LEVEL_CUTS[levelCount(subject)]) if (pct >= cut) return l;
  return null;
}

/** 성취수준 → 표현 단계 */
export function tierOf(level, subject) {
  if (!level) return null;
  if (levelCount(subject) === 3) return { A: 'high', B: 'mid', C: 'basic' }[level] || null;
  return { A: 'high', B: 'mid', C: 'low', D: 'basic', E: 'start' }[level] || null;
}

const TAIL = {
  high: '관련 개념을 깊이 있게 이해하고 새로운 상황에도 적용함',
  mid: '배운 개념을 바르게 이해하고 활용함',
  low: '기본 개념을 이해하고 활동에 성실하게 적용함',
  basic: '꾸준히 노력하며 기본 개념을 하나씩 익혀 감',
  start: '꾸준히 참여하며 기본 개념을 익혀 가고 있음',
  none: '관련 활동에 성실히 참여함',
};

export const stripCode = (t) => String(t || '').replace(/^\s*\[[^\]]*\]\s*/, '').replace(/^\(예시\)\s*/, '').trim();

/** 성취기준(또는 수준별 기술) 한 문장 → 생기부 문장 */
export function standardSentence(std, level, subject) {
  if (!std) return '';
  const tier = tierOf(level, subject) || 'none';
  const desc = level && std.levels ? String(std.levels[level] || '').trim() : '';
  if (desc) {
    // 학교에서 적어 둔 수준별 기술이 있으면 그 문장을 음슴체로 바꿔 씀
    const d = stripCode(desc).replace(/[.。]+$/, '');
    if (/수 있다$/.test(d)) return d.replace(/수 있다$/, '수 있음');
    if (/한다$/.test(d)) return d.replace(/한다$/, '함');
    if (/다$/.test(d)) return d.replace(/다$/, '음');
    return d;
  }
  const t = stripCode(std.text).replace(/[.。]+$/, '');
  if (/수 있다$/.test(t)) {
    const base = t.replace(/다$/, '');
    if (tier === 'basic' || tier === 'start') return `${base}도록 ${TAIL[tier]}`;
    return `${base}으며, ${TAIL[tier]}`;
  }
  if (/한다$/.test(t)) {
    const core = t.replace(/한다$/, '');
    return `${core}하는 과정에서 ${TAIL[tier]}`;
  }
  return `이 단원 학습에서 ${TAIL[tier]}`;
}
