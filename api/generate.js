// POST /api/generate  (Vercel 서버리스 함수 · 로컬 server.mjs 공용)
// 환경 변수 ANTHROPIC_API_KEY가 있으면 AI로 문장을 만들고, 없으면 규칙 기반 '예시 문장'을 돌려줍니다.
import { generateExample, rephraseExample, shortenExample } from '../public/lib/example.js';
import { toEumseumLoose, splitSentences } from '../public/lib/rules.js';
import { AREA_NAMES, LENGTHS, CLOSINGS } from '../public/lib/data.js';
import { jayulSentence } from '../public/lib/example.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

const SYSTEM = `당신은 대한민국 중학교 교사의 학교생활기록부(생기부) 문장 작성을 돕는 도우미입니다.
반드시 지킬 것:
1. 교사가 관찰한 시점으로 씁니다. 모든 문장의 끝은 '~함', '~했음', '~보임', '~임', '~됨'처럼 명사형(음슴체)으로 끝냅니다. '~다', '~습니다', '~요'로 끝내지 않습니다.
2. 중학생 수준에 맞게, 고등학교처럼 지나치게 깊은 학술 용어나 과장된 표현을 쓰지 않습니다. 짧고 구체적인 행동 중심으로 씁니다.
3. 입력에 없는 사실(활동, 결과, 수치, 진로)을 지어내지 않습니다.
4. 다음 내용은 절대 쓰지 않습니다: 점수·등급·성취수준(A~E), 교내·외 대회 참가와 수상 실적, 공인어학시험(토익 등) 이름과 점수, 자격증·인증시험, 부모의 직업 등 사회·경제적 지위, 사교육(학원·과외), 해외 연수·봉사, 논문·특허·출간, 대학 등 외부 기관 프로그램, 장학생, 모의고사 성적. 입력에 이런 내용이 있어도 빼고 씁니다.
5. 다른 학생과 비교하거나 순위를 매기는 표현을 쓰지 않습니다.
6. 학생 이름은 쓰지 않습니다.
7. 결과 문장만 출력합니다. 제목, 따옴표, 설명, 줄바꿈 없이 한 문단으로 씁니다.`;

function areaGuide(area) {
  if (area === 'hang') return '행동특성 및 종합의견: 한 해 동안 꾸준히 보인 성격·태도·인성을 담임교사 관찰로 씁니다. 단점은 나아진 점이나 가능성과 함께 씁니다.';
  if (area === 'jayul') return '자율·자치활동 특기사항: 학급·학교 자치 활동에서 맡은 역할과 참여 모습을 씁니다.';
  return '교과 세부능력 및 특기사항: 해당 과목 수업 안에서 보인 참여 태도, 탐구·협력 모습을 씁니다.';
}

function buildPrompt(body) {
  const { mode = 'generate', area = 'gwa', input = {}, text = '' } = body;
  const len = LENGTHS.find((l) => l.key === input.length) || LENGTHS[1];
  if (mode === 'rephrase') {
    return `아래 생기부 문장의 뜻과 사실은 그대로 두고, 표현만 자연스럽게 다르게 다듬어 주세요. 분량은 비슷하게 유지합니다.\n\n${text}`;
  }
  if (mode === 'shorten') {
    return `아래 생기부 문장을 핵심만 남겨 지금보다 30% 정도 짧게 줄여 주세요. 새로운 사실은 넣지 않습니다.\n\n${text}`;
  }
  const lines = [
    `작성 영역: ${AREA_NAMES[area] || area}`,
    areaGuide(area),
    `목표 분량: 공백 포함 약 ${len.target}자`,
  ];
  if (area === 'gwa') {
    lines.push(`과목: ${input.subject || ''}`);
    if (input.activity) lines.push(`단원·활동: ${input.activity}`);
  }
  if (area === 'gwa' && input.standard && input.standard.text) {
    lines.push(`관련 성취기준(그대로 옮겨 적지 말고 학생 활동으로 풀어 쓸 것): ${input.standard.text}`);
    if (input.level && input.standard.levels && input.standard.levels[input.level]) lines.push(`이 학생 수준의 기술: ${input.standard.levels[input.level]}`);
  }
  if (area === 'gwa' && input.level) {
    const guide = { A: '개념을 깊이 이해하고 새로운 상황에 적용하는 모습 중심', B: '개념을 바르게 이해하고 활용하는 모습 중심', C: '기본 개념을 이해하고 성실히 참여하는 모습 중심', D: '노력하며 조금씩 나아지는 성장 중심(부정적 표현 금지)', E: '꾸준한 참여와 성장 가능성 중심(부정적 표현 금지)' }[input.level];
    if (guide) lines.push(`표현의 깊이: ${guide}. 성취수준(A~E)이나 점수는 절대 문장에 쓰지 말 것.`);
  }
  if (area === 'gwa' && (input.types || []).length) lines.push(`수업 활동 종류: ${input.types.join(', ')}`);
  if (area === 'jayul') {
    if (input.roleTitle) lines.push(`학급 직책: ${input.roleTitle}`);
    const acts = [...(input.chips || []), ...(input.custom || [])];
    if (acts.length) {
      lines.push('참여한 활동과 역할(활동마다 역할이 다르니 섞지 말 것):');
      acts.forEach((a, i) => lines.push(`- ${jayulSentence(a, (input.roles || {})[a], (input.roleCustom || {})[a], i)}`));
    }
  } else {
    const picks = [...(input.chips || []), ...(input.custom || [])];
    if (picks.length) lines.push(`교사가 고른 관찰 모습: ${picks.join(' / ')}`);
  }
  const closing = (CLOSINGS[area] || []).find((c) => c.label === input.closing);
  if (closing) lines.push(`마지막 문장 방향: ${closing.label}`);
  if (input.memo) lines.push(`꼭 넣을 장면(그대로 옮기지 말고 자연스럽게 다듬어 넣기): ${String(input.memo).slice(0, 500)}`);
  return lines.join('\n');
}

// 혹시 '~다'로 끝난 문장이 섞여도 음슴체로 정리
function tidy(text) {
  const clean = String(text || '').replace(/^["'“”]+|["'“”]+$/g, '').replace(/\s*\n+\s*/g, ' ').trim();
  return splitSentences(clean).map((s) => toEumseumLoose(s.core) + '.').join(' ');
}

function example(body) {
  const { mode = 'generate', area = 'gwa', input = {}, text = '' } = body;
  if (mode === 'rephrase') return rephraseExample(text);
  if (mode === 'shorten') return shortenExample(text);
  return generateExample({ ...input, area });
}

async function callClaude(body) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system: SYSTEM,
      messages: [{ role: 'user', content: buildPrompt(body) }],
    }),
  });
  if (!res.ok) throw new Error(`AI 응답 오류 ${res.status}`);
  const data = await res.json();
  return (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST만 쓸 수 있어요.' });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  if (!['generate', 'rephrase', 'shorten'].includes(body.mode || 'generate')) {
    res.status(400).json({ error: '알 수 없는 요청이에요.' });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(200).json({ text: example(body), source: 'example' });
    return;
  }
  try {
    const text = tidy(await callClaude(body));
    res.status(200).json({ text, source: 'ai' });
  } catch (err) {
    res.status(200).json({ text: example(body), source: 'example', notice: 'AI 연결에 실패해서 예시 문장을 보여 드려요.' });
  }
}
