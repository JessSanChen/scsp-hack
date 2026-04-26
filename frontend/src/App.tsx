import { useState } from 'react';
import { Header } from './components/Header';
import { Layout } from './components/Layout';
import { MOCK_STATE } from './mockData';
import type { GameState } from './mockData';

export function App() {
  const [state] = useState<GameState>(MOCK_STATE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header state={state} />
      <Layout state={state} />
    </div>
  );
}
