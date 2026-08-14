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
  akane: { id: 'akane', name: '茜', kana: 'あかね', color: '#C4373D', colorDeep: '#8E2126' },
  aoi: { id: 'aoi', name: '葵', kana: 'あおい', color: '#2E6FB7', colorDeep: '#1E4E84' },
  sui: { id: 'sui', name: '翠', kana: 'すい', color: '#17A67C', colorDeep: '#0E7757' },
  touka: { id: 'touka', name: '橙香', kana: 'とうか', color: '#E8811F', colorDeep: '#A85B12' },
  shion: { id: 'shion', name: '紫音', kana: 'しおん', color: '#7B4FA8', colorDeep: '#573579' },
  momoka: { id: 'momoka', name: '桃果', kana: 'ももか', color: '#EE8497', colorDeep: '#C05468' },
};

/** 攻略対象の5人（茜を含まない）。アプリ「カラット」で出会う順ではなく定義順。 */
export const HEROINE_IDS: readonly HeroineId[] = ['aoi', 'sui', 'touka', 'shion', 'momoka'] as const;

/** パラメータの上限。UIのゲージ計算に使う。 */
export const PARAM_MAX = 100;

/**
 * ルート突入のしきい値（暫定値。バランス調整で変える）。
 * - 個別ルート: 対応する1色が INDIVIDUAL 以上
 * - 茜ルート  : 5色すべてが AKANE_ALL 以上
 */
export const THRESHOLD = {
  INDIVIDUAL: 60,
  AKANE_ALL: 45,
} as const;

/** 茜のデレ段階が解放される総合値のしきい値（H5: 到達するたびにイベント解放） */
export const AKANE_DERE_STEPS: readonly number[] = [60, 110, 160, 210] as const;
