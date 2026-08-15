/**
 * 背景の定義。
 *
 * シナリオの `bg:` に書くキーと、実ファイル・出典を1か所で対応づける。
 * 素材は再配布を避けるため**リポジトリに含めない**（`.gitignore` 済み）。
 * `npm run fetch:assets` で各自の環境にダウンロードする運用にしている。
 *
 * 【素材の調達先はこの2サイトに限る】どちらも 商用OK / 加工OK / 再配布NG
 *   - みんちりえ            https://min-chi.material.jp/
 *   - ゲームまてりあるず     https://game-materials.com/
 * 規約の詳細と全出典は docs/06_credits.md
 */

/** みんちりえ。`<slug>/<slug>_<variant>.jpg` の規則でファイルが並んでいる。 */
export interface MinchirieSource {
  site: 'minchirie';
  slug: string;
  /** 素材セット内の通し番号（1=日中, 2=夕方, 3=夜 のことが多い） */
  variant: number;
}

/** ゲームまてりあるず。WordPressのアップロードパスをそのまま指定する。 */
export interface GameMaterialsSource {
  site: 'game-materials';
  /** 例: '2024/05/aquarium1.jpg' */
  path: string;
  /** 素材ページのURL（出典表記と再取得のため） */
  page: string;
}

export type BackgroundSource = MinchirieSource | GameMaterialsSource;

export interface BackgroundDef {
  /** シナリオで使うキー */
  key: string;
  /** public/assets/bg/ 配下のファイル名 */
  file: string;
  /** 画面や資料での説明 */
  label: string;
  source: BackgroundSource;
}

export const BACKGROUNDS: BackgroundDef[] = [
  {
    key: 'izakaya_night',
    file: 'izakaya_night.jpg',
    label: '居酒屋・夜',
    source: { site: 'minchirie', slug: 'izakaya_table', variant: 3 },
  },
  {
    key: 'room_night',
    file: 'room_night.jpg',
    label: '自室・夜',
    // 以前は single_room2 を使っていたが、ピンクの壁・テディベア・鏡台があり
    // どう見ても女性の部屋だった。24歳男性の一人暮らしとして成立する
    // 机・ノートPC・本棚だけの1Kに差し替えた（variant 4 が夜）。
    source: { site: 'minchirie', slug: 'single_room3', variant: 4 },
  },
  {
    key: 'cafe_day',
    file: 'cafe_day.jpg',
    label: '喫茶店・昼',
    source: { site: 'minchirie', slug: 'cafe', variant: 1 },
  },
  {
    key: 'cafe_evening',
    file: 'cafe_evening.jpg',
    label: '喫茶店・夕方',
    source: { site: 'minchirie', slug: 'cafe', variant: 2 },
  },
  {
    key: 'family_restaurant',
    file: 'family_restaurant.jpg',
    label: 'ファミレス・夜',
    source: { site: 'minchirie', slug: 'casual_restaurant', variant: 3 },
  },
  {
    key: 'street_evening',
    file: 'street_evening.jpg',
    label: '街並み・夕方',
    source: { site: 'minchirie', slug: 'urban_street', variant: 2 },
  },
  {
    key: 'aquarium_evening',
    file: 'aquarium_evening.jpg',
    label: '水族館',
    // どの1枚を採用するかはユーザー確認待ち（候補7枚）。差し替えは path の数字を変えるだけ。
    source: {
      site: 'game-materials',
      path: '2024/05/aquarium1.jpg',
      page: 'https://game-materials.com/aquarium/',
    },
  },
];

const BY_KEY = new Map(BACKGROUNDS.map((b) => [b.key, b]));

export function backgroundOf(key: string | null): BackgroundDef | null {
  if (!key) return null;
  return BY_KEY.get(key) ?? null;
}

/** ダウンロード元のURL */
export function sourceUrl(source: BackgroundSource): string {
  if (source.site === 'minchirie') {
    return `https://min-chi.material.jp/mc/materials/background-c/${source.slug}/${source.slug}_${source.variant}.jpg`;
  }
  return `https://game-materials.com/wp-content/uploads/${source.path}`;
}

/** Viteのbaseに追従させるため、画像URLは import.meta.env.BASE_URL から組み立てる */
export function backgroundUrl(def: BackgroundDef): string {
  return `${import.meta.env.BASE_URL}assets/bg/${def.file}`;
}
