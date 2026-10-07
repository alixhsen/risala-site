import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Info, FileText, Users, Image, Images, Eye, WandSparkles, Siren, Activity, Newspaper } from 'lucide-react';
import { useLoad, useSettings } from '../../App.jsx';
import { useAdmin } from '../../components/AdminLayout.jsx';
import CoverGenerator from '../../components/CoverGenerator.jsx';
import ImageInput from '../../components/ImageInput.jsx';
import MediaInput from '../../components/MediaInput.jsx';
import ParamedicPicker from '../../components/ParamedicPicker.jsx';
import TypeBadge from '../../components/TypeBadge.jsx';
import { AdminHead, FormSection, SaveBar } from '../../components/admin/AdminPage.jsx';
import { api, CATEGORIES, CATEGORY_LABELS, STATUS, formatDate } from '../../lib/api.js';

const EMPTY = {
  title: '', category: 'activity', mission_type_id: null, summary: '', body: '',
  cover_url: '', event_date: '', status: 'draft', images: [], paramedic_ids: [],
};
const CATEGORY_ICON = { mission: Siren, activity: Activity, news: Newspaper };
const STATUS_TONE = { draft: 'draft', pending: 'pending', published: 'published' };

export default function PostEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { isAdmin } = useAdmin();
  const missionTypes = useLoad('/admin/mission-types', []);
  const team = useLoad('/admin/team', []);
  const [post, setPost] = useState(() => {
    const category = CATEGORIES[params.get('category')] ? params.get('category') : EMPTY.category;
    return { ...EMPTY, category };
  });
  const [loaded, setLoaded] = useState(!id);
  const [showGenerator, setShowGenerator] = useState(false);
  const [state, setState] = useState({ busy: false, error: '' });
  const set = (patch) => setPost((p) => ({ ...p, ...patch }));

  useEffect(() => {
    if (!id) return;
    api(`/admin/posts/${id}`)
      .then((p) => {
        setPost({
          ...EMPTY, ...p,
          summary: p.summary || '', body: p.body || '', cover_url: p.cover_url || '',
          event_date: p.event_date ? String(p.event_date).slice(0, 10) : '',
          images: p.images || [], paramedic_ids: p.paramedic_ids || [],
        });
        setLoaded(true);
      })
      .catch((err) => setState((s) => ({ ...s, error: err.message })));
  }, [id]);

  async function save(status) {
    setState({ busy: true, error: '' });
    try {
      const body = { ...post, status };
      if (id) await api(`/admin/posts/${id}`, { method: 'PUT', body });
      else await api('/admin/posts', { method: 'POST', body });
      navigate('/admin/posts');
    } catch (err) {
      setState({ busy: false, error: err.message });
    }
  }

  if (!loaded) return state.error ? <p className="error">{state.error}</p> : <p className="muted">جارٍ التحميل…</p>;
  const locked = post.status === 'published' && !isAdmin && !!id;
  const isMission = post.category === 'mission';
  const missionType = missionTypes.data.find((t) => t.id === post.mission_type_id);
  const CatIcon = CATEGORY_ICON[post.category] || FileText;
  const initialInfo = isMission ? {
    typeLabel: missionType?.name || '',
    dateLabel: formatDate(post.event_date),
    names: team.data.filter((m) => post.paramedic_ids.includes(m.id)).map((m) => m.name),
    body: post.body,
  } : undefined;

  return (
    <>
      <AdminHead
        kicker={CATEGORIES[post.category]}
        title={id ? `تعديل ${CATEGORY_LABELS[post.category].one}` : CATEGORY_LABELS[post.category].new}
        subtitle={locked ? 'هذا المنشور منشور على الموقع، وتعديله للمدير فقط.' : 'املأ الأقسام، وراجع المعاينة قبل الحفظ.'}
        status={<span className={`status ${STATUS_TONE[post.status]}`}>{STATUS[post.status]}</span>}
      />

      <div className="editor">
        <div className="editor-main">
          <FormSection icon={CatIcon} title="المعلومات الأساسية" help="العنوان والقسم والتاريخ">
            <div className="seg-cats" role="group" aria-label="القسم">
              {Object.entries(CATEGORIES).map(([k, v]) => {
                const Icon = CATEGORY_ICON[k];
                return (
                  <button
                    key={k}
                    type="button"
                    className={post.category === k ? 'on' : ''}
                    aria-pressed={post.category === k}
                    onClick={() => set({ category: k, mission_type_id: null })}
                  >
                    <Icon size={16} aria-hidden="true" /> {v}
                  </button>
                );
              })}
            </div>

            <label className="field field-wide"><span>العنوان</span>
              <input maxLength={200} placeholder="عنوان واضح ومختصر" value={post.title} onChange={(e) => set({ title: e.target.value })} />
              <small className="field-help">{post.title.length} / 200</small>
            </label>

            <div className="field-row">
              <label className="field"><span>التاريخ</span>
                <input type="date" value={post.event_date} onChange={(e) => set({ event_date: e.target.value })} />
              </label>
              {isMission && (
                <label className="field"><span>نوع المهمة</span>
                  <select value={post.mission_type_id || ''} onChange={(e) => set({ mission_type_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">— اختر النوع —</option>
                    {missionTypes.data.filter((t) => t.active || t.id === post.mission_type_id).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </FormSection>

          <FormSection icon={FileText} title="المحتوى" help="الملخّص يظهر في البطاقة، والنص يظهر في صفحة المنشور">
            <label className="field field-wide"><span>ملخّص قصير</span>
              <input maxLength={500} placeholder="جملة أو جملتان تظهران في البطاقة" value={post.summary} onChange={(e) => set({ summary: e.target.value })} />
              <small className="field-help">{post.summary.length} / 500</small>
            </label>
            <label className="field field-wide"><span>{isMission ? 'تفاصيل المهمة' : 'النص الكامل'}</span>
              <textarea rows={9} value={post.body} onChange={(e) => set({ body: e.target.value })} />
              <small className="field-help">افصل الفقرات بسطر فارغ.</small>
            </label>
          </FormSection>

          {isMission && (
            <FormSection icon={Users} title="المسعفون المشاركون" help="اختر من شارك في المهمة لتظهر أسماؤهم في التقارير">
              <ParamedicPicker value={post.paramedic_ids} onChange={(ids) => set({ paramedic_ids: ids })} />
            </FormSection>
          )}

          <FormSection icon={Image} title="صورة الغلاف" help="ارفع صورة جاهزة، أو صمّم غلافاً بالمولّد">
            <ImageInput label="صورة الغلاف" value={post.cover_url} onChange={(url) => set({ cover_url: url })} />
            <button type="button" className="btn outline" onClick={() => setShowGenerator(!showGenerator)}>
              <WandSparkles size={16} aria-hidden="true" /> {showGenerator ? 'إغلاق المولّد' : 'فتح مولّد الصور'}
            </button>
            {showGenerator && (
              <div className="editor-gen">
                {isMission && <p className="hint">صمّم غلافاً، ثم بطاقة معلومات بتفاصيل المهمة، ونزّلهما معاً كمنشور من صورتين.</p>}
                <CoverGenerator
                  settings={settings}
                  initialTitle={post.title}
                  initialInfo={initialInfo}
                  onUse={(url) => set({ cover_url: url })}
                />
              </div>
            )}
          </FormSection>

          <FormSection icon={Images} title="صور وفيديوهات إضافية" help="تظهر في معرض المنشور بالترتيب الذي تضيفها به">
            <MediaInput value={post.images} onChange={(images) => set({ images })} />
          </FormSection>
        </div>

        <aside className="editor-side">
          <div className="preview-card">
            <p className="preview-label"><Eye size={14} aria-hidden="true" /> معاينة البطاقة</p>
            <article className="preview-post">
              <div className="preview-media">
                {post.cover_url ? <img src={post.cover_url} alt="" /> : <div className="cover-empty" />}
                {isMission && missionType
                  ? <span className="preview-type"><TypeBadge name={missionType.name} color={missionType.color} /></span>
                  : <span className="preview-type"><span className="tag">{CATEGORIES[post.category]}</span></span>}
              </div>
              <div className="preview-body">
                <h3>{post.title || 'عنوان المنشور'}</h3>
                {post.summary && <p>{post.summary}</p>}
                <small>{formatDate(post.event_date) || 'بلا تاريخ'}</small>
              </div>
            </article>
          </div>
          <div className="preview-meta">
            <div><span>الحالة</span><strong>{STATUS[post.status]}</strong></div>
            <div><span>الصور الإضافية</span><strong>{post.images.length}</strong></div>
            {isMission && <div><span>المشاركون</span><strong>{post.paramedic_ids.length}</strong></div>}
          </div>
        </aside>
      </div>

      <SaveBar error={state.error} hint={locked ? 'للتعديل، تواصل مع المدير.' : null}>
        <button type="button" className="btn" onClick={() => navigate('/admin/posts')}>إلغاء</button>
        <button type="button" className="btn" disabled={state.busy || locked} onClick={() => save('draft')}>حفظ كمسودة</button>
        {isAdmin
          ? <button type="button" className="btn primary" disabled={state.busy} onClick={() => save('published')}>نشر على الموقع</button>
          : <button type="button" className="btn primary" disabled={state.busy || locked} onClick={() => save('pending')}>إرسال للموافقة</button>}
      </SaveBar>
    </>
  );
}
