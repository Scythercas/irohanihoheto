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

## 1. 画像生成AIの選定（AMD GPU / 0円）

開発機は **AMD Radeon RX 6600 XT（VRAM 8GB, RDNA2）／Ryzen 5 5600／RAM 32GB／Windows 11**。
**NVIDIAではないためCUDAが使えない**ので、AMD向けの経路を選ぶ必要がある。

### 選定の決め手は「画質」ではなく「表情差分を同じ顔で作れるか」

本作は1キャラにつき**表情7種**が要る。しかも6人分。
つまり必要なのは「いい絵が1枚出る」ことではなく、**同じ顔のまま口と目だけ差し替えられること**。

これを実現する機能が **inpaint（部分描き直し）** で、**ここが選定を決める**。
1枚ずつプロンプトで生成し直す方式では、顔が毎回変わって破綻する。

| 要件 | 効いてくる機能 |
|---|---|
| 同じ顔を保つ | **seed固定 ＋ inpaint** |
| 表情だけ変える | **inpaint（顔部分マスク）** |
| 背景を透過する | **LayerDiffuse**（透過PNGを直接生成）または rembg |
| 何十枚も試す | **ローカル実行**（枚数無制限・完全無料） |

### 推奨: Stability Matrix ＋ Forge（または ComfyUI）

| 手段 | 導入 | inpaint | LoRA | 透過生成 | 費用 | 判定 |
|---|---|---|---|---|---|---|
| **Stability Matrix → Forge/ComfyUI** | ★★（GUIインストーラが面倒を見る） | ◎ | ◎ | ◎ | 0円 | **本命** |
| A1111 / ComfyUI + ZLUDA（手動） | ★★★ 面倒 | ◎ | ◎ | ◎ | 0円 | 上が失敗したとき |
| Amuse AI | ★ 最も簡単 | △ 限定的 | △ | × | 0円 | 本番には力不足。**2026-08-14 時点で公式サイトがダウン中** |
| SD.Next（DirectML） | ★★ | ○ | ○ | △ | 0円 | 速度が出ない |
| Web無料枠（Civitai/SeaArt等） | ★ | ○ | ○ | × | 0円枠あり | 保険。**規約要確認・複数アカウント不可** |
| NovelAI / niji・journey | ★ | ○ | — | × | **有料** | 0円方針に反する |

**Stability Matrix** は生成環境のインストーラ兼ランチャー。
Forge / ComfyUI / A1111 をワンクリックで導入でき、**AMD向けのバックエンド選択も面倒を見てくれる**。
ZLUDA を手で組むより格段に楽なので、まずこれを試す。

> **注意**: これらのツールは更新が速い。導入時は必ず公式の最新手順を確認すること。
> AMD向けバックエンド（ZLUDA / DirectML / ROCm）の対応状況は変わりうる。

### VRAM 8GB での現実的な設定

- **SDXL系は動く**が余裕はない。Forge なら省メモリ運用が効く
- 重いと感じたら **SD1.5系のアニメモデル**に落とす手もある（軽い・LoRAが豊富・品質は一段落ちる）
- 生成解像度は **832×1216** 程度に抑え、仕上げに Hires.fix か Upscale で 1024×1536 へ

### モデルの選び方（Civitai から入手）

アニメ調の立ち絵なら **Illustrious XL 系** または **Animagine XL 系** が扱いやすい。
「かわいらしく」を狙うなら、モデルページのサンプルを見て**絵柄が好みのものを選ぶ**のが一番早い。

> **【重要】モデルのライセンスを必ず確認すること。**
> Civitai のモデルには商用利用や生成物の扱いに条件が付くものがある。
> 本作は **完全無料公開（D4①）**なので大半は問題ないが、
> 使ったモデル名とライセンスを **`docs/06_credits.md` に記録**すること。

### 進め方（Stability Matrix から直接始める）

> **2026-08-14 時点で amuse-ai.com はダウンしている（Cloudflare 522）。**
> Amuse は下見用にすぎないので、飛ばして問題ない。

1. **Stability Matrix を入れる**
   - 配布元: <https://lykos.ai/> ／ <https://github.com/LykosAI/StabilityMatrix>
   - Windows版は `StabilityMatrix-win-x64.zip` を展開して実行するだけ（インストール不要）
   - 起動後、Packages から **「Stable Diffusion WebUI reForge」**（または Forge）を追加する
   - **AMD向けのバックエンド（ZLUDA / DirectML）を選ぶ画面が出たら、まず ZLUDA を試す**。
     動かなければ DirectML に切り替える
   - **本プロジェクトの実環境は reForge**（`C:\StabilityMatrix\Data\Packages\Stable Diffusion WebUI reForge`）
2. **モデルを入れる**
   - Stability Matrix の Model Browser から Civitai を検索できる
   - アニメ調の **Illustrious XL 系 / Animagine XL 系** で、サンプルの絵柄が好みのものを選ぶ
   - **ライセンスを確認し、`docs/06_credits.md` に記録する**
3. §2 のプロンプトで **`normal` の1枚**を作り込む。**気に入ったら seed を必ずメモ**
4. §3 の手順で **inpaint で表情6種**を派生させる

### つまずいたときの対処

#### `TypeError: 'NoneType' object is not iterable` が出る

**チェックポイント（モデル）が選択されていない。** 起動直後は未選択のことがある。

見分け方: 生成結果の下の表示が **`A: 0.00 GB, R: 0.00 GB`** になっている
（＝VRAMにモデルが1バイトも載っていない）。

対処:

1. WebUI 左上の **Checkpoint ドロップダウン**からモデルを選ぶ
2. リストが空なら、隣の **🔄（Refresh）** を押す
3. 選んだあと、コンソールに `Model loaded in ...` と出て、`Sys` の使用量が増えれば成功

> **【注意】Forge と reForge は別物。**
> 本家 Forge にある **UIプリセット切替（sd / xl / flux）は reForge には無い**
> （`forge_preset` の実装自体が存在しないことを確認済み）。
> reForge は A1111 と同じ見た目で、**SDXLかどうかはモデルから自動判定される**ので、
> チェックポイントを選ぶだけでよい。

> 設定は `Packages\<パッケージ名>\config.json` の `sd_model_checkpoint` に記録される。
> ここが空なら未選択。**WebUI起動中に手で書き換えても終了時に上書きされる**ので、UI側で選ぶこと。

#### モデルの選び分け（本作の用途）

| 種別 | 用途 |
|---|---|
| Illustrious / NoobAI 系（`illustrious...`, `novaAnimeXL...`） | **アニメ立ち絵。本作はこれ** |
| 実写系（`epicrealismXL`, `novaRealityXL`） | 使わない |
| ケモノ系（`novaKemonoXL`） | 使わない |

### 詰まったときの代替（すべて0円）

| 状況 | 代替 |
|---|---|
| ZLUDA も DirectML も動かない | Stability Matrix から **ComfyUI** を入れ直す（バックエンドの選択肢が違う） |
| ローカルが重すぎる／動かない | **Civitai の生成機能**（無料クレジットが毎日回復）。inpaint も使える。※複数アカウントは規約違反 |
| SDXLが重い | **SD1.5系のアニメモデル**に落とす。軽く、LoRAが豊富 |

---

## 2. 茜の生成プロンプト（まず1枚だけ試す用）

### 守るべき設定（設計書 §2.2・変更禁止）

- **髪色: 茜色＝深い緋色／赤**
- **髪型: 低い位置で結んだミディアムのポニーテール。毛先はハネ気味**
- 24歳・事務職。ブラウス＋カーディガンなど、きちんと感のある服装
- ※「肩にかかるショートヘア・顔が小さい」は**葵**の設定。茜と混同しないこと
- 性格はツンデレ。口が悪く素直に褒めない → **normal は「やや不機嫌そう」くらいがちょうどいい**

### ポジティブプロンプト（Forge の上の欄にそのまま貼る）

**下から2行目の `annoyed, frown, closed mouth,` が表情の行。** ここだけを差し替えて差分を作る。

```text
masterpiece, best quality, amazing quality, very aesthetic, absurdres,
1girl, solo, cowboy shot, standing, facing viewer, looking at viewer, arms at sides,
mature female, 24 years old, office lady,
crimson hair, dark red hair, low ponytail, medium hair, messy hair, wavy hair tips, hair between eyes, sidelocks,
dark red eyes, slender,
white collared shirt, dark grey cardigan, black pencil skirt,
annoyed, frown, closed mouth,
simple background, white background, anime style, clean lineart, cel shading, soft lighting
```

### ネガティブプロンプト（Forge の下の欄にそのまま貼る）

```text
lowres, worst quality, low quality, bad anatomy, bad hands, missing fingers, extra digits, fewer digits, extra arms,
jpeg artifacts, signature, watermark, username, artist name, text, logo,
blurry, depth of field, multiple views, multiple girls, 2girls,
nsfw, nude, cleavage,
pink hair, orange hair, blonde hair, brown hair, black hair, blue hair, purple hair, green hair,
twintails, high ponytail, very long hair, short hair, ahoge, hair bun,
school uniform, hat, glasses,
cropped, head out of frame, from behind
```

**髪色の指定が最重要。** ピンク・オレンジ・金髪に転びやすいので、ネガティブで他の髪色を全部潰してある。
**他ヒロインの色（青・翠・橙・紫・桃）も入っている**ので、この5人を作るときは該当色をネガティブから外すこと。

### 推奨パラメータ（Forge の設定欄）

| 項目 | 値 |
|---|---|
| Sampling method | **DPM++ 2M SDE Karras**（無ければ Euler a） |
| Sampling steps | **28** |
| CFG Scale | **5**（アニメ系SDXLは低めが安定） |
| Width × Height | **832 × 1216** |
| Hires. fix | 有効 / Upscale **1.25倍** / Denoising **0.4**（VRAM 8GBなので1.5倍以上は重い） |
| Seed | 最初は **-1**（ランダム）。気に入った1枚が出たら**その seed を固定** |

### 表情差分の差し替え行（7種）

ポジティブの `annoyed, frown, closed mouth,` の行を、下の1行に置き換える。**他は一字も変えない。**

| ファイル名 | 差し替える1行 |
|---|---|
| `normal` | `annoyed, frown, closed mouth,` |
| `smile` | `smile, closed mouth, gentle expression, half-closed eyes,` |
| `laugh` | `laughing, open mouth, closed eyes, happy, teeth,` |
| `bored` | `bored, half-closed eyes, expressionless, flat mouth, jitome,` |
| `smug` | `smug, smirk, one eye closed, raised eyebrow, grin,` |
| `fluster` | `blush, embarrassed, surprised, wide eyes, small open mouth, flustered,` |
| `away` | `looking to the side, averted eyes, pout, closed mouth,` |

---

## 3. キャラの同一性を保つ手順（懸念R6への対策）

**1枚目が気に入ったら、必ず seed をメモすること。** ここが全ての起点になる。

推奨は **①→②** の2段構え。②の inpaint が本命で、①だけでは顔が揺れる。

**① seed を固定してプロンプトの表情部分だけ差し替える（お手軽・精度は中）**

同じ seed ＋ 同じプロンプトなら、ほぼ同じ顔が出る。
表情部分（`slightly annoyed expression`）を下表に置き換え、**他は一字も変えない**。

**② inpaint で顔だけ描き直す（本命・精度が高い）**

`normal` の完成画像を img2img → inpaint に読み込み、**目と口の周りだけをマスク**して、
表情部分だけ差し替えたプロンプトで再生成する。

- Denoising strength **0.4〜0.6**（高すぎると別人になる）
- **Only masked** を有効にすると、マスク部分を高解像度で描き直せる
- **髪・輪郭・服はマスクしない**。ここを触ると同一性が崩れる

この方式なら、**体と服と髪は1枚目のまま完全に固定**され、表情だけが変わる。

| 表情ファイル名 | プロンプトの差し替え箇所 |
|---|---|
| `normal` | `slightly annoyed expression, mouth closed` |
| `smile` | `soft smile, gentle expression, mouth closed` |
| `laugh` | `laughing, open mouth, closed eyes, happy` |
| `bored` | `half-closed eyes, unimpressed, bored expression, flat mouth` |
| `smug` | `smug smile, smirk, one eyebrow raised` |
| `fluster` | `blushing, flustered, surprised, wide eyes, small open mouth` |
| `away` | `looking away, averted eyes, pouting slightly` |

**③ それでも足りないとき**

- 気に入った数枚から **LoRA を自作**する（20〜30枚あれば作れる）。6人分やるなら結局これが一番早い
- 顔の角度や体勢を揃えたいときは **ControlNet（OpenPose / Canny）** を併用する

### 背景の抜き方

| 手段 | 方法 |
|---|---|
| **LayerDiffuse**（推奨） | Forge の拡張。**透過PNGを直接生成できる**ので後処理が不要 |
| rembg | 無料・ローカル実行の自動切り抜き。手軽 |
| GIMP | `simple background, white background` で生成 → 「色域を選択」→ 削除 |

**髪の輪郭が最も汚くなりやすい**ので、そこだけは目視で確認し、必要なら手で整える。

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
