# アセット制作ガイド ―『いろはにほへと』

最終更新: 2026-08-15 / 予算: **0円**

> **【2026-08-15 方針】立ち絵は、`allowCommercialUse` に `Image` を含むモデルで作り直す。**
> 現行の茉白（7枚）は暫定。実施は**残り5人の立ち絵に着手するとき**にまとめて行う。
> モデルの足切り基準は §1、差し替え手順は `docs/06_credits.md` §5。

---

## 0. 立ち絵の受け入れ仕様（これに従えば「置くだけ」で反映される）

| 項目 | 仕様 |
|---|---|
| 形式 | **PNG（背景透過）** |
| 推奨サイズ | **1024 × 1536 px**（縦長のバストアップ〜膝上） |
| 構図 | **膝上〜バストアップ。頭のてっぺんに少し余白**。下端は切れていてよい |
| 置き場所（採用） | `public/assets/chara/<キャラID>/<表情>.png` |
| 置き場所（試作・候補） | `work-assets/chara/<キャラID>/`（**Git管理外**。何枚溜めてもよい） |
| キャラID | `mashiro` `aoi` `sui` `touka` `shion` `momoka` |
| 表情ファイル名 | `normal` `smile` `laugh` `bored` `smug` `fluster` `away` の7種 |

例: `public/assets/chara/mashiro/normal.png`

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

#### 【必須条件】`allowCommercialUse` に `Image` が含まれていること 【2026-08-15 確定】

**絵柄より先に、ここで足切りする。**
`Image` が無いモデルは「生成画像を含む作品を有償で配布できない」という制約が付き、
**あとから外せない**（＝立ち絵を全部作り直すしかなくなる）。

```powershell
# 選ぶ前に必ず実行する。id はモデルページのURL末尾の数字
Invoke-RestMethod "https://civitai.com/api/v1/models/131986" |
  Select-Object name, @{n='商用';e={$_.allowCommercialUse -join ','}}
```

| 判定 | 意味 |
|---|---|
| `Image` **あり** | ✅ 使ってよい |
| `Image` **なし**（`RentCivit, Rent` だけ等） | ❌ **採用しない** |

> **本プロジェクトはこれで一度失敗している。**
> 茉白の7枚を作ったあとで、使ったモデル（id 835655）に `Image` が無いことが判明した。
> 経緯は `docs/06_credits.md` §4、差し替え手順は同 §5。

#### 確認済みの採用候補（2026-08-15 時点）

| モデル | id | baseModel | 備考 |
|---|---|---|---|
| **CAT - Citron Anime Treasure** | 131986 | Illustrious / NoobAI | **★推奨。現行と同系なので §2 のプロンプトがそのまま使える** |
| Holy Mix [illustriousXL] | 959490 | Illustrious | 対抗。高コントラスト寄り |
| Animagine XL 4.0 | 1188071 | SDXL 1.0 | 許諾は最も広いが**タグの効き方と画風が変わる**ため、プロンプトを作り直すことになる |

**絵柄の好みは、足切りを通ったモデルの中だけで比べること。**
モデルページのサンプル画像を見るのが一番早い。

> **使ったモデル名・ライセンス・seed を必ず `docs/06_credits.md` に記録すること。**
> seed は表情差分を作り直すときに要る。

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
   - **まず `allowCommercialUse` に `Image` があるかで足切りし**、通ったものから絵柄で選ぶ（上記）
   - **ライセンスを確認し、`docs/06_credits.md` に記録する**
3. §2 のプロンプトで **`normal` の1枚**を作り込む。**気に入ったら seed を必ずメモ**
4. §3 の手順で **inpaint で表情6種**を派生させる

### 【重要】生成中にPCが落ちる場合

**これはソフト設定だけでは治らない。電力か熱の問題である可能性が高い。**
設定を軽くするのは「引き金を引きにくくする」対処であって、原因の除去ではない。

> 電源断を繰り返すと**ファイル破損のリスク**がある。作業中のデータはこまめに保存すること。

#### ハード側（本命の対処）

1. **AMD Software: Adrenalin Edition → パフォーマンス → チューニング → 電力制限を -15% 程度に下げる**
   → 最も効く。RX 6600 XT は瞬間的な電力スパイクが大きく、電源ユニットが古いとここで落ちる
2. **ファン回転数を手動で上げる**（カスタムファンカーブ）
3. **GPU温度とホットスポット温度を監視**する（Adrenalin のオーバーレイ、または HWiNFO64）。
   落ちる直前の温度が分かれば、熱か電力かを切り分けられる
4. **GPUファンが実際に回っているか目視**、ケース内のホコリを除去

#### ソフト側（負荷を下げる）

**A. 起動オプション**（Stability Matrix のパッケージ設定 → Launch Options）

| オプション | 設定 | 効果 |
|---|---|---|
| `--always-low-vram` | **ON** | UNetを分割して読み込む。VRAMのピークが大きく下がる |
| `--always-offload-from-vram` | **ON** | 使い終わったモデルをRAMへ退避。RAM 32GBあるので余裕がある |
| `--attention-quad` | ON（既定のまま） | 省メモリなアテンション。維持する |
| `--pin-shared-memory` | **OFF のまま** | reForge自身が「VRAM 12GB以下では問題を起こす」と警告している |

**B. 生成設定**

| 項目 | 通常 | **軽量** |
|---|---|---|
| **Hires. fix** | 有効 | **無効（切る）** ← 最も効く。2パス目が丸ごと消える |
| Width × Height | 832 × 1216 | **768 × 1152** |
| Sampling steps | 28 | **20** |
| Batch count / size | 1 / 1 | 1 / 1（変更なし） |

**C. 拡大は後工程に分ける**

Hires.fix を切ると解像度が足りないが、**気に入った1枚が出てから Extras タブで拡大**すればよい。
生成と拡大を分ければ、GPUに高い負荷がかかる時間が短くなる。

- Extras タブ → Upscaler 1 に **R-ESRGAN 4x+ Anime6B** → Resize **1.5** 倍

これで **768×1152 → 1152×1728** となり、受け入れ仕様（1024×1536）を満たせる。

#### それでも落ちるなら

| 手段 | 内容 |
|---|---|
| さらに解像度を下げる | 640 × 960。SDXLとしては下限に近く品質は落ちるが、構図の当たりは見られる |
| `--always-no-vram` を使う | `--always-low-vram` でも足りないとき用。かなり遅くなる |
| Web版に逃がす | Civitai の生成機能（無料クレジット）。ローカルGPUを一切使わない |

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

## 2. 茉白の生成プロンプト（まず1枚だけ試す用）

### 守るべき設定（設計書 §2.2・変更禁止）

- **髪色: 白（白銀）**【2026-08-15 変更。旧「茜／緋色」から改名に伴い変更】
- **髪型: 低い位置で結んだミディアムのポニーテール。毛先はハネ気味**
- 24歳・事務職。ブラウス＋カーディガンなど、きちんと感のある服装
- ※「肩にかかるショートヘア・顔が小さい」は**葵**の設定。茉白と混同しないこと
- 性格はツンデレ。口が悪く素直に褒めない → **normal は「やや不機嫌そう」くらいがちょうどいい**

#### 【最重要】白髪は「純白」にしないこと

背景透過（§3.6）は、**画像の白い部分を背景とみなして消す**仕組みで動いている。
純白（RGB 250以上）の髪を描かせると、**髪が背景ごと消える**。

対策は2つ。どちらも必ず守る。

1. **`silver hair` / `ash grey hair` を主タグにする。** `pure white hair` は使わない。
   狙いは `#E6E9F0`（RGB 230前後）＝ しきい値 `SOLID_BG` の 250 より確実に暗い銀白
2. **服を白から外す。** 旧設定は「白いYシャツ」だったが、
   これは以前**シャツが背景と誤判定されて襟元に穴が空く**事故を起こしている。
   白髪と組み合わせると再発が確実なので、**ライトグレーのシャツ＋チャコールのカーディガン**にする

> **副次的な利点**: 服が白でなくなることで、`HOLE_CANDIDATE` の調整（§3.6 の落とし穴）が
> そもそも要らなくなる。白髪への変更は、透過処理の観点ではむしろ有利に働く。

### v2（2026-08-15 改訂）— 初回生成の結果を受けて修正

**初回の失敗から分かったこと。** 同じ轍を踏まないよう記録しておく。

| 症状 | 原因 | 対策 |
|---|---|---|
| **ポニーテールにならず髪を下ろした姿になる** | `messy hair, wavy hair tips` が `low ponytail` を打ち消していた。さらに Clip skip 4 でプロンプト追従が落ちていた | 競合タグを削り `(low ponytail:1.4)` に強調をかける。**Clip skip は 2** |
| **表情が険しすぎる（睨んでいる）** | `annoyed, frown` が強すぎた | `neutral expression` ＋ 軽い `pout` に変更。ネガティブに `angry, glaring, scowl` |
| **スカートが透けて卑猥に見える** | 透け防止の指定が無かった | ポジティブに `opaque`、ネガティブに `see-through, sheer` 等。`black pantyhose` で脚も覆う |
| **胸が過度に強調される** | Illustrious/NoobAI系の既定の癖 | `small breasts` を明示し、ネガティブで `large breasts` 系を潰す |
| 全身のバランスが崩れる | **512×512 で生成していた** | **832×1216 で生成する**（SDXLは1024²前後が前提。512では破綻する） |
| 仕上がりがぼやける | Hires upscaler が `Latent` | **`R-ESRGAN 4x+ Anime6B`** に変更、Denoising 0.35 |

### ポジティブプロンプト（上の欄にそのまま貼る）

**下から3行目の `(neutral expression:1.2), slight pout, closed mouth, calm,` が表情の行。**
ここだけを差し替えて差分を作る。

```text
masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest,
1girl, solo, cowboy shot, standing, facing viewer, looking at viewer, arms at sides,
mature female, 24 years old, office lady, slender, small breasts,
(silver hair:1.35), ash grey hair, (low ponytail:1.4), hair tied at nape, medium hair, swept bangs, sidelocks,
grey eyes,
light grey collared shirt, buttoned up, charcoal cardigan, (opaque black pencil skirt:1.3), knee length skirt, black pantyhose,
(neutral expression:1.2), slight pout, closed mouth, calm,
simple background, white background, even lighting, anime style, clean lineart, cel shading
```

### ネガティブプロンプト（下の欄にそのまま貼る）

```text
lowres, worst quality, low quality, bad anatomy, bad hands, missing fingers, extra digits, fewer digits, extra arms,
jpeg artifacts, signature, watermark, username, artist name, text, logo,
blurry, depth of field, multiple views, multiple girls, 2girls,
nsfw, nude, cleavage, see-through, transparent clothes, sheer, wet clothes, panties, underwear, thighs visible through skirt,
large breasts, huge breasts, gigantic breasts, breast focus, oppai,
angry, glaring, scowl, furrowed brow, sharp eyes, gloomy, shadow over face,
pink hair, orange hair, blonde hair, brown hair, black hair, blue hair, purple hair, green hair, red hair, crimson hair,
pure white hair, glowing hair, shiny hair, blown out highlights,
old woman, elderly, wrinkles,
hair down, loose hair, twintails, high ponytail, very long hair, short hair, ahoge, hair bun,
white shirt, white clothes,
school uniform, hat, glasses, miniskirt,
cropped, head out of frame, from behind
```

> **【2026-08-15 実測・未解決】`grey eyes` が効かず、瞳が紫になった。**
> ネガティブに `purple hair` が入っているのに、**毛先にも薄紫が乗っている。**
> 紫は**紫音のイメージカラー**なので、「名前＝髪色」で人物を見分ける本作では紛らわしい。
> 直すなら `(grey eyes:1.3)` に強調をかけ、ネガティブへ `purple eyes, gradient hair, colored tips` を足す。
> **現行の素材はこの状態のまま採用している**（ユーザー判断待ち）。

**髪色の指定が最重要。** ピンク・オレンジ・金髪に転びやすいので、ネガティブで他の髪色を全部潰してある。
**他ヒロインの色（青・翠・橙・紫・桃）も入っている**ので、この5人を作るときは該当色をネガティブから外すこと。

**白髪ならではのネガティブが3種類入っている。** 消さないこと。

| タグ | 目的 |
|---|---|
| `pure white hair, glowing hair, shiny hair, blown out highlights` | **髪が純白に飛ぶと、背景透過で髪ごと消える** |
| `old woman, elderly, wrinkles` | 白髪＝老人と解釈されるのを防ぐ（24歳） |
| `white shirt, white clothes` | 服が白いと、髪・服・背景が一続きに見えて輪郭が消える |

### 推奨パラメータ

> **実際に茉白を作ったときの設定（2026-08-15・PNGメタデータより）。5人ぶんもこれに揃えること。**
>
> | 項目 | 値 |
> |---|---|
> | モデル | **`holyMixIllustriousxl_v1`**（Holy Mix [illustriousXL]・商用可） |
> | Sampler / Steps | Euler a / 20 |
> | **CFG Scale** | **7** ← 下の推奨は5だが、実際は7で良好な結果が出ている |
> | Size / Clip skip | 768 × 1152 / 2 |
> | seed（`normal`） | **3402663755** |

| 項目 | 値 | 備考 |
|---|---|---|
| Sampling method | **Euler a**（または DPM++ 2M SDE Karras） | どちらでも可 |
| Sampling steps | **20** | PCが落ちるため28から下げた |
| CFG Scale | 5〜**7** | 実績があるのは **7**（上の実測を参照） |
| Width × Height | **768 × 1152** | 512×512では破綻する。**PCが落ちるため832×1216から下げた** |
| **Clip skip** | **2** | **最重要。4だとプロンプトを聞かなくなる** |
| Hires. fix | **無効（切る）** | **PCが落ちるため。拡大は後から Extras タブで行う** |
| Seed | 最初は **-1**（ランダム） | 気に入った1枚が出たら**その seed を固定** |

### 表情差分の差し替え行（7種）

ポジティブの表情の行を、下の1行に置き換える。**他は一字も変えない。**

**ツンデレだからといって `angry` 系のタグは使わないこと。** 睨んだ顔になり、立ち絵として使えなくなる。
不機嫌さは `pout`（ふくれっ面）や `jitome`（ジト目）で表現する。こちらのほうが可愛げが残る。

| ファイル名 | 差し替える1行 |
|---|---|
| `normal` | `(neutral expression:1.2), slight pout, closed mouth, calm,` |
| `smile` | `soft smile, closed mouth, gentle expression, half-closed eyes,` |
| `laugh` | `laughing, open mouth, closed eyes, happy,` |
| `bored` | `jitome, half-closed eyes, expressionless, flat mouth, unamused,` |
| `smug` | `smug, smirk, one eye closed, grin, closed mouth,` |
| `fluster` | `blush, embarrassed, surprised, wide eyes, small open mouth, flustered,` |
| `away` | `looking to the side, averted eyes, pout, closed mouth,` |

---

## 3. キャラの同一性を保つ手順（懸念R6への対策）

**1枚目が気に入ったら、必ず seed をメモすること。** ここが全ての起点になる。

推奨は **①→②** の2段構え。②の inpaint が本命で、①だけでは顔が揺れる。

**① seed を固定してプロンプトの表情部分だけ差し替える（お手軽・精度は中）**

同じ seed ＋ 同じプロンプトなら、ほぼ同じ顔が出る。
表情部分（`slightly annoyed expression`）を下表に置き換え、**他は一字も変えない**。

#### ② inpaint で顔だけ描き直す（本命・精度が高い）

`normal` の完成画像を読み込み、**顔だけをマスクして描き直す**。
体・服・髪・背景は元画像のまま1ピクセルも動かないので、**同一性が原理的に保証される**。

##### 仕組み（理解しておくと調整が速い）

`Inpaint area: Only masked` を選ぶと、内部では次の処理が走る。

```text
マスク領域＋padding を切り出す
   ↓
指定した Width × Height に拡大する
   ↓
その解像度で生成する
   ↓
元のサイズに縮小して、元画像へ貼り戻す
```

つまり **Width × Height は「顔をどれだけ細かく描くか」**を意味し、画像全体の解像度ではない。
顔という狭い領域に解像度を集中投下できるので、全体を描き直すより顔が綺麗になる。

##### 手順

**1. 起点を確定させる**

`normal` を完成させてから始める。**差分から差分を作らないこと**（劣化が累積して別人になる）。
6種すべて、必ず `normal` を起点にする。

**2. img2img タブ → Inpaint サブタブ を開き、`normal` の画像をドロップする**

> `PNG Info` タブに画像を投げると、生成時のプロンプトと設定を読める。
> 送信ボタンがあれば img2img へ送ると設定ごと引き継げるので楽。

**3. マスクを塗る**

キャンバス右上のブラシサイズを調整して、白く塗る。

| 塗る | 塗らない |
|---|---|
| **眉**（最重要。表情の大半は眉で決まる） | 髪・後ろ髪 |
| **目**（まつげ・目尻を含む） | 顔の輪郭・あご |
| **口**（口角の外側まで少し広めに） | 首・肩・服 |
| 頬（赤面を出す表情のみ） | 背景 |

- **眉を塗り忘れると表情が変わらない。** ここが一番多い失敗
- 前髪が目にかかっている部分は塗らざるを得ない。`Mask blur` で馴染むので気にしなくてよい
- 輪郭を塗ると顔の形が変わる＝別人になる。**絶対に塗らない**

**4. プロンプトを差し替える**

表情の行を差し替えるのに加えて、**全身用のタグを削る**。
`Only masked` ではモデルに顔しか見えていないため、服やポーズのタグが残っていると顔に混ざる。

顔まわりの inpaint 用ポジティブ（例: `smile`）:

```text
masterpiece, best quality, amazing quality, very aesthetic,
1girl, solo, face focus, mature female, grey eyes, (silver hair:1.3), ash grey hair, swept bangs,
soft smile, closed mouth, gentle expression, half-closed eyes,
anime style, clean lineart, cel shading
```

ネガティブ:

```text
lowres, worst quality, low quality, bad anatomy, jpeg artifacts, blurry,
angry, glaring, scowl, furrowed brow, sharp eyes, gloomy, shadow over face,
pink hair, orange hair, blonde hair, brown hair, black hair, red hair,
pure white hair, glowing hair, old woman, elderly,
realistic, 3d
```

**5. 設定する**

| 項目 | 値 | 備考 |
|---|---|---|
| Resize mode | `Just resize` | |
| **Mask blur** | **6** | 既定は4。境目を馴染ませる |
| Mask mode | `Inpaint masked` | 既定のまま |
| **Masked content** | **`original`** | 既定のまま。**元の絵を下敷きにする＝画風が保たれる** |
| **Inpaint area** | **`Only masked`** | **既定は `Whole picture` なので必ず変更する** |
| **Only masked padding** | **64** | 既定は32。顔の周辺を少し広く見せて破綻を防ぐ |
| Sampling method | `Euler a` | txt2imgと同じでよい |
| Sampling steps | **20** | |
| Width × Height | **768 × 768** | 顔の描画解像度。PCが落ちるなら 512 × 512 |
| CFG Scale | **5** | |
| **Denoising strength** | **0.75** | **ここが調整の主役**。当初0.5を推奨したが低すぎて表情が変わらず、実測で **0.75がちょうどよい**（2026-08-15 確認） |
| Seed | `-1` | 固定しなくてよい。気に入ったら控える |

**6. Generate して、結果を見て Denoising を調整する**

| 症状 | 対処 |
|---|---|
| 表情が変わらない | Denoising を上げる（**0.75 が実測値**）。それでも駄目ならマスク範囲、特に**眉**を見直す |
| 別人になった | Denoising を下げる（0.75 → 0.65）。マスク範囲を狭める |
| マスクの継ぎ目が見える | `Mask blur` を上げる（8〜12）。`Soft inpainting` を有効にするのも効く |
| 顔が潰れる・ぼやける | Width × Height を上げる（768 → 896） |
| 目の左右が揃わない | Denoising を下げる。`Only masked padding` を広げる（64 → 96） |

**7. 保存する**

`work-assets/chara/mashiro/<表情>.png` に保存する。採用が決まったものだけ
`public/assets/chara/mashiro/<表情>.png` へ移す。

##### 背景の透過は「7枚そろえてから最後にまとめて」

1枚ずつ透過すると、抜き具合がばらついて立ち絵が揃わなくなる。

- **7種すべてを白背景のまま作り切る**
- 最後に**一括処理**する（下記 §3.6）
- 体・髪・輪郭は7枚とも完全に同一なので、**抜き方も自動的に揃う**

これが inpaint 方式のもう一つの利点。

---

## 3.6 背景の透過

### 用意したスクリプトで一括処理する（推奨）

```powershell
& "C:\StabilityMatrix\Data\Packages\Stable Diffusion WebUI reForge\venv\Scripts\python.exe" `
  scripts\remove-bg.py public\assets\chara\mashiro
```

**フォルダ内のPNGをまとめて透過し、その場で上書きする。** 実行前に元画像を
`work-assets\chara\<ID>\_original_opaque\` へ退避しておくこと。

> reForge の venv の Python を使うのは、PIL と numpy がすでに入っているため。
> 追加インストールは要らない。

### 【2026-08-15 追加】白髪になったことによる注意

本スクリプトは**「白い部分＝背景」**という前提で動いている。
茉白の髪が白になったため、**素材の作り方を間違えると髪ごと消える。**

| 守ること | 理由 |
|---|---|
| 髪は**銀白（RGB 230前後）**にする。純白（250以上）にしない | `SOLID_BG = 250` を超えた画素は背景として塗りつぶされる |
| プロンプトに `pure white hair, glowing hair, blown out highlights` を**ネガティブで**入れる | ハイライトが飛ぶと、そこだけ穴が空く |
| 服を白にしない | 髪・服・背景が地続きになり、外周フラッドフィルが服まで到達する |

**透過した直後に必ず「髪の毛先」と「頭頂部のハイライト」を拡大して確認すること。**
欠けていたら `SOLID_BG` を上げる（250 → 252）。それでも欠けるなら生成側が明るすぎる。

#### 白髪での実測値（茉白・2026-08-15）

**心配された「髪が背景ごと消える」は起きなかった。** 設計どおりに機能している。

| 項目 | 結果 |
|---|---|
| 透明率 | 7枚すべて **56.5%** で一致（＝体と輪郭が完全に同一。inpaintが正しく効いている） |
| 隙間の除去 | 1枚あたり **7箇所 / 約6,748px**（髪と首の間・腕と体の間） |
| 取り残した純白 | **187〜287px**（実用上ゼロ） |
| 縁の明るさ平均 | **207**（250に近いと白フチ。問題なし） |
| 髪の明るさ | 中央値 **206** ／ 上位1% でも **242** ← しきい値 250 に届いていない |

**実行前に必ず「消される候補」を目視すること。** 白髪では下見の価値が特に高い。
外周背景をシアン、囲まれた白領域をマゼンタで塗った画像を作って確認すると、
**髪に色が乗っていないか**が一目で分かる。茉白では7箇所すべてが正しく背景だった。

> 以前の検証値（透明率65%など）は**旧・茜（緋色の髪／白いYシャツ）で測ったもの**であり、
> 現行素材には当てはまらない。

### なぜ rembg を使わないのか

rembg は**写真で学習したモデル**なので、アニメ調の**髪の毛先を食ってしまう**ことがある。
本作の立ち絵は「白背景・くっきりした輪郭」で生成しているため、
**画像の縁からの塗りつぶし（フラッドフィル）のほうが確実で速く、モデルのダウンロードも不要**。

### スクリプトがやっていること

| 手順 | 内容 |
|---|---|
| 1 | 画像の**外周から繋がっている白領域**をたどって背景と判定する |
| 2 | **囲まれた白領域**（腕と体の隙間、髪と首の隙間、指の間）を拾い直す |
| 3 | 背景を透明にする |
| 4 | 輪郭の1〜2pxを半透明にして、ギザギザを防ぐ |
| 5 | 白が滲んだ縁の色を戻す（**白フチの除去**） |

**手順1だけでは足りない。** 腕と体の隙間などは画像の縁と繋がっていないため消えず、
暗い背景に置いたときに白く浮く。かといって「白い画素を全部消す」と**Yシャツと目のハイライトまで消える**。

#### 手順2の判定基準 ―「純白率」

囲まれた白領域ごとに、**ほぼ真っ白（RGB最小値 ≥ 253）な画素の割合**を測って区別する。

| 領域 | 純白率（実測・茉白） | 理由 |
|---|---|---|
| **背景の隙間** | **90.1% / 92.2% / 97.3% / 97.4%** | 生成時の平坦な白。陰影がない |
| **Yシャツ・目のハイライト** | **1.5% / 2.7% / 5.6% / 12.1%** | 陰影と線画があるため白一色にならない |

**間が大きく空いているので誤判定しにくい。** しきい値は 80%。

#### 【重要な落とし穴】囲まれた領域を切り出すしきい値

`HOLE_CANDIDATE`（既定 245）を **`SOLID_BG`（250）と同じにしてはいけない**。

250 にすると、**Yシャツ内部の明るい部分だけが細かく分断され**（実測で1枚あたり86個の断片になった）、
その断片ひとつひとつが「ほぼ純白」と判定されて**襟元に穴が空く**。

245 まで下げるとシャツが陰影ごと1つの塊になり、純白率が下がって正しく残る
（隙間の検出数が 86箇所 → 3〜5箇所 に収束する）。

**判定に迷ったら残す側に倒すこと。** 小さな白い点が残るより、シャツや目に穴が空くほうが致命的。

### 結果の見方

実行すると各ファイルの透明率が出る。**7枚とも同じ数値になっていれば成功**
（＝体と輪郭が完全に一致している ＝ inpaint が正しく効いている）。

```text
  normal.png     透明  64.8%  半透明の縁    822px
  smile.png      透明  64.8%  半透明の縁    824px
```

| 症状 | 原因と対処 |
|---|---|
| **腕と体の隙間などが白いまま** | 純白率が足りていない。`HOLE_PURITY` を下げる（0.80 → 0.70） |
| **Yシャツや目に穴が空いた** | `HOLE_CANDIDATE` が高すぎてシャツが分断されている。下げる（245 → 240）。「隙間」の検出数が数十件になっていたら確実にこれ |
| 透明率が7枚でバラバラ | inpaint で顔以外も描き変わっている。マスク範囲を見直す |
| 透明率が極端に低い（数%） | 背景が白くない。生成時に `simple background, white background` を入れる |
| 服の白い部分が画像の縁で消えた | その白領域が画像の縁と繋がっている。構図を見直す |
| 髪の毛先が欠けた | `SOLID_BG` を上げる（250 → 252） |
| 白フチが残る | `EDGE_LOW` を下げる（225 → 210）、`FEATHER` を上げる（2 → 3） |

**「隙間」の検出数は正常なら1枚あたり3〜5箇所。** 数十件出ていたら設定が誤っている。

### 検証（茉白・2026-08-15）

| 項目 | 結果 |
|---|---|
| 透明率 | 7枚すべて **65.2〜65.3%** で一致 |
| 隙間の除去 | 1枚あたり **3〜5箇所 / 約4,300px**（腕と体・髪と首・手と体） |
| Yシャツ・目の残存 | **1,394px**（穴なし。襟元も無傷） |
| 取り残した純白領域 | **合計5px**（1px×5箇所。実質ゼロ） |
| 縁の色 minRGB平均 | **204**（250近いと白フチ。問題なし） |

> 拡大して見える髪の中の白い筋は**元絵のハイライト**であって取り残しではない。
> 純白率が低い（＝陰影がある）ため正しく保持されている。

### 手作業でやる場合（GIMP）

1. `ファジー選択`（魔法の杖）で背景の白をクリック。しきい値 20 程度
2. `選択 > 選択範囲を拡大` 1px → `選択 > 境界をぼかす` 2px
3. `Delete` で削除
4. **アルファチャンネルを追加**してから保存（`レイヤー > 透明部分 > アルファチャンネルを追加`）
5. `ファイル > 名前を付けてエクスポート` → `.png`

**7枚それぞれで手作業するとムラが出る**ので、スクリプトのほうが確実。

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

## 3.5 費用と使用量について

### ローカル生成に「無料枠」は存在しない

Stability Matrix / reForge は**すべて自分のPC上で動いている**。モデルもソフトもローカルにあり、
生成のたびにどこかのサービスへ問い合わせているわけではない。

- **アカウント不要・ログイン不要**
- **生成枚数は無制限**。1日何百枚作っても課金されない
- クレジットや残高という概念自体がない

したがって **「無料枠を使い切る」ことは起こらない**。0円制作（`docs/03_tech-stack.md`）が
成立しているのはこのため。

### 代わりに気にするもの

| 項目 | 現状（2026-08-15 実測） | 目安 |
|---|---|---|
| **ディスク空き容量** | Cドライブ **298.6 GB 空き** | モデル1本6.5GB。立ち絵42枚作っても数百MB。当面問題なし |
| モデルの占有量 | `Models` **42.7 GB** | 使わないモデルは消してよい |
| 生成済み枚数 | **12枚**（`outputs` 配下） | 溜まったら定期的に整理する |
| **電気代** | — | 生成中で約160W。1枚30秒なら1000枚でも数十円程度 |
| **GPUへの負荷** | — | **実質的な制限はここ**。落ちる問題が解決するまでは連続生成を控える |

#### 使用量の確認方法

| 見たいもの | 方法 |
|---|---|
| 生成枚数 | `Data\Packages\Stable Diffusion WebUI reForge\outputs\` を開く（日付フォルダ別） |
| ディスク使用量 | エクスプローラで `C:\StabilityMatrix` のプロパティ |
| モデルの容量 | Stability Matrix の Models タブ |
| GPU温度・使用率 | AMD Adrenalin の「パフォーマンス」タブ、または `Alt + R` のオーバーレイ |

### 無料枠が関係するのは、外部サービスに逃がしたときだけ

ローカルが動かず **Civitai のオンライン生成**などに切り替えた場合に限り、枠の概念が出てくる。

| サービス | 枠 | 確認方法 |
|---|---|---|
| Civitai | **Buzz**（毎日回復するクレジット） | サイト右上に残高が表示される |

**複数アカウントで枠を稼ぐのは規約違反**なので採らない（`docs/03_tech-stack.md` の方針）。

### 生成物の権利のほうが実質的な制約

枠より重要なのはこちら。**使ったモデルのライセンス**によって、生成物の商用利用に条件が付く。

**本プロジェクトはここで一度つまずいた。** 茉白の7枚を作ったあとで、
使ったモデルの `allowCommercialUse` に `Image` が無い＝**生成画像を売れない**ことが判明した。
そのため **§1 の足切り（`Image` の有無）を、モデルを落とす前に必ず行うこと。**
**モデル名・ライセンス・seed を `docs/06_credits.md` に記録すること。**

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

**取得済み**。`npm run fetch:assets` で取得する。詳細と規約は `docs/06_credits.md`。

| 調達先 | 用途 |
|---|---|
| みんちりえ <https://min-chi.material.jp/> | 居酒屋・自室・カフェ・ファミレス・街並み |
| ゲームまてりあるず <https://game-materials.com/> | 水族館（みんちりえに無かったため） |

**未解決**: 現在7種を使い回している。今後ほしい背景 ―― **美術館・花屋の店先・病院の前・公園・夜の高架下**。
`npm run check:scenario` が、シナリオで使われているのに未登録の背景キーを教えてくれる。
