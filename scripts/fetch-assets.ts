/**
 * 背景素材のダウンロード。
 *
 *   npm run fetch:assets
 *
 * 素材は「みんちりえ」（https://min-chi.material.jp/）から取得する。
 *   商用利用OK / 加工OK / クレジット任意 / **素材としての再配布は禁止**
 *
 * 再配布禁止の規約に配慮し、ダウンロードしたファイルは公開リポジトリに含めない
 * （public/assets/bg/ は .gitignore 済み）。各自このコマンドで取得する。
 *
 * 取得先は BACKGROUNDS（src/game/backgrounds.ts）が唯一の正。
 * 背景を増やすときはそちらに1行足してから、このコマンドを流す。
 */

import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { join, resolve } from 'node:path';
import { BACKGROUNDS, sourceUrl, type BackgroundDef } from '../src/game/backgrounds';

const ROOT = resolve(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'assets', 'bg');

const SITE_LABEL = {
  minchirie: 'みんちりえ',
  'game-materials': 'ゲームまてりあるず',
} as const;

async function download(def: BackgroundDef): Promise<'downloaded' | 'skipped' | 'failed'> {
  const dest = join(OUT_DIR, def.file);
  if (existsSync(dest) && statSync(dest).size > 0) return 'skipped';

  const url = sourceUrl(def.source);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    console.error(`  ✗ ${def.file}  (HTTP ${response.status})  ${url}`);
    return 'failed';
  }

  await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(dest));
  const kb = Math.round(statSync(dest).size / 1024);
  console.log(`  ✓ ${def.file}  ${kb}KB  ← ${SITE_LABEL[def.source.site]}`);
  return 'downloaded';
}

mkdirSync(OUT_DIR, { recursive: true });

console.log('背景素材を取得します');
console.log('  出典: みんちりえ https://min-chi.material.jp/ ／ ゲームまてりあるず https://game-materials.com/');

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const def of BACKGROUNDS) {
  try {
    const result = await download(def);
    if (result === 'downloaded') downloaded += 1;
    else if (result === 'skipped') skipped += 1;
    else failed += 1;
  } catch (e) {
    console.error(`  ✗ ${def.file}  ${e instanceof Error ? e.message : e}`);
    failed += 1;
  }
}

console.log(`\n取得 ${downloaded} / 既存 ${skipped} / 失敗 ${failed}`);
console.log('保存先: public/assets/bg/（.gitignore 済み。再配布禁止のため公開リポジトリには含めない）');

if (failed > 0) process.exit(1);
