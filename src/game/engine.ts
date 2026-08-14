/**
 * シナリオ走査エンジン（純粋ロジック）。
 *
 * React にも Vite にも依存させない。ここを独立させておくことで、
 * ブラウザを開かずに Node 上でシナリオを全走査して壊れを検出できる
 * （scripts/smoke.ts）。分岐が増えるほどこの担保が効いてくる。
 */

import { PARAM_ORDER } from './constants';
import type {
  ChoiceNode,
  HeroineId,
  ParamDelta,
  ParamKey,
  SayNode,
  Scene,
  ScenarioNode,
} from './types';

/** プレイヤーの操作を待つノード（＝画面に出るノード） */
export type DisplayNode = SayNode | ChoiceNode;

export type SceneLookup = (id: string) => Scene;

export const isDisplayNode = (node: ScenarioNode): node is DisplayNode =>
  node.kind === 'say' || node.kind === 'choice';

export function emptyParams(): Record<ParamKey, number> {
  return { sincerity: 0, tolerance: 0, humor: 0, sensibility: 0, confidence: 0 };
}

export function emptyAffection(): Record<HeroineId, number> {
  return { aoi: 0, sui: 0, touka: 0, shion: 0, momoka: 0 };
}

/** 走査中の可変状態 */
export interface Cursor {
  sceneId: string;
  index: number;
  params: Record<ParamKey, number>;
  affection: Record<HeroineId, number>;
  flags: Record<string, boolean>;
  bg: string | null;
  bgm: string | null;
  /** 直近に通過した効果音。UI側が拾って鳴らす。 */
  pendingSe: string | null;
}

export function newCursor(sceneId: string): Cursor {
  return {
    sceneId,
    index: -1,
    params: emptyParams(),
    affection: emptyAffection(),
    flags: {},
    bg: null,
    bgm: null,
    pendingSe: null,
  };
}

export function applyDelta(params: Record<ParamKey, number>, delta: ParamDelta): void {
  for (const key of PARAM_ORDER) {
    const d = delta[key];
    if (typeof d === 'number') params[key] = Math.max(0, params[key] + d);
  }
}

export function applyAffection(
  affection: Record<HeroineId, number>,
  delta: Partial<Record<HeroineId, number>>,
): void {
  for (const [id, d] of Object.entries(delta)) {
    if (typeof d === 'number') {
      const key = id as HeroineId;
      affection[key] = Math.max(0, affection[key] + d);
    }
  }
}

/** シーンに入る。先頭の bg / bgm を適用し、カーソルを本文の手前に置く。 */
export function enterScene(cursor: Cursor, scene: Scene): void {
  cursor.sceneId = scene.id;
  cursor.index = -1;
  if (scene.bg) cursor.bg = scene.bg;
  if (scene.bgm) cursor.bgm = scene.bgm;
}

/**
 * 次に画面へ出すノードまでカーソルを進める。
 * 演出・状態操作ノードは通過しながら適用していく。
 * 到達できなければ null（＝物語の終端）。
 */
export function step(cursor: Cursor, lookup: SceneLookup): DisplayNode | null {
  cursor.pendingSe = null;

  // シーンを跨いで進むため、goto の循環に対する保険をかける
  for (let guard = 0; guard < 10_000; guard++) {
    const scene = lookup(cursor.sceneId);
    cursor.index += 1;

    if (cursor.index >= scene.body.length) {
      if (!scene.next) return null;
      enterScene(cursor, lookup(scene.next));
      continue;
    }

    const node = scene.body[cursor.index];
    if (!node) return null;
    if (isDisplayNode(node)) return node;

    switch (node.kind) {
      case 'bg':
        cursor.bg = node.bg;
        break;
      case 'bgm':
        cursor.bgm = node.bgm;
        break;
      case 'se':
        cursor.pendingSe = node.se;
        break;
      case 'param':
        applyDelta(cursor.params, node.params);
        break;
      case 'flag':
        cursor.flags[node.flag] = node.value;
        break;
      case 'goto':
        enterScene(cursor, lookup(node.goto));
        break;
    }
  }
  throw new Error('シナリオの走査が終了しませんでした。goto が循環している可能性があります。');
}
