import { useSettings } from '../../App.jsx';
import CoverGenerator from '../../components/CoverGenerator.jsx';
import { AdminHead } from '../../components/admin/AdminPage.jsx';

export default function Generator() {
  const { settings } = useSettings();
  return (
    <>
      <AdminHead
        kicker="المحتوى"
        title="مولّد الصور"
        subtitle="صمّم غلاف نشاط، أو إطاراً من صورة، أو بطاقة معلومات بهوية الفريق، ثم نزّلها أو استخدمها غلافاً لمنشور. الشعار واسم الفريق يؤخذان تلقائياً من الإعدادات."
      />
      <CoverGenerator settings={settings} />
    </>
  );
}
