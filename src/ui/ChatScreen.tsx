import { useEffect, useRef } from 'react';
import { CHARACTERS } from '../game/constants';
import { useGame } from '../game/store';
import type { ChoiceOption } from '../game/types';
import styles from './ChatScreen.module.css';

/**
 * カラットのトーク画面。C6①でゲームの中心と位置づけた画面。
 *
 * 通常のADVと違い、過去のやり取りが画面に残り続ける。
 * 「返信を選ぶ」という行為そのものが攻略になるため、選択肢は
 * 画面下部の入力欄の位置に置き、送信すると自分の吹き出しになる。
 */
export default function ChatScreen() {
  const node = useGame((s) => s.node);
  const chatLog = useGame((s) => s.chatLog);
  const chatWith = useGame((s) => s.chatWith);
  const advance = useGame((s) => s.advance);
  const choose = useGame((s) => s.choose);
  const flags = useGame((s) => s.flags);

  const bottomRef = useRef<HTMLDivElement>(null);
  const partner = chatWith ? CHARACTERS[chatWith] : null;
  const waitingReply = node?.kind === 'reply';

  // 新しいメッセージが来たら末尾へ送る
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatLog.length, waitingReply]);

  const replyOptions: ChoiceOption[] =
    node?.kind === 'reply' ? node.options.filter((o) => !o.requireFlag || flags[o.requireFlag]) : [];

  return (
    <div className={styles.screen} onClick={() => !waitingReply && advance()}>
      <header className={styles.header}>
        {partner && <span className={styles.avatar} style={{ background: partner.color }} />}
        <span className={styles.headerName}>{partner?.name ?? ''}</span>
        <span className={styles.headerApp}>CARAT</span>
      </header>

      <div className={styles.log}>
        {chatLog.map((entry, i) => {
          const mine = entry.from === 'iroha';
          return (
            <div key={i} className={`${styles.row} ${mine ? styles.rowMe : styles.rowThem}`}>
              <div className={`${styles.bubble} ${mine ? styles.bubbleMe : styles.bubbleThem}`}>
                {entry.text}
              </div>
              <span className={styles.stamp}>{entry.at}</span>
            </div>
          );
        })}

        {/* 相手の返信待ち中は入力中インジケータを出す */}
        {waitingReply && (
          <div className={styles.typing} aria-label="返信を待っています">
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {waitingReply ? (
        <div className={styles.replyBar} onClick={(e) => e.stopPropagation()}>
          <span className={styles.replyHint}>返信を選ぶ</span>
          {replyOptions.map((option, i) => (
            <button key={i} className={styles.replyOption} onClick={() => choose(option)}>
              {option.text}
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.prompt}>クリックで進む</div>
      )}
    </div>
  );
}
