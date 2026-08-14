# 実装状況 ―『いろはにほへと』

最終更新: 2026-08-14 / **Phase3 開発中**

> セッションが切り替わったClaudeは、**何が実装済みで何が未実装か**をここで把握すること。
> 実装を進めたら必ずこの表を更新する。

リポジトリ: <https://github.com/Scythercas/irohanihoheto>（public）

---

## 1. システムの実装状況

| 機能 | 状態 | 実装場所 |
|---|---|---|
| タイトル画面 | ✅ | `src/ui/TitleScreen.tsx` |
| ADVテキスト表示・文字送り | ✅ | `src/ui/AdvScreen.tsx` `MessageWindow.tsx` |
| 選択肢 | ✅ | `src/ui/ChoiceList.tsx` |
| **LINE風チャットUI**（吹き出し・時刻・返信選択） | ✅ | `src/ui/ChatScreen.tsx` |
| **カラットのカード**（マッチング演出・プロフィール閲覧） | ✅ | `src/ui/CaratCard.tsx` |
| **週スケジュール画面**（12週・行動枠） | ✅ | `src/ui/ScheduleScreen.tsx` |
| **5角形のパラメータ表示＋変動通知** | ✅ | `src/ui/ParamPentagon.tsx` |
| **立ち絵の配置**（主人公=左固定／相手=右、話し手を大きく） | ✅ | `src/ui/StageLayer.tsx` |
| **茜の立ち絵（SVG製・表情7種）** | ✅ 仮素材 | `src/ui/sprites/AkaneSprite.tsx` |
| **条件分岐（branch）** | ✅ | `engine.ts` の `matchesCase` |
| **茜のデレ段階のゲート**（2人目＋魅力60） | ✅ | `carat.yaml` の `akane_talk_01` |
| 5色パラメータの管理・変動 | ✅ | `src/game/engine.ts` |
| ヒロイン好感度 | ✅ | `src/game/engine.ts` |
| フラグ管理 | ✅ | `src/game/engine.ts` |
| オートセーブ | ✅ | `src/game/save.ts`（スロット `auto`） |
| セーブデータのスキーマ版・移行 | ✅ 仕組みのみ | `src/game/save.ts` |
| シナリオYAMLの読み込み・検証 | ✅ | `src/game/scenario/build.ts` |
| 全分岐スモークテスト | ✅ | `scripts/smoke.ts` |
| **手動セーブ／ロード画面**（H2 a） | ❌ 未実装 | — |
| **コンフィグ画面**（音量・文字速度） | ❌ 未実装 | — |
| **バックログ（履歴）** | ❌ 未実装 | — |
| **既読管理・既読スキップ** | ❌ 未実装 | — |
| **オート再生** | ❌ 未実装 | — |
| **回想・エンディング一覧**（H2 c） | ❌ 未実装 | — |
| **BGM／SE／ボイスの再生**（Howler） | ❌ 未実装（`se` ノードは通過するだけ） | — |
| **茜のデレ段階解放**（H5） | ❌ 未実装（しきい値の定数のみ用意） | `constants.ts` の `AKANE_DERE_STEPS` |
| **エンディング判定**（個別／茜／サッド） | ❌ 未実装（`finale_judge` は仮） | `THRESHOLD` のみ定義済み |
| **立ち絵・背景・BGMの実素材** | ❌ 未着手（色面で仮置き） | — |

## 2. シナリオの実装状況

`npm run check:scenario` の集計値（2026-08-14 時点）: 21シーン / 本文116行 / チャット15発言 / 総2,333字

| 区分 | 状態 |
|---|---|
| プロローグ（茜への相談 →「マチアプ始めなよ」→ カラット導入） | ✅ 6シーン |
| カラット登録・スワイプ・桃果とマッチング | ✅ 3シーン |
| 桃果との初トーク（チャット） | ✅ 5シーン |
| 桃果のデート1回目（水族館） | ✅ 3シーン |
| 茜への相談1回目（ヒント役） | ✅ 1シーン |
| 週スケジュールのハブ | ✅ 1シーン |
| 汎用の埋めシーン | ✅ 1シーン |
| 終幕の仮シーン | ✅ 1シーン（仮） |
| **葵・翠・橙香・紫音との出会い** | ❌ 未着手 |
| **各ヒロインのデート2回目以降** | ❌ 未着手 |
| **茜の相談2回目以降・デレ段階イベント** | ❌ 未着手 |
| **各エンディング** | ❌ 未着手 |

## 3. シナリオYAMLの記法（早見表）

`src/scenario/*.yaml` に書く。**トップレベルはシーンの配列**。

### シーンの属性

```yaml
- id: momoka_date_01      # 必須。全体で一意
  screen: chat            # 省略時は adv。chat ならチャット画面で表示
  with: momoka            # screen: chat のとき必須。相手が変わると履歴がリセットされる
  bg: aquarium_evening    # 開始時の背景
  bgm: bgm_date           # 開始時のBGM
  next: schedule_hub      # 読み切ったあとに自動で進む先
  body: [...]
```

### body に書けるノード

| 書き方 | 意味 |
|---|---|
| `text: "..."` ＋ `who: akane` | セリフ。`who` を書かなければ**主人公の心の声**（A5①） |
| `face: smile` | 立ち絵の表情差分（素材が入ったら効く） |
| `voice: momoka_0012` | ボイスファイル名（拡張子なし） |
| `from: momoka` ＋ `msg: "..."` | **チャットの1メッセージ**。`from: iroha` なら自分の吹き出し |
| `at: "21:04"` | チャットの時刻を明示（省略時は自動で2分刻み） |
| `choice: [...]` | 通常の選択肢 |
| `reply: [...]` | **チャットの返信**。選んだ文が自分の吹き出しとして残る |
| `carat: match` ＋ `target: momoka` | **マッチング演出**のカード |
| `carat: profile` ＋ `target: momoka` | **プロフィール閲覧**のカード |
| `schedule: true` | **週スケジュール画面**に制御を渡す |
| `bg: street_evening` | 背景切替 |
| `bgm: bgm_daily` / `bgm: null` | BGM切替／停止 |
| `se: se_notification` | 効果音 |
| `params: { confidence: 3 }` | 選択肢を経ずにパラメータを動かす |
| `flag: met_aoi` ＋ `value: true` | フラグ操作 |
| `goto: other_scene` | 別シーンへ飛ぶ |
| `branch: [...]` | **条件分岐**（下記） |

### branch（条件分岐）

上から順に評価し、**最初に条件を満たしたものへ飛ぶ**。
**最後の項目は必ず「条件なし＝それ以外」にすること**（どれも満たさないと走査が止まるため、検証で弾かれる）。

```yaml
- branch:
    - goto: akane_dere_01
      ifMetCount: 2        # 出会ったヒロインが2人以上（met_* フラグの数）
      ifTotalParam: 60     # 総合魅力レベル（5色の合計）が60以上
    - goto: akane_talk_plain   # それ以外
```

指定できる条件: `ifFlag` / `ifMetCount` / `ifTotalParam` / `ifParam: { confidence: 30 }`

### 立ち絵と表情

- **主人公は常に左、会話相手は常に右**。話し手が大きく手前に、聞き手は小さく暗くなる
- 主人公はA5①により顔を描かない。**無彩色のシルエット**で置いている
- `face:` を省略したセリフは**直前の表情を引き継ぐ**
- 茜の表情キー: `normal` / `bored` / `smug` / `laugh` / `fluster` / `away` / `smile`
- 立ち絵の差し替えは `src/ui/sprites/index.tsx` の `REGISTRY` に登録するだけでよい

### choice / reply の各項目

```yaml
- reply:
    - text: "日曜、水族館はどう。夕方から空いてる"
      params: { confidence: 4 }        # 5色パラメータの変動
      affection: { momoka: 2 }         # ヒロイン好感度の変動
      goto: chat_momoka_02b_lead       # 省略時は次のノードへ
      requireFlag: met_momoka          # このフラグが立っているときだけ表示
```

**パラメータは 0 未満にならない**（`Math.max(0, ...)` で丸められる）。

## 4. 週スケジュールのイベント登録

デートイベントを増やすときは `src/game/schedule.ts` の `DATE_SCENES` に追記するだけでよい。
`progress[ヒロイン]` 回目に対応するシーンが再生される。用意した数を超えたら `date_filler` が出る。

```ts
export const DATE_SCENES: Record<HeroineId, string[]> = {
  momoka: ['momoka_date_01', 'momoka_date_02'],  // ← 2回目を足す場合
  ...
};
```

**ここに書いたシーンIDは `npm run check:scenario` でリンク切れを検査している。**

## 5. 次にやること（優先順）

1. **葵・翠・橙香・紫音との出会いシーン**を書き、`met_*` フラグを立てて全員をスケジュールに出す
2. **BGM／SE／ボイスの再生**（Howler.js）— 現状 `se` ノードは通過するだけ
3. **エンディング判定**（`THRESHOLD` を使って個別／茜／サッドを分岐）
4. **手動セーブ／ロード画面・コンフィグ・バックログ**
5. **アセット制作**（AMD GPU向けの画像生成環境構築 → `docs/04_asset-guide.md`）

## 6. 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-08-14 | 初版。チャットUI・カラットUI・週スケジュールの実装完了時点で作成 |
