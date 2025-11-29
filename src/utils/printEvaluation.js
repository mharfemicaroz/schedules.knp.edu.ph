import { printContent, buildTable } from './printDesign';

export function printEvaluationSummary({
  title = 'Evaluation Summary',
  subtitle = '',
  stats = {},
  feedbacks = [],
  questions = [],
  context = {},
  mode = 'schedule',
}) {
  // Student mode: print only evaluated courses list
  if (mode === 'student') {
    const courses = Array.isArray(context?.courses) ? context.courses : [];
    const hdrs = ['Program', 'Course', 'Title', 'Term', 'Day/Time', 'Faculty'];
    const rows = courses.map((c) => [
      String(c.programcode || ''),
      String(c.course_name || ''),
      String(c.course_title || ''),
      buildTermStr({ term: c.term, sy: c.sy, sem: c.sem }),
      [c.day, c.time].filter(Boolean).join(' · '),
      String(c.instructor || ''),
    ]);

    const tableHtml = buildTable(hdrs, rows);
    const bodyHtml = tableHtml;
    printContent({ title, subtitle, bodyHtml }, { orientation: 'portrait', compact: false });
    return;
  }

  const rows = questions.map((q, i) => {
    const key = `q${i + 1}`;
    const avg = stats && stats[key] != null ? Number(stats[key]).toFixed(2) : '-';
    return [String(i + 1), q, String(avg)];
  });
  const hdrs = ['#', 'Statement', 'Average'];
  const details = buildDetails(mode, context);
  const detailsHtml = `
    <table class='prt-table'>
      <thead><tr><th class='col-tight'>Field</th><th>Value</th></tr></thead>
      <tbody>
        ${details.map(d => `<tr><td class='col-tight'>${escapeHtml(d[0])}</td><td>${escapeHtml(d[1])}</td></tr>`).join('')}
      </tbody>
    </table>`;

  const tableHtml = buildTable(hdrs, rows);
  const fbHtml = (feedbacks || []).length
    ? `<div class='prt-notice'><div class='prt-notice-title'>Top Feedback</div>
        ${feedbacks.map(f => `<p>${escapeHtml(f.feedback)}</p>`).join('')}
      </div>`
    : '';
  const bodyHtml = `${detailsHtml}${tableHtml}${fbHtml}`;
  printContent({ title, subtitle, bodyHtml }, { orientation: 'portrait', compact: false });
}

function buildTermStr(ctx) {
  const bits = [];
  if (ctx.term) bits.push(ctx.term);
  if (ctx.sy) bits.push(`SY ${ctx.sy}`);
  if (ctx.sem) bits.push(ctx.sem);
  return bits.join(' • ');
}

function buildDetails(mode, ctx) {
  if (mode === 'faculty') {
    return [
      ['Faculty', ctx.instructor || ctx.faculty || '-'],
      ['Department', ctx.dept || ctx.department || '-'],
      ['Designation', ctx.designation || '-'],
      ['Employment', ctx.employment || '-'],
      ['Load Release Units', ctx.load_release_units ?? ctx.loadReleaseUnits ?? '-'],
      ['School Year', ctx.sy || '-'],
      ['Semester', ctx.sem || '-'],
    ];
  }
  // schedule/course view
  return [
    ['Program', ctx.programcode || '-'],
    ['Course', ctx.course_name || ctx.course || '-'],
    ['Course Title', ctx.course_title || ctx.courseTitle || '-'],
    ['Faculty', ctx.instructor || ctx.faculty || '-'],
    ['Term', buildTermStr(ctx)],
  ];
}

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
