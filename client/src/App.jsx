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
import BloodDonation from './pages/BloodDonation.jsx';
import Login from './pages/admin/Login.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Posts from './pages/admin/Posts.jsx';
import PostEditor from './pages/admin/PostEditor.jsx';
import MissionTypesAdmin from './pages/admin/MissionTypesAdmin.jsx';
import Reports from './pages/admin/Reports.jsx';
import YearlyReport from './pages/admin/YearlyReport.jsx';
import MemberReports from './pages/admin/MemberReports.jsx';
import InventoryReport from './pages/admin/InventoryReport.jsx';
import InventoryAdmin from './pages/admin/InventoryAdmin.jsx';
import InventoryUnitsAdmin from './pages/admin/InventoryUnitsAdmin.jsx';
import InventoryCategoriesAdmin from './pages/admin/InventoryCategoriesAdmin.jsx';
import InventoryAssetsAdmin from './pages/admin/InventoryAssetsAdmin.jsx';
import AmbulanceFinanceAdmin from './pages/admin/AmbulanceFinanceAdmin.jsx';
import AmbulanceCategoriesAdmin from './pages/admin/AmbulanceCategoriesAdmin.jsx';
import AmbulanceAssetsAdmin from './pages/admin/AmbulanceAssetsAdmin.jsx';
import ScheduleAdmin from './pages/admin/ScheduleAdmin.jsx';
import BloodDonationsAdmin from './pages/admin/BloodDonationsAdmin.jsx';
import BloodDonorsAdmin from './pages/admin/BloodDonorsAdmin.jsx';
import CommunityDonationsAdmin from './pages/admin/CommunityDonationsAdmin.jsx';
import DonationItemTypesAdmin from './pages/admin/DonationItemTypesAdmin.jsx';
import DocumentsAdmin from './pages/admin/DocumentsAdmin.jsx';
import DocumentFill from './pages/admin/DocumentFill.jsx';
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
          <Route path="/blood-donation" element={<BloodDonation />} />
        </Route>
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="posts" element={<Posts />} />
          <Route path="posts/new" element={<PostEditor />} />
          <Route path="posts/:id" element={<PostEditor />} />
          <Route path="mission-types" element={<MissionTypesAdmin />} />
          <Route path="reports" element={<Reports />} />
          <Route path="yearly-report" element={<YearlyReport />} />
          <Route path="member-reports" element={<MemberReports />} />
          <Route path="inventory-report" element={<InventoryReport />} />
          <Route path="inventory" element={<InventoryAdmin />} />
          <Route path="inventory-assets" element={<InventoryAssetsAdmin />} />
          <Route path="ambulance-finance" element={<AmbulanceFinanceAdmin />} />
          <Route path="ambulance-categories" element={<AmbulanceCategoriesAdmin />} />
          <Route path="ambulance-assets" element={<AmbulanceAssetsAdmin />} />
          <Route path="inventory-units" element={<InventoryUnitsAdmin />} />
          <Route path="inventory-categories" element={<InventoryCategoriesAdmin />} />
          <Route path="inventory-usage" element={<UsageAdmin />} />
          <Route path="loaned-items" element={<LoanedItemsAdmin />} />
          <Route path="service-types" element={<ServiceTypesAdmin />} />
          <Route path="service-logs" element={<ServiceLogsAdmin />} />
          <Route path="schedule" element={<ScheduleAdmin />} />
          <Route path="blood-donations" element={<BloodDonationsAdmin />} />
          <Route path="blood-donors" element={<BloodDonorsAdmin />} />
          <Route path="community-donations" element={<CommunityDonationsAdmin />} />
          <Route path="donation-item-types" element={<DonationItemTypesAdmin />} />
          <Route path="documents" element={<DocumentsAdmin />} />
          <Route path="documents/fill/:templateId" element={<DocumentFill />} />
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
