/**
 * ゲーム状態の中枢。
 *
 * 状態はすべてこのストアに集約し、まるごとJSON化できる形に保つ。
 * セーブ機能を後付けせずに済ませるための設計上の約束（03_tech-stack.md §8.5）。
 * 走査ロジック本体は engine.ts（純粋関数）にある。
 */

import { create } from 'zustand';
import {
  applyAffection,
  applyDelta,
  cloneCursor,
  consumeSlot,
  emptyAffection,
  emptyParams,
  emptyProgress,
  enterScene,
  isDisplayNode,
  newCursor,
  pushChat,
  step,
  type Cursor,
  type DisplayNode,
} from './engine';
import { getScene } from './scenario/loader';
import { FINAL_WEEK, FINALE_SCENE, SLOTS_PER_WEEK, isHeroineId, nextSceneFor } from './schedule';
import type {
  CharacterId,
  ChatEntry,
  ChoiceOption,
  GameSnapshot,
  HeroineId,
  ParamKey,
  ScreenKind,
} from './types';
import { SAVE_SCHEMA_VERSION } from './types';

export type Mode = 'title' | 'adv' | 'ended';

interface GameStore {
  mode: Mode;
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
  chatWith: CharacterId | null;
  chatLog: ChatEntry[];
  pendingSe: string | null;
  /** 現在表示中のノード。null なら終端。 */
  node: DisplayNode | null;

  start: (sceneId: string) => void;
  /** クリック送り。選択待ちのときは何もしない。 */
  advance: () => void;
  choose: (option: ChoiceOption) => void;
  /** スケジュール画面で「誰と会うか」を決めたとき */
  pickAction: (who: CharacterId) => void;
  backToTitle: () => void;

  /** 現在のシーンの画面モード */
  screen: () => ScreenKind;
  snapshot: (caption: string) => GameSnapshot;
  restore: (snap: GameSnapshot) => void;
}

const cursorOf = (s: GameStore): Cursor =>
  cloneCursor({
    sceneId: s.sceneId,
    index: s.index,
    params: s.params,
    affection: s.affection,
    progress: s.progress,
    week: s.week,
    slots: s.slots,
    flags: s.flags,
    bg: s.bg,
    bgm: s.bgm,
    chatWith: s.chatWith,
    chatLog: s.chatLog,
    pendingSe: null,
  });

const commit = (cursor: Cursor, node: DisplayNode | null) => ({
  sceneId: cursor.sceneId,
  index: cursor.index,
  params: cursor.params,
  affection: cursor.affection,
  progress: cursor.progress,
  week: cursor.week,
  slots: cursor.slots,
  flags: cursor.flags,
  bg: cursor.bg,
  bgm: cursor.bgm,
  chatWith: cursor.chatWith,
  chatLog: cursor.chatLog,
  pendingSe: cursor.pendingSe,
  node,
  mode: (node === null ? 'ended' : 'adv') as Mode,
});

export const useGame = create<GameStore>((set, get) => ({
  mode: 'title',
  sceneId: '',
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
  pendingSe: null,
  node: null,

  start: (sceneId) => {
    const cursor = newCursor(sceneId);
    enterScene(cursor, getScene(sceneId));
    set(commit(cursor, step(cursor, getScene)));
  },

  advance: () => {
    const state = get();
    if (state.mode !== 'adv') return;
    // 選択待ち・スケジュール待ちは送らせない
    const kind = state.node?.kind;
    if (kind === 'choice' || kind === 'reply' || kind === 'schedule') return;

    const cursor = cursorOf(state);
    set(commit(cursor, step(cursor, getScene)));
  },

  choose: (option) => {
    const state = get();
    const kind = state.node?.kind;
    if (kind !== 'choice' && kind !== 'reply') return;

    const cursor = cursorOf(state);
    // 返信は自分の吹き出しとしてチャットに残る
    if (kind === 'reply') pushChat(cursor, 'iroha', option.text);

    if (option.params) applyDelta(cursor.params, option.params);
    if (option.affection) applyAffection(cursor.affection, option.affection);
    if (option.goto) enterScene(cursor, getScene(option.goto));

    set(commit(cursor, step(cursor, getScene)));
  },

  pickAction: (who) => {
    const state = get();
    if (state.node?.kind !== 'schedule') return;

    const cursor = cursorOf(state);
    const target = nextSceneFor(who, cursor.progress);

    if (isHeroineId(who)) {
      cursor.progress[who] = (cursor.progress[who] ?? 0) + 1;
    }
    consumeSlot(cursor);

    // 12週を終えたら、デートには行かず終幕の判定へ
    const destination = cursor.week > FINAL_WEEK ? FINALE_SCENE : target;
    enterScene(cursor, getScene(destination));

    set(commit(cursor, step(cursor, getScene)));
  },

  backToTitle: () => set({ mode: 'title', node: null }),

  screen: () => {
    const { sceneId } = get();
    if (!sceneId) return 'adv';
    return getScene(sceneId).screen ?? 'adv';
  },

  snapshot: (caption) => {
    const s = get();
    return {
      schemaVersion: SAVE_SCHEMA_VERSION,
      sceneId: s.sceneId,
      index: s.index,
      params: { ...s.params },
      affection: { ...s.affection },
      progress: { ...s.progress },
      week: s.week,
      slots: s.slots,
      flags: { ...s.flags },
      bg: s.bg,
      bgm: s.bgm,
      chatWith: s.chatWith,
      chatLog: [...s.chatLog],
      savedAt: new Date().toISOString(),
      caption,
    };
  },

  restore: (snap) => {
    // index は「現在表示中のノード」を指す。復元後もその位置から再開する。
    const scene = getScene(snap.sceneId);
    const node = scene.body[snap.index];
    set({
      mode: 'adv',
      sceneId: snap.sceneId,
      index: snap.index,
      params: { ...snap.params },
      affection: { ...snap.affection },
      progress: { ...snap.progress },
      week: snap.week,
      slots: snap.slots,
      flags: { ...snap.flags },
      bg: snap.bg,
      bgm: snap.bgm,
      chatWith: snap.chatWith,
      chatLog: [...snap.chatLog],
      pendingSe: null,
      node: node && isDisplayNode(node) ? node : null,
    });
  },
}));
