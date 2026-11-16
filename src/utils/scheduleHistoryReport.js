const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = value => String(value).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export function buildScheduleHistoryReport(items, filters, generatedAt = new Date()) {
  const actions = {};
  items.forEach(item => { const action = item.action || 'unknown'; actions[action] = (actions[action] || 0) + 1; });
  const records = items.map((item, index) => {
    const schedule = item.schedule || {};
    const details = String(item.details || 'No details recorded.');
    const changes = [...details.matchAll(/(?:^|\|)\s*([\w]+): '([\s\S]*?)' -> '([\s\S]*?)'(?=\s*\||$)/g)];
    const context = [schedule.programcode, schedule.courseName, schedule.courseTitle, schedule.blockCode,
      schedule.schoolyear, schedule.semester, schedule.term, schedule.day, schedule.time, schedule.room, schedule.instructor].filter(Boolean);
    return `<article><h2>${index + 1}. ${escapeHtml(label(item.action || 'unknown'))} — Schedule #${escapeHtml(item.scheduleId)}</h2>
      <p class="meta">${escapeHtml(new Date(item.createdAt).toLocaleString())} · By ${escapeHtml(item.actor || 'system')} · Event #${escapeHtml(item.id)}</p>
      ${context.length ? `<p><b>Current schedule context:</b> ${context.map(escapeHtml).join(' · ')}</p>` : '<p>Schedule context unavailable; see recorded details below.</p>'}
      ${changes.length ? `<table><thead><tr><th>Changed field</th><th>Before</th><th>After</th></tr></thead><tbody>${changes.map(([, field, before, after]) => `<tr><td>${escapeHtml(label(field))}</td><td>${escapeHtml(before || '(empty)')}</td><td>${escapeHtml(after || '(empty)')}</td></tr>`).join('')}</tbody></table>` : ''}
      <p class="details"><b>Full recorded details:</b><br>${escapeHtml(details).replace(/ \| /g, '<br>')}</p></article>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Schedule History Report</title><style>
    @page { size: A4; margin: 15mm; } * { box-sizing: border-box; } body { font: 11pt Arial, sans-serif; color: #172033; margin: 24px auto; max-width: 1000px; line-height: 1.45; }
    h1 { font-size: 22pt; margin-bottom: 0; } h2 { font-size: 12pt; margin-bottom: 4px; } .meta { color: #475569; font-size: 10pt; } .summary { padding: 12px; border: 1px solid #94a3b8; }
    article { border-top: 1px solid #cbd5e1; margin-top: 18px; padding-top: 8px; } p, td { overflow-wrap: anywhere; } .details { white-space: pre-wrap; font-size: 10pt; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; table-layout: fixed; } th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; vertical-align: top; } th { background: #f1f5f9; } thead { display: table-header-group; } tr { break-inside: avoid; } h2 { break-after: avoid; }
    button { padding: 10px 16px; cursor: pointer; } @media print { body { margin: 0; max-width: none; } .toolbar { display: none; } }
    </style></head><body><div class="toolbar"><button onclick="window.print()">Print / Save PDF</button><p>Choose “Save as PDF” in the print dialog to download this report.</p></div>
    <h1>KNP Schedule History Report</h1><p class="meta">Generated ${escapeHtml(generatedAt.toLocaleString())} · ${escapeHtml(Intl.DateTimeFormat().resolvedOptions().timeZone)}</p>
    <div class="summary"><b>Applied filters</b><p>Search: ${escapeHtml(filters.q || 'All')} · Action: ${escapeHtml(filters.action || 'All')}<br>From: ${escapeHtml(filters.dateFrom || 'Any date')} · Through: ${escapeHtml(filters.dateTo || 'Any date')}</p>
    <b>${items.length} events · ${new Set(items.map(i => i.scheduleId).filter(id => id != null)).size} schedules · ${new Set(items.map(i => i.userId ?? i.actor ?? 'system')).size} actors</b>
    <p>${Object.entries(actions).map(([action, count]) => `${escapeHtml(label(action))}: ${count}`).join(' · ')}</p></div>
    <p>All matching records, newest first. Before/after values come from the audit record. Current schedule context may reflect later edits. IDs are retained where names were not recorded.</p>
    ${records || '<p>No history entries matched these filters.</p>'}</body></html>`;
}
