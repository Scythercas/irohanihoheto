import { useGame } from './game/store';
import AdvScreen from './ui/AdvScreen';
import TitleScreen from './ui/TitleScreen';

export default function App() {
  const mode = useGame((s) => s.mode);
  return mode === 'title' ? <TitleScreen /> : <AdvScreen />;
}
