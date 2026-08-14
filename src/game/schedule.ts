/**
 * 週スケジュール制の設定（C2① / A4②: 作中期間は約3ヶ月＝12週）。
 *
 * 「誰と何回目に会ったか」でシーンが決まる。イベントを増やすときは
 * DATE_SCENES に追記するだけでよく、スケジュール画面側は触らなくて済む。
 */

import type { CharacterId, HeroineId } from './types';

/** 作中の総週数 */
export const FINAL_WEEK = 12;

/** 1週あたりの行動枠。使い切ると翌週へ進む。 */
export const SLOTS_PER_WEEK = 2;

/**
 * ヒロインごとのデートイベント。progress[heroine] 回目に対応するシーンを再生する。
 * 用意した回数を超えて選ばれた場合は FILLER_SCENE を再生する。
 */
export const DATE_SCENES: Record<HeroineId, string[]> = {
  aoi: [],
  sui: [],
  touka: [],
  shion: [],
  momoka: ['momoka_date_01'],
};

/** 茜に相談する（C3: ヒントを得る）。会うたびに違う話をさせたいので同様に配列で持つ。 */
export const AKANE_SCENES: string[] = ['akane_talk_01'];

/** イベントを用意していない相手を選んだときの受け皿 */
export const FILLER_SCENE = 'date_filler';

/** 12週を終えたあとに飛ぶ先 */
export const FINALE_SCENE = 'finale_judge';

/** スケジュール画面に並ぶ選択肢 */
export interface ScheduleAction {
  /** 誰と会うか。'akane' は相談枠。 */
  who: CharacterId;
  label: string;
  /** まだ出会っていない相手は選べない */
  requireFlag?: string;
}

export const SCHEDULE_ACTIONS: ScheduleAction[] = [
  { who: 'momoka', label: '桃果と会う', requireFlag: 'met_momoka' },
  { who: 'aoi', label: '葵と会う', requireFlag: 'met_aoi' },
  { who: 'sui', label: '翠と会う', requireFlag: 'met_sui' },
  { who: 'touka', label: '橙香と会う', requireFlag: 'met_touka' },
  { who: 'shion', label: '紫音と会う', requireFlag: 'met_shion' },
  { who: 'akane', label: '茜に相談する' },
];

/** 攻略対象の5人かどうか。茜・主人公は progress を持たないため区別が要る。 */
export const isHeroineId = (id: CharacterId): id is HeroineId => id !== 'akane' && id !== 'iroha';

/** 次に再生すべきシーンIDを決める */
export function nextSceneFor(who: CharacterId, progress: Record<HeroineId, number>): string {
  if (!isHeroineId(who)) {
    return who === 'akane' ? (AKANE_SCENES[0] ?? FILLER_SCENE) : FILLER_SCENE;
  }

  const scenes = DATE_SCENES[who];
  const count = progress[who] ?? 0;
  return scenes[count] ?? FILLER_SCENE;
}
