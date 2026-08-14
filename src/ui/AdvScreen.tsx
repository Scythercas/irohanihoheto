import { useCallback, useEffect, useState } from 'react';
import { CHARACTERS, PARAM_LABEL, PARAM_ORDER, PARAM_TO_HEROINE } from '../game/constants';
import { AUTO_SLOT, save } from '../game/save';
import { useGame } from '../game/store';
import ChoiceList from './ChoiceList';
import MessageWindow from './MessageWindow';
import styles from './AdvScreen.module.css';

/** 1文字あたりの表示間隔(ms)。あとでコンフィグ画面から変えられるようにする。 */
const TYPE_SPEED = 28;

export default function AdvScreen() {
  const node = useGame((s) => s.node);
  const bg = useGame((s) => s.bg);
  const params = useGame((s) => s.params);
  const advance = useGame((s) => s.advance);
  const choose = useGame((s) => s.choose);
  const backToTitle = useGame((s) => s.backToTitle);
  const snapshot = useGame((s) => s.snapshot);
  const mode = useGame((s) => s.mode);

  const [revealed, setRevealed] = useState(0);
  const [showDebug, setShowDebug] = useState(import.meta.env.DEV);

  const text = node?.kind === 'say' ? node.text : '';
  const done = revealed >= text.length;

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
    if (mode === 'adv' && node) save(AUTO_SLOT, snapshot('オートセーブ'));
  }, [mode, node, snapshot]);

  const onClick = useCallback(() => {
    if (node?.kind === 'choice') return;
    if (!done) {
      setRevealed(text.length); // 途中クリックで全文表示
      return;
    }
    advance();
  }, [advance, done, node, text.length]);

  // 開発用: D キーでパラメータ表示を切り替え
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') setShowDebug((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const speaker = node?.kind === 'say' && node.who ? CHARACTERS[node.who] : null;

  return (
    <div className={styles.screen} onClick={onClick}>
      <div className={styles.bg} />
      {bg && <span className={styles.bgLabel}>bg: {bg}</span>}

      {speaker && (
        <div
          className={styles.sprite}
          style={{ background: `linear-gradient(180deg, ${speaker.color} 0%, ${speaker.colorDeep} 100%)` }}
        />
      )}

      {showDebug && (
        <div className={styles.debug} onClick={(e) => e.stopPropagation()}>
          {PARAM_ORDER.map((key) => (
            <div key={key} className={styles.debugRow}>
              <span
                className={styles.debugSwatch}
                style={{ background: CHARACTERS[PARAM_TO_HEROINE[key]].color }}
              />
              <span className={styles.debugName}>{PARAM_LABEL[key]}</span>
              <span className={styles.debugValue}>{params[key]}</span>
            </div>
          ))}
          <span className={styles.debugHint}>D キーで開閉 / 開発用表示</span>
        </div>
      )}

      {node?.kind === 'say' && (
        <MessageWindow speaker={speaker} text={text} revealed={revealed} showPrompt={done} />
      )}

      {node?.kind === 'choice' && <ChoiceList options={node.options} onChoose={choose} />}

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
