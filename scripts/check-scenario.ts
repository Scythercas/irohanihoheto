/**
 * シナリオYAMLの検証CLI。
 *
 *   npm run check:scenario
 *
 * 執筆中にこれを走らせれば、ブラウザを開かなくても
 * 「YAMLの書式ミス」「未定義キャラ」「リンク切れ」を検出できる。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { buildScenes } from '../src/game/scenario/build';

const ROOT = resolve(import.meta.dirname, '..');
const SCENARIO_DIR = join(ROOT, 'src', 'scenario');

function collectYaml(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectYaml(full));
    else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) out.push(full);
  }
  return out;
}

const paths = collectYaml(SCENARIO_DIR);
const files = Object.fromEntries(
  paths.map((p) => [relative(ROOT, p).replace(/\\/g, '/'), readFileSync(p, 'utf8')]),
);

try {
  const scenes = buildScenes(files);

  let sayCount = 0;
  let chatCount = 0;
  let choiceCount = 0;
  let charCount = 0;
  for (const scene of scenes.values()) {
    for (const node of scene.body) {
      if (node.kind === 'say') {
        sayCount += 1;
        charCount += node.text.length;
      }
      if (node.kind === 'chat') {
        chatCount += 1;
        charCount += node.text.length;
      }
      if (node.kind === 'choice' || node.kind === 'reply') {
        choiceCount += 1;
        for (const o of node.options) charCount += o.text.length;
      }
    }
  }

  console.log(`✓ シナリオ検証OK`);
  console.log(`  ファイル数     : ${paths.length}`);
  console.log(`  シーン数       : ${scenes.size}`);
  console.log(`  テキスト行     : ${sayCount}`);
  console.log(`  チャット発言   : ${chatCount}`);
  console.log(`  選択肢／返信   : ${choiceCount}`);
  console.log(`  総文字数       : ${charCount.toLocaleString('ja-JP')}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
