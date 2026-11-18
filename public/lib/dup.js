// 여러 학생에게 같은 문장(연속 6어절 이상)이 들어갔는지 찾기
// 사이버 감사 기준: 교과세특·행동특성 및 종합의견에서 6어절 이상 같은 문장이 2명 이상에게 있으면 조회됨

const strip = (w) => w.replace(/[.,!?'"“”‘’()[\]·…~:;「」『』<>]/g, '');

export function tokenize(text) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const norm = strip(m[0]);
    if (norm) out.push({ norm, start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/**
 * docs: [{ id, text }]
 * 반환: { byId: { [id]: [{ start, end, text, others:[id] }] }, groups: [{ text, ids:[id] }] }
 */
export function findDuplicates(docs, n = 6) {
  const toks = docs.map((d) => tokenize(d.text));
  const index = new Map();
  toks.forEach((tk, di) => {
    for (let i = 0; i + n <= tk.length; i++) {
      const key = tk.slice(i, i + n).map((t) => t.norm).join(' ');
      let list = index.get(key);
      if (!list) index.set(key, (list = []));
      list.push([di, i]);
    }
  });
  // 학생마다 겹친 어절 표시
  const cover = toks.map((tk) => tk.map(() => null));
  for (const list of index.values()) {
    const ds = new Set(list.map(([d]) => d));
    if (ds.size < 2) continue;
    for (const [d, i] of list) {
      for (let k = i; k < i + n; k++) {
        if (!cover[d][k]) cover[d][k] = new Set();
        for (const o of ds) if (o !== d) cover[d][k].add(o);
      }
    }
  }
  const byId = {};
  const groupMap = new Map();
  docs.forEach((doc, d) => {
    const spans = [];
    const tk = toks[d];
    let k = 0;
    while (k < tk.length) {
      if (!cover[d][k]) { k++; continue; }
      const a = k;
      const others = new Set();
      while (k < tk.length && cover[d][k]) { cover[d][k].forEach((o) => others.add(o)); k++; }
      const b = k - 1;
      const text = doc.text.slice(tk[a].start, tk[b].end);
      spans.push({ start: tk[a].start, end: tk[b].end, text, words: b - a + 1, others: [...others].map((o) => docs[o].id) });
      const gk = tk.slice(a, b + 1).map((t) => t.norm).join(' ');
      let g = groupMap.get(gk);
      if (!g) groupMap.set(gk, (g = { text, ids: new Set() }));
      g.ids.add(doc.id);
      others.forEach((o) => g.ids.add(docs[o].id));
    }
    if (spans.length) byId[doc.id] = spans;
  });
  // 더 긴 문장에 포함되는 짧은 묶음은 합침
  const groups = [...groupMap.values()]
    .map((g) => ({ text: g.text, ids: [...g.ids] }))
    .sort((a, b) => b.ids.length - a.ids.length || b.text.length - a.text.length);
  const kept = [];
  for (const g of groups) {
    const norm = tokenize(g.text).map((t) => t.norm).join(' ');
    if (kept.some((k) => k.norm.includes(norm) && g.ids.every((id) => k.ids.includes(id)))) continue;
    kept.push({ ...g, norm });
  }
  return { byId, groups: kept.map(({ norm, ...g }) => g) };
}
