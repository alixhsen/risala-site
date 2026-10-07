import { useMemo, useState } from 'react';
import { Download, Package, Activity, HandCoins, AlertTriangle, Boxes, FileSpreadsheet } from 'lucide-react';
import { useLoad, useSettings } from '../../App.jsx';
import { AdminHead, FormSection } from '../../components/admin/AdminPage.jsx';
import { StatTiles, EmptyPanel } from '../../components/admin/DataPage.jsx';
import { formatDate, MONTHS_AR } from '../../lib/api.js';
import { generateInventoryPdf, expiryOf } from '../../lib/inventoryPdf.js';
import { toCsv, downloadCsv } from '../../lib/csv.js';

function CsvButton({ onClick, label, disabled }) {
  return (
    <button type="button" className="btn" onClick={onClick} disabled={disabled} title={label}>
      <FileSpreadsheet size={15} aria-hidden="true" /> CSV
    </button>
  );
}

const now = new Date();
const YEARS = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
const EXPIRY_CHIP = { expired: 'expired', expiring: 'expiring', ok: 'ok', none: 'none' };

export default function InventoryReport() {
  const { settings } = useSettings();
  const items = useLoad('/admin/inventory-items', []);
  const usage = useLoad('/admin/inventory-usage', []);
  const loans = useLoad('/admin/loaned-items', []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const periodLabel = `${MONTHS_AR[month - 1]} ${year}`;

  const usageInPeriod = useMemo(() => usage.data.filter((r) => {
    const d = new Date(r.used_at);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  }), [usage.data, year, month]);

  const stock = useMemo(() => items.data.map((i) => ({ ...i, ex: expiryOf(i.expiry_date) })), [items.data]);
  const totalQty = stock.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const expiring = stock.filter((i) => i.ex.key === 'expiring').length;
  const expired = stock.filter((i) => i.ex.key === 'expired').length;
  const usedQty = usageInPeriod.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const loansOut = loans.data.filter((l) => l.status !== 'returned').length;

  // Usage grouped by item for the period
  const usageByItem = useMemo(() => {
    const m = new Map();
    for (const r of usageInPeriod) {
      const cur = m.get(r.item_name) || { name: r.item_name, unit: r.unit, qty: 0, uses: 0, last: null };
      cur.qty += Number(r.quantity) || 0;
      cur.uses += 1;
      if (!cur.last || new Date(r.used_at) > new Date(cur.last)) cur.last = r.used_at;
      m.set(r.item_name, cur);
    }
    return [...m.values()].sort((a, b) => b.qty - a.qty);
  }, [usageInPeriod]);

  async function downloadPdf() {
    setBusy(true);
    setError('');
    try {
      await generateInventoryPdf({
        settings,
        periodLabel,
        items: items.data,
        usage: usageInPeriod,
        loans: loans.data,
      });
    } catch (e) {
      setError(e.message || 'تعذّر إنشاء الملف');
    } finally {
      setBusy(false);
    }
  }

  function exportStockCsv() {
    const columns = [
      { label: 'المادة', value: 'name' },
      { label: 'الوحدة', value: 'unit' },
      { label: 'الكمية', value: 'quantity' },
      { label: 'حالة الصلاحية', value: (i) => i.ex.label },
      { label: 'تاريخ انتهاء الصلاحية', value: (i) => (i.expiry_date ? String(i.expiry_date).slice(0, 10) : '') },
      { label: 'المصدر', value: 'source' },
    ];
    downloadCsv(`سجل-المخزون-${periodLabel}`, toCsv(columns, stock));
  }

  function exportUsageCsv() {
    const columns = [
      { label: 'المادة', value: 'name' },
      { label: 'الكمية المستهلكة', value: (u) => `${u.qty}${u.unit ? ` ${u.unit}` : ''}` },
      { label: 'عدد المرات', value: 'uses' },
      { label: 'آخر استخدام', value: (u) => String(u.last).slice(0, 10) },
    ];
    downloadCsv(`الاستهلاك-${periodLabel}`, toCsv(columns, usageByItem));
  }

  function exportLoansCsv() {
    const columns = [
      { label: 'الغرض', value: 'item_name' },
      { label: 'المستلم', value: 'recipient_name' },
      { label: 'تاريخ التسليم', value: (l) => String(l.loan_date).slice(0, 10) },
      { label: 'الحالة', value: (l) => (l.status === 'returned' ? `أُعيدت ${String(l.return_date).slice(0, 10)}` : 'قيد العهدة') },
    ];
    downloadCsv(`العهد-${periodLabel}`, toCsv(columns, loans.data));
  }

  const loading = items.loading || usage.loading || loans.loading;

  return (
    <>
      <AdminHead
        kicker="التقارير"
        title="تقرير المخزون"
        subtitle={`سجلّ المخزون والاستهلاك والعُهد. الاستهلاك للفترة: ${periodLabel}.`}
        actions={(
          <div className="rep-tools">
            <label className="field"><span>الشهر</span>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS_AR.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </label>
            <label className="field"><span>السنة</span>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <button type="button" className="btn primary" onClick={downloadPdf} disabled={busy || loading}>
              <Download size={16} aria-hidden="true" /> {busy ? 'جارٍ إنشاء الملف…' : 'تحميل PDF'}
            </button>
          </div>
        )}
      />

      {error && <p className="error" role="alert">{error}</p>}

      <StatTiles items={[
        { label: 'أصناف المخزون', value: items.data.length, tone: 'brand' },
        { label: 'إجمالي الكميات', value: totalQty, tone: 'gold' },
        { label: 'قريبة الانتهاء', value: expiring, sub: 'خلال 30 يوماً', tone: 'warn' },
        { label: 'منتهية الصلاحية', value: expired, sub: 'تحتاج إزالة', tone: 'danger' },
        { label: `مستهلك في ${MONTHS_AR[month - 1]}`, value: usedQty, sub: `${usageInPeriod.length} عملية`, tone: 'brand' },
        { label: 'عُهد خارجة', value: loansOut, sub: 'لم تُعَد بعد', tone: 'warn' },
      ]} />

      <FormSection
        icon={Package}
        title="سجلّ المخزون"
        help="حالة كل مادة من حيث الكمية والصلاحية (الحالة الحالية)"
        aside={<CsvButton onClick={exportStockCsv} label="تصدير سجلّ المخزون" disabled={stock.length === 0} />}
      >
        {stock.length === 0 ? <EmptyPanel title="لا مواد في المخزون" /> : (
          <div className="table-wrap admin-table">
            <table>
              <thead><tr><th>المادة</th><th>الكمية</th><th>الصلاحية</th><th>تاريخ الانتهاء</th><th>المصدر</th></tr></thead>
              <tbody>
                {stock.map((i) => (
                  <tr key={i.id} className={`row-${i.ex.key}`}>
                    <td><strong>{i.name}</strong>{i.unit && <small>{i.unit}</small>}</td>
                    <td><span className={`qty ${Number(i.quantity) <= 0 ? 'is-zero' : ''}`}>{i.quantity}</span></td>
                    <td>
                      <span className={`status ${EXPIRY_CHIP[i.ex.key]}`}>
                        {i.ex.key === 'expired' && <AlertTriangle size={12} aria-hidden="true" />}
                        {i.ex.label}
                      </span>
                    </td>
                    <td>{i.expiry_date ? formatDate(i.expiry_date) : '—'}</td>
                    <td>{i.source || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>

      <FormSection
        icon={Activity}
        title={`الاستهلاك خلال ${periodLabel}`}
        help="ما استُخدم من المواد في الشهر المختار، مجمّعاً حسب المادة"
        aside={<CsvButton onClick={exportUsageCsv} label="تصدير الاستهلاك" disabled={usageByItem.length === 0} />}
      >
        {usageByItem.length === 0 ? <EmptyPanel icon={Boxes} title="لا استهلاك في هذه الفترة" text="اختر شهراً آخر، أو سجّل الاستخدام من سجلّ الاستخدام." /> : (
          <div className="table-wrap admin-table">
            <table>
              <thead><tr><th>المادة</th><th>الكمية المستهلكة</th><th>عدد المرات</th><th>آخر استخدام</th></tr></thead>
              <tbody>
                {usageByItem.map((u) => (
                  <tr key={u.name}>
                    <td><strong>{u.name}</strong></td>
                    <td><span className="qty">{u.qty}{u.unit ? ` ${u.unit}` : ''}</span></td>
                    <td>{u.uses}</td>
                    <td>{formatDate(u.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>

      <FormSection
        icon={HandCoins}
        title="العُهد"
        help="الأجهزة المُعارة وحالة إعادتها"
        aside={<CsvButton onClick={exportLoansCsv} label="تصدير العُهد" disabled={loans.data.length === 0} />}
      >
        {loans.data.length === 0 ? <EmptyPanel title="لا عُهد مسجّلة" /> : (
          <div className="table-wrap admin-table">
            <table>
              <thead><tr><th>الغرض</th><th>المستلم</th><th>تاريخ التسليم</th><th>الحالة</th></tr></thead>
              <tbody>
                {loans.data.map((l) => {
                  const returned = l.status === 'returned';
                  return (
                    <tr key={l.id}>
                      <td><strong>{l.item_name}</strong></td>
                      <td>{l.recipient_name}</td>
                      <td>{formatDate(l.loan_date)}</td>
                      <td><span className={`status ${returned ? 'ok' : 'pending'}`}>{returned ? `أُعيدت ${formatDate(l.return_date)}` : 'قيد العهدة'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>
    </>
  );
}
