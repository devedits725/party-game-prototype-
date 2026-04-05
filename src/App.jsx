import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import HostLobby from './pages/HostLobby.jsx'
import JoinPage from './pages/JoinPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
<<<<<<< HEAD
        <Route path="/host/:game/:mode" element={<HostLobby />} />
=======
>>>>>>> 229d39f7510f794d97ecf01b8a41be9139875e08
        <Route path="/host/:game" element={<HostLobby />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/join" element={<JoinPage />} />
      </Routes>
    </BrowserRouter>
  )
}
