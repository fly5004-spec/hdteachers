// 학생 자료 파일 읽기 (브라우저 전용): 엑셀 · CSV · PDF · 텍스트
import { readXlsxRows, parseCsv, decodeText } from './standards.js';
import { rowsToStudents, pagesToStudents, mergeStudents } from './analyze.js';

let pdfjsReady = null;
function loadPdfJs() {
  if (pdfjsReady) return pdfjsReady;
  pdfjsReady = new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const sc = document.createElement('script');
    sc.src = new URL('../vendor/pdfjs/pdf.min.js', import.meta.url).href;
    sc.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;
      resolve(window.pdfjsLib);
    };
    sc.onerror = () => { pdfjsReady = null; reject(new Error('PDF 읽기 도구를 불러오지 못했어요.')); };
    document.head.appendChild(sc);
  });
  return pdfjsReady;
}

export async function pdfPages(buf) {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    // 글자 위치를 보고 띄어쓰기·줄바꿈을 되살림 (글자마다 따로 저장된 PDF 대비)
    let t = '';
    let prevEnd = null;
    let prevY = null;
    for (const it of tc.items) {
      if (!it.str) { if (it.hasEOL) { t += '\n'; prevEnd = null; } continue; }
      const x = it.transform[4];
      const y = it.transform[5];
      const h = Math.abs(it.transform[3]) || 10;
      if (prevY !== null && Math.abs(y - prevY) > h * 0.5) t += '\n';
      else if (prevEnd !== null && x - prevEnd > h * 0.2) t += ' ';
      t += it.str;
      prevEnd = x + (it.width || 0);
      prevY = y;
      if (it.hasEOL) { t += '\n'; prevEnd = null; }
    }
    pages.push(t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim());
  }
  return pages;
}

/**
 * files: File[] → { students, notes[] }
 * defaults: { grade, cls } (자료에 학년·반이 없을 때)
 */
export async function readStudentFiles(files, defaults) {
  const all = [];
  const notes = [];
  for (const f of files) {
    const name = f.name || '';
    try {
      if (f.size > 30 * 1024 * 1024) throw new Error('파일이 너무 커요(30MB 이하).');
      if (/\.(hwp|hwpx)$/i.test(name)) throw new Error("한글 파일은 바로 읽을 수 없어요. '다른 이름으로 저장 → PDF'로 바꿔 올려 주세요.");
      if (/\.xls$/i.test(name)) throw new Error("예전 엑셀(.xls)은 읽을 수 없어요. '.xlsx'로 저장해 올려 주세요.");
      const buf = await f.arrayBuffer();
      if (/\.xlsx$/i.test(name)) all.push(...rowsToStudents(await readXlsxRows(buf), defaults));
      else if (/\.(csv|tsv)$/i.test(name)) all.push(...rowsToStudents(parseCsv(decodeText(buf)), defaults));
      else if (/\.pdf$/i.test(name)) {
        const pages = await pdfPages(buf);
        if (!pages.join('').trim()) throw new Error('글자를 찾지 못했어요. 사진으로 찍은(스캔한) PDF는 읽을 수 없어요.');
        const st = pagesToStudents(pages, name, defaults);
        if (!st.length) throw new Error("학생 번호를 찾지 못했어요. 각 쪽 맨 위에 '2학년 3반 14번'처럼 적혀 있거나, 파일 이름에 학번(예: 20314 홍길동)이 있어야 해요.");
        all.push(...st);
      } else if (/\.txt$/i.test(name)) {
        const text = decodeText(buf);
        const st = pagesToStudents(text.split(/\f|\n-{3,}\n/), name, defaults);
        if (!st.length) throw new Error('학생 번호를 찾지 못했어요.');
        all.push(...st);
      } else throw new Error('엑셀(.xlsx), CSV, PDF, 텍스트(.txt) 파일만 올릴 수 있어요.');
    } catch (err) {
      notes.push(`${name}: ${err && err.message ? err.message : '읽지 못했어요.'}`);
    }
  }
  return { students: mergeStudents(all), notes };
}
