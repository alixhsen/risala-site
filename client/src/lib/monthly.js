// Monthly report data, built only from the existing admin report endpoints.
// A mission can list several paramedics, so missions are counted once by id.
import { api, MONTHS_AR } from './api.js';

export async function loadMonth(year, month) {
  const [missions, services] = await Promise.all([
    api(`/admin/reports/paramedics?year=${year}&month=${month}`),
    api(`/admin/reports/services?year=${year}&month=${month}`),
  ]);

  const unique = new Map();
  for (const p of missions.paramedics) {
    for (const m of p.missions) unique.set(m.id, m.type_name || 'غير محدّد');
  }
  const typeCounts = {};
  for (const type of unique.values()) typeCounts[type] = (typeCounts[type] || 0) + 1;

  return {
    year,
    month,
    monthName: MONTHS_AR[month - 1],
    missionsTotal: unique.size,
    typeCounts,
    paramedics: missions.paramedics,
    servicesTotal: services.totalServices,
    serviceTypes: services.types,
    serviceParamedics: services.paramedics,
  };
}

// Twelve months of one year, in calendar order (used by the dashboard charts).
export async function loadYear(year) {
  const months = await Promise.all(Array.from({ length: 12 }, (_, i) => loadMonth(year, i + 1)));
  return months;
}

// Sums type counts over several months: { name: count }.
export function sumTypes(months, key = 'typeCounts') {
  const out = {};
  for (const m of months) {
    const src = key === 'serviceTypes'
      ? Object.fromEntries(m.serviceTypes.map((t) => [t.name, t.count]))
      : m[key];
    for (const [name, count] of Object.entries(src)) out[name] = (out[name] || 0) + count;
  }
  return out;
}
