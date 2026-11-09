/**
 * VOICEVOX のユーザー辞書に、本作の固有名詞を登録する。
 *
 *   npm run voice:dict
 *
 * ■ なぜ必要か（実測。2026-08-22）
 *   本作は登場人物の名前がすべて「色」の漢字なので、VOICEVOX は素直に読めない。
 *
 *     茉白   → （無音。読めずに消える）
 *     翠     → ミドリ
 *     橙香   → ダイダイガ
 *     紫音   → ムラサキオン
 *     色葉くん → イロバクン（濁る）
 *     カラット → カ／ラット（2句に割れる）
 *
 *   **登録しないまま本生成すると、全編にわたって名前を間違えて呼ぶ。**
 *
 * ■ 辞書はエンジン側に保存される（リポジトリには入らない）
 *   つまり **環境を作り直すたびに流し直す必要がある**。だからスクリプトにしてある。
 *   何度流しても同じ状態になる（surface が同じものは消してから入れ直す）。
 *
 * ■ priority について【重要】
 *   既定の priority=5 では **システム辞書に負ける**。実際 `翠` は 5 では
 *   ミドリのままだった。**固有名詞は priority=10 で登録すること。**
 *
 * 読みの正は `src/game/constants.ts` の CHARACTERS.kana。ここには重複して書かない。
 */

import { CHARACTERS } from '../src/game/constants';

const ENGINE = 'http://127.0.0.1:50021';

/**
 * アクセント核の位置（モーラ数え、0 = 平板）。
 * kana からは決められないので、ここだけは人が決める。
 * 迷ったら 0（平板）にしておくと日本語の人名としては無難。
 */
const ACCENT: Record<string, number> = {
  色葉: 0,
  茉白: 0,
  葵: 0,
  翠: 1,
  橙香: 1,
  紫音: 1,
  桃果: 1,
};

/** 人名以外で誤読・分割される語。 */
const EXTRA: { surface: string; pronunciation: string; accent: number }[] = [
  { surface: 'カラット', pronunciation: 'カラット', accent: 1 },
];

const KATAKANA = (kana: string): string =>
  kana.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

type Word = { surface: string; pronunciation: string; accent: number };

const WORDS: Word[] = [
  ...Object.values(CHARACTERS).map((c) => ({
    surface: c.name,
    pronunciation: KATAKANA(c.kana),
    accent: ACCENT[c.name] ?? 0,
  })),
  ...EXTRA,
];

async function api(path: string, method: 'GET' | 'POST' | 'DELETE' = 'GET'): Promise<unknown> {
  const res = await fetch(`${ENGINE}${path}`, { method });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}\n${await res.text()}`);
  const body = await res.text();
  return body.trim() ? JSON.parse(body) : null;
}

try {
  await api('/version');
} catch {
  console.error(`✗ VOICEVOX ENGINE に繋がらない（${ENGINE}）`);
  console.error('  先に起動すること:');
  console.error('  & "$env:LOCALAPPDATA\\Programs\\voicevox_engine\\run.exe" --host 127.0.0.1 --port 50021');
  process.exit(1);
}

// 何度流しても同じ状態になるよう、同じ surface の既存エントリを先に消す。
const current = (await api('/user_dict')) as Record<string, { surface: string }>;
const targets = new Set(WORDS.map((w) => w.surface));
let removed = 0;
for (const [uuid, w] of Object.entries(current ?? {})) {
  if (targets.has(w.surface)) {
    await api(`/user_dict_word/${uuid}`, 'DELETE');
    removed += 1;
  }
}
if (removed > 0) console.log(`既存エントリを ${removed} 件消して入れ直します`);

console.log('ユーザー辞書に登録します（priority=10。既定の5ではシステム辞書に負ける）');
for (const w of WORDS) {
  const q = new URLSearchParams({
    surface: w.surface,
    pronunciation: w.pronunciation,
    accent_type: String(w.accent),
    word_type: 'PROPER_NOUN',
    priority: '10',
  });
  await api(`/user_dict_word?${q}`, 'POST');
  console.log(`  ✓ ${w.surface.padEnd(6, '　')} → ${w.pronunciation}（核${w.accent}）`);
}

// 登録しただけでは安心できない。**実際に読ませて確かめる。**
console.log('\n=== 読み上げて確認 ===');
let ng = 0;
for (const w of WORDS) {
  for (const suffix of ['', 'さん', 'くん', 'は']) {
    const text = `${w.surface}${suffix}`;
    const query = (await api(`/audio_query?text=${encodeURIComponent(text)}&speaker=23`, 'POST')) as {
      accent_phrases: { moras: { text: string }[] }[];
    };
    const kana = query.accent_phrases.map((ap) => ap.moras.map((m) => m.text).join('')).join('');
    if (!kana.startsWith(w.pronunciation)) {
      console.error(`  ✗ ${text} → ${kana}（${w.pronunciation} で始まるはず）`);
      ng += 1;
    }
  }
}
console.log(ng === 0 ? '  ✓ すべて期待どおりに読めている' : `  ✗ ${ng}件が期待と違う`);
console.log('\n辞書はエンジン側に保存される。**環境を作り直したらこのコマンドを流し直すこと。**');

if (ng > 0) process.exit(1);
