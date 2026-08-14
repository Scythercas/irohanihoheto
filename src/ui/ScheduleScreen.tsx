import { CHARACTERS } from '../game/constants';
import { FINAL_WEEK, SCHEDULE_ACTIONS, SLOTS_PER_WEEK, isHeroineId } from '../game/schedule';
import { useGame } from '../game/store';
import ParamPentagon from './ParamPentagon';
import styles from './ScheduleScreen.module.css';

/**
 * 週スケジュール画面（C2①）。
 *
 * 「誰と会うか」を選ぶ＝どの色を伸ばすかを選ぶことなので、
 * 主人公が今どれだけ色づいているかを同じ画面で示す。
 * ただし数値は出さない（C3②）。伸びた帯の長さだけで伝える。
 */
export default function ScheduleScreen() {
  const week = useGame((s) => s.week);
  const slots = useGame((s) => s.slots);
  const flags = useGame((s) => s.flags);
  const params = useGame((s) => s.params);
  const progress = useGame((s) => s.progress);
  const pickAction = useGame((s) => s.pickAction);

  const available = SCHEDULE_ACTIONS.filter((a) => !a.requireFlag || flags[a.requireFlag]);

  return (
    <div className={styles.overlay} onClick={(e) => e.stopPropagation()}>
      <div className={styles.head}>
        <h2 className={styles.week}>
          第 {week} 週 <span style={{ opacity: 0.4 }}>/ {FINAL_WEEK}</span>
        </h2>
        <div className={styles.slots}>
          {Array.from({ length: SLOTS_PER_WEEK }, (_, i) => (
            <span key={i} className={`${styles.slot} ${i < slots ? styles.slotFull : ''}`} />
          ))}
        </div>
        <p className={styles.slotLabel}>残りの予定 {slots}</p>
      </div>

      <div className={styles.palette}>
        <ParamPentagon params={params} showNumbers={import.meta.env.DEV} />
      </div>

      <div className={styles.actions}>
        {available.map((action) => {
          const character = CHARACTERS[action.who];
          const count = isHeroineId(action.who) ? progress[action.who] : 0;
          return (
            <button
              key={action.who}
              className={styles.action}
              style={{ borderLeftColor: character.color }}
              onClick={() => pickAction(action.who)}
            >
              {action.label}
              {count > 0 && <span className={styles.actionMeta}>{count}回会った</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
