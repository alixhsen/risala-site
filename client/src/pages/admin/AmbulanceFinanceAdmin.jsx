import { useDialog } from '../../components/admin/Dialog.jsx';
import { useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, Wallet, Check, X, FileSpreadsheet, ArrowDownCircle, ArrowUpCircle, Settings2 } from 'lucide-react';
import { useLoad } from '../../App.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import { AdminHead, FormSection, SaveBar } from '../../components/admin/AdminPage.jsx';
import { StatTiles, FilterBar, ChipFilter, IconButton, EmptyPanel } from '../../components/admin/DataPage.jsx';
import { api, formatDate } from '../../lib/api.js';
import { toCsv, downloadCsv } from '../../lib/csv.js';

const EMPTY = {
  type: 'income', amount: '', category: '', ambulance_number: '160', party: '',
  transaction_date: new Date().toISOString().slice(0, 10), receipt_url: '', notes: '',
};
const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));

// Which grid columns a viewer wants shown - a display preference, so it
// lives in this browser only (not synced between admins or devices).
const GRID_COLUMNS = [
  { key: 'date', label: 'التاريخ' },
  { key: 'type', label: 'النوع' },
  { key: 'category', label: 'الفئة' },
  { key: 'amount', label: 'المبلغ' },
  { key: 'party', label: 'الجهة' },
  { key: 'ambulance_number', label: 'رقم السيارة' },
  { key: 'notes', label: 'ملاحظات' },
];
const GRID_STORAGE_KEY = 'risala-ambulance-finance-columns';

function loadGridColumns() {
  try {
    const saved = JSON.parse(localStorage.getItem(GRID_STORAGE_KEY));
    if (Array.isArray(saved) && saved.every((k) => GRID_COLUMNS.some((c) => c.key === k))) return saved;
  } catch { /* storage unavailable or corrupt - fall back to defaults */ }
  return GRID_COLUMNS.map((c) => c.key);
}

// Income (donations, grants...) and expenses (fuel, maintenance...) for the
// ambulance, one combined ledger. `ambulance_number` lets a future second
// vehicle be filtered separately without changing the data model.
export default function AmbulanceFinanceAdmin() {
  const { confirm, notify } = useDialog();
  const { data, error, reload } = useLoad('/admin/ambulance-transactions', []);
  const categories = useLoad('/admin/ambulance-categories', []);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [gridCols, setGridCols] = useState(loadGridColumns);
  const [showGridSettings, setShowGridSettings] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function toggleCol(key) {
    setGridCols((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try { localStorage.setItem(GRID_STORAGE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }
  const showCol = (key) => gridCols.includes(key);

  const counts = useMemo(() => {
    const income = data.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const outcome = data.filter((t) => t.type === 'outcome').reduce((s, t) => s + Number(t.amount || 0), 0);
    return { all: data.length, income, outcome, balance: income - outcome };
  }, [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((t) => {
      if (filter !== 'all' && t.type !== filter) return false;
      if (!q) return true;
      return [t.category, t.party, t.notes, t.ambulance_number].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [data, filter, search]);

  function exportRows() {
    const columns = [
      { label: 'التاريخ', value: (t) => String(t.transaction_date).slice(0, 10) },
      { label: 'النوع', value: (t) => (t.type === 'income' ? 'إيراد' : 'مصروف') },
      { label: 'الفئة', value: 'category' },
      { label: 'المبلغ ($)', value: 'amount' },
      { label: 'الجهة', value: 'party' },
      { label: 'رقم السيارة', value: 'ambulance_number' },
      { label: 'ملاحظات', value: 'notes' },
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`السجل-المالي-للإسعاف-${stamp}`, toCsv(columns, rows));
  }

  async function save(e) {
    e.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      if (form.id) await api(`/admin/ambulance-transactions/${form.id}`, { method: 'PUT', body: form });
      else await api('/admin/ambulance-transactions', { method: 'POST', body: form });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(t) {
    if (!(await confirm('حذف هذه الحركة المالية نهائياً؟', { danger: true }))) return;
    await api(`/admin/ambulance-transactions/${t.id}`, { method: 'DELETE' }).catch((err) => notify(err.message));
    reload();
  }

  return (
    <>
      <AdminHead
        kicker="سيارة الإسعاف"
        title="الإيرادات والمصروفات"
        subtitle="سجّل الأموال الواردة للسيارة (تبرعات، دعم) والمصروفات عليها (وقود، صيانة)."
        actions={(
          <>
            <button type="button" className="btn" onClick={() => setShowGridSettings((v) => !v)} aria-expanded={showGridSettings} title="اختيار أعمدة الجدول">
              <Settings2 size={16} aria-hidden="true" /> إعدادات الجدول
            </button>
            <button type="button" className="btn" onClick={exportRows} disabled={rows.length === 0} title="تصدير الحركات المعروضة في القائمة">
              <FileSpreadsheet size={16} aria-hidden="true" /> تصدير CSV
            </button>
            <button type="button" className="btn primary" onClick={() => { setFormError(''); setForm(EMPTY); }}><Plus size={16} aria-hidden="true" /> حركة جديدة</button>
          </>
        )}
      />

      {showGridSettings && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <p className="hint" style={{ marginTop: 0 }}>اختر الأعمدة التي تريد ظهورها في جدول الحركات أدناه.</p>
          <div className="field-row" style={{ flexWrap: 'wrap', gap: 12 }}>
            {GRID_COLUMNS.map((c) => (
              <label key={c.key} className="check">
                <input type="checkbox" checked={showCol(c.key)} onChange={() => toggleCol(c.key)} />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <StatTiles items={[
        { label: 'إجمالي الإيرادات', value: money(counts.income), tone: 'ok' },
        { label: 'إجمالي المصروفات', value: money(counts.outcome), tone: 'danger' },
        { label: 'الرصيد', value: money(counts.balance), tone: counts.balance >= 0 ? 'brand' : 'danger' },
        { label: 'عدد الحركات', value: counts.all, tone: 'gold' },
      ]} />

      {error && <p className="error">{error}</p>}

      {form && (
        <form className="drawer-form" onSubmit={save}>
          <FormSection icon={Wallet} title={form.id ? 'تعديل حركة' : 'حركة مالية جديدة'} help="اختر النوع أولاً لتظهر الفئات المناسبة له.">
            <div className="field-row">
              <label className="field"><span>النوع</span>
                <select value={form.type} onChange={(e) => set({ type: e.target.value, category: '' })}>
                  <option value="income">إيراد (وارد)</option>
                  <option value="outcome">مصروف (صادر)</option>
                </select>
              </label>
              <label className="field"><span>المبلغ ($)</span>
                <input required type="number" min="0" step="any" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>الفئة</span>
                <select value={form.category || ''} onChange={(e) => set({ category: e.target.value })}>
                  <option value="">— اختر الفئة —</option>
                  {categories.data
                    .filter((c) => c.kind === form.type && (c.active || c.name === form.category))
                    .map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <small className="field-help">فئة جديدة؟ أضفها من <a href="/admin/ambulance-categories" target="_blank" rel="noreferrer">فئات مالية سيارة الإسعاف</a>.</small>
              </label>
              <label className="field"><span>تاريخ الحركة</span>
                <input required type="date" value={form.transaction_date || ''} onChange={(e) => set({ transaction_date: e.target.value })} />
              </label>
            </div>
            <div className="field-row">
              <label className="field"><span>{form.type === 'income' ? 'الجهة المانحة' : 'الجهة المستفيدة/المورّد'}</span>
                <input maxLength={150} value={form.party || ''} onChange={(e) => set({ party: e.target.value })} />
              </label>
              <label className="field"><span>رقم السيارة</span>
                <input maxLength={20} value={form.ambulance_number || ''} onChange={(e) => set({ ambulance_number: e.target.value })} />
              </label>
            </div>
            <ImageInput label="صورة الإيصال (اختياري)" value={form.receipt_url || ''} onChange={(url) => set({ receipt_url: url })} />
            <label className="field"><span>ملاحظات</span>
              <textarea rows={3} value={form.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
            </label>
            {formError && <p className="error" role="alert">{formError}</p>}
          </FormSection>
          <SaveBar>
            <button type="button" className="btn" onClick={() => setForm(null)}><X size={15} aria-hidden="true" /> إلغاء</button>
            <button className="btn primary" disabled={busy}><Check size={15} aria-hidden="true" /> {busy ? 'جارٍ الحفظ…' : 'حفظ الحركة'}</button>
          </SaveBar>
        </form>
      )}

      <FilterBar search={search} onSearch={setSearch} placeholder="ابحث بالفئة أو الجهة أو الملاحظات">
        <ChipFilter
          label="النوع"
          value={filter}
          onChange={setFilter}
          options={[
            ['all', 'الكل', counts.all],
            ['income', 'إيرادات', data.filter((t) => t.type === 'income').length],
            ['outcome', 'مصروفات', data.filter((t) => t.type === 'outcome').length],
          ]}
        />
      </FilterBar>

      {data.length === 0 && <EmptyPanel icon={Wallet} title="لا حركات مالية بعد" text="أضف أول حركة من الزر أعلاه." />}
      {data.length > 0 && rows.length === 0 && <EmptyPanel title="لا نتائج مطابقة" text="جرّب كلمة بحث أخرى، أو غيّر تصفية النوع." />}

      {rows.length > 0 && (
        <div className="table-wrap admin-table">
          <table>
            <thead>
              <tr>
                {showCol('date') && <th>التاريخ</th>}
                {showCol('type') && <th>النوع</th>}
                {showCol('category') && <th>الفئة</th>}
                {showCol('amount') && <th>المبلغ</th>}
                {showCol('party') && <th>الجهة</th>}
                {showCol('ambulance_number') && <th>رقم السيارة</th>}
                {showCol('notes') && <th>ملاحظات</th>}
                <th aria-label="إجراءات"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  {showCol('date') && <td>{formatDate(t.transaction_date)}</td>}
                  {showCol('type') && (
                    <td>
                      <span className={`status ${t.type === 'income' ? 'ok' : 'danger'}`}>
                        {t.type === 'income' ? <ArrowDownCircle size={12} aria-hidden="true" /> : <ArrowUpCircle size={12} aria-hidden="true" />}
                        {t.type === 'income' ? 'إيراد' : 'مصروف'}
                      </span>
                    </td>
                  )}
                  {showCol('category') && <td>{t.category || '—'}</td>}
                  {showCol('amount') && <td><strong>{money(t.amount)}</strong></td>}
                  {showCol('party') && <td>{t.party || '—'}</td>}
                  {showCol('ambulance_number') && <td>{t.ambulance_number}</td>}
                  {showCol('notes') && <td className="cell-wrap">{t.notes || '—'}</td>}
                  <td className="row-actions-icons">
                    <IconButton icon={Pencil} label="تعديل الحركة" onClick={() => { setFormError(''); setForm({ ...t, transaction_date: t.transaction_date ? String(t.transaction_date).slice(0, 10) : '' }); }} />
                    <IconButton icon={Trash2} label="حذف الحركة" tone="danger" onClick={() => remove(t)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
