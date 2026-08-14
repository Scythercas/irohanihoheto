import type { CharacterDef } from '../game/constants';
import styles from './MessageWindow.module.css';

interface Props {
  speaker: CharacterDef | null;
  text: string;
  revealed: number;
  showPrompt: boolean;
}

export default function MessageWindow({ speaker, text, revealed, showPrompt }: Props) {
  return (
    <div className={styles.window}>
      {speaker && (
        <span className={styles.name} style={{ background: speaker.colorDeep }}>
          {speaker.name}
        </span>
      )}
      <p className={`${styles.text} ${speaker ? '' : styles.inner}`}>{text.slice(0, revealed)}</p>
      {showPrompt && <span className={styles.prompt}>▼</span>}
    </div>
  );
}
