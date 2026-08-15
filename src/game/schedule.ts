/**
 * 週スケジュール制の設定（C2① / A4②: 作中期間は約3ヶ月＝12週）。
 *
 * 「誰と何回目に会ったか」でシーンが決まる。イベントを増やすときは
 * DATE_SCENES に追記するだけでよく、スケジュール画面側は触らなくて済む。
 */

import type { CharacterId, HeroineId } from './types';

/** 作中の総週数 */
export const FINAL_WEEK = 12;

/**
 * 1週あたりの行動枠。使い切ると翌週へ進む。
 *
 * 総枠数 = FINAL_WEEK × SLOTS_PER_WEEK。**これがゲームの通貨の総量**であり、
 * しきい値（constants.ts の THRESHOLD）と対で意味を持つ。
 * 2枠（計24）では5色すべてを MASHIRO_ALL まで押し上げる余裕がなく、
 * 茉白ルートが数学的に到達不能になる。変更したら `npm run balance` で確認すること。
 */
export const SLOTS_PER_WEEK = 3;

/**
 * ヒロインごとのデートイベント。progress[heroine] 回目に対応するシーンを再生する。
 * 用意した回数を超えて選ばれた場合は FILLER_SCENE を再生する。
 */
export const DATE_SCENES: Record<HeroineId, string[]> = {
  aoi: ['aoi_date_01', 'aoi_date_02', 'aoi_date_03'],
  sui: ['sui_date_01', 'sui_date_02', 'sui_date_03'],
  touka: ['touka_date_01', 'touka_date_02', 'touka_date_03'],
  shion: ['shion_date_01', 'shion_date_02', 'shion_date_03'],
  momoka: ['momoka_date_01', 'momoka_date_02', 'momoka_date_03'],
};

/**
 * 用意したデートを使い切ったあと、何度でも再生される「重ねの一日」。
 *
 * ここを共通の1シーンにしてしまうと **どの色も伸びない**ため、
 * 「他の子に会う意味がない＝トレードオフが成立しない」という設計事故になる。
 * ヒロインごとに分けて、対応する色が伸びるようにしてある。
 */
export const EXTRA_DATE_SCENES: Record<HeroineId, string> = {
  aoi: 'aoi_date_extra',
  sui: 'sui_date_extra',
  touka: 'touka_date_extra',
  shion: 'shion_date_extra',
  momoka: 'momoka_date_extra',
};

/** 茉白に相談する（C3: ヒントを得る）。デレ段階の出し分けは mashiro_talk_01 の branch が行う。 */
export const MASHIRO_SCENES: string[] = ['mashiro_talk_01'];

/** ヒロインでもない相手を選んだときの受け皿（通常は到達しない） */
export const FILLER_SCENE = 'date_filler';

/** 12週を終えたあとに飛ぶ先 */
export const FINALE_SCENE = 'finale_judge';

/** スケジュール画面に並ぶ選択肢 */
export interface ScheduleAction {
  /** 誰と会うか。'mashiro' は相談枠。 */
  who: CharacterId;
  label: string;
  /** まだ出会っていない相手は選べない */
  requireFlag?: string;
}

/**
 * 【並び順は固定】`HEROINE_IDS` と同じ **青 → 翠 → 橙 → 紫 → 桃** の順に並べ、最後に茉白を置く。
 *
 * これは「カラット」の起動画面に石が並ぶ順（prologue_04）でもあり、
 * `constants.ts` のパラメータ定義順でもある。**作品を通して1つの順序に統一する。**
 * 茉白に相談するときの「誰の話か」を選ぶ選択肢（carat.yaml の `mashiro_hint_select`）も
 * この順に並べること。並びが場面ごとに違うと、選ぶたびに読み直す羽目になる。
 */
export const SCHEDULE_ACTIONS: ScheduleAction[] = [
  { who: 'aoi', label: '葵と会う', requireFlag: 'met_aoi' },
  { who: 'sui', label: '翠と会う', requireFlag: 'met_sui' },
  { who: 'touka', label: '橙香と会う', requireFlag: 'met_touka' },
  { who: 'shion', label: '紫音と会う', requireFlag: 'met_shion' },
  { who: 'momoka', label: '桃果と会う', requireFlag: 'met_momoka' },
  { who: 'mashiro', label: '茉白に相談する' },
];

/** 攻略対象の5人かどうか。茉白・主人公は progress を持たないため区別が要る。 */
export const isHeroineId = (id: CharacterId): id is HeroineId => id !== 'mashiro' && id !== 'iroha';

/** 次に再生すべきシーンIDを決める */
export function nextSceneFor(who: CharacterId, progress: Record<HeroineId, number>): string {
  if (!isHeroineId(who)) {
    return who === 'mashiro' ? (MASHIRO_SCENES[0] ?? FILLER_SCENE) : FILLER_SCENE;
  }

  const scenes = DATE_SCENES[who];
  const count = progress[who] ?? 0;
  return scenes[count] ?? EXTRA_DATE_SCENES[who];
}
