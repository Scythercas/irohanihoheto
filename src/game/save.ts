/**
 * セーブ／ロード。localStorage を使う（0円・サーバーなしのため）。
 *
 * スキーマ版を必ず持たせ、構造変更のたびに migrate() を足す。
 * セーブデータの互換性は個人開発で最も壊れやすい箇所（03_tech-stack.md §8.4）。
 */

import type { GameSnapshot } from './types';
import { SAVE_SCHEMA_VERSION } from './types';

const KEY_PREFIX = 'irohanihoheto:save:';
/** オートセーブ専用スロット（H2: 章の切れ目で自動保存） */
export const AUTO_SLOT = 'auto';
/** 手動セーブのスロット数 */
export const MANUAL_SLOTS = 12;

const keyOf = (slot: string | number) => `${KEY_PREFIX}${slot}`;

/**
 * 旧バージョンのセーブデータを現行スキーマへ引き上げる。
 * 引き上げられないほど古い場合は null を返し、呼び出し側で「読み込めません」と扱う。
 */
function migrate(raw: Record<string, unknown>): GameSnapshot | null {
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;

  if (version === SAVE_SCHEMA_VERSION) return raw as unknown as GameSnapshot;

  // v1 は週スケジュール／チャット履歴を持たない開発初期の形式。
  // 公開前のため引き上げは行わず、読み込み不可として扱う。
  // 以降のバージョンでは、ここに段階的な引き上げ処理を足していくこと。
  // if (version === 2) { ...; return migrate({ ...raw, schemaVersion: 3 }); }

  return null;
}

export function save(slot: string | number, snapshot: GameSnapshot): void {
  try {
    localStorage.setItem(keyOf(slot), JSON.stringify(snapshot));
  } catch (e) {
    // 容量超過やプライベートブラウジングでも落とさない
    console.error('セーブに失敗しました', e);
  }
}

export function load(slot: string | number): GameSnapshot | null {
  try {
    const text = localStorage.getItem(keyOf(slot));
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return migrate(parsed as Record<string, unknown>);
  } catch (e) {
    console.error('セーブデータの読み込みに失敗しました', e);
    return null;
  }
}

export function remove(slot: string | number): void {
  localStorage.removeItem(keyOf(slot));
}

/** セーブ一覧画面用。空きスロットは null。 */
export function listManualSlots(): (GameSnapshot | null)[] {
  return Array.from({ length: MANUAL_SLOTS }, (_, i) => load(i + 1));
}

export function hasAnySave(): boolean {
  if (load(AUTO_SLOT)) return true;
  return listManualSlots().some((s) => s !== null);
}
