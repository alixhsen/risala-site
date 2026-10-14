// Monthly report data, built only from the existing admin report endpoints.
// A mission can list several paramedics, so missions are counted once by id.
import { api, MONTHS_AR } from './api.js';

export async function loadMonth(year, month) {
  const [missions, services, bloodDonations, communityDonations, activities] = await Promise.all([
    api(`/admin/reports/paramedics?year=${year}&month=${month}`),
    api(`/admin/reports/services?year=${year}&month=${month}`),
    api(`/admin/reports/blood-donations?year=${year}&month=${month}`),
    api(`/admin/reports/community-donations?year=${year}&month=${month}`),
    api(`/admin/reports/activities?year=${year}&month=${month}`),
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
    bloodDonationsTotal: bloodDonations.total,
    bloodDonationTypes: bloodDonations.types,
    bloodDonations: bloodDonations.donations,
    communityDonationsTotal: communityDonations.total,
    communityDonationsQuantity: communityDonations.totalQuantity,
    communityDonationTypes: communityDonations.types,
    communityDonations: communityDonations.donations,
    activitiesTotal: activities.total,
  };
}

// Twelve months of one year, in calendar order (used by the dashboard charts).
export async function loadYear(year) {
  const months = await Promise.all(Array.from({ length: 12 }, (_, i) => loadMonth(year, i + 1)));
  return months;
}

// Sums type counts over several months: { name: count }. `key` may point to
// either a plain { name: count } object (typeCounts) or an array of
// { name, count } (serviceTypes, bloodDonationTypes, communityDonationTypes).
export function sumTypes(months, key = 'typeCounts') {
  const out = {};
  for (const m of months) {
    const value = m[key];
    const src = Array.isArray(value) ? Object.fromEntries(value.map((t) => [t.name, t.count])) : value;
    for (const [name, count] of Object.entries(src)) out[name] = (out[name] || 0) + count;
  }
  return out;
}

// Same { name, count } shape as sumTypes but as a sorted array, for the
// report tables/PDF that expect that shape (serviceTypes, bloodDonationTypes...).
function sumTypesList(months, key) {
  return Object.entries(sumTypes(months, key))
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// Sums a per-person count (missions or services) across the year, keeping
// one row per person. No per-mission/per-service detail is kept - that's
// only meaningful at the monthly grain, where Reports.jsx expands it inline.
function sumPeople(months, key) {
  const people = new Map();
  for (const m of months) {
    for (const p of m[key]) {
      const row = people.get(p.id) || { id: p.id, name: p.name, group_name: p.group_name, photo_url: p.photo_url, count: 0 };
      row.count += p.count;
      people.set(p.id, row);
    }
  }
  return [...people.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'));
}

// A full year rolled up into one report-shaped object, built entirely from
// loadYear's twelve months (no extra API calls). Deliberately has no
// `monthName` field - the PDF/image generators use that absence as the
// signal to render a yearly report instead of a monthly one.
export async function loadYearSummary(year) {
  const months = await loadYear(year);
  const sum = (key) => months.reduce((s, m) => s + (m[key] || 0), 0);

  return {
    year,
    missionsTotal: sum('missionsTotal'),
    typeCounts: sumTypes(months, 'typeCounts'),
    paramedics: sumPeople(months, 'paramedics'),
    servicesTotal: sum('servicesTotal'),
    serviceTypes: sumTypesList(months, 'serviceTypes'),
    serviceParamedics: sumPeople(months, 'serviceParamedics'),
    bloodDonationsTotal: sum('bloodDonationsTotal'),
    bloodDonationTypes: sumTypesList(months, 'bloodDonationTypes'),
    bloodDonations: months.flatMap((m) => m.bloodDonations),
    communityDonationsTotal: sum('communityDonationsTotal'),
    communityDonationsQuantity: sum('communityDonationsQuantity'),
    communityDonationTypes: sumTypesList(months, 'communityDonationTypes'),
    communityDonations: months.flatMap((m) => m.communityDonations),
    activitiesTotal: sum('activitiesTotal'),
  };
}
