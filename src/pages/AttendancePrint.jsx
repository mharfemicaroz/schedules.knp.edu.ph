import React from 'react';
import { Box, HStack, Button, useToast } from '@chakra-ui/react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import useAttendance from '../hooks/useAttendance';
import useFaculties from '../hooks/useFaculties';
import apiService from '../services/apiService';

export default function AttendancePrint() {
  const [search] = useSearchParams();
  const toast = useToast();
  const type = normalizeStatus(search.get('type') || 'all');
  const startDate = search.get('startDate') || '';
  const endDate = search.get('endDate') || '';
  const term = search.get('term') || '';
  const schoolYear = search.get('school_year') || '';
  const semester = search.get('semester') || '';
  const facultyId = search.get('facultyId') || '';
  const faculty = search.get('faculty') || '';
  const status = normalizeStatus(search.get('status') || '');
  const schedules = useSelector(selectAllCourses);
  const { data: facultyOptions } = useFaculties();
  const facultyById = React.useMemo(() => {
    const map = new Map();
    (facultyOptions || []).forEach((opt) => {
      if (opt && opt.id != null) map.set(String(opt.id), opt.label);
    });
    return map;
  }, [facultyOptions]);

  const isSummary = ['present', 'absent', 'excused'].includes(type);
  const summaryLabel = isSummary
    ? (type === 'excused' ? 'Excuse' : `${type.slice(0,1).toUpperCase()}${type.slice(1)}`)
    : '';
  const statusFilter = isSummary ? type : status;

  const { data, loading, refresh } = useAttendance({ page: 1, limit: '', startDate, endDate, term, school_year: schoolYear, semester, facultyId, faculty, status: statusFilter, schedules });
  const [excusingIds, setExcusingIds] = React.useState(() => new Set());
  const allowExcuse = normalizeStatus(type) === 'absent' || normalizeStatus(statusFilter) === 'absent';

  const recordById = React.useMemo(() => {
    const map = new Map();
    const arr = Array.isArray(data) ? data : [];
    arr.forEach((r) => {
      if (r && r.id != null) map.set(String(r.id), r);
    });
    return map;
  }, [data]);

  const handleExcuse = React.useCallback(async (id) => {
    const key = String(id || '').trim();
    if (!key || excusingIds.has(key)) return;
    const record = recordById.get(key);
    if (!record) {
      toast({ title: 'Record not found', status: 'warning' });
      return;
    }
    setExcusingIds((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    try {
      await apiService.updateAttendance(record.id, {
        status: 'excused',
        date: record.date,
        remarks: record.remarks == null ? '' : String(record.remarks),
      });
      toast({ title: 'Marked as excused', status: 'success' });
      await refresh(true);
    } catch (e) {
      toast({ title: 'Failed to update', description: e.message, status: 'error' });
    } finally {
      setExcusingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [excusingIds, recordById, refresh, toast]);

  const handleExcuseMany = React.useCallback(async (ids) => {
    const list = Array.isArray(ids) ? ids : [];
    const cleaned = list.map((id) => String(id || '').trim()).filter(Boolean);
    const pending = cleaned.filter((id) => !excusingIds.has(id));
    if (!pending.length) return;
    setExcusingIds((prev) => new Set([...prev, ...pending]));
    try {
      const updates = pending
        .map((id) => recordById.get(id))
        .filter(Boolean)
        .map((record) => apiService.updateAttendance(record.id, {
          status: 'excused',
          date: record.date,
          remarks: record.remarks == null ? '' : String(record.remarks),
        }));
      if (!updates.length) {
        toast({ title: 'No records found', status: 'warning' });
        return;
      }
      await Promise.all(updates);
      toast({
        title: 'Marked as excused',
        description: `Excused ${updates.length} record${updates.length === 1 ? '' : 's'}.`,
        status: 'success',
      });
      await refresh(true);
    } catch (e) {
      toast({ title: 'Failed to update', description: e.message, status: 'error' });
    } finally {
      setExcusingIds((prev) => {
        const next = new Set(prev);
        pending.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [excusingIds, recordById, refresh, toast]);

  const handleBodyClick = React.useCallback((event) => {
    const target = event.target;
    const batchBtn = target && typeof target.closest === 'function'
      ? target.closest('[data-attendance-ids]')
      : null;
    if (batchBtn) {
      const raw = batchBtn.getAttribute('data-attendance-ids') || '';
      const ids = raw.split(',').map((v) => v.trim()).filter(Boolean);
      if (!ids.length) return;
      event.preventDefault();
      handleExcuseMany(ids);
      return;
    }
    const btn = target && typeof target.closest === 'function'
      ? target.closest('[data-attendance-id]')
      : null;
    if (!btn) return;
    const id = btn.getAttribute('data-attendance-id');
    if (!id) return;
    event.preventDefault();
    handleExcuse(id);
  }, [handleExcuse, handleExcuseMany]);

  const title = isSummary ? `${summaryLabel} Summary (Per Faculty)` : 'Attendance Report';
  const subBits = [];
  if (startDate || endDate) subBits.push(`Dates: ${startDate || 'â€”'} to ${endDate || 'â€”'}`);
  if (schoolYear) subBits.push(`SY: ${schoolYear}`);
  if (semester) subBits.push(`Sem: ${semester}`);
  if (term) subBits.push(`Term: ${term}`);
  if (faculty) subBits.push(`Faculty: ${faculty}`);
  const subtitle = subBits.join('  |  ');

  const bodyHtml = React.useMemo(() => {
    if (loading) return '<p>Loading...</p>';
    const arr = Array.isArray(data) ? data : [];
    const renderExcuseButton = (row) => {
      if (!allowExcuse) return '';
      const key = row && row.id != null ? String(row.id) : '';
      if (!key) return '<span class="excuse-muted">N/A</span>';
      const busy = excusingIds.has(key);
      const label = busy ? 'Excusing...' : 'Excuse';
      const disabled = busy ? 'disabled aria-disabled="true"' : '';
      return `<button type="button" class="excuse-btn" data-attendance-id="${escapeHtml(key)}" ${disabled}>${label}</button>`;
    };
    const renderExcuseAllButton = (rows) => {
      if (!allowExcuse || type !== 'absent') return '';
      const ids = (rows || []).map((row) => row?.id).filter(Boolean).map((id) => String(id));
      if (!ids.length) return '';
      const busy = ids.some((id) => excusingIds.has(id));
      const label = busy ? 'Excusing...' : `Excuse all (${ids.length})`;
      const disabled = busy ? 'disabled aria-disabled="true"' : '';
      return `<button type="button" class="excuse-all-btn no-print" data-attendance-ids="${escapeHtml(ids.join(','))}" ${disabled}>${label}</button>`;
    };
    const buildTableHtml = (headers, rows, showAction) => {
      const norm = (s) => String(s || '').trim().toLowerCase();
      const allHeaders = showAction ? [...headers, 'Excuse'] : headers;
      const colClasses = allHeaders.map((h, i) => {
        if (showAction && i === allHeaders.length - 1) return 'col-action no-print';
        const n = norm(h);
        if (n === 'title' || n === 'course' || n === 'subject' || n === 'remarks') return 'col-title';
        if (n === 'faculty') return 'col-faculty';
        return 'col-tight';
      });
      const thead = `<thead><tr>${allHeaders
        .map((h, i) => `<th class="${colClasses[i]}">${escapeHtml(h)}</th>`)
        .join('')}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((row) => {
          const cells = Array.isArray(row?.cells) ? row.cells : [];
          const tds = cells
            .map((c, i) => `<td class="${colClasses[i]}">${escapeHtml(c)}</td>`)
            .join('');
          const actionTd = showAction
            ? `<td class="${colClasses[colClasses.length - 1]}">${renderExcuseButton(row)}</td>`
            : '';
          return `<tr>${tds}${actionTd}</tr>`;
        })
        .join('')}</tbody>`;
      return `<table class="prt-table">${thead}${tbody}</table>`;
    };
    if (isSummary) {
      const by = new Map();
      arr.forEach(r => {
        if (normalizeStatus(r.status) !== type) return;
        const sch = r.schedule || {};
        const fid = sch.facultyId ?? sch.faculty_id ?? r.facultyId ?? r.faculty_id;
        const fac = fid != null ? (facultyById.get(String(fid)) || sch.faculty || sch.instructor || '') : (sch.faculty || sch.instructor || '');
        const key = fac || '(Unknown Faculty)';
        const subj = [sch.programcode, sch.courseName, sch.courseTitle].filter(Boolean).join(' - ');
        const tm = [sch.day, sch.time].filter(Boolean).join(' ');
        const row = { id: r.id, status: r.status, cells: [r.date || '', subj || '-', tm || '-', sch.term || ''] };
        const a = by.get(key) || []; a.push(row); by.set(key, a);
      });
      const names = Array.from(by.keys()).sort((a,b)=>a.localeCompare(b));
      if (!names.length) return `<p>No ${summaryLabel.toLowerCase()} records match current filters.</p>`;
      let html = '';
      names.forEach((name) => {
        const rows = by.get(name) || [];
        const tbl = buildTableHtml(['Date','Subject','Time','Term'], rows, allowExcuse && type === 'absent');
        const action = renderExcuseAllButton(rows);
        const head = `<div class="prt-fac-head"><h3 class="prt-fac-name">${escapeHtml(name)}</h3>${action ? `<div class="prt-fac-actions no-print">${action}</div>` : ''}</div>`;
        html += `<div class="prt-fac-section">${head}${tbl}</div>`;
      });
      return html;
    } else {
      const rows = arr.map(r => {
        const sch = r.schedule || {};
        const course = [sch.programcode, sch.courseName].filter(Boolean).join(' - ');
        const sched = [sch.day, sch.time].filter(Boolean).join(' ');
        return { id: r.id, status: r.status, cells: [r.date || '', String(r.status || '').toUpperCase(), course || '-', sched || '-', String(r.remarks || '').slice(0,80)] };
      });
      return buildTableHtml(['Date','Status','Course','Schedule','Remarks'], rows, allowExcuse);
    }
  }, [isSummary, type, data, loading, summaryLabel, facultyById, allowExcuse, excusingIds]);

  const styles = `
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 0; color: #0a0a0a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .toolbar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #e5e7eb; padding: 8px 12px; display: flex; gap: 8px; z-index: 5; }
    .no-print { }
    @media print { .toolbar { display: none; } .no-print { display: none !important; } }
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
    .prt-body { padding: 16px 24px 24px; overflow-x: auto; }
    .prt-table { width: 100%; border-collapse: collapse; margin-top: 8px; table-layout: auto; }
    .prt-table th, .prt-table td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; line-height: 1.3; vertical-align: top; word-break: break-word; }
    .prt-table th { background: #f6f9fc; text-align: left; font-weight: 700; }
    .prt-table .col-action { width: 72px; min-width: 72px; white-space: nowrap; text-align: right; }
    .prt-fac-section { margin-bottom: 12px; }
    .prt-fac-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 6px 0; }
    .prt-fac-actions { display: flex; align-items: center; gap: 6px; }
    .prt-fac-name { font-weight: 900; font-size: 16px; margin: 0; }
    .prt-footer { padding: 0 24px 16px; margin-top: 12px; display: flex; gap: 32px; justify-content: space-between; flex-wrap: wrap; font-size: 13px; }
    .prt-block { min-width: 260px; }
    .prt-sign { margin-top: 12px; display: inline-block; border-top: 1px solid #333; padding-top: 6px; font-weight: 700; }
    .prt-role { color: #444; font-size: 12px; }
    .excuse-btn { background: #0f172a; color: #fff; border: 1px solid #0f172a; border-radius: 999px; font-size: 11px; font-weight: 700; padding: 4px 10px; line-height: 1; cursor: pointer; }
    .excuse-btn:hover { background: #1d4ed8; border-color: #1d4ed8; }
    .excuse-btn:disabled { background: #94a3b8; border-color: #94a3b8; cursor: not-allowed; opacity: 0.8; }
    .excuse-all-btn { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 999px; font-size: 11px; font-weight: 700; padding: 4px 10px; line-height: 1; cursor: pointer; }
    .excuse-all-btn:hover { background: #dbeafe; }
    .excuse-all-btn:disabled { background: #e2e8f0; color: #64748b; border-color: #e2e8f0; cursor: not-allowed; opacity: 0.9; }
    .excuse-muted { color: #94a3b8; font-size: 11px; font-weight: 700; }
  `;

  const now = new Date().toLocaleString();

  return (
    <Box>
      <style>{styles}</style>
      <HStack className="toolbar" justify="flex-end">
        <Button colorScheme="blue" onClick={() => window.print()}>Print</Button>
      </HStack>
      <Box className="inst-hero">
        <Box className="inst-wrap">
          <img className="inst-logo" src="/logo.png" alt="Logo" />
          <Box className="inst-lines">
            <p className="inst-name">Kolehiyo ng Pantukan</p>
            <p className="inst-office">Office of the Vice President of Academic Affairs</p>
            <p className="inst-app">Smart Academic Scheduler</p>
          </Box>
        </Box>
      </Box>
      <Box className="prt-header">
        <p className="prt-title">{title}</p>
        {subtitle ? <p className="prt-sub">{subtitle}</p> : null}
        <p className="prt-meta">Printed: {now}</p>
      </Box>
      <Box className="prt-body" onClick={handleBodyClick} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <Box className="prt-footer">
        <Box className="prt-block">
          <div className="prt-approve">Verified by:</div>
          <div className="prt-sign">Dr. Mharfe M. Micaroz</div>
          <div className="prt-role">Vice President of Academic Affairs</div>
        </Box>
        <Box className="prt-block">
          <div className="prt-approve">Approved by:</div>
          <div className="prt-sign">Dr. Mary Ann R. Araula</div>
          <div className="prt-role">Acting College President</div>
        </Box>
      </Box>
    </Box>
  );
}

function normalizeStatus(val) {
  const v = String(val || '').toLowerCase();
  if (v === 'excuse') return 'excused';
  return v;
}

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
