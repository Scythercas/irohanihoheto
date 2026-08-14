import { useEffect, useRef, useState } from 'react';
import { CHARACTERS, PARAM_LABEL, PARAM_MAX, PARAM_ORDER, PARAM_TO_HEROINE } from '../game/constants';
import type { ParamKey } from '../game/types';
import styles from './ParamPentagon.module.css';

const SIZE = 100;
const CENTER = SIZE / 2;
const RADIUS = 34;
const LABEL_RADIUS = 44;
/** 見た目が完全に潰れないよう、0のときも中心から少しだけ広げる */
const MIN_RATIO = 0.08;

/** 5角形の頂点。誠実さ(青)を頂点に置き、そこから時計回りに並べる。 */
function vertex(i: number, radius: number): [number, number] {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / PARAM_ORDER.length;
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
}

function ratioOf(value: number): number {
  return MIN_RATIO + (1 - MIN_RATIO) * Math.min(1, value / PARAM_MAX);
}

interface Change {
  key: ParamKey;
  delta: number;
  /** 同じパラメータが連続で動いても再アニメーションさせるための識別子 */
  id: number;
}

/** 数値を見せずに変化量を伝える（C3②: パラメータの数値はプレイヤーに出さない） */
function describe(delta: number): string {
  const magnitude = Math.abs(delta);
  if (delta > 0) return magnitude >= 4 ? '大きく伸びた' : 'すこし伸びた';
  return magnitude >= 4 ? '大きく翳った' : 'すこし翳った';
}

interface Props {
  params: Record<ParamKey, number>;
  /** 開発時のみ数値も併記する */
  showNumbers?: boolean;
}

/**
 * 主人公が得た5つの色を、5角形（レーダーチャート）で示す。
 *
 * 塗りは1色ではなく、頂点ごとにそのパラメータの色を置いた5枚の三角形で構成する。
 * 「色を集めていく」という作品の中核メカニクスを、形と色の両方で見せるため。
 */
export default function ParamPentagon({ params, showNumbers = false }: Props) {
  const previous = useRef(params);
  const counter = useRef(0);
  const [changes, setChanges] = useState<Change[]>([]);

  useEffect(() => {
    const diffs: Change[] = [];
    for (const key of PARAM_ORDER) {
      const delta = params[key] - previous.current[key];
      if (delta !== 0) diffs.push({ key, delta, id: ++counter.current });
    }
    previous.current = params;
    if (diffs.length === 0) return;

    setChanges((current) => [...current, ...diffs]);
    const ids = new Set(diffs.map((d) => d.id));
    const timer = window.setTimeout(() => {
      setChanges((current) => current.filter((c) => !ids.has(c.id)));
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [params]);

  const changedKeys = new Set(changes.map((c) => c.key));
  const points = PARAM_ORDER.map((key, i) => vertex(i, RADIUS * ratioOf(params[key])));

  return (
    <div className={styles.wrap}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={styles.chart} role="img" aria-label="主人公の五つの色">
        {/* 目盛りの5角形 */}
        {[1, 0.66, 0.33].map((scale) => (
          <polygon
            key={scale}
            points={PARAM_ORDER.map((_, i) => vertex(i, RADIUS * scale).join(',')).join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.11)"
            strokeWidth="0.6"
          />
        ))}

        {/* 中心から各頂点への軸 */}
        {PARAM_ORDER.map((key, i) => {
          const [x, y] = vertex(i, RADIUS);
          return (
            <line
              key={key}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              stroke="rgba(255,255,255,0.09)"
              strokeWidth="0.6"
            />
          );
        })}

        {/* 塗り。隣り合う2頂点と中心で作る三角形を、パラメータの色で重ねる */}
        <g>
          {PARAM_ORDER.map((key, i) => {
            const next = (i + 1) % PARAM_ORDER.length;
            const a = points[i];
            const b = points[next];
            if (!a || !b) return null;
            return (
              <polygon
                key={key}
                points={`${CENTER},${CENTER} ${a.join(',')} ${b.join(',')}`}
                fill={CHARACTERS[PARAM_TO_HEROINE[key]].color}
                opacity="0.5"
              />
            );
          })}
        </g>

        {/* 外周の輪郭 */}
        <polygon
          points={points.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />

        {/* 各頂点の点。変動したものは大きく光らせる */}
        {PARAM_ORDER.map((key, i) => {
          const p = points[i];
          if (!p) return null;
          const changed = changedKeys.has(key);
          return (
            <circle
              key={key}
              cx={p[0]}
              cy={p[1]}
              r={changed ? 2.6 : 1.5}
              fill={CHARACTERS[PARAM_TO_HEROINE[key]].color}
              stroke={changed ? '#fff' : 'none'}
              strokeWidth="0.8"
            />
          );
        })}

        {/* ラベル */}
        {PARAM_ORDER.map((key, i) => {
          const [x, y] = vertex(i, LABEL_RADIUS);
          const anchor = Math.abs(x - CENTER) < 3 ? 'middle' : x > CENTER ? 'start' : 'end';
          return (
            <text
              key={key}
              x={x}
              y={y + 2.4}
              textAnchor={anchor}
              className={`${styles.axisLabel} ${changedKeys.has(key) ? styles.axisChanged : ''}`}
            >
              {PARAM_LABEL[key]}
              {showNumbers ? ` ${params[key]}` : ''}
            </text>
          );
        })}
      </svg>

      <div className={styles.toasts}>
        {changes.map((change) => {
          const color = CHARACTERS[PARAM_TO_HEROINE[change.key]].color;
          return (
            <div key={change.id} className={styles.toast} style={{ borderColor: color, color }}>
              <span className={styles.toastDot} style={{ background: color }} />
              {PARAM_LABEL[change.key]} が {describe(change.delta)}
              {showNumbers ? `（${change.delta > 0 ? '+' : ''}${change.delta}）` : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
