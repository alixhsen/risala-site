// The admin session is an httpOnly cookie set by the server, so page scripts
// never see the token. Every request carries X-Requested-With, which the server
// requires for changes (a cross-site form cannot set it).
const CSRF_HEADER = { 'X-Requested-With': 'risala-admin' };

// api('/admin/posts', { method: 'POST', body: {...} })  -> JSON
// api('/admin/upload', { method: 'POST', form: formData }) -> file upload
export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { ...CSRF_HEADER };
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: form || (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new Error('تعذر الاتصال بالخادم');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path.startsWith('/admin')) {
    window.location.assign('/admin/login');
  }
  if (!res.ok) throw new Error(data.error || 'حدث خطأ');
  return data;
}

// Ends the session on the server and clears the token kept by older versions of the admin.
export async function logout() {
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
  try { localStorage.removeItem('risala_token'); } catch { /* storage unavailable */ }
}

export async function uploadImage(fileOrBlob, filename = 'image.jpg') {
  const form = new FormData();
  form.append('image', fileOrBlob, fileOrBlob.name || filename);
  const { url } = await api('/admin/upload', { method: 'POST', form });
  return url;
}

// Routes an image or video file to the right upload endpoint and returns
// { url, kind } ready to store on a post's media list.
export async function uploadMedia(file) {
  const isVideo = file.type.startsWith('video/');
  const form = new FormData();
  form.append(isVideo ? 'video' : 'image', file, file.name);
  return api(isVideo ? '/admin/upload-video' : '/admin/upload', { method: 'POST', form });
}

export const CATEGORIES = {
  mission: 'مهمة',
  activity: 'نشاط',
  news: 'خبر',
};

export const CATEGORY_LABELS = {
  mission: { nav: 'المهام', one: 'مهمة', new: 'مهمة جديدة', empty: 'لا مهام بعد.' },
  activity: { nav: 'الأنشطة', one: 'نشاط', new: 'نشاط جديد', empty: 'لا أنشطة بعد.' },
  news: { nav: 'الأخبار', one: 'خبر', new: 'خبر جديد', empty: 'لا أخبار بعد.' },
};

export const MONTHS_AR = [
  'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول',
];

export const STATUS = {
  draft: 'مسودة',
  pending: 'بانتظار الموافقة',
  published: 'منشور',
};

export const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ar-LB', { year: 'numeric', month: 'long', day: 'numeric' });
};
