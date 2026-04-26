import type { GameState } from '../../mockData';
import { MapContainer } from './MapContainer';
import { LayerToggle } from './controls/LayerToggle';
import { PlaybackControls } from './controls/PlaybackControls';
import { useLayerToggles } from './hooks/useLayerToggles';
import { useMapAnimation } from './hooks/useMapAnimation';

interface Props { state: GameState; }

export function TaiwanMap({ state }: Props) {
  const { toggles, toggle } = useLayerToggles();
  const {
    currentTick, playing, speed,
    togglePlay, stepBack, stepForward, setSpeed, seek,
  } = useMapAnimation(state.currentTurn);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer toggles={toggles} currentTick={currentTick} />
      <LayerToggle toggles={toggles} toggle={toggle} />
      <PlaybackControls
        currentTick={currentTick}
        playing={playing}
        speed={speed}
        onTogglePlay={togglePlay}
        onStepBack={stepBack}
        onStepForward={stepForward}
        onSpeedChange={setSpeed}
        onSeek={seek}
      />
    </div>
  );
}
