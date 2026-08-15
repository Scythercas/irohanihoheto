/**
 * エンディング到達性のバランス検証。
 *
 *   npm run balance
 *
 * 【なぜ要るか】
 * 本作はプレイヤーにパラメータの数値を見せない（C3②）。
 * つまりプレイヤーは**手探りで**エンディングを目指すことになるため、
 * 「そもそも到達できない結末がある」状態を人力レビューで見つけるのは不可能に近い。
 *
 * さらに K11③ で「個別ルート優先」を選んだ結果、茉白ルートの条件は
 * 「どの色も INDIVIDUAL に届かず、5色すべてが MASHIRO_ALL 以上」という**帯**になった。
 * 帯は上にも下にも外れうるので、行動枠の総数と1回あたりの獲得点のバランスが崩れると、
 * 茉白ルート（＝本作のトゥルーエンド）が数学的に消滅する。
 *
 * そこで、獲得点を**シナリオYAMLから実測**し、行動枠の配分を総当たりして
 * 7つのエンディングすべてに到達できることを機械的に確かめる。
 * 点数を手で書き写さないので、シナリオを足しても検証が古びない。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  HEROINE_IDS,
  HEROINE_TO_PARAM,
  PARAM_LABEL,
  PARAM_ORDER,
  THRESHOLD,
} from '../src/game/constants';
import { OPENING_SCENE_ID } from '../src/game/flow';
import {
  applyAffection,
  applyDelta,
  emptyAffection,
  emptyParams,
  endingRoute,
  enterScene,
  newCursor,
  pushChat,
  step,
  type Cursor,
} from '../src/game/engine';
import { buildScenes } from '../src/game/scenario/build';
import {
  MASHIRO_SCENES,
  DATE_SCENES,
  EXTRA_DATE_SCENES,
  FINAL_WEEK,
  SLOTS_PER_WEEK,
} from '../src/game/schedule';
import type { ChoiceOption, EndingRoute, HeroineId, ParamKey, Scene } from '../src/game/types';

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

type Params = Record<ParamKey, number>;

const TOTAL_SLOTS = FINAL_WEEK * SLOTS_PER_WEEK;

// --- シナリオから獲得点を実測する -------------------------------------------

/** 選択肢の良し悪しを測る物差し。target を決めた場合はその色の伸びだけを見る。 */
function scoreOption(option: ChoiceOption, target: ParamKey | null): number {
  if (!option.params) return 0;
  if (target) return option.params[target] ?? 0;
  return PARAM_ORDER.reduce((sum, key) => sum + (option.params?.[key] ?? 0), 0);
}

/**
 * 1シーンを最後まで（＝スケジュール画面に戻るまで）再生し、パラメータの増分を返す。
 * policy が best なら毎回いちばん伸びる選択肢を、worst なら伸びない選択肢を選ぶ。
 */
function playScene(sceneId: string, policy: 'best' | 'worst', target: ParamKey | null): Params {
  const cursor: Cursor = newCursor(sceneId);
  enterScene(cursor, lookup(sceneId));

  for (let guard = 0; guard < 5_000; guard++) {
    const node = step(cursor, lookup);
    if (node === null || node.kind === 'schedule') break;

    if (node.kind === 'choice' || node.kind === 'reply') {
      let chosen = node.options[0];
      if (!chosen) break;
      for (const option of node.options.slice(1)) {
        const a = scoreOption(option, target);
        const b = scoreOption(chosen, target);
        if (policy === 'best' ? a > b : a < b) chosen = option;
      }
      if (node.kind === 'reply') pushChat(cursor, 'iroha', chosen.text);
      if (chosen.params) applyDelta(cursor.params, chosen.params);
      if (chosen.affection) applyAffection(cursor.affection, chosen.affection);
      if (chosen.goto) enterScene(cursor, lookup(chosen.goto));
    }
  }
  return cursor.params;
}

const addInto = (into: Params, from: Params): void => {
  for (const key of PARAM_ORDER) into[key] += from[key];
};

const scaled = (p: Params, n: number): Params => {
  const out = emptyParams();
  for (const key of PARAM_ORDER) out[key] = p[key] * n;
  return out;
};

/** 共通パート（プロローグ〜出会い）で入る点。スケジュールに入る前の初期値になる。 */
const COMMON: Record<'best' | 'worst', Params> = {
  best: playScene(OPENING_SCENE_ID, 'best', null),
  worst: playScene(OPENING_SCENE_ID, 'worst', null),
};

/** ヒロインに n 回会ったときの累計点（書き下ろしを使い切ったら _extra を繰り返す） */
function datesGain(heroine: HeroineId, n: number, policy: 'best' | 'worst'): Params {
  const target = HEROINE_TO_PARAM[heroine];
  const written = DATE_SCENES[heroine];
  const out = emptyParams();
  for (let i = 0; i < n; i++) {
    const sceneId = written[i] ?? EXTRA_DATE_SCENES[heroine];
    addInto(out, playScene(sceneId, policy, target));
  }
  return out;
}

/** 茉白に1回相談したときの点 */
const MASHIRO_GAIN = playScene(MASHIRO_SCENES[0] as string, 'best', null);

// --- 配分を総当たりして、到達できるエンディングを調べる ----------------------

function routeOf(params: Params): EndingRoute {
  const cursor = newCursor('(判定用)');
  cursor.params = params;
  cursor.affection = emptyAffection();
  return endingRoute(cursor);
}

interface Plan {
  perGirl: number;
  mashiro: number;
  policy: 'best' | 'worst';
  params: Params;
  route: EndingRoute;
}

/** 5人に均等に会う配分をすべて試す（茉白ルートが存在するかの確認が主目的） */
function sweepEven(): Plan[] {
  const out: Plan[] = [];
  for (const policy of ['best', 'worst'] as const) {
    const perGirlCache = new Map<number, Params>();
    for (let perGirl = 0; perGirl * 5 <= TOTAL_SLOTS; perGirl++) {
      for (let mashiro = 0; perGirl * 5 + mashiro <= TOTAL_SLOTS; mashiro++) {
        const params = { ...COMMON[policy] };
        let girls = perGirlCache.get(perGirl);
        if (!girls) {
          girls = emptyParams();
          for (const heroine of HEROINE_IDS) addInto(girls, datesGain(heroine, perGirl, policy));
          perGirlCache.set(perGirl, girls);
        }
        addInto(params, girls);
        addInto(params, scaled(MASHIRO_GAIN, mashiro));
        out.push({ perGirl, mashiro, policy, params, route: routeOf(params) });
      }
    }
  }
  return out;
}

/** 1人に集中する配分（個別ルートが取れるかの確認） */
function sweepFocused(): Plan[] {
  const out: Plan[] = [];
  for (const heroine of HEROINE_IDS) {
    for (let dates = 1; dates <= TOTAL_SLOTS; dates++) {
      const params = { ...COMMON.best };
      addInto(params, datesGain(heroine, dates, 'best'));
      const route = routeOf(params);
      out.push({ perGirl: dates, mashiro: 0, policy: 'best', params, route });
      if (route === heroine) break; // 最短で到達した時点で打ち切る
    }
  }
  return out;
}

const evenPlans = sweepEven();
const focusedPlans = sweepFocused();
const reachable = new Set<EndingRoute>([...evenPlans, ...focusedPlans].map((p) => p.route));

// --- 結果の報告 -------------------------------------------------------------

const fmt = (p: Params): string => PARAM_ORDER.map((k) => `${PARAM_LABEL[k]}:${p[k]}`).join(' ');

console.log('=== バランス検証 ===');
console.log(`  行動枠     : ${FINAL_WEEK}週 × ${SLOTS_PER_WEEK} = ${TOTAL_SLOTS}枠`);
console.log(`  しきい値   : 個別 ${THRESHOLD.INDIVIDUAL} / 茉白 全色 ${THRESHOLD.MASHIRO_ALL}`);
console.log(`  茉白ルートの帯: 全色が ${THRESHOLD.MASHIRO_ALL} 以上 ${THRESHOLD.INDIVIDUAL} 未満\n`);

console.log('  [1人に集中したとき（最善手）]');
for (const plan of focusedPlans) {
  if (!HEROINE_IDS.includes(plan.route as HeroineId)) continue;
  console.log(`    ${plan.route.padEnd(7)} : ${plan.perGirl}回で到達（残り ${TOTAL_SLOTS - plan.perGirl}枠）`);
}

const mashiroPlans = evenPlans.filter((p) => p.route === 'mashiro');
console.log('\n  [5人に均等＋茉白に相談]');
if (mashiroPlans.length === 0) {
  console.log('    ✗ 茉白ルートに入る配分が存在しません');
} else {
  const best = mashiroPlans[0] as Plan;
  const worst = mashiroPlans[mashiroPlans.length - 1] as Plan;
  console.log(`    茉白ルートになる配分: ${mashiroPlans.length}通り`);
  console.log(`    例) 各${best.perGirl}回＋相談${best.mashiro}回（${best.policy}） → ${fmt(best.params)}`);
  console.log(`    例) 各${worst.perGirl}回＋相談${worst.mashiro}回（${worst.policy}） → ${fmt(worst.params)}`);
}

const sadPlans = evenPlans.filter((p) => p.route === 'sad' && p.perGirl * 5 + p.mashiro >= TOTAL_SLOTS - 2);
console.log('\n  [枠を使い切ってもサッドになる配分]');
console.log(`    ${sadPlans.length}通り（選択肢を外し続けると届かない、が成立している）`);

const missing = (['aoi', 'sui', 'touka', 'shion', 'momoka', 'mashiro', 'sad'] as EndingRoute[]).filter(
  (r) => !reachable.has(r),
);

console.log('');
if (missing.length) {
  console.error(`✗ 到達できないエンディングがあります: ${missing.join(', ')}`);
  console.error('  しきい値（constants.ts）か行動枠（schedule.ts）か、獲得点（シナリオ）を見直してください。');
  process.exit(1);
}
console.log('✓ 7つのエンディングすべてに到達可能');
