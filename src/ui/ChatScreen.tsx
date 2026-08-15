import { useEffect, useRef } from 'react';
import { backgroundOf, backgroundUrl } from '../game/backgrounds';
import { CHARACTERS } from '../game/constants';
import { useGame } from '../game/store';
import type { ChoiceOption } from '../game/types';
import styles from './ChatScreen.module.css';

/**
 * カラットのトーク画面。C6①でゲームの中心と位置づけた画面。
 *
 * **画面いっぱいのチャットUIではなく、ゲーム画面の中に「スマホ」を1台置き、その中で会話する。**
 * 主人公が自室でスマホを見ている、という状況がそのまま絵になるため、
 * 背景（自室など）を後ろに残したまま、アプリの中だけが明るく光る画になる。
 *
 * 通常のADVと違い、過去のやり取りが画面に残り続ける。
 * 「返信を選ぶ」という行為そのものが攻略になるため、選択肢は
 * スマホの入力欄の位置からせり上がってくる形に置いている。
 */
export default function ChatScreen() {
  const node = useGame((s) => s.node);
  const chatLog = useGame((s) => s.chatLog);
  const chatWith = useGame((s) => s.chatWith);
  const bg = useGame((s) => s.bg);
  const advance = useGame((s) => s.advance);
  const choose = useGame((s) => s.choose);
  const flags = useGame((s) => s.flags);

  const bottomRef = useRef<HTMLDivElement>(null);
  const partner = chatWith ? CHARACTERS[chatWith] : null;
  const waitingReply = node?.kind === 'reply';
  const bgDef = backgroundOf(bg);

  // ステータスバーの時計は実時刻ではなく作中時刻。最後のメッセージの時刻に合わせる。
  const clock = chatLog[chatLog.length - 1]?.at ?? '21:04';

  // 新しいメッセージが来たら末尾へ送る
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatLog.length, waitingReply]);

  const replyOptions: ChoiceOption[] =
    node?.kind === 'reply' ? node.options.filter((o) => !o.requireFlag || flags[o.requireFlag]) : [];

  return (
    <div className={styles.screen} onClick={() => !waitingReply && advance()}>
      <div className={styles.backdrop}>
        {bgDef && (
          <img
            key={bgDef.file}
            className={styles.backdropImage}
            src={backgroundUrl(bgDef)}
            alt=""
            // 素材未取得でも遊べるよう、読み込めなければ色面のまま進める
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
      </div>

      <div className={styles.device}>
        <div className={styles.earpiece} />

        <div className={styles.statusBar}>
          <span className={styles.clock}>{clock}</span>
          <span className={styles.statusIcons} aria-hidden>
            <span className={styles.signal}>
              <i />
              <i />
              <i />
            </span>
            <span className={styles.battery} />
          </span>
        </div>

        <header className={styles.appBar}>
          <span className={styles.back} aria-hidden>
            ‹
          </span>
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
          <div className={styles.replySheet} onClick={(e) => e.stopPropagation()}>
            <span className={styles.replyHint}>返信を選ぶ</span>
            {replyOptions.map((option, i) => (
              <button key={i} className={styles.replyOption} onClick={() => choose(option)}>
                {option.text}
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.inputBar}>
            <span className={styles.inputField}>メッセージを入力</span>
            <span className={styles.sendButton} aria-hidden>
              ↑
            </span>
          </div>
        )}

        <div className={styles.homeBar} aria-hidden />
      </div>

      {!waitingReply && <div className={styles.prompt}>クリックで進む</div>}
    </div>
  );
}
