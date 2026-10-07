import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { api } from './lib/api.js';
import SiteLayout from './components/SiteLayout.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Team from './pages/Team.jsx';
import Missions from './pages/Missions.jsx';
import MissionDetail from './pages/MissionDetail.jsx';
import Activities from './pages/Activities.jsx';
import News from './pages/News.jsx';
import PostDetail from './pages/PostDetail.jsx';
import Gallery from './pages/Gallery.jsx';
import Contact from './pages/Contact.jsx';
import Login from './pages/admin/Login.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Posts from './pages/admin/Posts.jsx';
import PostEditor from './pages/admin/PostEditor.jsx';
import MissionTypesAdmin from './pages/admin/MissionTypesAdmin.jsx';
import Reports from './pages/admin/Reports.jsx';
import MemberReports from './pages/admin/MemberReports.jsx';
import InventoryReport from './pages/admin/InventoryReport.jsx';
import InventoryAdmin from './pages/admin/InventoryAdmin.jsx';
import UsageAdmin from './pages/admin/UsageAdmin.jsx';
import LoanedItemsAdmin from './pages/admin/LoanedItemsAdmin.jsx';
import ServiceTypesAdmin from './pages/admin/ServiceTypesAdmin.jsx';
import ServiceLogsAdmin from './pages/admin/ServiceLogsAdmin.jsx';
import TeamAdmin from './pages/admin/TeamAdmin.jsx';
import GalleryAdmin from './pages/admin/GalleryAdmin.jsx';
import Generator from './pages/admin/Generator.jsx';
import Messages from './pages/admin/Messages.jsx';
import Settings from './pages/admin/Settings.jsx';
import Users from './pages/admin/Users.jsx';

// Site-wide settings (name, logo, phone…) loaded once and shared everywhere.
const SettingsContext = createContext({ settings: {}, reload: () => {} });
export const useSettings = () => useContext(SettingsContext);

// Small data-loading hook: { data, error, loading, reload }.
export function useLoad(path, fallback) {
  const [state, setState] = useState({ data: fallback, error: '', loading: true });
  const reload = useCallback(() => {
    api(path)
      .then((data) => setState({ data, error: '', loading: false }))
      .catch((err) => setState((s) => ({ ...s, error: err.message, loading: false })));
  }, [path]);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

export default function App() {
  const [settings, setSettings] = useState({});
  const reload = useCallback(() => {
    api('/public/settings').then(setSettings).catch(() => {});
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { if (settings.site_name) document.title = settings.site_name; }, [settings.site_name]);

  return (
    <SettingsContext.Provider value={{ settings, reload }}>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/team" element={<Team />} />
          <Route path="/missions" element={<Missions />} />
          <Route path="/missions/:id" element={<MissionDetail />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/activities/:id" element={<PostDetail category="activity" />} />
          <Route path="/news" element={<News />} />
          <Route path="/news/:id" element={<PostDetail category="news" />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/contact" element={<Contact />} />
        </Route>
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="posts" element={<Posts />} />
          <Route path="posts/new" element={<PostEditor />} />
          <Route path="posts/:id" element={<PostEditor />} />
          <Route path="mission-types" element={<MissionTypesAdmin />} />
          <Route path="reports" element={<Reports />} />
          <Route path="member-reports" element={<MemberReports />} />
          <Route path="inventory-report" element={<InventoryReport />} />
          <Route path="inventory" element={<InventoryAdmin />} />
          <Route path="inventory-usage" element={<UsageAdmin />} />
          <Route path="loaned-items" element={<LoanedItemsAdmin />} />
          <Route path="service-types" element={<ServiceTypesAdmin />} />
          <Route path="service-logs" element={<ServiceLogsAdmin />} />
          <Route path="team" element={<TeamAdmin />} />
          <Route path="gallery" element={<GalleryAdmin />} />
          <Route path="generator" element={<Generator />} />
          <Route path="messages" element={<Messages />} />
          <Route path="settings" element={<Settings />} />
          <Route path="users" element={<Users />} />
        </Route>
        <Route path="*" element={<SiteLayout notFound />} />
      </Routes>
    </SettingsContext.Provider>
  );
}
