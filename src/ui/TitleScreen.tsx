import { useGame } from '../game/store';
import { AUTO_SLOT, load } from '../game/save';
import { OPENING_SCENE_ID } from '../game/flow';
import styles from './TitleScreen.module.css';

export default function TitleScreen() {
  const start = useGame((s) => s.start);
  const restore = useGame((s) => s.restore);
  const auto = load(AUTO_SLOT);

  return (
    <div className={styles.screen}>
      <div className={styles.aura} aria-hidden />

      <div className={styles.brand}>
        <h1 className={styles.title}>
          いろはにほへ<span className={styles.last}>と</span>
        </h1>
        <p className={styles.tagline}>色は匂へど 散りぬるを</p>
      </div>

      <nav className={styles.menu}>
        <button className={styles.item} onClick={() => start(OPENING_SCENE_ID)}>
          はじめから
        </button>
        <button className={styles.item} disabled={!auto} onClick={() => auto && restore(auto)}>
          つづきから
        </button>
      </nav>

      <span className={styles.version}>ver 0.1.0 — 開発中</span>
    </div>
  );
}
