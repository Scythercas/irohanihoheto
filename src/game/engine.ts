/**
 * シナリオ走査エンジン（純粋ロジック）。
 *
 * React にも Vite にも依存させない。ここを独立させておくことで、
 * ブラウザを開かずに Node 上でシナリオを全走査して壊れを検出できる
 * （scripts/smoke.ts）。分岐が増えるほどこの担保が効いてくる。
 */

import { PARAM_ORDER, PARAM_TO_HEROINE, THRESHOLD } from './constants';
import { SLOTS_PER_WEEK } from './schedule';
import type {
  BranchCase,
  CaratNode,
  ChatEntry,
  ChatNode,
  ChoiceNode,
  CharacterId,
  EndingRoute,
  HeroineId,
  ParamDelta,
  ParamKey,
  ReplyNode,
  SayNode,
  Scene,
  ScenarioNode,
  ScheduleNode,
} from './types';

/** プレイヤーの操作を待つノード（＝画面に出るノード） */
export type DisplayNode = SayNode | ChoiceNode | ChatNode | ReplyNode | CaratNode | ScheduleNode;

export type SceneLookup = (id: string) => Scene;

const DISPLAY_KINDS = new Set<ScenarioNode['kind']>(['say', 'choice', 'chat', 'reply', 'carat', 'schedule']);

export const isDisplayNode = (node: ScenarioNode): node is DisplayNode => DISPLAY_KINDS.has(node.kind);

export function emptyParams(): Record<ParamKey, number> {
  return { sincerity: 0, tolerance: 0, humor: 0, sensibility: 0, confidence: 0 };
}

export function emptyAffection(): Record<HeroineId, number> {
  return { aoi: 0, sui: 0, touka: 0, shion: 0, momoka: 0 };
}

export function emptyProgress(): Record<HeroineId, number> {
  return { aoi: 0, sui: 0, touka: 0, shion: 0, momoka: 0 };
}

/** 走査中の可変状態 */
export interface Cursor {
  sceneId: string;
  index: number;
  params: Record<ParamKey, number>;
  affection: Record<HeroineId, number>;
  progress: Record<HeroineId, number>;
  week: number;
  slots: number;
  flags: Record<string, boolean>;
  bg: string | null;
  bgm: string | null;
  /** チャット相手。変わると履歴をリセットする（＝別スレッドを開いた扱い） */
  chatWith: CharacterId | null;
  chatLog: ChatEntry[];
  /** 画面右に立たせている会話相手。主人公は常に左なので、右の1枠だけ管理すればよい。 */
  partner: CharacterId | null;
  /** キャラごとの現在の表情。face を省略したセリフは直前の表情を引き継ぐ。 */
  faces: Record<string, string>;
  /** 直近に通過した効果音。UI側が拾って鳴らす。 */
  pendingSe: string | null;
}

export function newCursor(sceneId: string): Cursor {
  return {
    sceneId,
    index: -1,
    params: emptyParams(),
    affection: emptyAffection(),
    progress: emptyProgress(),
    week: 1,
    slots: SLOTS_PER_WEEK,
    flags: {},
    bg: null,
    bgm: null,
    chatWith: null,
    chatLog: [],
    partner: null,
    faces: {},
    pendingSe: null,
  };
}

export function cloneCursor(c: Cursor): Cursor {
  return {
    ...c,
    params: { ...c.params },
    affection: { ...c.affection },
    progress: { ...c.progress },
    flags: { ...c.flags },
    chatLog: [...c.chatLog],
    faces: { ...c.faces },
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

// --- チャットの時刻 ---------------------------------------------------------
// 実時刻ではなく作中時刻。テストの再現性を保つため Date は使わない。

const CHAT_START_MINUTES = 21 * 60 + 4; // 21:04

function stampFor(cursor: Cursor, explicit?: string): string {
  if (explicit) return explicit;
  const minutes = CHAT_START_MINUTES + cursor.chatLog.length * 2;
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** チャット履歴に1件積む。表示中のメッセージも履歴に残す（LINEと同じ見え方にするため）。 */
export function pushChat(cursor: Cursor, from: CharacterId, text: string, at?: string): void {
  cursor.chatLog = [...cursor.chatLog, { from, text, at: stampFor(cursor, at) }];
}

/** 総合魅力レベル（5色の合計） */
export function totalParam(params: Record<ParamKey, number>): number {
  return PARAM_ORDER.reduce((sum, key) => sum + params[key], 0);
}

/** 出会ったヒロインの人数。met_* フラグの数で数える。 */
export function metCount(flags: Record<string, boolean>): number {
  return Object.entries(flags).filter(([key, on]) => on && key.startsWith('met_')).length;
}

/**
 * 終幕でどのエンディングに入るかを判定する。
 *
 * **個別ルート優先**（K11③ でユーザーが選択）。
 *
 *   1. 対応する色が `THRESHOLD.INDIVIDUAL` 以上のヒロインがいれば、その個別ルート。
 *      複数該当したら値が最も大きい色を採る。同値なら好感度、それも同値なら
 *      `PARAM_ORDER` の順で決める（判定を再現可能にするため、必ず一意に決まるようにする）。
 *   2. 誰も該当しないとき、5色すべてが `THRESHOLD.MASHIRO_ALL` 以上なら茉白ルート。
 *      「どの色にも特化しなかった＝すべてを平均的に上げた」人だけが通れる帯になる。
 *   3. どちらでもなければサッドエンド（茉白に見限られる）。
 *
 * 設計書 §3.5 の「誰とも交際確定していない」は、1 に該当しないこと＝
 * 特化した相手がいないこと、として表現している。
 */
export function endingRoute(cursor: Cursor): EndingRoute {
  const reached = PARAM_ORDER.filter((key) => cursor.params[key] >= THRESHOLD.INDIVIDUAL);

  if (reached.length > 0) {
    let best = reached[0] as ParamKey;
    for (const key of reached.slice(1)) {
      if (cursor.params[key] > cursor.params[best]) {
        best = key;
      } else if (cursor.params[key] === cursor.params[best]) {
        const a = cursor.affection[PARAM_TO_HEROINE[key]];
        const b = cursor.affection[PARAM_TO_HEROINE[best]];
        if (a > b) best = key;
      }
    }
    return PARAM_TO_HEROINE[best];
  }

  if (PARAM_ORDER.every((key) => cursor.params[key] >= THRESHOLD.MASHIRO_ALL)) return 'mashiro';

  return 'sad';
}

/** branch の1ケースが成立するか */
export function matchesCase(cursor: Cursor, c: BranchCase): boolean {
  if (c.ifFlag && !cursor.flags[c.ifFlag]) return false;
  if (c.ifMetCount !== undefined && metCount(cursor.flags) < c.ifMetCount) return false;
  if (c.ifTotalParam !== undefined && totalParam(cursor.params) < c.ifTotalParam) return false;
  if (c.ifParam) {
    for (const [key, min] of Object.entries(c.ifParam)) {
      if (typeof min === 'number' && cursor.params[key as ParamKey] < min) return false;
    }
  }
  if (c.ifEnding !== undefined && endingRoute(cursor) !== c.ifEnding) return false;
  return true;
}

/**
 * 背景を切り替える。
 *
 * **場所が変わったら、立っていた相手は退場させる。**
 * これを忘れると「居酒屋で別れたはずの茉白が、自室の背景の前に立ち続ける」
 * といった事故になる。同じ背景を指定し直した場合は続きの場面なので退場させない。
 */
export function setBackground(cursor: Cursor, bg: string): void {
  if (cursor.bg === bg) return;
  cursor.bg = bg;
  cursor.partner = null;
}

/** シーンに入る。先頭の bg / bgm を適用し、カーソルを本文の手前に置く。 */
export function enterScene(cursor: Cursor, scene: Scene): void {
  cursor.sceneId = scene.id;
  cursor.index = -1;
  if (scene.bg) setBackground(cursor, scene.bg);
  if (scene.bgm) cursor.bgm = scene.bgm;

  if (scene.screen === 'chat') {
    const partner = scene.with ?? cursor.chatWith;
    // 相手が変わったら別スレッドを開いた扱いにする
    if (partner !== cursor.chatWith) {
      cursor.chatWith = partner ?? null;
      cursor.chatLog = [];
    }
  }

  // with を書いたシーンでは、立ち絵の相手も明示的に指定されたものとして扱う
  if (scene.with && scene.with !== 'iroha') cursor.partner = scene.with;
}

/** 行動枠を1つ消費する。使い切ったら翌週へ。 */
export function consumeSlot(cursor: Cursor): void {
  cursor.slots -= 1;
  if (cursor.slots <= 0) {
    cursor.week += 1;
    cursor.slots = SLOTS_PER_WEEK;
  }
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

    if (isDisplayNode(node)) {
      // チャットは「送信された」時点で履歴に積む
      if (node.kind === 'chat') pushChat(cursor, node.from, node.text, node.at);

      // 立ち絵の状態はセリフから拾う。主人公は左固定なので右枠だけ更新する。
      if (node.kind === 'say' && node.who && node.who !== 'iroha') {
        cursor.partner = node.who;
        if (node.face) cursor.faces = { ...cursor.faces, [node.who]: node.face };
      }
      return node;
    }

    switch (node.kind) {
      case 'bg':
        setBackground(cursor, node.bg);
        break;
      case 'stage':
        cursor.partner = node.partner;
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
      case 'branch': {
        const chosen = node.cases.find((c) => matchesCase(cursor, c));
        if (!chosen) {
          throw new Error(
            `シーン "${cursor.sceneId}" の branch で、条件を満たす行き先がありませんでした。` +
              '条件なしの case を最後に置いてください。',
          );
        }
        enterScene(cursor, lookup(chosen.goto));
        break;
      }
    }
  }
  throw new Error('シナリオの走査が終了しませんでした。goto が循環している可能性があります。');
}
