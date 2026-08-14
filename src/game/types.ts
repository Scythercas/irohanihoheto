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

/**
 * 条件分岐。上から順に評価し、最初に条件を満たしたものへ飛ぶ。
 * 条件を書かない case は「それ以外」を意味するので、最後に置くこと。
 *
 * 茜のデレ段階（H5）や、終幕のエンディング判定に使う。
 */
export interface BranchCase {
  goto: string;
  /** このフラグが立っていること */
  ifFlag?: string;
  /** 出会ったヒロインが何人以上か（met_* フラグの数で数える） */
  ifMetCount?: number;
  /** 総合魅力レベル（5色の合計）の下限 */
  ifTotalParam?: number;
  /** 個別パラメータの下限 */
  ifParam?: Partial<Record<ParamKey, number>>;
}

export interface BranchNode {
  kind: 'branch';
  cases: BranchCase[];
}

// --- チャット（LINE風メッセージ画面。C6①: ゲームの中心） --------------------

/** チャットの1メッセージ。from が 'iroha' なら自分の吹き出し（右側）。 */
export interface ChatNode {
  kind: 'chat';
  from: CharacterId;
  text: string;
  /** 表示する時刻（例: '21:04'）。省略時は前のメッセージから自動で刻む。 */
  at?: string;
}

/** チャットでの返信を選ぶ。ChoiceNode との違いは見た目と、選んだ文が吹き出しとして残ること。 */
export interface ReplyNode {
  kind: 'reply';
  options: ChoiceOption[];
}

// --- カラット（マッチングアプリ画面。C5②: 簡易表現に留める） ----------------

export type CaratView = 'match' | 'profile';

export interface CaratNode {
  kind: 'carat';
  view: CaratView;
  target: HeroineId;
}

// --- 週スケジュール（C2①） --------------------------------------------------

/** この節でスケジュール画面に制御を渡す。誰と会うかはプレイヤーが選ぶ。 */
export interface ScheduleNode {
  kind: 'schedule';
}

/**
 * 画面右に立たせる相手を明示的に指定する。null で退場。
 *
 * 通常はセリフから自動で決まり、背景が変われば自動で退場するので、
 * これを書くのは「しゃべる前から立たせておきたい」「その場に残したい」
 * といった例外的なときだけでよい。
 */
export interface StageNode {
  kind: 'stage';
  partner: CharacterId | null;
}

export type ScenarioNode =
  | SayNode
  | ChoiceNode
  | BgNode
  | BgmNode
  | SeNode
  | ParamNode
  | FlagNode
  | GotoNode
  | BranchNode
  | ChatNode
  | ReplyNode
  | CaratNode
  | ScheduleNode
  | StageNode;

/** 画面モード。シーン単位で切り替える。 */
export type ScreenKind = 'adv' | 'chat';

export interface Scene {
  id: string;
  /** 画面モード。省略時は 'adv'。 */
  screen?: ScreenKind;
  /** チャット相手。相手が変わるとチャット履歴はリセットされる（＝別スレッド）。 */
  with?: CharacterId;
  /** 開始時の背景 */
  bg?: string;
  /** 開始時のBGM */
  bgm?: string;
  /** 本文を読み切ったあとに自動で進むシーンID */
  next?: string;
  body: ScenarioNode[];
}

/** 画面に残るチャット履歴の1件 */
export interface ChatEntry {
  from: CharacterId;
  text: string;
  at: string;
}

// ---------------------------------------------------------------------------
// セーブデータ
// ---------------------------------------------------------------------------

/**
 * セーブデータのスキーマ版。
 * 構造を変えたら必ずインクリメントし、save.ts のマイグレーションを足すこと。
 * （03_tech-stack.md §8.4 のリスク対策）
 */
export const SAVE_SCHEMA_VERSION = 3;

export interface GameSnapshot {
  schemaVersion: number;
  sceneId: string;
  /** シーン本文内の現在位置 */
  index: number;
  params: Record<ParamKey, number>;
  affection: Record<HeroineId, number>;
  /** 週スケジュール制の現在週（1〜12） */
  week: number;
  /** その週に残っている行動枠 */
  slots: number;
  /** ヒロインごとに何回デートしたか。次に再生するイベントの決定に使う。 */
  progress: Record<HeroineId, number>;
  flags: Record<string, boolean>;
  bg: string | null;
  bgm: string | null;
  chatWith: CharacterId | null;
  chatLog: ChatEntry[];
  partner: CharacterId | null;
  faces: Record<string, string>;
  /** 保存時刻（ISO文字列） */
  savedAt: string;
  /** セーブ一覧に出す短い説明 */
  caption: string;
}
