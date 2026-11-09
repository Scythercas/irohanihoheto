/**
 * 茉白の声を決めるための試聴用ボイス生成。
 *
 *   npm run voice:audition
 *
 * VOICEVOX ENGINE（http://127.0.0.1:50021）に喋らせ、候補キャラ × 試聴セリフ
 * の総当たりで WAV を書き出す。出力は work-assets/（.gitignore 済み）。
 *
 * ■ なぜ「ライセンスを先に出す」のか
 *   立ち絵で `allowCommercialUse` を見落とし、7枚作ったあとに作り直しになった
 *   （docs/06_credits.md §4）。同じ轍を踏まないため、このスクリプトは
 *   **音を出す前に各キャラの利用規約（/speaker_info の policy）を採取して表示する。**
 *   声は「規約が通ったものの中から」選ぶ。順序を逆にしない。
 *
 * ■ なぜ通常とデレでスタイルを分けるのか
 *   茉白はツンデレ（docs/01_game-design.md §2.2）。**通常が良くてもデレが破綻すると使えない。**
 *   実際のゲームでも場面ごとにスタイルを変えて使うので、試聴も同じ条件で行う。
 *
 * ■ エンジンの起動
 *   & "$env:LOCALAPPDATA\Programs\voicevox_engine\run.exe" --host 127.0.0.1 --port 50021
 *
 * 候補を足したいときは CANDIDATES に1行足すだけでよい。
 * 声が決まったら、このスクリプトは役目を終える（本生成は別スクリプトに分ける）。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ENGINE = 'http://127.0.0.1:50021';
const ROOT = resolve(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'work-assets', 'voice-audition');

/**
 * 茉白は24歳・事務職・ツンデレ。口が悪く、素直に褒めない（docs/01_game-design.md §2.2）。
 * **幼く高い声は合わない**ので、ずんだもん・四国めたん・櫻歌ミコ等は最初から外している。
 *
 * `tsun` … 通常時（口が悪い）に使うスタイル
 * `dere` … デレ・余韻に使うスタイル。省略時は tsun と同じ
 */
/**
 * `commercial` は 2026-08-22 に /speaker_info の policy 全文を読んで記録した実測値。
 *   ok  … クレジット記載だけで商用・非商用ともに可
 *   ask … 商用は個別の問い合わせが必要
 *   nc  … 非商用のみ（商用は事前確認が必要）
 * **`ok` 以外は、収益化の可能性を残す方針（CLAUDE.md §4.6）と噛み合わない。**
 */
type Candidate = {
  speaker: string;
  tsun: string;
  dere?: string;
  why: string;
  commercial: 'ok' | 'ask' | 'nc';
};

const CANDIDATES: Candidate[] = [
  { speaker: '夜語トバリ', tsun: '呆れ', dere: '哀しみ', commercial: 'ok', why: '「呆れ」が茉白の地の態度そのもの。第一候補' },
  { speaker: '九州そら', tsun: 'ツンツン', dere: 'ノーマル', commercial: 'ok', why: 'ツンデレ用スタイルが公式にある。大人寄りの声' },
  { speaker: 'あんこもん', tsun: 'けだるげ', dere: 'ノーマル', commercial: 'ok', why: '気だるげな軽口。幼馴染の気安さが出せるか' },
  { speaker: '波音リツ', tsun: 'ノーマル', dere: 'クイーン', commercial: 'ok', why: '低くクール。「あんた」呼びとの相性' },
  { speaker: 'WhiteCUL', tsun: 'ノーマル', dere: 'かなしい', commercial: 'ok', why: '素直な発話。デレ側の振れ幅が広い' },
  { speaker: '冥鳴ひまり', tsun: 'ノーマル', commercial: 'ok', why: '低めで静か。終盤の余韻向き' },
  { speaker: 'ぞん子', tsun: '低血圧', dere: 'ノーマル', commercial: 'ask', why: '平坦なぶっきらぼうさ。ただし商用は要問い合わせ' },
  { speaker: 'No.7', tsun: 'ノーマル', dere: '読み聞かせ', commercial: 'nc', why: '落ち着いた大人の女性。ただし非商用のみ' },
];

/**
 * 試聴セリフ。すべて実際のシナリオからの引用（prologue / carat / endings）。
 * **茉白の振れ幅をひととおり通す**ように選んである。
 * ここが偏ると「通常は良いのにデレが致命的」という事故を後で踏む。
 */
const LINES: { id: string; label: string; mood: 'tsun' | 'dere'; text: string }[] = [
  { id: '1_butsukirabou', label: 'ぶっきらぼう（通常）', mood: 'tsun', text: '「で？　うまくいってないんでしょ、顔に出てる」' },
  { id: '2_warai', label: '笑い・軽口', mood: 'tsun', text: '「いや笑うって。あんた大学のときからずーっと『別に今はいいや』って言ってたじゃん」' },
  { id: '3_jogen', label: '助言（落ち着き）', mood: 'tsun', text: '「間違ってると思ったら、ちゃんと言ってあげな。合わせるのがいちばん失礼」' },
  { id: '4_dere', label: 'デレ（照れ）', mood: 'dere', text: '「全部、私が好きなところなんだけど」' },
  { id: '5_yoin', label: '静かな余韻', mood: 'dere', text: '「二十四年かかったんだよ。こっちは」' },
];

/**
 * YAMLのセリフをそのまま渡すと読みが崩れる箇所だけを直す。
 * - 「」『』… 読まれないが、稀に妙な間になるので落とす
 * - 全角スペース … 本作では「間」として使っている。読点にすると無音の間になる
 * - ……      … そのままだと無視されることがあるため読点に寄せる
 */
function normalize(text: string): string {
  return text
    .replace(/[「」『』]/g, '')
    .replace(/…+/g, '、')
    .replace(/　/g, '、')
    .replace(/^、+/, '')
    .trim();
}

/** 出力フォルダ名。生成側と聴き比べページ側で必ず同じ名前を使うため関数にしてある。 */
function folderOf(c: Candidate): string {
  const label = c.dere && c.dere !== c.tsun ? `${c.tsun}-${c.dere}` : c.tsun;
  return `${c.speaker}_${label}`;
}

type Style = { name: string; id: number };
type Speaker = { name: string; speaker_uuid: string; styles: Style[] };

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${ENGINE}${path}`, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}\n${await res.text()}`);
  return res;
}

// ─── 1. エンジンの確認 ────────────────────────────────────────────────
let version: string;
try {
  version = await (await api('/version')).text();
} catch {
  console.error(`✗ VOICEVOX ENGINE に繋がらない（${ENGINE}）`);
  console.error('  先に起動すること:');
  console.error('  & "$env:LOCALAPPDATA\\Programs\\voicevox_engine\\run.exe" --host 127.0.0.1 --port 50021');
  process.exit(1);
}
console.log(`VOICEVOX ENGINE ${version.replaceAll('"', '')} に接続`);

const speakers: Speaker[] = await (await api('/speakers')).json();

// ─── 2. 【先に】ライセンスを採取する ──────────────────────────────────
console.log('\n=== 利用規約の採取（音を作る前に必ず読むこと）===');
mkdirSync(OUT_DIR, { recursive: true });

const policies: string[] = [];

for (const cand of CANDIDATES) {
  const found = speakers.find((s) => s.name === cand.speaker);
  if (!found) {
    console.error(`  ✗ ${cand.speaker} … このエンジンに存在しない`);
    continue;
  }
  const info = await (await api(`/speaker_info?speaker_uuid=${found.speaker_uuid}`)).json();
  const policy: string = info.policy ?? '(policy なし)';
  policies.push(`\n${'='.repeat(70)}\n■ ${cand.speaker}\n${'='.repeat(70)}\n${policy}`);

  // 商用の可否は規約本文にしか書かれていない。全文はファイルに落とし、ここでは目印だけ出す。
  const ng = /(商用利用|商用)[^。\n]{0,30}(不可|禁止|できません|お断り)/.test(policy);
  console.log(`  ${cand.speaker.padEnd(8, '　')} ${ng ? '✗ 商用に制限の記述あり' : '— 全文を要確認'}  (${policy.length}字)`);
}

writeFileSync(join(OUT_DIR, '_利用規約.txt'), policies.join('\n'), 'utf8');
console.log('\n  規約の全文 → work-assets/voice-audition/_利用規約.txt');
console.log('  ※ 上の判定は目安にすぎない。**採用する1キャラは全文を読むこと。**');

// ─── 3. 試聴用の音声を作る ────────────────────────────────────────────
console.log('\n=== 試聴ボイスの生成 ===');
let made = 0;
let failed = 0;

for (const cand of CANDIDATES) {
  const speaker = speakers.find((s) => s.name === cand.speaker);
  if (!speaker) {
    failed += LINES.length;
    continue;
  }

  const styleId = (mood: 'tsun' | 'dere'): number | undefined => {
    const wanted = mood === 'dere' ? (cand.dere ?? cand.tsun) : cand.tsun;
    return speaker.styles.find((s) => s.name === wanted)?.id;
  };

  const label = cand.dere && cand.dere !== cand.tsun ? `${cand.tsun}→${cand.dere}` : cand.tsun;
  const dir = join(OUT_DIR, folderOf(cand));
  mkdirSync(dir, { recursive: true });

  for (const line of LINES) {
    const id = styleId(line.mood);
    if (id === undefined) {
      console.error(`  ✗ ${cand.speaker} … スタイルが見つからない（${line.mood}）`);
      failed += 1;
      continue;
    }
    try {
      const query = await (
        await api(`/audio_query?text=${encodeURIComponent(normalize(line.text))}&speaker=${id}`, { method: 'POST' })
      ).json();

      const wav = await (
        await api(`/synthesis?speaker=${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(query),
        })
      ).arrayBuffer();

      writeFileSync(join(dir, `${line.id}.wav`), Buffer.from(wav));
      made += 1;
    } catch (e) {
      console.error(`  ✗ ${cand.speaker} ${line.label}  ${e instanceof Error ? e.message : e}`);
      failed += 1;
    }
  }
  console.log(`  ✓ ${cand.speaker.padEnd(8, '　')}（${label}）… ${LINES.length}本  ${cand.why}`);
}

// ─── 4. 聴き比べページを書き出す ──────────────────────────────────────
// 8人 × 5本をエクスプローラで比べるのは現実的でない。
// **同じセリフを縦に並べて連続再生できる**ページを作る。ここが選定の速さを決める。
writeFileSync(join(OUT_DIR, 'index.html'), buildPage(), 'utf8');

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildPage(): string {
  const BADGE = {
    ok: ['商用OK', '#1a7f4b'],
    ask: ['商用は要問い合わせ', '#a86b00'],
    nc: ['非商用のみ', '#b3261e'],
  } as const;

  const rows = LINES.map((line) => {
    const players = CANDIDATES.map((c) => {
      const [text, color] = BADGE[c.commercial];
      const style = line.mood === 'dere' ? (c.dere ?? c.tsun) : c.tsun;
      return `<div class="cell${c.commercial === 'ok' ? '' : ' dim'}">
        <div class="who">${esc(c.speaker)}<span class="style">${esc(style)}</span></div>
        <audio controls preload="none" src="${encodeURI(`${folderOf(c)}/${line.id}.wav`)}"></audio>
        <div class="badge" style="color:${color}">${text}</div>
      </div>`;
    }).join('\n');

    return `<section>
      <h2>${esc(line.label)}<span class="mood">${line.mood === 'dere' ? 'デレ側のスタイル' : '通常のスタイル'}</span></h2>
      <p class="line">${esc(line.text)}</p>
      <div class="grid">${players}</div>
    </section>`;
  }).join('\n');

  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>茉白の声 — 聴き比べ</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: "Yu Gothic UI", system-ui, sans-serif; margin: 0 auto; padding: 2rem 1.5rem 5rem;
         max-width: 1100px; line-height: 1.7; }
  h1 { font-size: 1.5rem; margin: 0 0 .3rem; }
  .note { opacity: .75; font-size: .9rem; margin: 0 0 2rem; }
  section { margin: 0 0 2.5rem; }
  h2 { font-size: 1.05rem; margin: 0 0 .2rem; display: flex; align-items: baseline; gap: .6rem; }
  .mood { font-size: .75rem; font-weight: 400; opacity: .6; }
  .line { margin: 0 0 .9rem; padding: .5rem .8rem; border-left: 3px solid #888;
          background: rgba(128,128,128,.1); font-size: .95rem; }
  .grid { display: grid; gap: .8rem; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); }
  .cell { border: 1px solid rgba(128,128,128,.35); border-radius: 8px; padding: .6rem .7rem; }
  .cell.dim { opacity: .45; }
  .who { font-weight: 600; font-size: .9rem; display: flex; justify-content: space-between; gap: .5rem; }
  .style { font-weight: 400; opacity: .6; font-size: .8rem; }
  audio { width: 100%; margin: .4rem 0 .3rem; }
  .badge { font-size: .72rem; font-weight: 600; }
</style></head><body>
<h1>茉白の声 — 聴き比べ</h1>
<p class="note">VOICEVOX ENGINE 0.25.2 で生成。セリフはすべて実際のシナリオからの引用。<br>
<strong>薄く表示されているものは規約上おすすめしない</strong>（収益化の可能性を残す方針＝CLAUDE.md §4.6 と噛み合わないため）。<br>
比べ方: まず「ぶっきらぼう」で候補を絞り、残ったものを「デレ」で確認する。<strong>通常が良くてもデレが破綻すると使えない。</strong></p>
${rows}
</body></html>`;
}

console.log(`\n生成 ${made} / 失敗 ${failed}`);
console.log('保存先: work-assets/voice-audition/（.gitignore 済み）');
console.log('\n▶ 聴き比べページ: work-assets/voice-audition/index.html をブラウザで開く');
console.log('  比べ方: 「ぶっきらぼう」で絞る → 残りを「デレ」で確認');
console.log('  茉白は「通常が良くてもデレが破綻する」と使えない。**両方通ったものだけ残す。**');

if (failed > 0) process.exit(1);
