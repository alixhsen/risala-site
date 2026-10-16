import { Link } from 'react-router-dom';
import { Download, FilePenLine, FileSignature } from 'lucide-react';
import { AdminHead } from '../../components/admin/AdminPage.jsx';

// The association's own paper forms. Ones with a matching Word template can
// be filled in and downloaded ready to sign; the rest are plain downloadable
// copies to print and fill by hand.
const FORMS = [
  { file: 'membership-request-civil-defense.pdf', templateId: 'membership-request-civil-defense', title: 'طلب انتساب (الدفاع المدني)', description: 'طلب انتساب عضو جديد إلى فرقة الدفاع المدني.' },
  { file: 'membership-request-movement.pdf', templateId: null, title: 'طلب انتساب (حركة أمل)', description: 'طلب الانتساب الرسمي إلى حركة أمل، مع سلسلة موافقات القيادات.' },
  { file: 'card-renewal.pdf', templateId: 'card-renewal', title: 'طلب تجديد بطاقة', description: 'طلب تجديد صلاحية بطاقة العضوية في الجمعية.' },
  { file: 'meeting-minutes.pdf', templateId: 'meeting-minutes', title: 'محضر اجتماع', description: 'محضر جلسة قيادة الدفاع المدني: الحضور والغياب وبنود الجلسة.' },
  { file: 'activity-permit.pdf', templateId: 'activity-permit', title: 'طلب إجازة نشاط', description: 'طلب إذن لإقامة نشاط: الزمان والمكان والبرنامج المقترح.' },
  { file: 'equipment-receipt.pdf', templateId: 'equipment-receipt', title: 'استلام تجهيزات', description: 'سند استلام تجهيزات من الجمعية مع التعهد بالحفاظ عليها.' },
  { file: 'receipt-voucher.pdf', templateId: null, title: 'سند استلام', description: 'سند استلام جهاز طبي معار، مع قيمة الرهن وحالة الجهاز.' },
  { file: 'ambulance-vehicle-form.pdf', templateId: 'ambulance-vehicle-form', title: 'استمارة سيارة إسعاف', description: 'بيانات تفصيلية عن سيارة الإسعاف: النوع، الملكية، التأمين، والمسؤول عنها.' },
  { file: 'expenses-statement.pdf', templateId: null, title: 'بيان مصارفات', description: 'بيان شهري بالمصارفات: التاريخ والمصدر والقيمة الإجمالية.' },
  { file: 'financial-ledger.pdf', templateId: 'financial-ledger', title: 'السجل المالي', description: 'سجل حركة الصندوق: الداخل والخارج والرصيد.' },
  { file: 'general-registry.pdf', templateId: null, title: 'سجل القيد العام', description: 'سجل عام لبيانات الأعضاء: الاسم وتاريخ الانتساب ومعلومات التواصل.' },
];

export default function DocumentsAdmin() {
  return (
    <>
      <AdminHead
        kicker="النماذج والمحاضر"
        title="المحاضر والنماذج"
        subtitle="نسخ أصلية من نماذج الجمعية. الأشكال القابلة للتعبئة تُملأ وتُنزَّل Word جاهزة للتوقيع، والباقي يُطبع ويُملأ يدوياً."
      />

      <div className="forms-grid">
        {FORMS.map((f) => (
          <article className="form-card" key={f.file}>
            <span className="form-card-icon"><FileSignature size={20} aria-hidden="true" /></span>
            <div className="form-card-body">
              <h2>{f.title}</h2>
              <p>{f.description}</p>
            </div>
            {f.templateId ? (
              <Link className="btn primary block" to={`/admin/documents/fill/${f.templateId}`}>
                <FilePenLine size={16} aria-hidden="true" /> تعبئة وتنزيل
              </Link>
            ) : (
              <a className="btn primary block" href={`/forms/${f.file}`} download>
                <Download size={16} aria-hidden="true" /> تنزيل PDF
              </a>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
