import React from 'react';
import { Box, HStack, Button } from '@chakra-ui/react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import useAttendance from '../hooks/useAttendance';
import { buildTable } from '../utils/printDesign';

export default function AttendancePrint() {
  const [search] = useSearchParams();
  const type = (search.get('type') || 'all').toLowerCase();
  const startDate = search.get('startDate') || '';
  const endDate = search.get('endDate') || '';
  const term = search.get('term') || '';
  const facultyId = search.get('facultyId') || '';
  const faculty = search.get('faculty') || '';
  const schedules = useSelector(selectAllCourses);

  const { data, loading } = useAttendance({ page: 1, limit: '', startDate, endDate, term, facultyId, faculty, schedules });

  const title = type === 'absent' ? 'Absent Summary (Per Faculty)' : 'Attendance Report';
  const subBits = [];
  if (startDate || endDate) subBits.push(`Dates: ${startDate || '—'} to ${endDate || '—'}`);
  if (term) subBits.push(`Term: ${term}`);
  if (faculty) subBits.push(`Faculty: ${faculty}`);
  const subtitle = subBits.join('  |  ');

  const bodyHtml = React.useMemo(() => {
    if (loading) return '<p>Loading…</p>';
    const arr = Array.isArray(data) ? data : [];
    if (type === 'absent') {
      const by = new Map();
      arr.forEach(r => {
        if (String(r.status || '').toLowerCase() !== 'absent') return;
        const sch = r.schedule || {};
        const fac = sch.faculty || sch.instructor || '';
        const key = fac || '(Unknown Faculty)';
        const subj = [sch.programcode, sch.courseName, sch.courseTitle].filter(Boolean).join(' - ');
        const tm = [sch.day, sch.time].filter(Boolean).join(' ');
        const row = [r.date || '', subj || '-', tm || '-', sch.term || ''];
        const a = by.get(key) || []; a.push(row); by.set(key, a);
      });
      const names = Array.from(by.keys()).sort((a,b)=>a.localeCompare(b));
      if (!names.length) return '<p>No absent records match current filters.</p>';
      let html = '';
      names.forEach((name) => {
        const rows = by.get(name) || [];
        const tbl = buildTable(['Date','Subject','Time','Term'], rows);
        html += `<div style="margin-bottom:12px;"><h3 class="prt-fac-name">${escapeHtml(name)}</h3>${tbl}</div>`;
      });
      return html;
    } else {
      const rows = arr.map(r => {
        const sch = r.schedule || {};
        const course = [sch.programcode, sch.courseName].filter(Boolean).join(' – ');
        const sched = [sch.day, sch.time].filter(Boolean).join(' ');
        return [r.date || '', String(r.status || '').toUpperCase(), course || '-', sched || '-', String(r.remarks || '').slice(0,80)];
      });
      return buildTable(['Date','Status','Course','Schedule','Remarks'], rows);
    }
  }, [type, data, loading]);

  const styles = `
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 0; color: #0a0a0a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .toolbar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #e5e7eb; padding: 8px 12px; display: flex; gap: 8px; z-index: 5; }
    @media print { .toolbar { display: none; } }
    .inst-hero { position: relative; background: url('/bg.jpg') center/cover no-repeat; min-height: 120px; padding: 16px 24px; display: flex; align-items: center; }
    .inst-hero::after { content: ''; position: absolute; inset: 0; background: rgba(255,255,255,0.92); z-index: 0; }
    .inst-wrap { position: relative; z-index: 1; display: flex; align-items: center; gap: 16px; width: 100%; }
    .inst-logo { width: 80px; height: 80px; border-radius: 10px; object-fit: cover; box-shadow: 0 3px 10px rgba(0,0,0,0.20); }
    .inst-lines { line-height: 1.2; }
    .inst-name { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 0.2px; color: #0a0a0a; }
    .inst-office { margin: 6px 0 0 0; font-size: 15px; color: #111; font-weight: 800; }
    .inst-app { margin: 8px 0 0 0; font-size: 13px; color: #333; font-weight: 700; }
    .prt-header { padding: 0 24px; margin-top: 12px; }
    .prt-title { font-weight: 900; font-size: 20px; margin: 0; }
    .prt-sub { color: #333; margin: 6px 0 0 0; font-size: 13px; font-weight: 600; }
    .prt-meta { color: #666; font-size: 12px; margin: 8px 0 0 0; }
    .prt-body { padding: 16px 24px 24px; }
    .prt-table { width: 100%; border-collapse: collapse; margin-top: 8px; table-layout: fixed; }
    .prt-table th, .prt-table td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; line-height: 1.3; vertical-align: top; }
    .prt-table th { background: #f6f9fc; text-align: left; font-weight: 700; }
    .prt-fac-name { font-weight: 900; font-size: 16px; margin: 0 0 6px 0; }
    .prt-footer { padding: 0 24px 16px; margin-top: 12px; display: flex; gap: 32px; justify-content: space-between; flex-wrap: wrap; font-size: 13px; }
    .prt-block { min-width: 260px; }
    .prt-sign { margin-top: 12px; display: inline-block; border-top: 1px solid #333; padding-top: 6px; font-weight: 700; }
    .prt-role { color: #444; font-size: 12px; }
  `;

  const now = new Date().toLocaleString();
  const html = `
    <style>${styles}</style>
    <div class='inst-hero'>
      <div class='inst-wrap'>
        <img class='inst-logo' src='/logo.png' alt='Logo' />
        <div class='inst-lines'>
          <p class='inst-name'>Kolehiyo ng Pantukan</p>
          <p class='inst-office'>Office of the Vice President of Academic Affairs</p>
          <p class='inst-app'>Smart Academic Scheduler</p>
        </div>
      </div>
    </div>
    <div class='prt-header'>
      <p class='prt-title'>${escapeHtml(title)}</p>
      ${subtitle ? `<p class='prt-sub'>${escapeHtml(subtitle)}</p>` : ''}
      <p class='prt-meta'>Printed: ${escapeHtml(now)}</p>
    </div>
    <div class='prt-body'>
      ${bodyHtml}
    </div>
    <div class='prt-footer'>
      <div class='prt-block'>
        <div class='prt-approve'>Verified by:</div>
        <div class='prt-sign'>Dr. Mharfe M. Micaroz</div>
        <div class='prt-role'>Vice President of Academic Affairs</div>
      </div>
      <div class='prt-block'>
        <div class='prt-approve'>Approved by:</div>
        <div class='prt-sign'>Dr. Mary Ann R. Araula</div>
        <div class='prt-role'>Acting College President</div>
      </div>
    </div>
  `;

  return (
    <Box>
      <HStack className="toolbar" justify="flex-end">
        <Button colorScheme="blue" onClick={() => window.print()}>Print</Button>
      </HStack>
      <Box dangerouslySetInnerHTML={{ __html: html }} />
    </Box>
  );
}

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
