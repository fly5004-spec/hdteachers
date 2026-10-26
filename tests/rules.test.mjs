import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  neisBytes, toEumseum, toEumseumLoose, checkText, applyFix, applyEnding, detectEnding, josaRo,
} from '../public/lib/rules.js';
import { generateExample, shortenExample, rephraseExample } from '../public/lib/example.js';

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
  const j = generateExample({ area: 'jayul', chips: ['학급 회의'], role: '학급 자치회 부회장', memo: '' });
  assert.ok(j.startsWith('학급 자치회 부회장으로서 '));
  assert.equal(generateExample({ area: 'hang', chips: [], memo: '' }), '');
  assert.ok(shortenExample(g).length < g.length);
  assert.notEqual(rephraseExample(g), g);
});
