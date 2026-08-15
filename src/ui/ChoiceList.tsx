import { CHARACTERS } from '../game/constants';
import { useGame } from '../game/store';
import type { ChoiceOption } from '../game/types';
import styles from './ChoiceList.module.css';

interface Props {
  options: ChoiceOption[];
  onChoose: (option: ChoiceOption) => void;
}

/**
 * 通常の選択肢。
 *
 * **立ち絵より必ず手前に置く**（overlay の z-index）。
 * 以前は z-index を指定していなかったため、`z-index: 1` を持つ立ち絵レイヤーの
 * 下に潜り込み、人物の上に文字が乗って読めない状態になっていた。
 *
 * `who` を持つ選択肢は、そのキャラクターのイメージカラーで縁取る。
 * 週スケジュールの「○○と会う」と同じ見た目・同じ並び順になるので、
 * 「相手を選ぶ」場面はどこでも同じ読み方ができる。
 */
export default function ChoiceList({ options, onChoose }: Props) {
  const flags = useGame((s) => s.flags);
  const visible = options.filter((o) => !o.requireFlag || flags[o.requireFlag]);

  return (
    <div className={styles.overlay} onClick={(e) => e.stopPropagation()}>
      {visible.map((option, i) => {
        const character = option.who ? CHARACTERS[option.who] : null;
        return (
          <button
            key={i}
            className={`${styles.option} ${character ? styles.tagged : ''}`}
            style={character ? { borderLeftColor: character.color } : undefined}
            onClick={() => onChoose(option)}
          >
            {character && (
              <span className={styles.chip} style={{ background: character.color }} aria-hidden />
            )}
            <span className={styles.label}>{option.text}</span>
          </button>
        );
      })}
    </div>
  );
}
