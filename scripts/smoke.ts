/**
 * 全ルート走破のスモークテスト。
 *
 *   npm run smoke
 *
 * ブラウザを開かずに、シナリオを実際に「最後まで再生」して壊れを検出する。
 * 選択肢は全分岐を総当たりするため、到達不能なシーンや走査の無限ループも見つかる。
 *
 * スケジュール画面は「誰と会うか」で12週ぶんの組み合わせが爆発するため、
 * そこで一旦打ち切り、スケジュールから呼ばれるシーンは別途それぞれを起点に再生する。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { OPENING_SCENE_ID } from '../src/game/flow';
import { PARAM_LABEL, PARAM_ORDER } from '../src/game/constants';
import {
  applyAffection,
  applyDelta,
  cloneCursor,
  enterScene,
  newCursor,
  pushChat,
  step,
  type Cursor,
} from '../src/game/engine';
import { buildScenes } from '../src/game/scenario/build';
import { AKANE_SCENES, DATE_SCENES, FILLER_SCENE, FINALE_SCENE } from '../src/game/schedule';
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

const visited = new Set<string>();
const endings: { path: string[]; params: Record<string, number>; stop: string }[] = [];
let runs = 0;

/** 選択肢を全通り試しながら、終端またはスケジュール画面まで再生する */
function play(cursor: Cursor, trail: string[]): void {
  runs += 1;
  if (runs > 2000) throw new Error('分岐が多すぎます。走査を打ち切りました。');

  for (;;) {
    visited.add(cursor.sceneId);
    const node = step(cursor, lookup);
    // step() はシーンを跨ぐことがあるので、移動後のシーンも到達済みにする
    visited.add(cursor.sceneId);

    if (node === null) {
      endings.push({ path: [...trail], params: { ...cursor.params }, stop: '終端' });
      return;
    }

    // スケジュールは選択の組み合わせが爆発するのでここで打ち切る
    if (node.kind === 'schedule') {
      endings.push({ path: [...trail], params: { ...cursor.params }, stop: 'スケジュール' });
      return;
    }

    if (node.kind === 'choice' || node.kind === 'reply') {
      const sceneAtChoice = cursor.sceneId;
      node.options.forEach((option, i) => {
        const branch = cloneCursor(cursor);
        if (node.kind === 'reply') pushChat(branch, 'iroha', option.text);
        if (option.params) applyDelta(branch.params, option.params);
        if (option.affection) applyAffection(branch.affection, option.affection);
        if (option.goto) enterScene(branch, lookup(option.goto));
        play(branch, [...trail, `${sceneAtChoice}#${i}「${option.text.slice(0, 12)}」`]);
      });
      return;
    }
  }
}

function playFrom(sceneId: string, trail: string[]): void {
  const cursor = newCursor(sceneId);
  enterScene(cursor, lookup(sceneId));
  play(cursor, trail);
}

try {
  playFrom(OPENING_SCENE_ID, []);

  // スケジュールから呼ばれるシーンは、それぞれを起点に再生して到達性を担保する
  const scheduleRoots = [
    ...Object.values(DATE_SCENES).flat(),
    ...AKANE_SCENES,
    FILLER_SCENE,
    FINALE_SCENE,
  ];
  for (const root of scheduleRoots) playFrom(root, [`(スケジュール経由) ${root}`]);

  // branch の行き先は条件次第で通らないため、それぞれ単独でも再生して壊れを検出する
  const branchRoots = new Set<string>();
  for (const scene of scenes.values()) {
    for (const node of scene.body) {
      if (node.kind === 'branch') for (const c of node.cases) branchRoots.add(c.goto);
    }
  }
  for (const root of branchRoots) {
    if (!visited.has(root)) playFrom(root, [`(条件分岐) ${root}`]);
  }

  // --- 茜のデレ段階のゲート検証 ---------------------------------------------
  // 「2人目と知り合い、かつ魅力レベルが一定に達するまで茜は揺れない」を実際に評価して確かめる。
  const gateChecks: { label: string; flags: Record<string, boolean>; total: number; expect: string }[] = [
    { label: '1人目のみ・魅力最大', flags: { met_momoka: true }, total: 999, expect: 'akane_talk_plain' },
    { label: '2人目まで・魅力不足', flags: { met_momoka: true, met_aoi: true }, total: 20, expect: 'akane_talk_plain' },
    { label: '2人目まで・魅力到達', flags: { met_momoka: true, met_aoi: true }, total: 60, expect: 'akane_dere_01' },
  ];

  const gateFailures: string[] = [];
  for (const check of gateChecks) {
    const cursor = newCursor('akane_talk_01');
    cursor.flags = { ...check.flags };
    // 総合値を1色に寄せて与える（条件は合計値で判定される）
    cursor.params.sincerity = check.total;
    enterScene(cursor, lookup('akane_talk_01'));
    step(cursor, lookup);
    if (cursor.sceneId !== check.expect) {
      gateFailures.push(`  ✗ ${check.label} → ${cursor.sceneId}（期待: ${check.expect}）`);
    } else {
      console.log(`  ✓ 茜ゲート: ${check.label} → ${cursor.sceneId}`);
    }
  }

  const unreachable = [...scenes.keys()].filter((id) => !visited.has(id));

  console.log('✓ 全分岐の走破OK');
  console.log(`  再生した経路 : ${endings.length}`);
  console.log(`  到達シーン   : ${visited.size} / ${scenes.size}`);

  const mainRoutes = endings.filter((e) => !e.path[0]?.startsWith('(スケジュール経由)'));
  console.log(`\n  [本編ルート ${mainRoutes.length}件]`);
  for (const [i, ending] of mainRoutes.entries()) {
    const summary = PARAM_ORDER.map((k) => `${PARAM_LABEL[k]}:${ending.params[k]}`).join(' ');
    console.log(`  ${i + 1}. ${summary}  → ${ending.stop}`);
    if (ending.path.length) console.log(`     ${ending.path.join(' / ')}`);
  }

  if (gateFailures.length) {
    console.error('\n✗ 茜のデレ段階のゲートが想定どおりに働いていません');
    for (const line of gateFailures) console.error(line);
    process.exit(1);
  }

  if (unreachable.length) {
    console.warn(`\n⚠ 到達できないシーンがあります: ${unreachable.join(', ')}`);
    process.exit(1);
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
