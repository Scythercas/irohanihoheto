/** ドメイン型。シナリオYAMLの構造もここで定義する。 */

export type ParamKey = 'sincerity' | 'tolerance' | 'humor' | 'sensibility' | 'confidence';

export type HeroineId = 'aoi' | 'sui' | 'touka' | 'shion' | 'momoka';

/** 主人公・幼馴染を含む全キャラ */
export type CharacterId = HeroineId | 'akane' | 'iroha';

export type ParamDelta = Partial<Record<ParamKey, number>>;

// ---------------------------------------------------------------------------
// シナリオノード
//
// YAMLでは「どのキーを持つか」でノード種別を判別する。書き手が `kind:` を
// 毎行書かなくて済むようにするため。読み込み時に loader.ts が kind を補う。
// ---------------------------------------------------------------------------

/** セリフ・地の文。who が null なら主人公の心の声（A5①: 主人公はボイス・立ち絵なし）。 */
export interface SayNode {
  kind: 'say';
  who: CharacterId | null;
  /** 立ち絵の表情差分キー（例: 'smile'）。省略時は直前の表情を維持。 */
  face?: string;
  text: string;
  /** ボイスファイル名（拡張子なし）。F2②: 主要シーンのみの部分ボイス。 */
  voice?: string;
}

export interface ChoiceOption {
  text: string;
  /** この選択肢で変動する5色パラメータ */
  params?: ParamDelta;
  /** 特定ヒロインの好感度変動 */
  affection?: Partial<Record<HeroineId, number>>;
  /** 選択後に飛ぶシーンID。省略時は次のノードへ進む。 */
  goto?: string;
  /** このフラグが立っているときだけ表示する */
  requireFlag?: string;
}

export interface ChoiceNode {
  kind: 'choice';
  options: ChoiceOption[];
}

export interface BgNode {
  kind: 'bg';
  bg: string;
}

export interface BgmNode {
  kind: 'bgm';
  /** null で停止 */
  bgm: string | null;
}

export interface SeNode {
  kind: 'se';
  se: string;
}

/** 選択肢を経ずにパラメータを動かす（イベント達成報酬など） */
export interface ParamNode {
  kind: 'param';
  params: ParamDelta;
}

export interface FlagNode {
  kind: 'flag';
  flag: string;
  value: boolean;
}

export interface GotoNode {
  kind: 'goto';
  goto: string;
}

export type ScenarioNode =
  | SayNode
  | ChoiceNode
  | BgNode
  | BgmNode
  | SeNode
  | ParamNode
  | FlagNode
  | GotoNode;

export interface Scene {
  id: string;
  /** 開始時の背景 */
  bg?: string;
  /** 開始時のBGM */
  bgm?: string;
  /** 本文を読み切ったあとに自動で進むシーンID */
  next?: string;
  body: ScenarioNode[];
}

// ---------------------------------------------------------------------------
// セーブデータ
// ---------------------------------------------------------------------------

/**
 * セーブデータのスキーマ版。
 * 構造を変えたら必ずインクリメントし、save.ts のマイグレーションを足すこと。
 * （03_tech-stack.md §8.4 のリスク対策）
 */
export const SAVE_SCHEMA_VERSION = 1;

export interface GameSnapshot {
  schemaVersion: number;
  sceneId: string;
  /** シーン本文内の現在位置 */
  index: number;
  params: Record<ParamKey, number>;
  affection: Record<HeroineId, number>;
  /** 週スケジュール制の現在週（1〜12） */
  week: number;
  flags: Record<string, boolean>;
  bg: string | null;
  bgm: string | null;
  /** 保存時刻（ISO文字列） */
  savedAt: string;
  /** セーブ一覧に出す短い説明 */
  caption: string;
}
