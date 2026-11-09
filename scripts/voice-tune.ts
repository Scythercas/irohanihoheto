/**
 * 茉白の声（WhiteCUL）のイントネーション調整と、修正前後の聴き比べ。
 *
 *   npm run voice:dict   # 先に固有名詞を辞書登録しておくこと
 *   npm run voice:tune
 *
 * ■ VOICEVOX のイントネーションが狂う3つの原因と、それぞれの直し方
 *
 *   1. 固有名詞が読めない        → **ユーザー辞書**（`npm run voice:dict`）
 *   2. アクセント句の割れ方が変    → **本スクリプトの `yomi`**（AquesTalk風記法）
 *   3. 全体の抑揚が平坦／過剰      → **TUNING**（intonationScale 等）
 *
 * ■ AquesTalk風記法の規則（2026-08-22 に実験して確定）
 *
 *   | 記号 | 意味 |
 *   |---|---|
 *   | `'`  | アクセント核。**各アクセント句にちょうど1つ必要**（無いと400） |
 *   | `/`  | アクセント句の区切り |
 *   | `、` | 無音（ポーズ）を入れる |
 *   | `？` | 直前の句を疑問形にする（語尾が上がる） |
 *
 *   - **カタカナで書く。長音記号「ー」は使えない**（`ズ'ーット` は400。`ズ'ウット` と書く）
 *   - **平板型（核0）は記法では書けない。** 核を末尾に置くと尾高になる。
 *     どうしても平板にしたい場合は yomi を使わず、辞書側の accent_type で解く
 *
 * ■ `yomi` は「必要な行にだけ」書く
 *   素のテキストで正しく読める行に yomi を足すと、**かえって壊れる上に保守が増える。**
 *   `npm run voice:tune` の出力に読みのカナが出るので、**耳で変だった行だけ**直すこと。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ENGINE = 'http://127.0.0.1:50021';
const ROOT = resolve(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'work-assets', 'voice-tune');

/** 採用した声。`VOICEVOX:WhiteCUL` のクレジット表記が必須（docs/06_credits.md §2.2）。 */
const SPEAKER = 'WhiteCUL';
const STYLE = { tsun: 'ノーマル', dere: 'かなしい' } as const;

/**
 * 合成全体にかかる調整。1.0 が既定。
 * **数値を触ったら、必ず聴いて確かめること。** 数字だけで良し悪しは判断できない。
 */
const TUNING = {
  speedScale: 1.0,
  pitchScale: 0.0,
  /** 抑揚の強さ。上げるとメリハリが付くが、上げすぎると芝居がかる */
  intonationScale: 1.0,
  volumeScale: 1.0,
  prePhonemeLength: 0.1,
  postPhonemeLength: 0.1,
};

/**
 * `yomi` は**素のテキストでは読みが崩れる行にだけ**書く。
 * 各行の `problem` は、なぜ直したのかの記録。消さないこと。
 */
type Line = {
  id: string;
  label: string;
  mood: 'tsun' | 'dere';
  text: string;
  yomi?: string;
  problem?: string;
};

const LINES: Line[] = [
  {
    id: '1_butsukirabou',
    label: 'ぶっきらぼう（通常）',
    mood: 'tsun',
    text: '「で？　うまくいってないんでしょ、顔に出てる」',
    yomi: "デ'？/ウマクイッテナインデ'ショ、カオニ'/デテ'ル",
    problem: '「うまくいってないんでしょ」が ウマクイッテナイ ／ ンデショ に割れ、「ん」が浮いていた',
  },
  {
    id: '2_warai',
    label: '笑い・軽口',
    mood: 'tsun',
    text: '「いや笑うって。あんた大学のときからずーっと『別に今はいいや』って言ってたじゃん」',
    yomi: "イヤ'/ワラウッテ'、ア'ンタ/ダイガクノ'/ト'キカラ/ズ'ウット/ベツニ'/イ'マワ/イ'イヤッテ/イッテタ'ジャン",
    problem: '「あんた大学の」が1句に融合して アンタダ↑イガクノ になっていた。「ずーっと」の核も末尾で不自然',
  },
  {
    id: '3_jogen',
    label: '助言（落ち着き）',
    mood: 'tsun',
    text: '「間違ってると思ったら、ちゃんと言ってあげな。合わせるのがいちばん失礼」',
    // 素のままで問題なかったので yomi は書かない
  },
  {
    id: '4_dere',
    label: 'デレ（照れ）',
    mood: 'dere',
    text: '「全部、私が好きなところなんだけど」',
    yomi: "ゼ'ンブ、ワタシガ'/スキ'ナ/トコロナンダケド'",
    problem: '「ところなんだけど」が トコロナ ／ ンダケド に割れ、また「ん」が浮いていた',
  },
  {
    id: '5_yoin',
    label: '静かな余韻',
    mood: 'dere',
    text: '「二十四年かかったんだよ。こっちは」',
    yomi: "ニジュウヨ'ネン/カカッタンダ'ヨ、コッチ'ワ",
    problem: '**「二十四年」が ニジュウ ／ ヨネン に割れていた。** デレの決めゼリフなので最優先で修正',
  },
];

/** YAMLの本文をそのまま渡すと読みが崩れる箇所だけを直す（yomi が無い行に適用）。 */
function normalize(text: string): string {
  return text
    .replace(/[「」『』]/g, '')
    .replace(/…+/g, '、')
    .replace(/　/g, '、')
    .replace(/^、+/, '')
    .trim();
}

type Mora = { text: string };
type AccentPhrase = { moras: Mora[]; accent: number; is_interrogative?: boolean; pause_mora?: unknown };
type Query = { accent_phrases: AccentPhrase[] } & Record<string, unknown>;

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${ENGINE}${path}`, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}\n${await res.text()}`);
  return res;
}

/** 読みを人が読める形にする。「どこで句が割れているか」が見えることが大事。 */
function describe(phrases: AccentPhrase[]): string {
  return phrases
    .map((ap) => {
      const kana = ap.moras.map((m) => m.text).join('');
      return `${kana}[${ap.accent}]${ap.is_interrogative ? '?' : ''}`;
    })
    .join(' / ');
}

try {
  await api('/version');
} catch {
  console.error(`✗ VOICEVOX ENGINE に繋がらない（${ENGINE}）`);
  console.error('  & "$env:LOCALAPPDATA\\Programs\\voicevox_engine\\run.exe" --host 127.0.0.1 --port 50021');
  process.exit(1);
}

const speakers: { name: string; styles: { name: string; id: number }[] }[] = await (
  await api('/speakers')
).json();
const white = speakers.find((s) => s.name === SPEAKER);
if (!white) throw new Error(`${SPEAKER} が見つからない`);

const styleId = (mood: 'tsun' | 'dere'): number => {
  const want = STYLE[mood];
  const s = white.styles.find((x) => x.name === want);
  if (!s) throw new Error(`${SPEAKER} に「${want}」スタイルが無い`);
  return s.id;
};

/** 素のテキストから作る（＝修正前）。 */
async function queryPlain(text: string, id: number): Promise<Query> {
  return (await (await api(`/audio_query?text=${encodeURIComponent(text)}&speaker=${id}`, { method: 'POST' })).json()) as Query;
}

/**
 * yomi（AquesTalk風記法）から作る（＝修正後）。
 * 全体のパラメータは素のクエリから引き継ぎ、**アクセント句だけ差し替える**。
 * こうしないと speedScale 等が既定値に戻ってしまう。
 */
async function queryYomi(text: string, yomi: string, id: number): Promise<Query> {
  const base = await queryPlain(text, id);
  const phrases = (await (
    await api(`/accent_phrases?text=${encodeURIComponent(yomi)}&speaker=${id}&is_kana=true`, { method: 'POST' })
  ).json()) as AccentPhrase[];
  return { ...base, accent_phrases: phrases };
}

async function synth(query: Query, id: number, dest: string): Promise<void> {
  const tuned = { ...query, ...TUNING };
  const wav = await (
    await api(`/synthesis?speaker=${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tuned),
    })
  ).arrayBuffer();
  writeFileSync(dest, Buffer.from(wav));
}

mkdirSync(join(OUT_DIR, 'before'), { recursive: true });
mkdirSync(join(OUT_DIR, 'after'), { recursive: true });

console.log(`${SPEAKER} のイントネーション調整（通常=${STYLE.tsun} / デレ=${STYLE.dere}）\n`);

const report: { line: Line; before: string; after: string | null }[] = [];

for (const line of LINES) {
  const id = styleId(line.mood);
  const plain = normalize(line.text);

  const qBefore = await queryPlain(plain, id);
  await synth(qBefore, id, join(OUT_DIR, 'before', `${line.id}.wav`));

  let after: string | null = null;
  if (line.yomi) {
    const qAfter = await queryYomi(plain, line.yomi, id);
    await synth(qAfter, id, join(OUT_DIR, 'after', `${line.id}.wav`));
    after = describe(qAfter.accent_phrases);
  }

  report.push({ line, before: describe(qBefore.accent_phrases), after });

  console.log(`■ ${line.label}${line.yomi ? '' : '（修正なし）'}`);
  console.log(`  修正前: ${describe(qBefore.accent_phrases)}`);
  if (after) console.log(`  修正後: ${after}`);
  console.log();
}

// ─── 聴き比べページ ───────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const sections = report
  .map(({ line, before, after }) => {
    const afterCell = after
      ? `<div class="col ok"><div class="tag">修正後</div>
           <audio controls preload="none" src="after/${line.id}.wav"></audio>
           <code>${esc(after)}</code></div>`
      : `<div class="col none"><div class="tag">修正不要</div>
           <p class="small">素のテキストで正しく読めていたので、yomi は書いていない。</p></div>`;

    return `<section>
      <h2>${esc(line.label)}<span class="style">${line.mood === 'dere' ? STYLE.dere : STYLE.tsun}</span></h2>
      <p class="line">${esc(line.text)}</p>
      ${line.problem ? `<p class="problem">${esc(line.problem)}</p>` : ''}
      <div class="ab">
        <div class="col"><div class="tag">修正前</div>
          <audio controls preload="none" src="before/${line.id}.wav"></audio>
          <code>${esc(before)}</code></div>
        ${afterCell}
      </div>
    </section>`;
  })
  .join('\n');

const page = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>茉白の声 — イントネーション修正</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: "Yu Gothic UI", system-ui, sans-serif; margin: 0 auto; padding: 2rem 1.5rem 5rem;
         max-width: 1000px; line-height: 1.7; }
  h1 { font-size: 1.5rem; margin: 0 0 .3rem; }
  .note { opacity: .8; font-size: .9rem; margin: 0 0 2.2rem; }
  section { margin: 0 0 2.2rem; }
  h2 { font-size: 1.05rem; margin: 0 0 .3rem; display: flex; align-items: baseline; gap: .6rem; }
  .style { font-size: .75rem; font-weight: 400; opacity: .55; }
  .line { margin: 0 0 .5rem; padding: .5rem .8rem; border-left: 3px solid #888;
          background: rgba(128,128,128,.1); font-size: .95rem; }
  .problem { margin: 0 0 .8rem; font-size: .85rem; color: #b3261e; }
  @media (prefers-color-scheme: dark) { .problem { color: #f2b8b5; } }
  .ab { display: grid; gap: .8rem; grid-template-columns: 1fr 1fr; }
  @media (max-width: 640px) { .ab { grid-template-columns: 1fr; } }
  .col { border: 1px solid rgba(128,128,128,.35); border-radius: 8px; padding: .6rem .7rem; }
  .col.ok { border-color: #1a7f4b; }
  .col.none { opacity: .6; }
  .tag { font-size: .75rem; font-weight: 700; margin-bottom: .25rem; }
  .col.ok .tag { color: #1a7f4b; }
  audio { width: 100%; margin: .2rem 0 .4rem; }
  code { display: block; font-size: .73rem; opacity: .8; word-break: break-all; line-height: 1.5; }
  .small { font-size: .8rem; margin: .3rem 0 0; }
</style></head><body>
<h1>茉白の声 — イントネーション修正</h1>
<p class="note">声は <strong>VOICEVOX:WhiteCUL</strong>（通常=ノーマル／デレ=かなしい）。<br>
<code style="display:inline">カナ[数字]</code> はアクセント句と核の位置。<strong>「/」で区切られた塊が1つの句</strong>で、
ここが不自然に割れる・融合するのが「イントネーションがおかしい」の正体。<br>
固有名詞（茉白・翠・橙香・紫音ほか）は <code style="display:inline">npm run voice:dict</code> で別途修正済み。</p>
${sections}
</body></html>`;

writeFileSync(join(OUT_DIR, 'index.html'), page, 'utf8');

console.log('▶ 聴き比べ: work-assets/voice-tune/index.html をブラウザで開く');
console.log('  まだ変な行があれば教えてください。その行に yomi を足します。');
