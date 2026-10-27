# 생기부 작성 도우미 (중학교)

과세특 · 자율·자치활동 · 행동특성 및 종합의견 문장을 중학교 기재요령에 맞게(음슴체, 기재 금지 내용 점검) 쓰도록 돕는 웹앱입니다.

## 구성

```
public/            화면 (HTML · CSS · JS, 빌드 없음)
  lib/rules.js     기재요령 점검: 어체, 적으면 안 되는 내용, 비교 표현, 단점 표현, NEIS 바이트
  lib/example.js   AI 연결 전 '예시 문장' 만들기 (규칙 기반)
  lib/data.js      고르기 항목(칩), 활동별 역할, 마무리 한 줄, 문장 길이
  lib/achievement.js 성취수준(점수→A~E)과 수준별 문장
  lib/standards.js 성취기준 파일(엑셀·CSV) 읽기와 양식
  lib/analyze.js   학생 자료(수행평가 결과표·활동 보고서) 분석
  lib/intake.js    학생 자료 파일 읽기(엑셀·CSV·PDF·텍스트)
  lib/records.js   저장한 문장 → 엑셀 시트
  lib/xlsx.js      엑셀(.xlsx) 파일 만들기 (외부 라이브러리 없음)
vendor/pdfjs/      PDF 글자 읽기 도구(pdf.js 3.11.174, Apache-2.0)
api/generate.js    문장 만들기 · 다듬기 · 줄이기 (Vercel 서버리스 함수)
server.mjs         로컬 개발 서버 (의존성 없음)
tests/             점검 규칙 테스트
```

## 로컬에서 실행

Node.js 18 이상이 필요합니다.

```bash
npm test        # 점검 규칙 테스트
npm run dev     # http://localhost:3000
```

AI 문장 만들기를 켜려면 `.env.example`을 `.env.local`로 복사하고 `ANTHROPIC_API_KEY`를 넣으세요.
키가 없으면 '예시 문장 (AI 연결 전)' 모드로 동작합니다.

## Vercel 배포

1. 이 폴더를 GitHub 저장소에 올립니다.
2. Vercel에서 저장소를 가져옵니다(Framework: Other). `vercel.json`이 `public`을 화면으로, `api/`를 서버 함수로 씁니다.
3. Project Settings → Environment Variables에 `ANTHROPIC_API_KEY`(필요하면 `ANTHROPIC_MODEL`)를 넣고 다시 배포합니다.

## 개인정보

- 올린 학생 자료(이름·점수·보고서)는 브라우저 메모리에서만 분석하고 저장하거나 서버로 보내지 않습니다. 새로고침하면 사라집니다.
- 학생 이름을 입력받지 않습니다. 학년·반·번호는 화면에만 쓰고 서버로 보내지 않습니다.
- 서버는 문장을 저장하지 않습니다. '저장하고 다음 학생'으로 모은 문장은 그 컴퓨터의 브라우저(localStorage)에만 남고, '엑셀로 내려받기'로 파일로 받을 수 있습니다.
- AI를 켜면 고른 항목과 관찰 메모가 AI 서비스로 전송됩니다. 메모에 학생 실명 등 개인정보를 적지 않도록 안내해 주세요.

## 확인이 필요한 부분

- 성취수준 기본 분할점수는 90/80/70/60(체육·음악·미술은 80/60)입니다. 학교 기준이 다르면 `public/lib/data.js`의 `LEVEL_CUTS`를 고치세요. 점수와 성취수준은 문장에 적지 않고, 점검에서도 오류로 잡습니다.

- 기재 금지 항목과 분량 기준(500자 · 1,500바이트)은 올해 학교생활기록부 기재요령으로 다시 확인해 주세요. `public/lib/rules.js`에서 고칠 수 있습니다.
- 점검은 낱말 규칙 기반이라 놓치거나 잘못 잡을 수 있습니다. 최종 확인은 선생님이 해야 합니다.
- 배포 후 누구나 주소로 접속할 수 있으므로, AI 키를 켤 때는 학교 공용 비밀번호 등 접근 제한을 추가하는 것을 권합니다.
