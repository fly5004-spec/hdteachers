// 성취기준 파일(.csv · .xlsx) 읽기와 양식 만들기 (외부 라이브러리 없음)
import { buildXlsx } from './xlsx.js';

// ---------- 엑셀(.xlsx) 읽기 ----------
async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buf) {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('엑셀 파일을 읽을 수 없어요.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const files = {};
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    const lnlen = dv.getUint16(off + 26, true);
    const lelen = dv.getUint16(off + 28, true);
    const start = off + 30 + lnlen + lelen;
    files[name] = { method, data: u8.subarray(start, start + csize) };
    p += 46 + nlen + elen + clen;
  }
  return {
    async text(name) {
      const f = files[name];
      if (!f) return null;
      const raw = f.method === 0 ? f.data : await inflateRaw(f.data);
      return dec.decode(raw);
    },
    names: Object.keys(files),
  };
}

const unxml = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
const textsIn = (xml) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unxml(m[1])).join('');
const colIndex = (ref) => {
  const letters = ref.replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

export async function readXlsxRows(buf) {
  const z = await unzip(buf);
  const shared = [];
  const ss = await z.text('xl/sharedStrings.xml');
  if (ss) for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textsIn(m[1]));
  const sheetName = z.names.filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))[0];
  if (!sheetName) throw new Error('엑셀에서 시트를 찾지 못했어요.');
  const xml = await z.text(sheetName);
  const rows = [];
  for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const inner = cm[2] || '';
      const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
      const type = (attrs.match(/t="(\w+)"/) || [])[1];
      let v = '';
      if (type === 's') v = shared[+(inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1]] ?? '';
      else if (type === 'inlineStr') v = textsIn(inner);
      else v = unxml((inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1] ?? '');
      row[ref ? colIndex(ref) : row.length] = v;
    }
    rows.push(Array.from(row, (x) => x ?? ''));
  }
  return rows;
}

// ---------- CSV 읽기 ----------
export function decodeText(buf) {
  const u8 = new Uint8Array(buf);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(u8).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('euc-kr').decode(u8); // 엑셀에서 저장한 한글 CSV
  }
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  const t = String(text).replace(/\r\n?/g, '\n');
  const sep = (t.split('\n')[0].match(/\t/g) || []).length > (t.split('\n')[0].match(/,/g) || []).length ? '\t' : ',';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ---------- 표 → 성취기준 목록 ----------
export function rowsToStandards(rows, fallbackSubject = '') {
  const clean = rows.map((r) => r.map((c) => String(c ?? '').trim())).filter((r) => r.some(Boolean));
  const hi = clean.findIndex((r) => r.some((c) => /성취\s*기준/.test(c) && !/코드/.test(c)));
  if (hi < 0) throw new Error("첫 줄에 '성취기준' 제목 칸이 있는지 확인해 주세요. (양식 내려받기를 눌러 양식을 써 주세요)");
  const head = clean[hi].map((c) => c.replace(/\s+/g, ''));
  const idx = { subject: -1, grade: -1, code: -1, text: -1, levels: {} };
  head.forEach((h, i) => {
    if (/과목/.test(h) && idx.subject < 0) idx.subject = i;
    else if (/학년/.test(h) && idx.grade < 0) idx.grade = i;
    else if (/코드/.test(h) && idx.code < 0) idx.code = i;
    else if (/성취기준/.test(h) && idx.text < 0) idx.text = i;
    else {
      const m = h.match(/^([A-E])(수준)?$/) || h.match(/^([A-E])수준/) || h.match(/^성취수준([A-E])$/);
      if (m) idx.levels[m[1]] = i;
    }
  });
  const out = [];
  for (const r of clean.slice(hi + 1)) {
    let text = r[idx.text] || '';
    let code = idx.code >= 0 ? r[idx.code] || '' : '';
    if (!code) {
      const m = text.match(/^\s*(\[[^\]]+\])\s*/);
      if (m) { code = m[1]; text = text.slice(m[0].length); }
    }
    if (!text) continue;
    const levels = {};
    for (const [l, i] of Object.entries(idx.levels)) if (r[i]) levels[l] = r[i];
    out.push({
      subject: (idx.subject >= 0 && r[idx.subject]) || fallbackSubject,
      grade: idx.grade >= 0 ? r[idx.grade] || '' : '',
      code, text, levels,
    });
  }
  if (!out.length) throw new Error('성취기준 내용을 찾지 못했어요. 성취기준 칸이 비어 있지 않은지 확인해 주세요.');
  return out;
}

export async function parseStandardsFile(fileName, buf, fallbackSubject) {
  const isXlsx = /\.xlsx$/i.test(fileName) || (new Uint8Array(buf)[0] === 0x50 && new Uint8Array(buf)[1] === 0x4b);
  if (/\.xls$/i.test(fileName)) throw new Error("예전 엑셀(.xls) 파일은 읽을 수 없어요. 엑셀에서 '다른 이름으로 저장 → .xlsx'로 바꿔 올려 주세요.");
  const rows = isXlsx ? await readXlsxRows(buf) : parseCsv(decodeText(buf));
  return rowsToStandards(rows, fallbackSubject);
}

/** 성취기준 양식(.xlsx) */
export function standardsTemplate(subject = '과학') {
  return buildXlsx([{
    name: '성취기준',
    columns: [
      { header: '과목', width: 10 }, { header: '학년', width: 6 }, { header: '성취기준 코드', width: 14 },
      { header: '성취기준', width: 60, wrap: true },
      { header: 'A 수준', width: 36, wrap: true }, { header: 'B 수준', width: 36, wrap: true },
      { header: 'C 수준', width: 36, wrap: true }, { header: 'D 수준', width: 36, wrap: true },
      { header: 'E 수준', width: 36, wrap: true },
    ],
    rows: [
      [subject, 2, '[예시-01]', '(예시) 빛이 거울과 렌즈를 지나며 상이 생기는 과정을 설명할 수 있다.',
        '(예시) 빛의 반사와 굴절로 상이 생기는 과정을 정확하게 설명하고 생활 속 예에 적용할 수 있다.',
        '(예시) 빛의 반사와 굴절로 상이 생기는 과정을 설명할 수 있다.', '', '', ''],
      [subject, 2, '[예시-02]', '(예시) 실험 결과를 표와 그래프로 나타내고 규칙을 찾을 수 있다.', '', '', '', '', ''],
    ],
  }]);
}
