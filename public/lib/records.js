// 저장한 문장 목록 → 엑셀 시트
import { buildXlsx } from './xlsx.js';

export const AREA_SHEETS = {
  gwa: { sheet: '과세특', title: '교과 세부능력 및 특기사항' },
  jayul: { sheet: '자율·자치활동', title: '자율·자치활동 특기사항' },
  hang: { sheet: '행동특성 및 종합의견', title: '행동특성 및 종합의견' },
};

/** 같은 학생·같은 영역(과세특은 과목까지)이면 같은 기록 */
export const recordKey = (r) => [r.area, r.grade, r.cls, r.num, r.area === 'gwa' ? r.subject : ''].join('|');

const sortRecords = (list) => [...list].sort((a, b) =>
  (+a.grade - +b.grade) || (+a.cls - +b.cls) || (+a.num - +b.num) || String(a.subject).localeCompare(String(b.subject), 'ko'));

function fmtTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function recordsToSheets(records) {
  const sheets = [];
  for (const area of ['gwa', 'jayul', 'hang']) {
    const list = sortRecords(records.filter((r) => r.area === area));
    if (!list.length) continue;
    const meta = AREA_SHEETS[area];
    const columns = [
      { header: '학년', width: 6 }, { header: '반', width: 6 }, { header: '번호', width: 6 },
      ...(area === 'gwa' ? [{ header: '과목', width: 12 }, { header: '성취수준', width: 9 }] : []),
      { header: meta.title, width: 90, wrap: true },
      { header: '글자 수', width: 9 }, { header: '바이트', width: 9 }, { header: '저장 시각', width: 18 },
    ];
    const rows = list.map((r) => [
      Number(r.grade), Number(r.cls), Number(r.num),
      ...(area === 'gwa' ? [r.subject || '', r.level || ''] : []),
      r.text, Number(r.chars), Number(r.bytes), fmtTime(r.savedAt),
    ]);
    sheets.push({ name: meta.sheet, columns, rows });
  }
  return sheets;
}

export function recordsToXlsx(records) {
  return buildXlsx(recordsToSheets(records));
}

export function xlsxFileName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `saenggibu_${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}.xlsx`;
}
