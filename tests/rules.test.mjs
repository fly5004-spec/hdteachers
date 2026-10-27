import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  neisBytes, toEumseum, toEumseumLoose, checkText, applyFix, applyEnding, detectEnding, josaRo,
} from '../public/lib/rules.js';
import { generateExample, shortenExample, rephraseExample, jayulSentence } from '../public/lib/example.js';
import { recordsToSheets, recordsToXlsx, recordKey } from '../public/lib/records.js';

test('NEIS 바이트 계산', () => {
  assert.equal(neisBytes('가나'), 6);
  assert.equal(neisBytes('a 1'), 3);
  assert.equal(neisBytes('가\n나'), 8);
});

test('음슴체 바꾸기', () => {
  const cases = {
    '말하였다': '말함', '참여했다': '참여함', '설명합니다': '설명함', '정리한다': '정리함',
    '선정되었다': '선정됨', '학생이다': '학생임', '관심이 있다': '관심이 있음',
    '찾았다': '찾음', '만들었다': '만듦', '도와주었다': '도와줌', '간다': '감',
    '읽는다': '읽음', '좋다': '좋음', '보였다': '보임', '노력했습니다': '노력함',
  };
  for (const [a, b] of Object.entries(cases)) assert.equal(toEumseum(a), b, a);
  assert.equal(toEumseum('꼼꼼히 관찰함'), '꼼꼼히 관찰함');
  assert.equal(toEumseumLoose('렌즈 상 크기 꼼꼼히 측정'), '렌즈 상 크기 꼼꼼히 측정함');
  assert.equal(toEumseumLoose('가끔 산만한 편'), '가끔 산만한 편임');
});

test('목업의 오류 예시: 어체 1건 + 대회·수상 1건', () => {
  const t = "'빛과 파동' 단원의 거울과 렌즈로 상 만들기 실험에서 실험 도구를 안전하게 다루며 상의 크기 변화를 꼼꼼히 관찰함. 모둠 토의에서 관찰 결과를 근거로 자신의 생각을 말하였다. 이를 바탕으로 한빛시 청소년 과학탐구대회에 참가하여 금상을 받음.";
  const r = checkText(t, 'gwa');
  assert.equal(r.errors.length, 2);
  const ending = r.errors.find((i) => i.group === 'ending');
  assert.equal(ending.word, '말하였다');
  assert.equal(ending.fix.to, '말함');
  const fixed1 = applyFix(t, ending);
  assert.ok(fixed1.includes('자신의 생각을 말함.'));
  const forb = checkText(fixed1, 'gwa').errors.find((i) => i.group === 'forbidden');
  const fixed2 = applyFix(fixed1, forb);
  assert.ok(!fixed2.includes('대회'));
  assert.equal(checkText(fixed2, 'gwa').errors.length, 0);
});

test('통과 예시와 오탐 방지', () => {
  const ok = "학급 자치회 부회장으로서 학급 회의를 진행함. 체육대회 준비 과정에서 응원 도구 만들기를 맡아 완성함. 친구들을 대상으로 설문을 실시함.";
  assert.equal(checkText(ok, 'jayul').errors.length, 0);
});

test('금지 내용·비교·분량·단점', () => {
  assert.equal(checkText('토익 850점을 받음.', 'hang').errors[0].group, 'forbidden');
  assert.equal(checkText('아버지가 의사로 일하심을 자랑스러워함.', 'hang').errors[0].group, 'forbidden');
  assert.equal(checkText('반에서 가장 성실함.', 'hang').errors[0].group, 'compare');
  assert.equal(checkText('수업 중 산만한 편임.', 'hang').warnings.length, 1);
  assert.equal(checkText('가'.repeat(501) + '함.', 'gwa').errors.some((i) => i.group === 'length'), true);
});

test('끝맺음 바꾸기', () => {
  const t = '실험을 꼼꼼히 관찰함. 결과를 정리함. 배려심이 깊음.';
  const h = applyEnding(t, 'haess');
  assert.equal(h, '실험을 꼼꼼히 관찰했음. 결과를 정리했음. 배려심이 깊음.');
  assert.equal(detectEnding(h), 'haess');
  const b = applyEnding(h, 'boim');
  assert.equal(b, '실험을 꼼꼼히 관찰하는 모습을 보임. 결과를 정리하는 모습을 보임. 배려심이 깊음.');
  assert.equal(applyEnding(b, 'ham'), t);
  assert.equal(checkText(b, 'gwa').errors.length, 0);
});

test('예시 문장 만들기', () => {
  assert.equal(josaRo('부회장'), '으로');
  assert.equal(josaRo('반장'), '으로');
  assert.equal(josaRo('회장'), '으로');
  assert.equal(josaRo('도우미'), '로');
  const g = generateExample({
    area: 'gwa', subject: '과학', activity: '빛과 파동 - 거울과 렌즈로 상 만들기 실험',
    chips: ['실험·활동 도구를 안전하게 다룸', '결과를 표나 그림으로 정리함'],
    memo: '렌즈 상 크기 변화 꼼꼼히 측정. 사이드미러 예시를 직접 찾아 모둠에 설명', length: 'normal',
  });
  assert.ok(g.startsWith("'빛과 파동"));
  assert.equal(checkText(g, 'gwa').errors.length, 0, g);
  const j = generateExample({ area: 'jayul', chips: ['학급 회의'], roleTitle: '학급 자치회 부회장', memo: '' });
  assert.ok(j.startsWith('학급 자치회 부회장으로서 '));
  assert.equal(generateExample({ area: 'hang', chips: [], memo: '' }), '');
  assert.ok(shortenExample(g).length < g.length);
  assert.notEqual(rephraseExample(g), g);
});

test('메모 없이도 충분한 길이', () => {
  const g = generateExample({
    area: 'gwa', subject: '과학', types: ['실험·관찰'],
    chips: ['실험·활동 도구를 안전하게 다룸', '모둠 활동에서 자기 생각을 말함', '결과를 표나 그림으로 정리함'],
    closing: '흥미와 자신감이 커짐', length: 'normal',
  });
  const r = checkText(g, 'gwa');
  assert.ok(r.chars >= 150, `${r.chars}자: ${g}`);
  assert.equal(r.errors.length, 0, g);
  assert.ok(g.includes('과학에 대한 흥미와 자신감이 커짐'));
  const short = generateExample({ area: 'gwa', subject: '과학', chips: ['궁금한 점을 질문함'], length: 'short' });
  assert.ok(checkText(short, 'gwa').chars < r.chars);
});

test('메모는 그대로 붙이지 않고 다듬어 넣음', () => {
  const g = generateExample({ area: 'gwa', subject: '과학', chips: ['궁금한 점을 질문함'], memo: '렌즈 상 크기 변화를 꼼꼼히 측정', length: 'normal' });
  assert.ok(g.includes('특히 렌즈 상 크기 변화를 꼼꼼히 측정하는 모습을 보임.'), g);
});

test('자율·자치: 활동마다 다른 역할', () => {
  assert.equal(jayulSentence('학급 회의', '회의 진행'), '학급 회의의 진행을 맡아 친구들이 고르게 의견을 낼 수 있도록 회의를 이끎');
  assert.ok(jayulSentence('1인 1역', '분리배출').includes('분리배출 역할을 맡아'));
  assert.ok(jayulSentence('학교 행사 (체육대회 등)', '__custom', '사진 기록').startsWith('학교 행사에서 사진 기록을 맡아'));
  assert.equal(jayulSentence('캠페인 활동', ''), '학교 캠페인 활동에 참여하여 친구들에게 바른 생활 습관을 알림');
  const g = generateExample({
    area: 'jayul', length: 'normal',
    chips: ['학급 회의', '캠페인 활동', '학교 행사 (체육대회 등)', '1인 1역'],
    roles: { '학급 회의': '기록', '캠페인 활동': '홍보물 제작', '학교 행사 (체육대회 등)': '응원 담당', '1인 1역': '환경 정리' },
  });
  for (const k of ['기록을 맡아', '홍보물 제작을 맡아', '응원을 맡아', '환경 정리 역할을 맡아']) assert.ok(g.includes(k), k);
  assert.equal(checkText(g, 'jayul').errors.length, 0, g);
});

test('저장 목록 → 엑셀', () => {
  const recs = [
    { area: 'gwa', grade: '2', cls: '3', num: '14', subject: '과학', text: '관찰함.', chars: 4, bytes: 10, savedAt: '2026-10-27T01:00:00Z' },
    { area: 'gwa', grade: '2', cls: '3', num: '2', subject: '과학', text: '정리함.', chars: 4, bytes: 10, savedAt: '2026-10-27T01:00:00Z' },
    { area: 'hang', grade: '2', cls: '3', num: '7', subject: '', text: '배려심이 깊음.', chars: 8, bytes: 20, savedAt: '2026-10-27T01:00:00Z' },
  ];
  const sheets = recordsToSheets(recs);
  assert.deepEqual(sheets.map((s) => s.name), ['과세특', '행동특성 및 종합의견']);
  assert.equal(sheets[0].rows[0][2], 2);
  assert.equal(sheets[0].columns[3].header, '과목');
  const bytes = recordsToXlsx(recs);
  assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b);
  assert.notEqual(recordKey(recs[0]), recordKey({ ...recs[0], subject: '수학' }));
  assert.equal(recordKey(recs[2]), recordKey({ ...recs[2], text: '다른 문장' }));
});

test('성취수준: 점수 → 수준, 수준별 문장', async () => {
  const { scoreToLevel, standardSentence } = await import('../public/lib/achievement.js');
  assert.equal(scoreToLevel(95, 100, '과학'), 'A');
  assert.equal(scoreToLevel(79.5, 100, '과학'), 'C');
  assert.equal(scoreToLevel(12, 20, '과학'), 'D');
  assert.equal(scoreToLevel(75, 100, '체육'), 'B');
  assert.equal(scoreToLevel(120, 100, '과학'), null);
  const std = { code: '[예시-01]', text: '상이 생기는 과정을 설명할 수 있다.', levels: {} };
  assert.ok(standardSentence(std, 'A', '과학').includes('깊이 있게'));
  assert.ok(standardSentence(std, 'D', '과학').startsWith('상이 생기는 과정을 설명할 수 있도록'));
  for (const lv of ['A', 'B', 'C', 'D', 'E']) {
    const g = generateExample({ area: 'gwa', subject: '과학', chips: ['궁금한 점을 질문함'], level: lv, standard: std, length: 'normal' });
    assert.equal(checkText(g, 'gwa').errors.length, 0, g);
    assert.ok(!/[A-E]\s?수준|\d\s?점/.test(g), g);
  }
  assert.equal(checkText('수행평가에서 95점을 받음.', 'gwa').errors[0].cat, '점수·등급');
});

test('성취기준 파일 읽기 (CSV · 엑셀 양식)', async () => {
  const { parseStandardsFile, standardsTemplate } = await import('../public/lib/standards.js');
  const csv = '과목,성취기준 코드,성취기준,A 수준,B 수준\n과학,[9과01-01],"힘의 크기를 측정할 수 있다.",정확히 측정하고 설명할 수 있다.,\n';
  const eucBytes = new Uint8Array(Buffer.from(new TextEncoder().encode(csv)));
  const rows = await parseStandardsFile('a.csv', eucBytes.buffer, '수학');
  assert.equal(rows[0].subject, '과학');
  assert.equal(rows[0].code, '[9과01-01]');
  assert.equal(rows[0].levels.A, '정확히 측정하고 설명할 수 있다.');
  const noSubject = await parseStandardsFile('b.csv', new TextEncoder().encode('성취기준\n[9수01-01] 소인수분해를 할 수 있다.\n').buffer, '수학');
  assert.equal(noSubject[0].subject, '수학');
  assert.equal(noSubject[0].code, '[9수01-01]');
  const x = await parseStandardsFile('t.xlsx', standardsTemplate('국어').buffer, '');
  assert.equal(x.length, 2);
  assert.equal(x[0].subject, '국어');
  assert.ok(x[0].levels.A.includes('정확하게'));
  await assert.rejects(parseStandardsFile('c.csv', new TextEncoder().encode('이름,점수\n가,1').buffer, '수학'));
});

test('학생 자료: 수행평가 결과표 분석', async () => {
  const { rowsToStudents, analyzeGwa } = await import('../public/lib/analyze.js');
  const rows = [
    ['2026 과학 수행평가'],
    ['학년', '반', '번호', '이름', '측정 (10)', '발표 (10)', '관찰 내용'],
    ['2', '3', '1', '가상일', '10', '5', '모둠 실험에서 측정값을 표로 정리하고 결과를 발표함'],
    ['2', '3', '2', '가상이', '6', '9', '저는 친구들과 역할을 나누어 협력했습니다.'],
  ];
  const st = rowsToStudents(rows);
  assert.equal(st.length, 2);
  assert.equal(st[0].score, 15); assert.equal(st[0].max, 20);
  const a = analyzeGwa(st[0]);
  assert.deepEqual(a.strengths, ['측정']); assert.deepEqual(a.growth, ['발표']);
  assert.ok(a.chips.includes('결과를 표나 그림으로 정리함'));
  const g = generateExample({ area: 'gwa', subject: '과학', chips: a.chips, analysis: a, memo: a.highlights.join('. '), level: 'C', length: 'normal' });
  assert.ok(g.includes('측정 영역에서 특히 뛰어난 모습을 보임'), g);
  assert.ok(g.includes('발표 영역은 꾸준한 노력으로'), g);
  assert.equal(checkText(g, 'gwa').errors.length, 0, g);
  assert.ok(!/가상일|15|20/.test(g));
  const b = analyzeGwa(st[1]);
  assert.ok(b.highlights[0].startsWith('친구들과 역할을 나누어 협력함'), b.highlights[0]);
});

test('학생 자료: PDF 쪽 나누기와 보고서 분석', async () => {
  const { pagesToStudents, analyzeJayul, toObservation, findStudentId } = await import('../public/lib/analyze.js');
  assert.deepEqual(findStudentId('학번: 20314 홍가상 활동 보고서'), { grade: '2', cls: '3', num: '14', name: '홍가상' });
  const pages = ['2학년 3반 1번 김가상\n저는 학급 회의에서 서기를 맡아 회의 내용을 기록했습니다.', '(이어지는 쪽) 환경 캠페인 포스터를 만들어 게시했습니다. 정말 재미있었다.', '2학년 3반 2번 이가상\n체육대회에서 응원 도구를 친구들과 함께 만들었습니다.'];
  const st = pagesToStudents(pages, 'report.pdf', { grade: '2', cls: '3' });
  assert.equal(st.length, 2);
  assert.ok(st[0].texts[0].includes('캠페인'));
  const a = analyzeJayul(st[0]);
  assert.ok(a.chips.includes('학급 회의') && a.chips.includes('캠페인 활동'));
  assert.equal(a.roles['학급 회의'], '기록');
  assert.equal(a.roles['캠페인 활동'], '홍보물 제작');
  assert.ok(!a.highlights.some((h) => /기록|포스터/.test(h)), '역할 문장과 겹치는 장면은 빠짐: ' + a.highlights.join('|'));
  assert.equal(a.roleTitle, '');
  assert.ok(!a.highlights.some((h) => h.includes('재미')));
  assert.equal(analyzeJayul(st[1]).roles['학교 행사 (체육대회 등)'], '응원 담당');
  assert.equal(toObservation('정말 재미있었다'), null);
  const one = pagesToStudents(['활동 내용만 있는 글입니다. 포스터를 만들었다.'], '20305 박가상.pdf', {});
  assert.equal(one[0].num, '5');
});
