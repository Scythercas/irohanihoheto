"""立ち絵の背景を透過する。

    python scripts/remove-bg.py public/assets/chara/akane

なぜ rembg ではなく自前かというと、rembg は写真で学習したモデルなので、
アニメ調の髪の毛先を食ってしまうことがあるため。
本作の立ち絵は「白背景・くっきりした輪郭」で生成しているので、
画像の縁からの塗りつぶし（フラッドフィル）のほうが確実で速い。

処理の流れ:
  1. 画像の外周から、白い領域だけを繋がりでたどって背景と判定する
     → 白いシャツは背景と繋がっていないので残る（ここが単純な色抜きとの違い）
  2. 背景を透明にする
  3. 輪郭の1〜2pxは半透明にして、ギザギザを防ぐ
  4. 白が滲んだ縁の色を戻す（白フチの除去）

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

    bg = background_mask(rgb.astype(np.uint8))

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
    return f"透明 {transparent:5.1f}%  半透明の縁 {semi:6d}px"


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
