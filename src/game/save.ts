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
/**
 * v3 → v4: 幼馴染のキャラクターIDを `akane` から `mashiro` に改名した（2026-08-15）。
 *
 * セーブデータには**シーンID・フラグ名・登場人物ID**が文字列のまま入っているため、
 * 旧IDが残っているとロード直後に「そんなシーンは無い」で落ちる。
 * 文字列を機械的に置換して引き上げる。
 */
function renameAkaneToMashiro(raw: Record<string, unknown>): Record<string, unknown> {
  const swap = (v: unknown): unknown =>
    typeof v === 'string' ? v.replace(/\bakane\b/g, 'mashiro').replace(/akane_/g, 'mashiro_') : v;

  const out: Record<string, unknown> = { ...raw };
  out.sceneId = swap(raw.sceneId);
  out.partner = swap(raw.partner);
  out.chatWith = swap(raw.chatWith);

  if (raw.flags && typeof raw.flags === 'object') {
    out.flags = Object.fromEntries(
      Object.entries(raw.flags as Record<string, unknown>).map(([k, v]) => [String(swap(k)), v]),
    );
  }
  if (raw.faces && typeof raw.faces === 'object') {
    out.faces = Object.fromEntries(
      Object.entries(raw.faces as Record<string, unknown>).map(([k, v]) => [String(swap(k)), v]),
    );
  }
  if (Array.isArray(raw.chatLog)) {
    out.chatLog = raw.chatLog.map((entry) =>
      entry && typeof entry === 'object'
        ? { ...(entry as Record<string, unknown>), from: swap((entry as Record<string, unknown>).from) }
        : entry,
    );
  }

  out.schemaVersion = 4;
  return out;
}

function migrate(raw: Record<string, unknown>): GameSnapshot | null {
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;

  if (version === SAVE_SCHEMA_VERSION) return raw as unknown as GameSnapshot;

  if (version === 3) return migrate(renameAkaneToMashiro(raw));

  // v1・v2 は週スケジュール／チャット履歴を持たない開発初期の形式。
  // 公開前のため引き上げは行わず、読み込み不可として扱う。

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
