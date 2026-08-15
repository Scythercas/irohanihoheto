/**
 * 作品の背骨となる定数。
 *
 * 「色 ＝ パラメータ ＝ ヒロイン」の対応は本作の中核メカニクスであり、
 * CLAUDE.md §3.2 で変更禁止と定められている。ここを書き換えてはならない。
 */

import type { CharacterId, HeroineId, ParamKey } from './types';

/** 5色パラメータの定義順（UI表示順もこれに従う） */
export const PARAM_ORDER: readonly ParamKey[] = [
  'sincerity',
  'tolerance',
  'humor',
  'sensibility',
  'confidence',
] as const;

export const PARAM_LABEL: Record<ParamKey, string> = {
  sincerity: '誠実さ',
  tolerance: '包容力',
  humor: 'ユーモア',
  sensibility: '感性',
  confidence: '自信',
};

/** パラメータ → 対応ヒロイン。1色を磨くとそのヒロインのルートに入れる。 */
export const PARAM_TO_HEROINE: Record<ParamKey, HeroineId> = {
  sincerity: 'aoi',
  tolerance: 'sui',
  humor: 'touka',
  sensibility: 'shion',
  confidence: 'momoka',
};

/** ヒロイン → 対応パラメータ（PARAM_TO_HEROINE の逆引き） */
export const HEROINE_TO_PARAM: Record<HeroineId, ParamKey> = {
  aoi: 'sincerity',
  sui: 'tolerance',
  touka: 'humor',
  shion: 'sensibility',
  momoka: 'confidence',
};

export interface CharacterDef {
  id: CharacterId;
  /** 表示名 */
  name: string;
  /** 読み */
  kana: string;
  /** 髪色＝キャラクターカラー。UI・ルート識別・演出のすべてで使う */
  color: string;
  /** 名前表示に使う濃色（背景に敷いたときの可読性用） */
  colorDeep: string;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  iroha: { id: 'iroha', name: '色葉', kana: 'いろは', color: '#6B6B72', colorDeep: '#4A4A50' },
  // 茉白の白は「色が無い」ではなく「五色すべてが重なった光」。
  // 色葉の灰（何も持っていない無彩色）と対になるよう、わずかに青みを含んだ白銀にしている。
  // colorDeep は名前表示の下地に使うため、白文字が乗る前提で暗い色を置く。
  mashiro: { id: 'mashiro', name: '茉白', kana: 'ましろ', color: '#E6E9F0', colorDeep: '#5B6270' },
  aoi: { id: 'aoi', name: '葵', kana: 'あおい', color: '#2E6FB7', colorDeep: '#1E4E84' },
  sui: { id: 'sui', name: '翠', kana: 'すい', color: '#17A67C', colorDeep: '#0E7757' },
  touka: { id: 'touka', name: '橙香', kana: 'とうか', color: '#E8811F', colorDeep: '#A85B12' },
  shion: { id: 'shion', name: '紫音', kana: 'しおん', color: '#7B4FA8', colorDeep: '#573579' },
  momoka: { id: 'momoka', name: '桃果', kana: 'ももか', color: '#EE8497', colorDeep: '#C05468' },
};

/** 攻略対象の5人（茉白を含まない）。アプリ「カラット」で出会う順ではなく定義順。 */
export const HEROINE_IDS: readonly HeroineId[] = ['aoi', 'sui', 'touka', 'shion', 'momoka'] as const;

/** パラメータの上限。UIのゲージ計算に使う。 */
export const PARAM_MAX = 100;

/**
 * ルート突入のしきい値。
 * - 個別ルート: 対応する1色が INDIVIDUAL 以上
 * - 茉白ルート  : どの色も INDIVIDUAL に届かず、5色すべてが MASHIRO_ALL 以上
 *
 * **個別ルート優先**（K11③）のため、茉白ルートは [MASHIRO_ALL, INDIVIDUAL) という
 * "帯" になる。帯が狭すぎると、平均的に遊んだ人が意図せず個別ルートに落ちる。
 * プレイヤーには数値を見せない（C3②）以上、帯は十分広く取る必要がある。
 *
 * **この値を変えたら必ず `npm run balance` を通すこと。**
 * 行動枠の総数（12週 × SLOTS_PER_WEEK）と1回あたりの獲得点から、
 * 7つのエンディングすべてに到達できるかを機械的に検証している。
 */
export const THRESHOLD = {
  INDIVIDUAL: 80,
  MASHIRO_ALL: 45,
} as const;

/** 茉白のデレ段階が解放される総合値のしきい値（H5: 到達するたびにイベント解放） */
export const MASHIRO_DERE_STEPS: readonly number[] = [60, 110, 160, 210] as const;
