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
  emptyAffection,
  emptyParams,
  enterScene,
  isDisplayNode,
  newCursor,
  step,
  type Cursor,
  type DisplayNode,
} from './engine';
import { getScene } from './scenario/loader';
import type { ChoiceOption, GameSnapshot, HeroineId, ParamKey } from './types';
import { SAVE_SCHEMA_VERSION } from './types';

export type Mode = 'title' | 'adv' | 'ended';

interface GameStore {
  mode: Mode;
  sceneId: string;
  index: number;
  params: Record<ParamKey, number>;
  affection: Record<HeroineId, number>;
  week: number;
  flags: Record<string, boolean>;
  bg: string | null;
  bgm: string | null;
  pendingSe: string | null;
  /** 現在表示中のノード。null なら終端。 */
  node: DisplayNode | null;

  start: (sceneId: string) => void;
  /** クリック送り。選択肢の表示中は何もしない。 */
  advance: () => void;
  choose: (option: ChoiceOption) => void;
  backToTitle: () => void;

  snapshot: (caption: string) => GameSnapshot;
  restore: (snap: GameSnapshot) => void;
}

const cursorOf = (s: GameStore): Cursor => ({
  sceneId: s.sceneId,
  index: s.index,
  params: { ...s.params },
  affection: { ...s.affection },
  flags: { ...s.flags },
  bg: s.bg,
  bgm: s.bgm,
  pendingSe: null,
});

const commit = (cursor: Cursor, node: DisplayNode | null) => ({
  sceneId: cursor.sceneId,
  index: cursor.index,
  params: cursor.params,
  affection: cursor.affection,
  flags: cursor.flags,
  bg: cursor.bg,
  bgm: cursor.bgm,
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
  week: 1,
  flags: {},
  bg: null,
  bgm: null,
  pendingSe: null,
  node: null,

  start: (sceneId) => {
    const cursor = newCursor(sceneId);
    enterScene(cursor, getScene(sceneId));
    set({ ...commit(cursor, step(cursor, getScene)), week: 1 });
  },

  advance: () => {
    const state = get();
    if (state.mode !== 'adv') return;
    if (state.node?.kind === 'choice') return; // 選択待ちは送らせない

    const cursor = cursorOf(state);
    set(commit(cursor, step(cursor, getScene)));
  },

  choose: (option) => {
    const state = get();
    if (state.node?.kind !== 'choice') return;

    const cursor = cursorOf(state);
    if (option.params) applyDelta(cursor.params, option.params);
    if (option.affection) applyAffection(cursor.affection, option.affection);
    if (option.goto) enterScene(cursor, getScene(option.goto));

    set(commit(cursor, step(cursor, getScene)));
  },

  backToTitle: () => set({ mode: 'title', node: null }),

  snapshot: (caption) => {
    const s = get();
    return {
      schemaVersion: SAVE_SCHEMA_VERSION,
      sceneId: s.sceneId,
      index: s.index,
      params: { ...s.params },
      affection: { ...s.affection },
      week: s.week,
      flags: { ...s.flags },
      bg: s.bg,
      bgm: s.bgm,
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
      week: snap.week,
      flags: { ...snap.flags },
      bg: snap.bg,
      bgm: snap.bgm,
      pendingSe: null,
      node: node && isDisplayNode(node) ? node : null,
    });
  },
}));
