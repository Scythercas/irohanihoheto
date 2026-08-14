import { useCallback, useEffect, useState } from 'react';
import { CHARACTERS } from '../game/constants';
import { AUTO_SLOT, save } from '../game/save';
import { useGame } from '../game/store';
import CaratCard from './CaratCard';
import ChoiceList from './ChoiceList';
import MessageWindow from './MessageWindow';
import ParamPentagon from './ParamPentagon';
import ScheduleScreen from './ScheduleScreen';
import StageLayer from './StageLayer';
import styles from './AdvScreen.module.css';

/** 1文字あたりの表示間隔(ms)。あとでコンフィグ画面から変えられるようにする。 */
const TYPE_SPEED = 28;

export default function AdvScreen() {
  const node = useGame((s) => s.node);
  const bg = useGame((s) => s.bg);
  const params = useGame((s) => s.params);
  const partner = useGame((s) => s.partner);
  const faces = useGame((s) => s.faces);
  const week = useGame((s) => s.week);
  const advance = useGame((s) => s.advance);
  const choose = useGame((s) => s.choose);
  const backToTitle = useGame((s) => s.backToTitle);
  const snapshot = useGame((s) => s.snapshot);
  const mode = useGame((s) => s.mode);

  const [revealed, setRevealed] = useState(0);
  const [showNumbers, setShowNumbers] = useState(import.meta.env.DEV);

  const text = node?.kind === 'say' ? node.text : '';
  const done = revealed >= text.length;
  /** クリック送りを受け付けない状態（プレイヤーの入力待ち） */
  const blocked = node?.kind === 'choice' || node?.kind === 'carat' || node?.kind === 'schedule';
  const onStage = node?.kind === 'say' || node?.kind === 'choice';

  // ノードが変わるたびに文字送りを頭から
  useEffect(() => {
    setRevealed(0);
  }, [node]);

  useEffect(() => {
    if (!text || done) return;
    const timer = window.setInterval(() => {
      setRevealed((n) => (n >= text.length ? n : n + 1));
    }, TYPE_SPEED);
    return () => window.clearInterval(timer);
  }, [text, done]);

  // オートセーブ（H2）。今はノード単位。章の区切りが実装できたらそこへ移す。
  useEffect(() => {
    if (mode === 'adv' && node) save(AUTO_SLOT, snapshot(`第${week}週`));
  }, [mode, node, snapshot, week]);

  const onClick = useCallback(() => {
    if (blocked) return;
    if (!done) {
      setRevealed(text.length); // 途中クリックで全文表示
      return;
    }
    advance();
  }, [advance, blocked, done, text.length]);

  // 開発用: D キーで数値の併記を切り替え
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') setShowNumbers((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const speaker = node?.kind === 'say' ? node.who : null;
  const speakerDef = speaker && speaker !== 'iroha' ? CHARACTERS[speaker] : null;

  return (
    <div className={styles.screen} onClick={onClick}>
      <div className={styles.bg} />
      {bg && <span className={styles.bgLabel}>bg: {bg}</span>}

      {onStage && (
        <StageLayer
          partner={partner}
          partnerExpression={partner ? faces[partner] : undefined}
          speaker={speaker}
        />
      )}

      <div className={styles.pentagon} onClick={(e) => e.stopPropagation()}>
        <ParamPentagon params={params} showNumbers={showNumbers} />
      </div>
      {import.meta.env.DEV && <span className={styles.debugHint}>D キーで数値表示</span>}

      {node?.kind === 'say' && (
        <MessageWindow speaker={speakerDef} text={text} revealed={revealed} showPrompt={done} />
      )}

      {node?.kind === 'choice' && <ChoiceList options={node.options} onChoose={choose} />}

      {node?.kind === 'carat' && <CaratCard node={node} onDismiss={advance} />}

      {node?.kind === 'schedule' && <ScheduleScreen />}

      {mode === 'ended' && (
        <div className={styles.endCard} onClick={(e) => e.stopPropagation()}>
          <span className={styles.endTitle}>ここまで実装済み</span>
          <button className={styles.endButton} onClick={backToTitle}>
            タイトルへ
          </button>
        </div>
      )}
    </div>
  );
}
