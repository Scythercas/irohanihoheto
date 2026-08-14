import { useGame } from '../game/store';
import type { ChoiceOption } from '../game/types';
import styles from './ChoiceList.module.css';

interface Props {
  options: ChoiceOption[];
  onChoose: (option: ChoiceOption) => void;
}

export default function ChoiceList({ options, onChoose }: Props) {
  const flags = useGame((s) => s.flags);
  const visible = options.filter((o) => !o.requireFlag || flags[o.requireFlag]);

  return (
    <div className={styles.overlay} onClick={(e) => e.stopPropagation()}>
      {visible.map((option, i) => (
        <button key={i} className={styles.option} onClick={() => onChoose(option)}>
          {option.text}
        </button>
      ))}
    </div>
  );
}
