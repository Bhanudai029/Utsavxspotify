import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<div>Simple Test</div>} />
        <Route path="/test" element={<div>Simple Test</div>} />
      </Routes>
    </Router>
  );
}

export default App;