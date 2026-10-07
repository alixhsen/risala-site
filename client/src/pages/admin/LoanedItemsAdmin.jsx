import { useDialog } from '../../components/admin/Dialog.jsx';
import { useMemo, useState } from 'react';
import { FileDown, Pencil, Trash2, Plus, HandCoins, Phone, X, Check, FileSpreadsheet } from 'lucide-react';
import { useLoad, useSettings } from '../../App.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import { AdminHead, FormSection, SaveBar } from '../../components/admin/AdminPage.jsx';
import { StatTiles, FilterBar, ChipFilter, IconButton, EmptyPanel, Thumb } from '../../components/admin/DataPage.jsx';
import { api, formatDate } from '../../lib/api.js';
import { downloadLoanReceipt } from '../../lib/receipt.js';
import { toCsv, downloadCsv } from '../../lib/csv.js';

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { item_name: '', recipient_name: '', recipient_phone: '', loan_date: today(), image_url: '', notes: '' };
const COMMON_ITEMS = ['عكّاز مشي (ووكر)', 'كرسي متحرك', 'اسطوانة أوكسجين', 'سرير طبي', 'جهاز قياس ضغط'];

export default function LoanedItemsAdmin() {
  const { confirm, notify } = useDialog();
  const { settings } = useSettings();
  const { data, error, reload } = useLoad('/admin/loaned-items', []);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const counts = useMemo(() => ({
    all: data.length,
    out: data.filter((r) => r.status !== 'returned').length,
    returned: data.filter((r) => r.status === 'returned').length,
  }), [data]);
  const rate = counts.all ? Math.round((counts.returned / counts.all) * 100) : 0;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      if (filter === 'out' && r.status === 'returned') return false;
      if (filter === 'returned' && r.status !== 'returned') return false;
      if (!q) return true;
      return [r.item_name, r.recipient_name, r.recipient_phone].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [data, filter, search]);

  // Exports the loans currently listed (so a filter applies to the file too).
  function exportLoans() {
    const columns = [
      { label: 'الغرض', value: 'item_name' },
      { label: 'المستلم', value: 'recipient_name' },
      { label: 'هاتف المستلم', value: 'recipient_phone' },
      { label: 'تاريخ التسليم', value: (r) => String(r.loan_date).slice(0, 10) },
      { label: 'الحالة', value: (r) => (r.status === 'returned' ? 'أُعيدت' : 'قيد العهدة') },
      { label: 'تاريخ الإعادة', value: (r) => (r.return_date ? String(r.return_date).slice(0, 10) : '') },
      { label: 'ملاحظات', value: 'notes' },
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`سجل-العهد-${stamp}`, toCsv(columns, rows));
  }

  async function save(e) {
    e.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      if (form.id) await api(`/admin/loaned-items/${form.id}`, { method: 'PUT', body: form });
      else await api('/admin/loaned-items', { method: 'POST', body: form });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleReturned(row) {
    await api(`/admin/loaned-items/${row.id}/return`, { method: 'PUT', body: { returned: row.status !== 'returned' } })
      .catch((err) => notify(err.message));
    reload();
  }

  async function remove(row) {
    if (!(await confirm(`حذف سجل عهدة "${row.item_name}"؟`, { danger: true }))) return;
    await api(`/admin/loaned-items/${row.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  async function receipt(row) {
    setBusyId(row.id);
    try {
      await downloadLoanReceipt({ settings, loan: row });
    } catch (err) {
      notify(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <AdminHead
        kicker="المخزون"
        title="العُهد"
        subtitle="أجهزة مُعارة مثل الووكر واسطوانة الأوكسجين والكرسي المتحرك، تُسلَّم لشخص وتُستعاد لاحقاً. لكل عهدة إيصال PDF."
        actions={(
          <>
            <button type="button" className="btn" onClick={exportLoans} disabled={rows.length === 0} title="تصدير العُهد المعروضة في القائمة">
              <FileSpreadsheet size={16} aria-hidden="true" /> تصدير CSV
            </button>
            <button type="button" className="btn primary" onClick={() => setForm(EMPTY)}><Plus size={16} aria-hidden="true" /> تسليم عهدة جديدة</button>
          </>
        )}
      />

      <StatTiles items={[
        { label: 'إجمالي العُهد', value: counts.all, tone: 'brand' },
        { label: 'لم تُعَد بعد', value: counts.out, sub: 'قيد الاستخدام', tone: 'warn' },
        { label: 'أُعيدت', value: counts.returned, tone: 'ok' },
        { label: 'نسبة الإعادة', value: `${rate}%`, sub: 'من مجموع العُهد', tone: 'gold' },
      ]} />

      {error && <p className="error">{error}</p>}

      {form && (
        <form className="drawer-form" onSubmit={save}>
          <FormSection icon={HandCoins} title={form.id ? 'تعديل عهدة' : 'تسليم عهدة جديدة'} help="سجّل الغرض والمستلم، وسيُنشأ الإيصال من السجل.">
            <div className="field-row">
              <label className="field"><span>الغرض</span>
                <input required maxLength={150} list="common-loan-items" placeholder="مثال: كرسي متحرك" value={form.item_name} onChange={(e) => set({ item_name: e.target.value })} />
                <datalist id="common-loan-items">{COMMON_ITEMS.map((n) => <option key={n} value={n} />)}</datalist>
              </label>
              <label className="field"><span>تاريخ التسليم</span>
                <input type="date" required value={form.loan_date} onChange={(e) => set({ loan_date: e.target.value })} />
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>اسم المستلم</span>
                <input required maxLength={150} value={form.recipient_name} onChange={(e) => set({ recipient_name: e.target.value })} />
              </label>
              <label className="field"><span>رقم الهاتف</span>
                <input dir="ltr" type="tel" maxLength={40} value={form.recipient_phone || ''} onChange={(e) => set({ recipient_phone: e.target.value })} />
              </label>
            </div>
            <ImageInput label="صورة الغرض" value={form.image_url || ''} onChange={(url) => set({ image_url: url })} />
            <label className="field"><span>ملاحظات</span>
              <textarea rows={3} value={form.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
            </label>
            {formError && <p className="error" role="alert">{formError}</p>}
          </FormSection>
          <SaveBar>
            <button type="button" className="btn" onClick={() => setForm(null)}><X size={15} aria-hidden="true" /> إلغاء</button>
            <button className="btn primary" disabled={busy}><Check size={15} aria-hidden="true" /> {busy ? 'جارٍ الحفظ…' : 'حفظ العهدة'}</button>
          </SaveBar>
        </form>
      )}

      <FilterBar search={search} onSearch={setSearch} placeholder="ابحث بالغرض أو المستلم أو الهاتف">
        <ChipFilter
          label="حالة العهدة"
          value={filter}
          onChange={setFilter}
          options={[['all', 'الكل', counts.all], ['out', 'قيد العهدة', counts.out], ['returned', 'أُعيدت', counts.returned]]}
        />
      </FilterBar>

      {data.length === 0 && <EmptyPanel icon={HandCoins} title="لا عُهد مسجّلة بعد" text="سلّم أول عهدة من الزر أعلاه، وسيُنشأ لها إيصال PDF." />}
      {data.length > 0 && rows.length === 0 && <EmptyPanel title="لا نتائج مطابقة" text="جرّب كلمة بحث أخرى، أو غيّر تصفية الحالة." />}

      {rows.length > 0 && (
        <div className="table-wrap admin-table">
          <table>
            <thead>
              <tr><th>الصورة</th><th>الغرض</th><th>المستلم</th><th>تاريخ التسليم</th><th>الحالة</th><th aria-label="إجراءات"></th></tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const returned = row.status === 'returned';
                return (
                  <tr key={row.id}>
                    <td><Thumb src={row.image_url} alt={row.item_name} /></td>
                    <td><strong>{row.item_name}</strong>{row.notes && <small className="cell-note">{row.notes}</small>}</td>
                    <td>
                      <strong>{row.recipient_name}</strong>
                      {row.recipient_phone && <small className="cell-phone"><Phone size={12} aria-hidden="true" /> <bdi>{row.recipient_phone}</bdi></small>}
                    </td>
                    <td>{formatDate(row.loan_date)}</td>
                    <td>
                      <button type="button" className={`status-btn ${returned ? 'ok' : 'warn'}`} onClick={() => toggleReturned(row)} title={returned ? 'اضغط لإعادة الحالة إلى قيد العهدة' : 'اضغط لتسجيل الإعادة'}>
                        {returned ? <><Check size={13} aria-hidden="true" /> أُعيدت {formatDate(row.return_date)}</> : 'قيد العهدة'}
                      </button>
                    </td>
                    <td className="row-actions-icons">
                      <IconButton icon={FileDown} label={busyId === row.id ? 'جارٍ تجهيز الإيصال' : 'تحميل الإيصال PDF'} onClick={() => receipt(row)} disabled={busyId === row.id} tone="brand" />
                      <IconButton icon={Pencil} label="تعديل العهدة" onClick={() => { setFormError(''); setForm({ ...row, loan_date: String(row.loan_date).slice(0, 10) }); }} />
                      <IconButton icon={Trash2} label="حذف العهدة" onClick={() => remove(row)} tone="danger" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
