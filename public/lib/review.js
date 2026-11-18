// '생기부 점검' 탭: 입력 정리와 전체 점검 (브라우저·Node 공용)
import { checkText } from './rules.js?v=9';
import { spellCheck } from './spell.js?v=9';
import { findDuplicates } from './dup.js?v=9';
import { buildXlsx } from './xlsx.js?v=9';

const num = (v) => {
  const n = Number(String(v ?? '').replace(/[^\d.]/g, ''));
  return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : null;
};

function makeItem(i, f) {
  const label = f.num ? `${f.grade ? `${f.grade}-` : ''}${f.cls ? `${f.cls}-` : ''}${f.num}번${f.name ? ` ${f.name}` : ''}` : `${i + 1}번째${f.name ? ` ${f.name}` : ''}`;
  return { id: `r${i}`, label, grade: f.grade || '', cls: f.cls || '', num: f.num || '', name: f.name || '', subject: f.subject || '', text: f.text, original: f.text };
}

/** 표(엑셀·CSV) → 점검할 학생 목록. 가장 긴 글이 든 칸을 생기부 내용으로 봄 */
export function rowsToItems(rows) {
  const clean = rows.map((r) => r.map((c) => String(c ?? '').trim())).filter((r) => r.some(Boolean));
  if (!clean.length) throw new Error('내용이 비어 있어요.');
  const width = Math.max(...clean.map((r) => r.length));
  const avg = (i, list) => list.reduce((a, r) => a + (r[i] || '').length, 0) / Math.max(list.length, 1);
  let hi = clean.findIndex((r) => r.some((c) => /^(번호|학번|이름|성명)$/.test(c.replace(/\s+/g, ''))));
  if (hi < 0) {
    // 제목 줄이 없으면 줄마다: 가장 긴 칸 = 내용, 숫자 칸 = 번호, 짧은 한글 칸 = 이름
    const items = [];
    for (const r of clean) {
      let ti = 0;
      r.forEach((c, i) => { if (c.length > (r[ti] || '').length) ti = i; });
      const text = r[ti];
      if (!text || text.length < 5) continue;
      let n = '';
      let name = '';
      r.forEach((c, i) => {
        if (i === ti) return;
        const m = c.match(/^(\d{1,5})\s*번?\s*([가-힣]{2,4})?$/);
        if (m && !n) { n = m[1].length === 5 ? String(+m[1].slice(3)) : String(+m[1]); if (m[2]) name = m[2]; }
        else if (/^[가-힣]{2,4}$/.test(c) && !name) name = c;
      });
      items.push(makeItem(items.length, { num: n, name, text }));
    }
    if (!items.length) throw new Error('생기부 내용을 찾지 못했어요.');
    return items;
  }
  const head = hi >= 0 ? clean[hi].map((c) => c.replace(/\s+/g, '')) : [];
  const body = hi >= 0 ? clean.slice(hi + 1) : clean;
  const find = (re) => head.findIndex((h) => re.test(h));
  let textCol = find(/특기사항|세부능력|종합의견|세특|내용|기록|문장/);
  if (textCol < 0 || avg(textCol, body) < 10) {
    textCol = 0;
    for (let i = 1; i < width; i++) if (avg(i, body) > avg(textCol, body)) textCol = i;
  }
  const col = { grade: find(/^학년$/), cls: find(/^반$/), num: find(/^(번호|번)$/), hakbun: find(/학번/), name: find(/이름|성명/), subject: find(/과목/) };
  const items = [];
  body.forEach((r) => {
    const text = r[textCol] || '';
    if (text.length < 5) return;
    let grade = col.grade >= 0 ? num(r[col.grade]) : null;
    let cls = col.cls >= 0 ? num(r[col.cls]) : null;
    let n = col.num >= 0 ? num(r[col.num]) : null;
    if (col.hakbun >= 0) {
      const d = String(r[col.hakbun] || '').replace(/\D/g, '');
      if (d.length === 5) { grade ??= +d[0]; cls ??= +d.slice(1, 3); n ??= +d.slice(3); }
    }
    items.push(makeItem(items.length, {
      grade: grade ?? '', cls: cls ?? '', num: n ?? '', name: col.name >= 0 ? r[col.name] : '',
      subject: col.subject >= 0 ? r[col.subject] : '', text,
    }));
  });
  if (!items.length) throw new Error('생기부 내용을 찾지 못했어요. 내용이 든 칸이 있는지 확인해 주세요.');
  return items;
}

/** 붙여 넣은 글 → 학생 목록. 엑셀에서 복사한 여러 칸(탭), 빈 줄 구분, 한 줄 한 학생 모두 받음 */
export function pastedToItems(text) {
  const t = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!t) return [];
  if (t.includes('\t')) {
    const rows = t.split('\n').map((l) => l.split('\t'));
    try { return rowsToItems(rows); } catch { /* 아래로 */ }
  }
  const blocks = /\n\s*\n/.test(t) ? t.split(/\n\s*\n/) : t.split('\n');
  return blocks.map((b) => b.replace(/\s*\n\s*/g, ' ').trim()).filter((b) => b.length >= 5).map((b, i) => {
    const m = b.match(/^\s*(\d{1,2})\s*(?:번)?\s*[.)\]:]?\s+([가-힣]{2,4})?\s*[:：]?\s*(.+)$/);
    if (m && m[3].length > 10) return makeItem(i, { num: String(+m[1]), name: m[2] || '', text: m[3].trim() });
    return makeItem(i, { text: b });
  });
}

export const CHECK_KINDS = [
  { key: 'dup', label: '중복 문장(6어절)' },
  { key: '맞춤법', label: '맞춤법' },
  { key: '띄어쓰기', label: '띄어쓰기' },
  { key: '문장 부호', label: '문장 부호' },
  { key: 'rules', label: '기재요령(어체·금지 표현·분량)' },
];

/** 전체 점검 */
export function reviewAll(items, area = 'gwa', kinds = CHECK_KINDS.map((k) => k.key)) {
  const on = new Set(kinds);
  const dup = on.has('dup') ? findDuplicates(items.map((x) => ({ id: x.id, text: x.text }))) : { byId: {}, groups: [] };
  const labelOf = Object.fromEntries(items.map((x) => [x.id, x.label]));
  const results = items.map((x) => {
    const spell = spellCheck(x.text).filter((s) => on.has(s.cat));
    const r = checkText(x.text, x.area || area);
    const rules = on.has('rules') ? r.issues : [];
    const dups = (dup.byId[x.id] || []).map((d) => ({ ...d, otherLabels: d.others.map((o) => labelOf[o]) }));
    const counts = {
      dup: dups.length,
      맞춤법: spell.filter((s) => s.cat === '맞춤법').length,
      띄어쓰기: spell.filter((s) => s.cat === '띄어쓰기').length,
      '문장 부호': spell.filter((s) => s.cat === '문장 부호').length,
      rules: rules.length,
    };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { id: x.id, spell, rules, dups, counts, total, bytes: r.bytes, chars: r.chars, limit: r.limit, fixable: spell.filter((s) => s.to !== null && s.to !== undefined).length };
  });
  const sum = (k) => results.reduce((a, r) => a + r.counts[k], 0);
  return {
    results,
    groups: dup.groups.map((g) => ({ ...g, labels: g.ids.map((id) => labelOf[id]) })),
    summary: {
      students: items.length,
      withIssues: results.filter((r) => r.total).length,
      dupStudents: results.filter((r) => r.counts.dup).length,
      dup: dup.groups.length, 맞춤법: sum('맞춤법'), 띄어쓰기: sum('띄어쓰기'), '문장 부호': sum('문장 부호'), rules: sum('rules'),
      fixable: results.reduce((a, r) => a + r.fixable, 0),
    },
  };
}

/** 점검 결과 엑셀 */
export function reviewToXlsx(items, review) {
  const byId = Object.fromEntries(review.results.map((r) => [r.id, r]));
  const summaryOf = (r) => [
    ...r.dups.map((d) => `[중복] "${d.text}" (같은 학생: ${d.otherLabels.join(', ')})`),
    ...r.spell.map((s) => `[${s.cat}] ${s.word ? `'${s.word.trim() || '빈칸'}' ` : ''}${s.msg}`),
    ...r.rules.map((i) => `[기재요령] ${i.message}`),
  ].join('\n');
  const rows = items.map((x) => {
    const r = byId[x.id];
    return [x.grade, x.cls, x.num, x.name, x.subject, x.original, x.text !== x.original ? x.text : '',
      r.chars, r.bytes, r.counts.dup, r.counts['맞춤법'], r.counts['띄어쓰기'], r.counts['문장 부호'], r.counts.rules, summaryOf(r)];
  });
  const groupRows = review.groups.map((g) => [g.text, g.ids.length, g.labels.join(', ')]);
  return buildXlsx([
    {
      name: '점검 결과',
      columns: [
        { header: '학년', width: 6 }, { header: '반', width: 6 }, { header: '번호', width: 6 }, { header: '이름', width: 10 }, { header: '과목', width: 10 },
        { header: '원래 내용', width: 60, wrap: true }, { header: '고친 내용', width: 60, wrap: true },
        { header: '글자 수', width: 8 }, { header: '바이트', width: 8 }, { header: '중복', width: 6 }, { header: '맞춤법', width: 7 },
        { header: '띄어쓰기', width: 8 }, { header: '문장 부호', width: 8 }, { header: '기재요령', width: 8 }, { header: '점검 내용', width: 70, wrap: true },
      ],
      rows,
    },
    {
      name: '중복 문장',
      columns: [{ header: '겹치는 문장(6어절 이상)', width: 80, wrap: true }, { header: '학생 수', width: 8 }, { header: '학생', width: 50, wrap: true }],
      rows: groupRows.length ? groupRows : [['겹치는 문장이 없어요.', 0, '']],
    },
  ]);
}

export function reviewTemplate() {
  return buildXlsx([{
    name: '점검할 내용',
    columns: [{ header: '학년', width: 6 }, { header: '반', width: 6 }, { header: '번호', width: 6 }, { header: '이름', width: 10 }, { header: '과목', width: 10 }, { header: '세부능력 및 특기사항', width: 90, wrap: true }],
    rows: [[2, 3, 1, '(예시)', '과학', '(예시) 이 칸에 점검할 생기부 내용을 붙여 넣어 주세요.']],
  }]);
}
