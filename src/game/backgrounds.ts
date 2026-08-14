/**
 * 背景の定義。
 *
 * シナリオの `bg:` に書くキーと、実ファイル・出典を1か所で対応づける。
 * 素材は再配布を避けるため**リポジトリに含めない**（`.gitignore` 済み）。
 * `npm run fetch:assets` で各自の環境にダウンロードする運用にしている。
 *
 * 出典: みんちりえ https://min-chi.material.jp/
 *   商用利用OK / 加工OK / クレジット任意 / 素材としての再配布は禁止
 *   → 詳細と全出典は docs/06_credits.md
 */

export interface BackgroundDef {
  /** シナリオで使うキー */
  key: string;
  /** public/assets/bg/ 配下のファイル名 */
  file: string;
  /** みんちりえのスラッグ（ダウンロード元） */
  slug: string;
  /** 素材セット内の通し番号（1=日中, 2=夕方, 3=夜 のことが多い） */
  variant: number;
  /** 画面左上に出す説明（素材が無いときのフォールバック表示にも使う） */
  label: string;
}

export const BACKGROUNDS: BackgroundDef[] = [
  { key: 'izakaya_night', file: 'izakaya_night.jpg', slug: 'izakaya_table', variant: 3, label: '居酒屋・夜' },
  { key: 'room_night', file: 'room_night.jpg', slug: 'single_room2', variant: 3, label: '自室・夜' },
  { key: 'cafe_day', file: 'cafe_day.jpg', slug: 'cafe', variant: 1, label: '喫茶店・昼' },
  { key: 'cafe_evening', file: 'cafe_evening.jpg', slug: 'cafe', variant: 2, label: '喫茶店・夕方' },
  {
    key: 'family_restaurant',
    file: 'family_restaurant.jpg',
    slug: 'casual_restaurant',
    variant: 3,
    label: 'ファミレス・夜',
  },
  { key: 'street_evening', file: 'street_evening.jpg', slug: 'urban_street', variant: 2, label: '街並み・夕方' },
];

const BY_KEY = new Map(BACKGROUNDS.map((b) => [b.key, b]));

export function backgroundOf(key: string | null): BackgroundDef | null {
  if (!key) return null;
  return BY_KEY.get(key) ?? null;
}

/** Viteのbaseに追従させるため、画像URLは import.meta.env.BASE_URL から組み立てる */
export function backgroundUrl(def: BackgroundDef): string {
  return `${import.meta.env.BASE_URL}assets/bg/${def.file}`;
}
