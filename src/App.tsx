import { useGame } from './game/store';
import AdvScreen from './ui/AdvScreen';
import ChatScreen from './ui/ChatScreen';
import TitleScreen from './ui/TitleScreen';

export default function App() {
  const mode = useGame((s) => s.mode);
  const sceneId = useGame((s) => s.sceneId);
  const screen = useGame((s) => s.screen);
  const node = useGame((s) => s.node);

  if (mode === 'title') return <TitleScreen />;

  // チャット画面でも、カラットのカードやスケジュールは全画面で重ねたい。
  // それらは AdvScreen 側に集約してあるので、通常のチャット中だけ ChatScreen を出す。
  const inChat = sceneId !== '' && screen() === 'chat';
  const overlayKinds = node?.kind === 'carat' || node?.kind === 'schedule';

  return inChat && !overlayKinds ? <ChatScreen /> : <AdvScreen />;
}
