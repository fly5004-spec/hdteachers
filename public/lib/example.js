// AI가 연결되지 않았을 때 쓰는 '예시 문장' 만들기 (규칙 기반)
import { GWA_CHIPS, HANG_CHIPS, JAYUL_CHIPS, LENGTHS } from './data.js';
import { toEumseumLoose, splitSentences, josaRo } from './rules.js';

const CHIP_MAP = new Map([...GWA_CHIPS, ...HANG_CHIPS, ...JAYUL_CHIPS].map((c) => [c.label, c.sentence]));

function memoToSentences(memo) {
  return String(memo || '')
    .split(/[.\n]+|(?<=[함음임됨])\s+/)
    .map((s) => s.replace(/^[-·•\s]+/, '').trim())
    .filter((s) => s.length > 1)
    .map(toEumseumLoose)
    .filter(Boolean);
}

function finish(list) {
  return list.map((s) => s.replace(/[.\s]+$/, '') + '.').join(' ');
}

/**
 * input: { area, chips: string[], custom: string[], memo, activity, subject, role, length }
 */
export function generateExample(input) {
  const area = input.area || 'gwa';
  const len = LENGTHS.find((l) => l.key === input.length) || LENGTHS[1];
  const chipSentences = [
    ...(input.chips || []).map((c) => CHIP_MAP.get(c) || toEumseumLoose(c)),
    ...(input.custom || []).map((c) => (area === 'jayul' && !/[함음임됨]$/.test(c.trim())
      ? `${c.trim()} 활동에 참여함` : toEumseumLoose(c))),
  ].filter(Boolean);
  const memo = memoToSentences(input.memo);

  // 칩 문장과 메모 문장을 번갈아 섞기
  const pool = [];
  const max = Math.max(chipSentences.length, memo.length);
  for (let i = 0; i < max; i++) {
    if (chipSentences[i]) pool.push(chipSentences[i]);
    if (memo[i]) pool.push(memo[i]);
  }
  if (!pool.length) return '';
  const picked = pool.slice(0, len.maxSentences);

  if (area === 'gwa') {
    const act = String(input.activity || '').trim();
    const opening = act ? `'${act}' 활동에서 ` : `${input.subject || ''} 수업 시간에 `.trimStart();
    picked[0] = opening + picked[0];
  } else if (area === 'jayul') {
    const role = String(input.role || '').trim();
    if (role) picked[0] = `${role}${josaRo(role)}서 ` + picked[0];
  }
  return finish(picked);
}

const SWAPS = [
  ['꼼꼼히', '세심하게'], ['적극적으로', '능동적으로'], ['성실히', '성실하게'],
  ['차분히', '침착하게'], ['즐겁게', '기쁜 마음으로'], ['책임감 있게', '책임감을 가지고'],
  ['설명함', '설명해 줌'], ['정리함', '정리해 냄'], ['배려심이 깊음', '배려하는 마음이 큼'],
  ['도와주는', '돕는'], ['함께 고민함', '함께 생각함'], ['알아보기 쉽게', '한눈에 보이도록'],
];

/** 표현 일부를 비슷한 말로 바꾸기 */
export function rephraseExample(text) {
  let out = text;
  let changed = 0;
  for (const [a, b] of SWAPS) {
    if (out.includes(a)) { out = out.split(a).join(b); changed++; }
    else if (out.includes(b)) { out = out.split(b).join(a); changed++; }
    if (changed >= 3) break;
  }
  return out;
}

/** 더 짧게: 문장이 여럿이면 마지막 문장을 빼고, 하나면 꾸밈말을 줄임 */
export function shortenExample(text) {
  const s = splitSentences(text);
  if (s.length > 1) {
    return s.slice(0, -1).map((x) => x.text).join(' ');
  }
  return text.replace(/\s?(꼼꼼히|적극적으로|성실히|차분히|즐겁게|평소|먼저|스스로)\s/g, ' ').replace(/\s{2,}/g, ' ').trim();
}
