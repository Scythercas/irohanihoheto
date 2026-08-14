/**
 * 全ルート走破のスモークテスト。
 *
 *   npm run smoke
 *
 * ブラウザを開かずに、シナリオを実際に「最後まで再生」して壊れを検出する。
 * 選択肢は全分岐を総当たりするため、到達不能なシーンや走査の無限ループも見つかる。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { OPENING_SCENE_ID } from '../src/game/flow';
import { PARAM_LABEL, PARAM_ORDER } from '../src/game/constants';
import {
  applyAffection,
  applyDelta,
  enterScene,
  newCursor,
  step,
  type Cursor,
} from '../src/game/engine';
import { buildScenes } from '../src/game/scenario/build';
import type { Scene } from '../src/game/types';

const ROOT = resolve(import.meta.dirname, '..');

function collectYaml(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectYaml(full));
    else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) out.push(full);
  }
  return out;
}

const paths = collectYaml(join(ROOT, 'src', 'scenario'));
const scenes: Map<string, Scene> = buildScenes(
  Object.fromEntries(paths.map((p) => [relative(ROOT, p).replace(/\\/g, '/'), readFileSync(p, 'utf8')])),
);

const lookup = (id: string): Scene => {
  const scene = scenes.get(id);
  if (!scene) throw new Error(`シーン "${id}" が見つかりません`);
  return scene;
};

const clone = (c: Cursor): Cursor => ({
  ...c,
  params: { ...c.params },
  affection: { ...c.affection },
  flags: { ...c.flags },
});

const visited = new Set<string>();
const endings: { path: string[]; params: Record<string, number> }[] = [];
let runs = 0;

/** 選択肢を全通り試しながら、物語を終端まで再生する */
function play(cursor: Cursor, trail: string[]): void {
  if (runs > 500) throw new Error('分岐が多すぎます。走査を打ち切りました。');

  for (;;) {
    visited.add(cursor.sceneId);
    const node = step(cursor, lookup);

    if (node === null) {
      runs += 1;
      endings.push({ path: [...trail], params: { ...cursor.params } });
      return;
    }

    if (node.kind === 'choice') {
      node.options.forEach((option, i) => {
        const branch = clone(cursor);
        if (option.params) applyDelta(branch.params, option.params);
        if (option.affection) applyAffection(branch.affection, option.affection);
        if (option.goto) enterScene(branch, lookup(option.goto));
        play(branch, [...trail, `${cursor.sceneId}#${i}:${option.text.slice(0, 14)}`]);
      });
      return;
    }
  }
}

try {
  const start = newCursor(OPENING_SCENE_ID);
  enterScene(start, lookup(OPENING_SCENE_ID));
  play(start, []);

  const unreachable = [...scenes.keys()].filter((id) => !visited.has(id));

  console.log('✓ 全分岐の走破OK');
  console.log(`  到達したエンド : ${endings.length}`);
  console.log(`  到達シーン     : ${visited.size} / ${scenes.size}`);

  for (const [i, ending] of endings.entries()) {
    const summary = PARAM_ORDER.map((k) => `${PARAM_LABEL[k]}:${ending.params[k]}`).join(' ');
    console.log(`  [${i + 1}] ${summary}`);
    if (ending.path.length) console.log(`      経路 → ${ending.path.join(' / ')}`);
  }

  if (unreachable.length) {
    console.warn(`\n⚠ 到達できないシーンがあります: ${unreachable.join(', ')}`);
    process.exit(1);
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
