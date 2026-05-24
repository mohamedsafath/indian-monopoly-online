import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import Lobby from './pages/Lobby';
import GameRoom from './pages/GameRoom';
import ResultPage from './pages/ResultPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home */}
        <Route path="/" element={<Home />} />

        {/* Lobby */}
        <Route path="/lobby/:roomCode" element={<Lobby />} />

        {/* Game Room */}
        <Route path="/game/:roomCode" element={<GameRoom />} />

        {/* Result Page */}
        <Route path="/results/:roomCode" element={<ResultPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;