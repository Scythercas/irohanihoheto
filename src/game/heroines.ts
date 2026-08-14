/**
 * ヒロインのプロフィール。
 *
 * 設計書 §2.2 のキャラクターシートが唯一の正。ここはその抜粋であり、
 * 「カラット」のプロフィール画面とスケジュール画面に出す情報だけを持つ。
 * 性格や攻略軸を変えたくなったら、先に設計書を直すこと。
 */

import type { HeroineId, ParamKey } from './types';
import { HEROINE_TO_PARAM } from './constants';

export interface HeroineProfile {
  id: HeroineId;
  age: number;
  job: string;
  /** カラットのプロフィール文。本人が書いた体で書く。 */
  bio: string;
  /** プロフィールに並ぶタグ */
  tags: string[];
  /** 攻略の軸となるパラメータ（＝髪色に対応） */
  param: ParamKey;
  /** 攻略のヒント。茜に相談したときに出す文言のもと（C3）。 */
  hint: string;
}

export const HEROINES: Record<HeroineId, HeroineProfile> = {
  aoi: {
    id: 'aoi',
    age: 26,
    job: '看護師',
    bio: 'シフト制なので予定が読めません。ドタキャンしてしまったらごめんなさい。\nでも、約束は大事にしたい人です。',
    tags: ['#夜勤あり', '#お酒すこし', '#まじめな人がいい'],
    param: HEROINE_TO_PARAM.aoi,
    hint: '取り繕われるのが一番きらい。間違ってると思ったら、ちゃんと言ってあげな。',
  },
  sui: {
    id: 'sui',
    age: 24,
    job: '花屋の店員',
    bio: '返信が遅くなる日があります。すみません。\nゆっくり話せる人と出会えたらうれしいです。',
    tags: ['#植物すき', '#人見知り', '#のんびり'],
    param: HEROINE_TO_PARAM.sui,
    hint: '落ち込んでるときに励ますのは逆効果。黙って聞いてあげるのが正解。',
  },
  touka: {
    id: 'touka',
    age: 23,
    job: 'アパレル販売員',
    bio: '笑ってる時間が長い人生がいいなと思ってます！\nとりあえず楽しくしゃべりましょ〜',
    tags: ['#お笑いすき', '#テンション高め', '#food好き'],
    param: HEROINE_TO_PARAM.touka,
    hint: 'あの子はボケ倒してくるタイプ。真面目に返したら終わり。拾ってあげな。',
  },
  shion: {
    id: 'shion',
    age: 25,
    job: 'グラフィックデザイナー',
    bio: '夜のほうが起きています。\n好きなものの話ができる人を探しています。',
    tags: ['#美術館', '#夜型', '#音楽'],
    param: HEROINE_TO_PARAM.shion,
    hint: '「なんかいいね」は絶対に言うな。わからないなら、わからないって言ったほうがマシ。',
  },
  momoka: {
    id: 'momoka',
    age: 21,
    job: '大学3年生',
    bio: '年上の人とお話ししてみたいです！\nいろいろ連れて行ってくれる人だとうれしいなあ',
    tags: ['#大学生', '#甘えたがり', '#カフェ巡り'],
    param: HEROINE_TO_PARAM.momoka,
    hint: '「どこでもいいよ」は言うな。あの子はあんたに決めてほしいんだよ。',
  },
};
