import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SantaCall } from './components/SantaCall';
import { ComingSoon } from './components/ComingSoon';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<ComingSoon />} />
          <Route path="/app" element={<SantaCall />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
