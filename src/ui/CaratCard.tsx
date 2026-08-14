import { CHARACTERS } from '../game/constants';
import { HEROINES } from '../game/heroines';
import type { CaratNode } from '../game/types';
import styles from './CaratCard.module.css';

interface Props {
  node: CaratNode;
  onDismiss: () => void;
}

/**
 * マッチングアプリ「カラット」のカード。
 *
 * C5②で「プロフィール・マッチング演出は簡易表現に留める」と決めているため、
 * 画面遷移は作らず、1枚のカードのオーバーレイで済ませている。
 * カラット＝宝石の単位なので、キャラクターカラーの石を主役に据える。
 */
export default function CaratCard({ node, onDismiss }: Props) {
  const character = CHARACTERS[node.target];
  const profile = HEROINES[node.target];
  const isMatch = node.view === 'match';

  return (
    <div className={styles.overlay} onClick={(e) => e.stopPropagation()}>
      <div className={styles.card}>
        <span className={styles.crown} style={{ background: character.color }} />

        <div className={styles.gem} style={{ background: character.color, color: character.color }} />

        <span className={styles.matchLabel}>{isMatch ? 'MATCHED' : 'PROFILE'}</span>
        <h2 className={styles.name}>{character.name}</h2>
        <p className={styles.meta}>
          {profile.age}歳 ・ {profile.job}
        </p>

        {!isMatch && (
          <>
            <p className={styles.bio}>{profile.bio}</p>
            <div className={styles.tags}>
              {profile.tags.map((tag) => (
                <span
                  key={tag}
                  className={styles.tag}
                  style={{ background: `${character.color}22`, color: character.color }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </>
        )}

        <button className={styles.action} onClick={onDismiss}>
          {isMatch ? 'メッセージを送る' : '閉じる'}
        </button>
      </div>
    </div>
  );
}
