import Sprite, { IrohaSilhouette } from './sprites';
import type { CharacterId } from '../game/types';
import styles from './StageLayer.module.css';

interface Props {
  /** 会話相手。null なら主人公だけを置く。 */
  partner: CharacterId | null;
  partnerExpression?: string;
  /** 今しゃべっているのは誰か。null は地の文。 */
  speaker: CharacterId | null;
}

/**
 * 立ち絵の配置。
 *
 * 主人公は必ず左、会話相手は必ず右。
 * 話し手を大きく手前に、聞き手を小さく暗く落として、誰の声かを一目でわかるようにする。
 */
export default function StageLayer({ partner, partnerExpression, speaker }: Props) {
  const irohaSpeaking = speaker === 'iroha';
  const partnerSpeaking = partner !== null && speaker === partner;
  const narration = speaker === null;

  const stateOf = (isSpeaking: boolean) =>
    narration ? styles.neutral : isSpeaking ? styles.speaking : styles.listening;

  return (
    <div className={styles.stage} aria-hidden>
      <div className={`${styles.slot} ${styles.left} ${stateOf(irohaSpeaking)}`}>
        <IrohaSilhouette />
      </div>

      {partner && (
        <div className={`${styles.slot} ${styles.right} ${stateOf(partnerSpeaking)}`}>
          <Sprite id={partner} expression={partnerExpression} />
        </div>
      )}
    </div>
  );
}
