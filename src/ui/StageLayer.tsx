import Sprite from './sprites';
import type { CharacterId } from '../game/types';
import styles from './StageLayer.module.css';

interface Props {
  /** 会話相手。null なら誰も立たせない。 */
  partner: CharacterId | null;
  partnerExpression?: string;
  /** 今しゃべっているのは誰か。null は地の文。 */
  speaker: CharacterId | null;
}

/**
 * 立ち絵の配置。
 *
 * **主人公の立ち絵は置かない**（設計書 A5①）。会話相手を画面中央に正面から立たせる。
 * 主人公を無彩色のシルエットで左に置いていた時期があったが、
 * 「顔のない人影が常時いる」という画になってしまい、ユーザー判断で取りやめた。
 *
 * 誰の声かは、相手の立ち絵の明るさで示す。
 *   相手がしゃべっている  … はっきり見せる
 *   主人公がしゃべっている … 少し暗く落として引く
 *   地の文                … その中間
 *
 * **メッセージウィンドウ（z-index 5）より必ず後ろに置くこと**（CLAUDE.md §4.5-9）。
 * 立ち絵は下端をマスクでフェードさせ、ウィンドウに重なる部分が透けて消えるようにしてある。
 */
export default function StageLayer({ partner, partnerExpression, speaker }: Props) {
  if (!partner) return null;

  const state =
    speaker === null ? styles.neutral : speaker === partner ? styles.speaking : styles.listening;

  return (
    <div className={styles.stage} aria-hidden>
      <div className={`${styles.slot} ${state}`}>
        <Sprite id={partner} expression={partnerExpression} />
      </div>
    </div>
  );
}
