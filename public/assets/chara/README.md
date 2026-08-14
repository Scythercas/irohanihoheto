# 立ち絵の置き場

**採用が決まった立ち絵だけ**をここに置く。ファイルを置けばゲームに自動で反映される（コード変更は不要）。

```text
public/assets/chara/<キャラID>/<表情>.png
```

| 項目 | 仕様 |
|---|---|
| キャラID | `akane` `aoi` `sui` `touka` `shion` `momoka` |
| 表情 | `normal` `smile` `laugh` `bored` `smug` `fluster` `away` |
| 形式 | **PNG（背景透過）** |
| 推奨サイズ | **1024 × 1536 px** |

例: `public/assets/chara/akane/normal.png`

読み込めない表情は、コードで描いた仮の立ち絵 → 色シルエット の順に自動でフォールバックする。

---

## 試作中の画像はここに置かない

生成したての候補や没カットは **`work-assets/chara/<キャラID>/`** に置く。
こちらは `.gitignore` 対象なので、リポジトリを汚さずに何枚でも溜められる。

```text
work-assets/chara/akane/   … 試作・候補（Git管理外）
public/assets/chara/akane/ … 採用したものだけ（Git管理下）
```

詳しい制作手順は `docs/04_asset-guide.md` を参照。
