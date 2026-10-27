// AI가 연결되지 않았을 때 쓰는 '예시 문장' 만들기 (규칙 기반)
// 메모가 없어도 고른 항목만으로 충분한 길이의 문장이 되도록 구성합니다.
import { GWA_CHIPS, HANG_CHIPS, JAYUL_CHIPS, CLOSINGS, LENGTHS, LEVEL_SUMMARY } from './data.js';
import { tierOf, standardSentence } from './achievement.js';
import { toEumseumLoose, splitSentences, josaRo, josaEul } from './rules.js';

const GWA_MAP = new Map(GWA_CHIPS.map((c) => [c.label, c]));
const HANG_MAP = new Map(HANG_CHIPS.map((c) => [c.label, c]));
const JAYUL_MAP = new Map(JAYUL_CHIPS.map((c) => [c.label, c]));

const plainName = (label) => label.replace(/\s*\(.*?\)\s*/g, '').trim();
const endsLikeSentence = (s) => /[함음임됨]$/.test(s.trim());

function memoToSentences(memo) {
  return String(memo || '')
    .split(/[.\n]+|(?<=[함음임됨])\s+/)
    .map((s) => s.replace(/^[-·•\s]+/, '').trim())
    .filter((s) => s.length > 1)
    .map(toEumseumLoose)
    .filter(Boolean);
}

/** 메모를 그대로 붙이지 않고 '특히 ~하는 모습을 보임'처럼 다듬어 넣기 */
function polishMemo(list) {
  return list.map((s, i) => {
    let t = s;
    if (i === 0 && /함$/.test(t)) t = t.replace(/함$/, '하는 모습을 보임');
    return (i === 0 ? '특히 ' : '아울러 ') + t;
  });
}

/** 자율·자치: 활동 하나 + 고른 역할 → 문장 */
const DO = ['성실히 수행함', '책임감 있게 해냄', '꾸준히 활동함'];
export function jayulSentence(label, role, customRole, idx = 0) {
  const c = JAYUL_MAP.get(label);
  const r = role === '__custom' ? String(customRole || '').trim() : String(role || '').trim();
  if (!c) {
    const name = label.trim();
    if (r) return `${name} 활동에서 ${r}${josaEul(r)} 맡아 ${DO[idx % DO.length]}`;
    return endsLikeSentence(name) ? name : `${name} 활동에 참여함`;
  }
  if (!r) return c.base;
  if (c.duty) return `1인 1역으로 ${r} 역할을 맡아 한 해 동안 꾸준하고 성실하게 수행함`;
  if (c.roles && c.roles[r]) return c.roles[r];
  return `${plainName(label)}에서 ${r}${josaEul(r)} 맡아 ${DO[idx % DO.length]}`;
}

function finish(list) {
  return list.map((s) => s.replace(/[.\s]+$/, '') + '.').join(' ');
}

const CONNECT = ['', '또한 ', '', '이와 함께 ', '', ''];

/**
 * input: { area, subject, activity, types[], chips[], custom[], memo, roleTitle,
 *          roles{label:role}, roleCustom{label:text}, closing, length,
 *          level('A'~'E'), standard{code,text,levels} }  ← level·standard는 과세특만
 */
export function generateExample(input) {
  const area = input.area || 'gwa';
  const len = LENGTHS.find((l) => l.key === input.length) || LENGTHS[1];
  const pick = (c) => (len.detail ? c.long : c.short);

  let items = [];
  const tier = area === 'gwa' ? tierOf(input.level, input.subject) : null;
  if (area === 'gwa') {
    // 성취수준에 따라 표현의 깊이를 바꿈 (점수·수준은 문장에 쓰지 않음)
    const pickGwa = (c) => {
      if (tier === 'basic' || tier === 'start') return c.basic;
      if (tier === 'low') return c.short;
      return pick(c);
    };
    items = (input.chips || []).map((l) => GWA_MAP.get(l)).filter(Boolean).slice(0, len.maxItems).map(pickGwa);
    if (input.standard && input.standard.text) items.unshift(standardSentence(input.standard, input.level, input.subject));
  } else if (area === 'hang') {
    items = (input.chips || []).map((l) => HANG_MAP.get(l)).filter(Boolean).slice(0, len.maxItems).map(pick);
  } else {
    const roles = input.roles || {};
    const rc = input.roleCustom || {};
    items = [...(input.chips || []), ...(input.custom || [])]
      .slice(0, len.key === 'short' ? 3 : 12)
      .map((l, i) => jayulSentence(l, roles[l], rc[l], i));
  }
  if (area !== 'jayul') items.push(...(input.custom || []).map(toEumseumLoose).filter(Boolean));
  items = items.map((s, i) => (CONNECT[i] || '') + s);

  const memo = polishMemo(memoToSentences(input.memo).slice(0, len.maxMemo));
  let list = [...items, ...memo];
  if (!list.length) return '';

  // 첫 문장 머리말
  if (area === 'gwa') {
    const act = String(input.activity || '').trim();
    const types = (input.types || []).join('·');
    const subject = String(input.subject || '').trim();
    const first = list[0].replace(/^(특히|아울러)\s/, '');
    // 첫 문장이 '모둠 활동에서'처럼 장소로 시작하면 '~에서'가 겹치지 않게
    const place = /^(\S+\s)?\S+에서\s/.test(first);
    let head;
    if (act && types) head = place ? `'${act}' 수업의 ${types} 활동 중 ` : `'${act}' 수업의 ${types} 활동에서 `;
    else if (act) head = place ? `'${act}' 수업 중 ` : `'${act}' 수업에서 `;
    else if (types) head = place ? `${subject} 수업의 ${types} 활동 중 ` : `${subject} 수업의 ${types} 활동에서 `;
    else head = place ? `${subject} 수업 중 ` : `${subject} 수업 시간에 `;
    list[0] = head + first;
  } else if (area === 'jayul') {
    const title = String(input.roleTitle || '').trim();
    if (title) list[0] = `${title}${josaRo(title)}서 ` + list[0];
  }

  // 성취기준 없이 수준만 고른 경우: 수준에 맞는 한 문장
  if (tier && !(input.standard && input.standard.text)) list.push(LEVEL_SUMMARY[tier]);

  // 마무리 한 줄
  const closing = (CLOSINGS[area] || []).find((c) => c.label === input.closing);
  if (closing) list.push(closing.sentence.replace('{subject}', String(input.subject || '이 과목').trim()));

  return finish(list);
}

const SWAPS = [
  ['꼼꼼히', '세심하게'], ['적극적으로', '능동적으로'], ['성실히', '성실하게'],
  ['차분히', '침착하게'], ['즐겁게', '기쁜 마음으로'], ['책임감 있게', '책임감을 가지고'],
  ['설명함', '설명해 줌'], ['정리함', '정리해 냄'], ['배려심이 깊음', '배려하는 마음이 큼'],
  ['도와주는', '돕는'], ['함께 고민함', '함께 생각함'], ['알아보기 쉽게', '한눈에 보이도록'],
  ['돋보임', '눈에 띔'], ['기대됨', '기대가 됨'], ['이끎', '이끌어 냄'],
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
