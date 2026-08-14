# アセット制作ガイド ―『いろはにほへと』

最終更新: 2026-08-14 / 予算: **0円**

---

## 0. 立ち絵の受け入れ仕様（これに従えば「置くだけ」で反映される）

| 項目 | 仕様 |
|---|---|
| 形式 | **PNG（背景透過）** |
| 推奨サイズ | **1024 × 1536 px**（縦長のバストアップ〜膝上） |
| 構図 | **膝上〜バストアップ。頭のてっぺんに少し余白**。下端は切れていてよい |
| 置き場所 | `public/assets/chara/<キャラID>/<表情>.png` |
| キャラID | `akane` `aoi` `sui` `touka` `shion` `momoka` |
| 表情ファイル名 | `normal` `smile` `laugh` `bored` `smug` `fluster` `away` の7種 |

例: `public/assets/chara/akane/normal.png`

**PNGを置くだけで自動的に使われる。** コードの変更は不要。
読み込めない表情は、コードで描いた仮の立ち絵 → 色シルエット の順に自動でフォールバックする。

> `public/assets/` 配下は `.gitignore` の対象を確認すること。
> 自作素材は含めてよいが、配布素材（みんちりえ等）は再配布禁止のため含めない。

---

## 1. 画像生成AIの環境（AMD GPU / 0円）

開発機は **AMD Radeon RX 6600 XT（VRAM 8GB）／Ryzen 5 5600／RAM 32GB／Windows 11**。
**NVIDIAではないためCUDAが使えない**。AMD向けの経路を選ぶ必要がある。

| 手段 | 導入の手間 | 速度 | 備考 |
|---|---|---|---|
| **Amuse AI** | ★ 最も簡単（インストーラ1本） | 中 | **まずこれを試すのを推奨。** AMD向けに最適化された無料アプリ |
| ComfyUI + ZLUDA | ★★★ やや面倒 | 速い | LoRA・ControlNetまで使える。キャラ同一性を突き詰めるならこちら |
| SD.Next（DirectML） | ★★ | 遅め | 導入は比較的容易 |
| Web版の無料クレジット | ★ | — | 上記が不調なときの保険。**規約は必ず確認**（複数アカウントは不可） |

**VRAM 8GB あれば SDXL系のアニメ調モデルが動く。**

---

## 2. 茜の生成プロンプト（まず1枚だけ試す用）

### 守るべき設定（設計書 §2.2・変更禁止）

- **髪色: 茜色＝深い緋色／赤**
- **髪型: 低い位置で結んだミディアムのポニーテール。毛先はハネ気味**
- 24歳・事務職。ブラウス＋カーディガンなど、きちんと感のある服装
- ※「肩にかかるショートヘア・顔が小さい」は**葵**の設定。茜と混同しないこと
- 性格はツンデレ。口が悪く素直に褒めない → **normal は「やや不機嫌そう」くらいがちょうどいい**

### プロンプト（英語・SDXLアニメ系モデル想定）

```text
masterpiece, best quality, very aesthetic, official art,
1girl, solo, standing, upper body to knees, full front view, looking at viewer,
24 years old, japanese office worker,
crimson red hair, madder red hair, low ponytail, medium hair, messy hair tips, wispy bangs,
dark red eyes, slender,
white blouse, dark gray cardigan, simple office attire,
slightly annoyed expression, tsundere, mouth closed,
soft cel shading, clean lineart, anime style, flat color,
simple background, transparent background, white background,
```

### ネガティブプロンプト

```text
lowres, bad anatomy, bad hands, extra digits, fewer digits, cropped head,
worst quality, low quality, jpeg artifacts, signature, watermark, username,
blurry, multiple views, multiple girls, nsfw,
pink hair, orange hair, blonde hair, twintails, high ponytail, long hair,
school uniform, hat,
```

**髪色の指定が最重要。** ピンク・オレンジ・金髪に転びやすいので、ネガティブで潰しておく。

### 推奨パラメータ

| 項目 | 値 |
|---|---|
| 解像度 | 832 × 1216（SDXL標準の縦長）→ 後で1024×1536に拡大 |
| Steps | 28〜32 |
| CFG Scale | 5〜7 |
| Sampler | DPM++ 2M Karras |

---

## 3. キャラの同一性を保つ手順（懸念R6への対策）

**1枚目が気に入ったら、必ず seed をメモすること。** ここが全ての起点になる。

1. **seed を固定**する。同じ seed ＋ 同じプロンプトなら、ほぼ同じ顔が出る
2. **表情だけを差し替える**。プロンプトの表情部分（`slightly annoyed expression`）を下表に置き換え、
   **他は一字も変えない**

| 表情ファイル名 | プロンプトの差し替え箇所 |
|---|---|
| `normal` | `slightly annoyed expression, mouth closed` |
| `smile` | `soft smile, gentle expression, mouth closed` |
| `laugh` | `laughing, open mouth, closed eyes, happy` |
| `bored` | `half-closed eyes, unimpressed, bored expression, flat mouth` |
| `smug` | `smug smile, smirk, one eyebrow raised` |
| `fluster` | `blushing, flustered, surprised, wide eyes, small open mouth` |
| `away` | `looking away, averted eyes, pouting slightly` |

3. それでも顔が揺れる場合は、**1枚目を参照画像にした img2img（Denoise 0.35〜0.5）**で表情差分を作る
4. 最終手段として、気に入った数枚から **LoRA を自作**する（ComfyUI + ZLUDA 環境が必要）

### 背景の抜き方

生成時に `simple background, white background` を指定し、後から透過にする。

- 無料の手段: GIMP の「色域を選択」→ 削除、または `rembg`（無料・ローカル実行）
- **髪の輪郭が最も汚くなりやすい**ので、そこだけ手で整える

---

## 4. ボイス

| 対象 | 方針 |
|---|---|
| 葵 | **知人に収録依頼**。まず**テスト録音を5本**もらって品質を確認してから本収録 |
| その他 | **VOICEVOX**（無料・商用可・キャラごとのクレジット表記が必要） |
| 範囲 | 主要シーンのみの部分ボイス（1キャラ20〜30本程度から始める） |

### 知人収録のノイズ処理手順（Audacity・無料）

1. **無音部分を数秒録ってもらう**（ノイズプロファイル取得用）。これを最初に依頼すること
2. Audacity で無音部分を選択 → `エフェクト > ノイズ低減` → **ノイズプロファイルの取得**
3. 全体を選択 → 同じダイアログ → ノイズ低減 12dB / 感度 6 / 周波数平滑化 3 で適用
4. `エフェクト > ノーマライズ` → **-3.0 dB**
5. 前後の無音を削り、`ファイル > 書き出し` → **OGG または WAV**

**録音時のお願い（依頼相手に伝えること）**

- スマホではなく、できればPC＋イヤホンマイク
- エアコン・冷蔵庫を止める。窓を閉める
- 布団や厚手のカーテンの近くで録ると反響が減る
- 口とマイクの距離を一定に保つ

---

## 5. BGM・効果音

| 種別 | 調達先 | 費用 |
|---|---|---|
| BGM | DOVA-SYNDROME / 甘茶の音楽工房 | 0円 |
| 効果音 | 効果音ラボ | 0円 |

**使ったら必ず `docs/06_credits.md` に記録すること。**

---

## 6. 背景

**取得済み**。みんちりえ（<https://min-chi.material.jp/>）から `npm run fetch:assets` で取得する。
詳細と規約は `docs/06_credits.md`。

**未解決**: 水族館の素材がみんちりえに無い（桃果の初デート先）。対応方針は要判断。
