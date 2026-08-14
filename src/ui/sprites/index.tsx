/**
 * 立ち絵の登録所。
 *
 * 優先順位:
 *   1. public/assets/chara/<id>/<表情>.png  … 実素材があればこれを使う
 *   2. コードで描いた立ち絵（現状は茜のみ）
 *   3. キャラクターカラーの無彩シルエット
 *
 * PNGは「置くだけ」で有効になる。読み込めなければ静かに次の候補へ落ちるので、
 * 素材が1枚ずつ増えていく制作序盤でも画面が壊れない。
 */

import { useEffect, useState } from 'react';
import { CHARACTERS } from '../../game/constants';
import type { CharacterId } from '../../game/types';
import AkaneSprite, { type Expression } from './AkaneSprite';

type SpriteComponent = (props: { expression?: Expression }) => JSX.Element;

/** コードで描いた立ち絵。実素材が用意できたキャラから順に消していける。 */
const DRAWN: Partial<Record<CharacterId, SpriteComponent>> = {
  akane: AkaneSprite,
};

const KNOWN_EXPRESSIONS = new Set<Expression>([
  'normal',
  'bored',
  'smug',
  'laugh',
  'fluster',
  'away',
  'smile',
]);

function normalize(expression?: string): Expression {
  return expression && KNOWN_EXPRESSIONS.has(expression as Expression)
    ? (expression as Expression)
    : 'normal';
}

function pngUrl(id: CharacterId, expression: Expression): string {
  return `${import.meta.env.BASE_URL}assets/chara/${id}/${expression}.png`;
}

/** 立ち絵が無いキャラのための仮表示。存在と色だけを示す。 */
function Silhouette({ id }: { id: CharacterId }) {
  const character = CHARACTERS[id];
  return (
    <svg viewBox="0 0 300 460" width="100%" height="100%" role="img" aria-label={character.name}>
      <defs>
        <linearGradient id={`sil-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={character.color} />
          <stop offset="100%" stopColor={character.colorDeep} />
        </linearGradient>
      </defs>
      <circle cx="150" cy="120" r="72" fill={`url(#sil-${id})`} />
      <path
        d="M150 208 C104 208 68 236 56 282 C46 320 42 386 40 460 L260 460 C258 386 254 320 244 282 C232 236 196 208 150 208 Z"
        fill={`url(#sil-${id})`}
      />
    </svg>
  );
}

interface Props {
  id: CharacterId;
  expression?: string;
}

export default function Sprite({ id, expression }: Props) {
  const face = normalize(expression);
  const src = pngUrl(id, face);
  const [pngFailed, setPngFailed] = useState(false);

  // 表情やキャラが変わったら、PNGの有無をもう一度試す
  useEffect(() => {
    setPngFailed(false);
  }, [src]);

  if (!pngFailed) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setPngFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'bottom center' }}
      />
    );
  }

  const Drawn = DRAWN[id];
  if (Drawn) return <Drawn expression={face} />;
  return <Silhouette id={id} />;
}

/**
 * 主人公・色葉。A5①により顔は描かない。
 * 「まだ色がついていない」という設定そのままに、無彩色のシルエットで置く。
 */
export function IrohaSilhouette() {
  return (
    <svg viewBox="0 0 300 460" width="100%" height="100%" role="img" aria-label="色葉">
      <defs>
        <linearGradient id="iroha-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6B6B72" />
          <stop offset="100%" stopColor="#3E3E45" />
        </linearGradient>
      </defs>
      <circle cx="150" cy="118" r="70" fill="url(#iroha-body)" />
      <path
        d="M150 204 C102 204 66 234 54 282 C44 322 40 388 38 460 L262 460 C260 388 256 322 246 282 C234 234 198 204 150 204 Z"
        fill="url(#iroha-body)"
      />
    </svg>
  );
}
