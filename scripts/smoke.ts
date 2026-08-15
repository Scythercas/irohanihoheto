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
import { PARAM_LABEL, PARAM_ORDER, THRESHOLD } from '../src/game/constants';
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
import {
  AKANE_SCENES,
  DATE_SCENES,
  EXTRA_DATE_SCENES,
  FILLER_SCENE,
  FINALE_SCENE,
} from '../src/game/schedule';
import type { ParamKey, Scene } from '../src/game/types';

/** 5色すべてに同じ値を入れた組を作る（エンディング判定の検証用） */
const fill = (value: number): Record<ParamKey, number> =>
  Object.fromEntries(PARAM_ORDER.map((key) => [key, value])) as Record<ParamKey, number>;

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

const visited = new Set<string>();

/**
 * シーンを引く。**引かれた時点で「到達した」と記録する。**
 *
 * step() は1回の呼び出しの中で複数のシーンを跨ぐことがある。
 * たとえば branch だけを持つシーンは、入った次の瞬間に別のシーンへ飛ぶため、
 * 呼び出し側から cursor.sceneId を見ても**一度も観測できない**。
 * engine が実際に引いたシーンをここで数えることで、その取りこぼしをなくす。
 */
const lookup = (id: string): Scene => {
  const scene = scenes.get(id);
  if (!scene) throw new Error(`シーン "${id}" が見つかりません`);
  visited.add(id);
  return scene;
};
const endings: { path: string[]; params: Record<string, number>; stop: string }[] = [];
let runs = 0;

/**
 * 総当たりを1回だけ済ませた選択肢の位置。
 *
 * 素直に全組み合わせを展開すると、選択肢がn個あるだけで 3^n 通りに爆発する
 * （出会いが4人ぶん増えた時点で2,000経路を超えて打ち切られた）。
 * 一方でこのテストの目的は「壊れていないこと」と「全部の枝を一度は通ること」であり、
 * パラメータの組み合わせを網羅することではない。
 * そこで **同じ選択肢に2回目以降に来たときは先頭の候補だけを選んで先へ進む**。
 * 各候補は必ず1回は展開されるので、リンク切れも到達不能も従来どおり見つかる。
 * （パラメータ次第で行き先が変わる branch は、後段で単独に再生して担保している）
 */
const expandedChoices = new Set<string>();

/** 選択肢を全通り試しながら、終端またはスケジュール画面まで再生する */
function play(cursor: Cursor, trail: string[]): void {
  runs += 1;
  if (runs > 20_000) throw new Error('分岐が多すぎます。走査を打ち切りました。');

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
      const signature = `${sceneAtChoice}#${cursor.index}`;
      const first = expandedChoices.has(signature);
      expandedChoices.add(signature);

      const options = first ? node.options.slice(0, 1) : node.options;
      options.forEach((option, i) => {
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
    ...Object.values(EXTRA_DATE_SCENES),
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

  // --- 立ち絵の退場検証 -----------------------------------------------------
  // 「居酒屋で別れたはずの茜が、自室の背景の前に立ち続ける」類の事故を検出する。
  // 背景が変わった時点で、前の場所にいた相手は退場していなければならない。
  const stageFailures: string[] = [];
  {
    const cursor = newCursor(OPENING_SCENE_ID);
    enterScene(cursor, lookup(OPENING_SCENE_ID));
    let bgAtEntry = cursor.bg;

    for (let i = 0; i < 500; i++) {
      const before = cursor.bg;
      const node = step(cursor, lookup);
      if (node === null || node.kind === 'schedule') break;

      if (cursor.bg !== before) bgAtEntry = cursor.bg;

      // 選択肢は最初の候補を選んで先へ進む
      if (node.kind === 'choice' || node.kind === 'reply') {
        const option = node.options[0];
        if (!option) break;
        if (option.params) applyDelta(cursor.params, option.params);
        if (option.goto) enterScene(cursor, lookup(option.goto));
        continue;
      }

      // チャット画面は立ち絵を出さないので対象外
      const scene = lookup(cursor.sceneId);
      if (node.kind === 'say' && cursor.partner && scene.screen !== 'chat') {
        // その相手が、今の場所でまだ一度もしゃべっていないなら怪しい
        const speaksHere = scene.body.some((n) => n.kind === 'say' && n.who === cursor.partner);
        if (!speaksHere && cursor.bg === bgAtEntry) {
          stageFailures.push(
            `  ✗ ${cursor.sceneId}（bg: ${cursor.bg}）に ${cursor.partner} が立ったままです`,
          );
          break;
        }
      }
    }
  }
  if (stageFailures.length === 0) console.log('  ✓ 立ち絵の退場: 場所替わりで相手が残っていない');

  // --- 茜のデレ段階のゲート検証 ---------------------------------------------
  // 「2人目と知り合い、かつ魅力レベルが一定に達するまで茜は揺れない」を実際に評価して確かめる。
  const gateChecks: { label: string; flags: Record<string, boolean>; total: number; expect: string }[] = [
    { label: '1人目のみ・魅力最大', flags: { met_momoka: true }, total: 999, expect: 'akane_talk_plain' },
    { label: '2人目まで・魅力不足', flags: { met_momoka: true, met_aoi: true }, total: 20, expect: 'akane_talk_plain' },
    { label: '2人目まで・魅力到達', flags: { met_momoka: true, met_aoi: true }, total: 60, expect: 'akane_dere_01' },
  ];

  const gateFailures: string[] = [];
  for (const check of gateChecks) {
    // ゲートは相談の「締め」に置いてある（誰について相談するかを選んだあと）
    const cursor = newCursor('akane_talk_close');
    cursor.flags = { ...check.flags };
    // 総合値を1色に寄せて与える（条件は合計値で判定される）
    cursor.params.sincerity = check.total;
    enterScene(cursor, lookup('akane_talk_close'));
    step(cursor, lookup);
    if (cursor.sceneId !== check.expect) {
      gateFailures.push(`  ✗ ${check.label} → ${cursor.sceneId}（期待: ${check.expect}）`);
    } else {
      console.log(`  ✓ 茜ゲート: ${check.label} → ${cursor.sceneId}`);
    }
  }

  // --- エンディング判定の検証 -----------------------------------------------
  // K11③「個別ルート優先」。数値を見せないゲームなので、判定の取り違えは
  // プレイヤーからは永久に見えない。ここで代表的な組み合わせを固定して確かめる。
  const endingChecks: { label: string; params: Partial<Record<ParamKey, number>>; expect: string }[] = [
    { label: '何も伸びていない', params: {}, expect: 'ending_sad' },
    { label: '全色が茜のしきい値の直下', params: fill(THRESHOLD.AKANE_ALL - 1), expect: 'ending_sad' },
    { label: '全色が茜のしきい値ちょうど', params: fill(THRESHOLD.AKANE_ALL), expect: 'ending_akane' },
    { label: '全色が個別のしきい値の直下', params: fill(THRESHOLD.INDIVIDUAL - 1), expect: 'ending_akane' },
    {
      label: '自信だけ突出（他は茜条件を満たす）',
      params: { ...fill(THRESHOLD.AKANE_ALL), confidence: THRESHOLD.INDIVIDUAL },
      expect: 'ending_momoka',
    },
    {
      label: '2色が到達（誠実さのほうが高い）',
      params: { sincerity: THRESHOLD.INDIVIDUAL + 5, humor: THRESHOLD.INDIVIDUAL },
      expect: 'ending_aoi',
    },
    {
      label: '全色が個別のしきい値到達（最大値を採る）',
      params: { ...fill(THRESHOLD.INDIVIDUAL), sensibility: THRESHOLD.INDIVIDUAL + 1 },
      expect: 'ending_shion',
    },
  ];

  const endingFailures: string[] = [];
  for (const check of endingChecks) {
    const cursor = newCursor(FINALE_SCENE);
    enterScene(cursor, lookup(FINALE_SCENE));
    for (const [key, value] of Object.entries(check.params)) {
      cursor.params[key as ParamKey] = value;
    }
    // branch を越えるまで進める（本文を読み切った先に分岐がある）
    for (let i = 0; i < 100 && cursor.sceneId === FINALE_SCENE; i++) step(cursor, lookup);

    if (cursor.sceneId !== check.expect) {
      endingFailures.push(`  ✗ ${check.label} → ${cursor.sceneId}（期待: ${check.expect}）`);
    } else {
      console.log(`  ✓ エンディング判定: ${check.label} → ${cursor.sceneId}`);
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

  if (stageFailures.length) {
    console.error('\n✗ 立ち絵が退場していないシーンがあります');
    for (const line of stageFailures) console.error(line);
    process.exit(1);
  }

  if (gateFailures.length) {
    console.error('\n✗ 茜のデレ段階のゲートが想定どおりに働いていません');
    for (const line of gateFailures) console.error(line);
    process.exit(1);
  }

  if (endingFailures.length) {
    console.error('\n✗ エンディング判定が想定どおりに働いていません');
    for (const line of endingFailures) console.error(line);
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
