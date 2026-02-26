import { Routes, Route } from 'react-router-dom'
import { useEffect } from "react";
import Layout from './components/Layout'
import HomePage      from './pages/HomePage'
import GeneratePage  from './pages/GeneratePage'
import LibraryPage   from './pages/LibraryPage'
import PoetPage      from './pages/PoetPage'
import PoemPage      from './pages/PoemPage'
import EraPage       from './pages/EraPage'
import MeterPage     from './pages/MeterPage'
import ThemePage     from './pages/ThemePage'
import RhymePage     from './pages/RhymePage'
import SearchPage    from './pages/SearchPage'
import ChatPage      from './pages/ChatPage'
import { getHealth } from './api'

export default function App() {
   
  useEffect(() => {
    getHealth().catch(() => {
      // ignore error – this is just to wake backend
    });
  }, []);

  return (
    <Layout>
      <Routes>
        <Route path="/"              element={<HomePage />} />
        <Route path="/generate"      element={<GeneratePage />} />
        <Route path="/library"       element={<LibraryPage />} />
        <Route path="/library/poet/:slug" element={<PoetPage />} />
        <Route path="/library/era/:slug" element={<EraPage />} />
        <Route path="/library/meter/:slug" element={<MeterPage />} />
        <Route path="/library/theme/:slug" element={<ThemePage />} />
        <Route path="/library/rhyme/:slug" element={<RhymePage />} />
        <Route path="/library/poem/:slug" element={<PoemPage />} />
        <Route path="/search"        element={<SearchPage />} />
        <Route path="/chat"          element={<ChatPage />} />
      </Routes>
    </Layout>
  )
}
