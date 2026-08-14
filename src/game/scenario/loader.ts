/** ブラウザ側のシナリオ読み込み。検証ロジック本体は build.ts にある。 */

import type { Scene } from '../types';
import { buildScenes } from './build';

const files = import.meta.glob('/src/scenario/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const SCENES: Map<string, Scene> = buildScenes(files);

export function getScene(id: string): Scene {
  const scene = SCENES.get(id);
  if (!scene) throw new Error(`シーン "${id}" が見つかりません`);
  return scene;
}
