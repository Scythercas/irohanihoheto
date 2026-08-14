"""立ち絵の背景を透過する。

    python scripts/remove-bg.py public/assets/chara/akane

なぜ rembg ではなく自前かというと、rembg は写真で学習したモデルなので、
アニメ調の髪の毛先を食ってしまうことがあるため。
本作の立ち絵は「白背景・くっきりした輪郭」で生成しているので、
画像の縁からの塗りつぶし（フラッドフィル）のほうが確実で速い。

処理の流れ:
  1. 画像の外周から、白い領域だけを繋がりでたどって背景と判定する
     → 白いシャツは背景と繋がっていないので残る（ここが単純な色抜きとの違い）
  2. 「囲まれた白領域」（腕と体の隙間、髪と首の隙間など）を拾い直す
     → ここは外周と繋がっていないので 1. では消えない
     → **純白率**（ほぼ真っ白な画素の割合）で背景かどうかを判定する
        背景の隙間は生成時の平坦な白なので純白率が非常に高い（90%以上）
        Yシャツ・目のハイライトは陰影や線画があるため純白率が低い（数%〜数十%）
  3. 背景を透明にする
  4. 輪郭の1〜2pxは半透明にして、ギザギザを防ぐ
  5. 白が滲んだ縁の色を戻す（白フチの除去）

reForge の venv の Python で実行する（PIL / numpy が入っているため）:
  C:\\StabilityMatrix\\Data\\Packages\\Stable Diffusion WebUI reForge\\venv\\Scripts\\python.exe
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

# 「確実に背景」とみなす明るさ。RGBの最小値がこれ以上なら白とみなす。
SOLID_BG = 250
# 「輪郭のぼかし」とみなす下限。ここから SOLID_BG の間が半透明になる。
EDGE_LOW = 225
# 半透明にする縁の幅（px）
FEATHER = 2

# --- 囲まれた白領域（腕と体の隙間など）の判定 ---------------------------------
#
# 【重要】囲まれた領域を切り出すしきい値は SOLID_BG より**低く**すること。
# 250 にすると Yシャツ内部の明るい部分だけが細かく分断され（実測で86個の断片）、
# その断片が「ほぼ純白」と判定されてシャツに穴が空く。
# 245 まで下げるとシャツが陰影ごと1つの塊になり、純白率が下がって正しく残る。
HOLE_CANDIDATE = 245
# この明るさ以上を「ほぼ真っ白」とみなす
PURE_WHITE = 253
# 領域内の「ほぼ真っ白」の割合がこれ以上なら背景の隙間と判定する。
#
# 実測（茜 / normal.png、HOLE_CANDIDATE=245 のとき）:
#   背景の隙間        … 90.1% / 92.2% / 97.3% / 97.4%   ← 生成時の平坦な白
#   Yシャツ・目の白   …  1.5% /  2.7% /  5.6% / 12.1%   ← 陰影と線画があるため低い
# 間が大きく空いているので誤判定しにくい。迷ったら残す側に倒すこと
# （小さな白い点が残るより、シャツや目に穴が空くほうが致命的なため）。
HOLE_PURITY = 0.80
# これより小さい領域は判定せず残す（線画のすき間などのノイズ対策）
MIN_HOLE_AREA = 80


def background_mask(rgb: np.ndarray) -> np.ndarray:
    """画像の外周から繋がっている白領域だけを True にする。"""
    height, width = rgb.shape[:2]
    whiteish = rgb.min(axis=2) >= SOLID_BG

    visited = np.zeros((height, width), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    def push(y: int, x: int) -> None:
        if not visited[y, x] and whiteish[y, x]:
            visited[y, x] = True
            queue.append((y, x))

    for x in range(width):
        push(0, x)
        push(height - 1, x)
    for y in range(height):
        push(y, 0)
        push(y, width - 1)

    while queue:
        y, x = queue.popleft()
        if y > 0:
            push(y - 1, x)
        if y < height - 1:
            push(y + 1, x)
        if x > 0:
            push(y, x - 1)
        if x < width - 1:
            push(y, x + 1)

    return visited


def enclosed_background(rgb: np.ndarray, outer_bg: np.ndarray) -> tuple[np.ndarray, list[tuple[int, float]]]:
    """外周と繋がっていない白領域のうち、背景の隙間だけを True にする。

    腕と体の間、髪と首の間などは画像の縁と繋がっていないため、
    外周からの塗りつぶしでは消えない。ここを純白率で拾い直す。
    """
    height, width = rgb.shape[:2]
    candidate = (rgb.min(axis=2) >= HOLE_CANDIDATE) & ~outer_bg

    pure = rgb.min(axis=2) >= PURE_WHITE
    mask = np.zeros((height, width), dtype=bool)
    seen = np.zeros((height, width), dtype=bool)
    report: list[tuple[int, float]] = []

    for y0 in range(height):
        for x0 in range(width):
            if not candidate[y0, x0] or seen[y0, x0]:
                continue

            queue = deque([(y0, x0)])
            seen[y0, x0] = True
            pixels: list[tuple[int, int]] = []
            while queue:
                y, x = queue.popleft()
                pixels.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < height and 0 <= nx < width and candidate[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))

            if len(pixels) < MIN_HOLE_AREA:
                continue

            ys = np.fromiter((p[0] for p in pixels), dtype=int, count=len(pixels))
            xs = np.fromiter((p[1] for p in pixels), dtype=int, count=len(pixels))
            purity = float(pure[ys, xs].mean())
            if purity >= HOLE_PURITY:
                mask[ys, xs] = True
                report.append((len(pixels), purity))

    return mask, sorted(report, reverse=True)


def dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    """マスクを radius ピクセルだけ膨らませる。"""
    out = mask.copy()
    for _ in range(radius):
        grown = out.copy()
        grown[1:, :] |= out[:-1, :]
        grown[:-1, :] |= out[1:, :]
        grown[:, 1:] |= out[:, :-1]
        grown[:, :-1] |= out[:, 1:]
        out = grown
    return out


def process(path: Path) -> str:
    image = Image.open(path).convert("RGBA")
    data = np.array(image).astype(np.float64)
    rgb = data[:, :, :3]

    outer = background_mask(rgb.astype(np.uint8))
    holes, hole_report = enclosed_background(rgb.astype(np.uint8), outer)
    bg = outer | holes

    alpha = np.full(rgb.shape[:2], 255.0)
    alpha[bg] = 0.0

    # 輪郭の帯だけ、白さに応じて半透明にする（アンチエイリアス）
    band = dilate(bg, FEATHER) & ~bg
    darkness = rgb.min(axis=2)
    soft = np.clip((SOLID_BG - darkness) / (SOLID_BG - EDGE_LOW), 0.0, 1.0) * 255.0
    alpha[band] = np.minimum(alpha[band], soft[band])

    # 白背景が滲んだぶんを戻す（白フチの除去）
    # P = a*C + (1-a)*255  →  C = (P - (1-a)*255) / a
    a = (alpha / 255.0)[:, :, None]
    with np.errstate(invalid="ignore", divide="ignore"):
        unpremultiplied = np.where(a > 0.02, (rgb - (1 - a) * 255.0) / np.maximum(a, 1e-6), rgb)
    rgb = np.clip(unpremultiplied, 0, 255)

    out = np.dstack([rgb, alpha]).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(path)

    transparent = float((alpha == 0).mean() * 100)
    semi = int(((alpha > 0) & (alpha < 255)).sum())
    gap_px = int(holes.sum())
    gaps = f"隙間 {len(hole_report)}箇所/{gap_px:5d}px" if hole_report else "隙間 なし"
    return f"透明 {transparent:5.1f}%  縁 {semi:5d}px  {gaps}"


def main() -> int:
    if len(sys.argv) < 2:
        print("使い方: python scripts/remove-bg.py <画像フォルダ または PNGファイル>")
        return 1

    target = Path(sys.argv[1])
    files = sorted(target.glob("*.png")) if target.is_dir() else [target]
    if not files:
        print(f"PNGが見つかりません: {target}")
        return 1

    print(f"背景を透過します（{len(files)}枚）")
    for path in files:
        print(f"  {path.name:<14} {process(path)}")
    print("\n完了。ゲームを再読み込みすると反映されます。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
