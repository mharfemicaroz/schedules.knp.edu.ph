import React from 'react';
import { Box, VStack, HStack, Heading, Text, Badge, useColorModeValue, SimpleGrid, Button, Icon, Popover, PopoverTrigger,PopoverContent, PopoverArrow, PopoverCloseButton, PopoverBody, Divider, Avatar, useDisclosure, useToast, Menu, MenuButton, MenuList, MenuItem, MenuDivider, Tag, TagLabel, Wrap, WrapItem, useBreakpointValue } from '@chakra-ui/react';
import { FiClock, FiBookOpen, FiUser, FiTag, FiPrinter, FiCalendar, FiKey, FiLogOut, FiDownload } from 'react-icons/fi';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import { getCurrentWeekDays, DAY_CODES } from '../utils/week';
import { parseTimeBlockToMinutes } from '../utils/conflicts';
import { buildTable, printContent } from '../utils/printDesign';
import apiService from '../services/apiService';
import ExcelJS from 'exceljs';
import { keyframes } from '@emotion/react';
import { loginThunk, logoutThunk, changePasswordThunk, updateProfileThunk } from '../store/authThunks';
import ChangePasswordModal from '../components/ChangePasswordModal';
import ProfileModal from '../components/ProfileModal';
import LoginModal from '../components/LoginModal';

function schemeForBlockCode(code) {
  const s = String(code || '').toUpperCase();
  if (s.includes('BSAB')) return 'green';
  if (s.includes('BSBA')) return 'yellow';
  if (s.includes('BSCRIM')) return 'red';
  if (s.includes('BSED') || s.includes('BTLED')) return 'blue';
  if (s.includes('BSTM')) return 'purple';
  if (s.includes('BSENTREP')) return 'orange';
  return 'blue';
}

function deriveSession(timeStartMinutes, explicit) {
  const s = String(explicit || '').toLowerCase();
  if (s.includes('morn')) return 'Morning';
  if (s.includes('after')) return 'Afternoon';
  if (s.includes('even')) return 'Evening';
  const t = Number(timeStartMinutes);
  if (!Number.isFinite(t)) return 'Morning';
  if (t < 12*60) return 'Morning';
  if (t < 17*60) return 'Afternoon';
  return 'Evening';
}

function normRoom(s){ return String(s||'').trim().replace(/\s+/g,' ').toUpperCase(); }

const ROOM_SPLIT_THRESHOLD = 10;

export default function RoomAttendance() {
  const dispatch = useDispatch();
  const all = useSelector(selectAllCourses);
  const acadData = useSelector(s => s.data.acadData);
  const authUser = useSelector(s => s.auth.user);
  const border = useColorModeValue('gray.200','gray.700');
  const panel = useColorModeValue('white','gray.800');
  const subtle = useColorModeValue('gray.600','gray.400');
  const accent = useColorModeValue('blue.600','blue.300');
  const pageBg = useColorModeValue('gray.50','gray.900');
  const headerBg = useColorModeValue('white','gray.800');
  const dotBg = useColorModeValue('gray.700','gray.200');
  const stickyBg = headerBg;
  const footerBg = headerBg;
  const loginModal = useDisclosure();
  const changePwdModal = useDisclosure();
  const profileModal = useDisclosure();
  const toast = useToast();

  const roleStr = String(authUser?.role || '').toLowerCase();
  const canAttend = !!authUser && (roleStr === 'admin' || roleStr === 'manager' || roleStr === 'checker');

  const days = getCurrentWeekDays();
  const today = new Date(); today.setHours(0,0,0,0);
  const todayIdx = days.findIndex(d => { const dd = new Date(d.date); dd.setHours(0,0,0,0); return dd.getTime() === today.getTime(); });
  const todayCode = todayIdx >= 0 ? days[todayIdx].code : DAY_CODES[0];

  // Determine current term from academic calendar (1st/2nd Term)
  const currentTermKey = React.useMemo(() => {
    try {
      const cal = Array.isArray(acadData) ? acadData[0]?.academic_calendar : acadData?.academic_calendar;
      const first = cal?.first_semester || {};
      const ft = first.first_term || {};
      const st = first.second_term || {};
      const now = new Date(); now.setHours(0,0,0,0);
      const d = (v)=> { const dd = new Date(v); return isNaN(dd.getTime()) ? null : new Date(dd.getFullYear(), dd.getMonth(), dd.getDate()); };
      const fs = d(ft.start), fe = d(ft.end), ss = d(st.start), se = d(st.end);
      if (fs && fe && fs <= now && now <= fe) return '1st';
      if (ss && se && ss <= now && now <= se) return '2nd';
      return null;
    } catch { return null; }
  }, [acadData]);

  // Term matcher (hoisted before use to avoid TDZ)
  function termMatches(t) {
    if (!currentTermKey) return true;
    const cur = String(currentTermKey || '').toLowerCase(); // '1st' or '2nd'
    const s = String(t || '').toLowerCase().trim();
    if (!s) return false;
    const want1 = cur.startsWith('1');
    const want2 = cur.startsWith('2');
    const has1 = /(^|\b)(1|first|1st)(\b|$)/i.test(s);
    const has2 = /(^|\b)(2|second|2nd)(\b|$)/i.test(s);
    return want1 ? has1 : want2 ? has2 : true;
  }

  // Time slots (7:00 AM to 9:00 PM in 1-hour intervals)
  const slots = React.useMemo(() => {
    const out = [];
    for (let h = 7; h <= 20; h++) {
      const start = h * 60;
      const end = start + 60;
      const toLabel = (m) => {
        let hh = Math.floor(m / 60);
        const mer = hh >= 12 ? 'PM' : 'AM';
        hh = ((hh + 11) % 12) + 1;
        return `${hh}` + mer;
      };
      const label = `${toLabel(start).replace(/(AM|PM)$/,'')} - ${toLabel(end)}`;
      out.push({ start, end, label });
    }
    return out;
  }, []);
  const defaultSlotIndex = React.useMemo(() => {
    const now = new Date();
    const min = now.getHours() * 60 + now.getMinutes();
    let idx = slots.findIndex(s => s.start <= min && min < s.end);
    if (idx === -1) idx = 0;
    return idx;
  }, [slots]);
  const [slotIndex, setSlotIndex] = React.useState(defaultSlotIndex);

  const tokens = React.useCallback((s) => String(s || '').split(',').map(t => t.trim()).filter(Boolean), []);
  const getRoomsForDay = React.useCallback((rec, d) => {
    try {
      const daysArr = Array.isArray(rec.f2fDays) && rec.f2fDays.length ? rec.f2fDays : tokens(rec.f2fSched || rec.f2fsched || rec.day);
      const roomsArr = tokens(rec.room);
      if (roomsArr.length > 1 && daysArr.length > 1) {
        const out = [];
        const len = Math.min(roomsArr.length, daysArr.length);
        for (let i = 0; i < len; i++) { if (String(daysArr[i]) === String(d)) out.push(roomsArr[i]); }
        return out;
      }
      return daysArr.includes(d) ? (roomsArr.length ? roomsArr : [rec.room].filter(Boolean)) : [];
    } catch { return []; }
  }, [tokens]);

  // Build matrix for today
  const matrix = React.useMemo(() => {
    const roomsSet = new Map(); // norm -> display
    (all || []).forEach(c => {
      const termOk = termMatches(c.term);
      if (!termOk) return;
      const rs = getRoomsForDay(c, todayCode);
      rs.forEach(r => { const disp = String(r||'').trim(); if (!disp) return; const n = normRoom(disp); if (!roomsSet.has(n)) roomsSet.set(n, disp); });
    });
    const rooms = Array.from(roomsSet.values()).sort((a,b)=>String(a).localeCompare(String(b)));
    const m = { Morning: new Map(), Afternoon: new Map(), Evening: new Map() };
    rooms.forEach(r => { m.Morning.set(r, new Map()); m.Afternoon.set(r, new Map()); m.Evening.set(r, new Map()); });
    (all || []).forEach(c => {
      const termOk = termMatches(c.term);
      if (!termOk) return;
      const rs = getRoomsForDay(c, todayCode);
      if (!rs.length) return;
      const ses = deriveSession(c.timeStartMinutes, c.session);
      const block = c.section || c.blockCode || c.block_code;
      rs.forEach(r => {
        const disp = roomsSet.get(normRoom(r)) || r;
        const mm = m[ses];
        if (!mm.has(disp)) mm.set(disp, new Map());
        const map = mm.get(disp);
        map.set(block, true);
      });
    });
    return { rooms, matrix: m };
  }, [all, todayCode, getRoomsForDay, currentTermKey]);

  // Attendance mapping for today
  const presentPulse = keyframes`
    0% { box-shadow: 0 0 0 0 rgba(72, 187, 120, 0.55); }
    70% { box-shadow: 0 0 0 6px rgba(72, 187, 120, 0.0); }
    100% { box-shadow: 0 0 0 0 rgba(72, 187, 120, 0.0); }
  `;

  const [bySched, setBySched] = React.useState({});
  React.useEffect(() => { (async () => {
    try {
      const iso = new Date().toISOString().slice(0,10);
      const list = await apiService.listAttendance({ startDate: iso, endDate: iso, limit: 100000 });
      const arr = Array.isArray(list) ? list : (list?.data || []);
      const m = {};
      arr.forEach(r => { m[Number(r.scheduleId || r.schedule_id)] = String(r.status || '').toLowerCase(); });
      setBySched(m);
    } catch { setBySched({}); }
  })(); }, []);

  function withinSlot(rec, slot) {
    let s = rec.timeStartMinutes, e = rec.timeEndMinutes;
    if (!Number.isFinite(s) || !Number.isFinite(e)) { const tt = parseTimeBlockToMinutes(String(rec.scheduleKey || rec.schedule || rec.time || '')); s = tt.start; e = tt.end; }
    if (!Number.isFinite(s) || !Number.isFinite(e)) return false;
    // overlap with slot
    return s < slot.end && slot.start < e;
  }

  

  function onPrint() {
    const label = getCurrentWeekDays().find(d=>d.code===todayCode)?.label || todayCode;
    // Time grid slots
    const timeSlots = slots; // already computed 7am-9pm hourly
    // Sort rooms alphabetically and split into three groups for layout
    const roomsSorted = [...rooms].sort((a,b)=>String(a).localeCompare(String(b)));
    const groups = (() => {
      const out = [[],[],[]];
      roomsSorted.forEach((r, i) => out[i % 3].push(r));
      return out.filter(g => g.length);
    })();

    const getCell = (room, slot) => {
      const candidates = (all || []).filter(c => {
        const rs = getRoomsForDay(c, todayCode);
        if (!rs.find(rr => normRoom(rr) === normRoom(room))) return false;
        // Filter by current term when available
        const term = String(c.term || '').toLowerCase();
        const tKey = currentTermKey ? String(currentTermKey).charAt(0) : null; // '1' or '2'
        const termOk = tKey ? term.startsWith(tKey) : true;
        return termOk && withinSlot(c, slot);
      });
      if (!candidates.length) return { faculty: '', status: '', course: '', title: '' };
      // Prefer the first; could be refined by session
      const info = candidates[0];
      const sid = Number(info.id);
      const status = (bySched[sid] || '').toString();
      return {
        faculty: info.faculty || info.instructor || '',
        status: status ? status.toUpperCase() : '',
        course: info.courseName || '',
        title: info.courseTitle || '',
        term: info.term || '',
        time: info.time || '',
        program: info.programcode || info.program || ''
      };
    };

    const programBg = (prog) => {
      const p = String(prog || '').toUpperCase();
      if (p.includes('BSAB')) return '#e6f7ed'; // light green
      if (p.includes('BSBA')) return '#fff7d6'; // light yellow
      if (p.includes('BSCRIM')) return '#fde2e0'; // light red
      if (p.includes('BSED') || p.includes('BTLED')) return '#e6efff'; // light blue
      if (p.includes('BSTM')) return '#eee6ff'; // light purple
      if (p.includes('BSENTREP')) return '#ffe9d9'; // light orange
      return '#edf2f7'; // gray
    };

    const styles = `
      <style>
        @page { size: 13in 8.5in; margin: 10mm; }
        body { font-family: Arial, sans-serif; color: #111; }
        /* Ensure a consistent top gap on every new page. Margins can collapse across page breaks, so use padding or a spacer. */
        .section { page-break-inside: avoid; page-break-before: always; margin-top: 0; padding-top: 0; }
        .section:first-child { page-break-before: auto; padding-top: 0; }
        /* Spacer to create top gap on new pages */
        .section::before { content: ''; display: block; height: 24mm; }
        .section:first-child::before { height: 0; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 1px solid #777; padding: 3px 4px; vertical-align: top; }
        th { background: #f4f6f8; font-size: 10px; }
        td { font-size: 9px; }
        .slot { width: 70px; white-space: nowrap; font-weight: 700; }
        .cell { min-height: 28px; }
        .faculty { font-weight: 700; margin-bottom: 1px; }
        .meta { color: #333; font-size: 9px; }
        .status.present { color: #157347; }
        .status.absent { color: #b02a37; }
        .status.late { color: #a75d00; }
        .status.excused { color: #0d6efd; }
        .head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
        .head .left { font-size: 11px; font-weight: 700; }
        .head .right { font-size: 10px; color: #555; }
      </style>
    `;

    const groupHtml = groups.map((grp, gi) => {
      const thead = `
        <thead>
          <tr>
            <th class="slot">Time</th>
            ${grp.map(r => `<th style=\"width: calc((100% - 70px)/${grp.length})\">${r}</th>`).join('')}
          </tr>
        </thead>
      `;
      const body = timeSlots.map((sl) => {
        return `
          <tr>
            <td class="slot">${sl.label}</td>
            ${grp.map(r => {
              const info = getCell(r, sl);
              const st = (info.status || '').toLowerCase();
              const bg = programBg(info.program);
              return `<td class="cell" style="background:${bg};width: calc((100% - 70px)/${grp.length})">
                ${info.faculty ? `<div class="faculty">${info.faculty}</div>` : `<div class="meta">&nbsp;</div>`}
                ${(info.course||info.title) ? `<div class="meta">${info.course || ''}${info.title ? ' — ' + info.title : ''}</div>` : ''}
                ${(info.term||info.time) ? `<div class="meta">${info.term ? ('Term: ' + info.term) : ''}${info.time ? (info.term ? ' · ' : '') + info.time : ''}</div>` : ''}
                ${st ? `<div class="status ${st}">Status: ${info.status}</div>` : ''}
                <div class="sig"></div>
              </td>`;
            }).join('')}
          </tr>
        `;
      }).join('');
      return `
        <div class="section">
          
          <table>${thead}<tbody>${body}</tbody></table>
        </div>
      `;
    }).join('');

    const html = `
      <!doctype html><html><head><meta charset="utf-8"/><title>Attendance Sheet</title>${styles}</head>
      <body>
        <div class="head"><div class="left">Attendance Sheet — Day: ${label}</div><div class="right">Generated: ${new Date().toLocaleString()}</div></div>
        ${groupHtml}
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
        <script>(function(){function download(){try{var jsp=window.jspdf&&window.jspdf.jsPDF?window.jspdf.jsPDF:null;if(!jsp){setTimeout(download,200);return;}var pw=936,ph=612,margin=12;var doc=new jsp({orientation:"landscape",unit:"pt",format:[pw,ph]});var innerW=pw-(margin*2);var ww=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth);if(!ww||ww<innerW) ww=innerW;var scale=innerW/ww;doc.html(document.body,{x:margin,y:margin,width:innerW,windowWidth:ww,autoPaging:"text",html2canvas:{scale:Math.min(1,scale),useCORS:true},callback:function(doc){var fn="Attendance_Sheet_"+(new Date().toISOString().slice(0,10))+".pdf";doc.save(fn);setTimeout(function(){window.close();},300);}});}catch(e){setTimeout(download,200);}}if(document.readyState==="complete")download();else window.addEventListener("load",download);})();</script>
      </body></html>
    `;
    // Convert download-based script into print preview in a robust way
    const htmlPrint = html
      .replace(/<script src=\"https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\/[\s\S]*?<\/script>\s*/g, '')
      .replace(/<script src=\"https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/html2canvas\/[\s\S]*?<\/script>\s*/g, '')
      .replace(/<script>\(function\(\)\{[\s\S]*?\}\)\(\);<\/script>/, '<script>(function(){function triggerPrint(){try{window.focus()}catch(e){} try{window.print()}catch(e){} setTimeout(function(){try{window.close()}catch(e){}},500);} if(document.readyState==="complete") setTimeout(triggerPrint,150); else window.addEventListener("load", function(){ setTimeout(triggerPrint,150); });})();<\/script>');
    const w = window.open('', '_blank');
    if (w) { w.document.write(htmlPrint); w.document.close(); }
  }

  async function onDownloadXlsx() {
    const label = getCurrentWeekDays().find(d=>d.code===todayCode)?.label || todayCode;
    const timeSlots = slots;
    const roomsSorted = [...rooms].sort((a,b)=>String(a).localeCompare(String(b)));
    const groups = (() => {
      const out = [[],[],[]];
      roomsSorted.forEach((r, i) => out[i % 3].push(r));
      return out.filter(g => g.length);
    })();

    const programFill = (prog) => {
      const p = String(prog || '').toUpperCase();
      if (p.includes('BSAB')) return 'FFE6F7ED';
      if (p.includes('BSBA')) return 'FFFFF7D6';
      if (p.includes('BSCRIM')) return 'FFFDE2E0';
      if (p.includes('BSED') || p.includes('BTLED')) return 'FFE6EFFF';
      if (p.includes('BSTM')) return 'FFEEE6FF';
      if (p.includes('BSENTREP')) return 'FFFFE9D9';
      return 'FFEDF2F7';
    };

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kolehiyo ng Pantukan';
    wb.created = new Date();

    for (let gi = 0; gi < groups.length; gi++) {
      const grp = groups[gi];
      const ws = wb.addWorksheet(`Rooms ${gi + 1}`);

      // Build rows
      const title = `Attendance Sheet — Day: ${label}`;
      ws.addRow([title]);
      const header = ['Time', ...grp];
      ws.addRow(header);

      timeSlots.forEach((sl) => {
        const rowVals = [sl.label];
        grp.forEach((r) => {
          const candidates = (all || []).filter(c => {
            const rs = getRoomsForDay(c, todayCode);
            if (!rs.find(rr => normRoom(rr) === normRoom(r))) return false;
            const term = String(c.term || '').toLowerCase();
            const tKey = currentTermKey ? String(currentTermKey).charAt(0) : null;
            const termOk = tKey ? term.startsWith(tKey) : true;
            return termOk && withinSlot(c, sl);
          });
          if (!candidates.length) { rowVals.push(''); return; }
          const info = candidates[0];
          const sid = Number(info.id);
          const status = (bySched[sid] || '').toString();
          const parts = [];
          const faculty = info.faculty || info.instructor || '';
          const course = info.code || info.courseName || '';
          const titleC = info.courseTitle || '';
          if (faculty) parts.push(faculty);
          if (course || titleC) parts.push(`${course || ''}${titleC ? ' — ' + titleC : ''}`);
          const meta = [];
          if (info.term) meta.push(`Term: ${info.term}`);
          if (info.time) meta.push(info.time);
          if (meta.length) parts.push(meta.join('  '));
          if (status) parts.push(`Status: ${String(status).toUpperCase()}`);
          // Ensure signature is the 5th line within the schedule cell
          while (parts.length < 4) parts.push('');
          parts.push('Signature: ____________________');
          rowVals.push(parts.join('\n'));
        });
        ws.addRow(rowVals);
      });

      const totalCols = grp.length + 1; // time + rooms

      // Merge title
      ws.mergeCells(1, 1, 1, totalCols);

      // Styling: title
      const titleCell = ws.getCell(1, 1);
      titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B5394' } };

      // Styling: header
      const headerRow = ws.getRow(2);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 22;
      for (let c = 1; c <= totalCols; c++) {
        const cell = headerRow.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        cell.border = { top: { style: 'thin', color: { argb: 'FFB0B0B0' } }, left: { style: 'thin', color: { argb: 'FFB0B0B0' } }, bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } }, right: { style: 'thin', color: { argb: 'FFB0B0B0' } } };
      }

      // Data rows: borders, wrap, alignment, alternating bands, program color accents
      for (let r = 3; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        row.alignment = { vertical: 'top', wrapText: true };
        // zebra banding
        const isEven = (r % 2) === 0;
        for (let c = 1; c <= totalCols; c++) {
          const cell = row.getCell(c);
          cell.border = { top: { style: 'thin', color: { argb: 'FFE0E0E0' } }, left: { style: 'thin', color: { argb: 'FFE0E0E0' } }, bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } }, right: { style: 'thin', color: { argb: 'FFE0E0E0' } } };
          // time column background subtle
          if (c === 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF5F7FA' : 'FFF8FAFC' } };
            cell.font = { bold: true, color: { argb: 'FF333333' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          } else {
            const text = String(cell.value || '');
            // Derive program for color by recomputing the slot cell
            let progColor = null;
            if (text) {
              const slIdx = r - 3; // data row index into timeSlots
              const roomName = grp[c - 2];
              const sl = timeSlots[slIdx];
              const candidates = (all || []).filter(rec => {
                const rs = getRoomsForDay(rec, todayCode);
                if (!rs.find(rr => normRoom(rr) === normRoom(roomName))) return false;
                const term = String(rec.term || '').toLowerCase();
                const tKey = currentTermKey ? String(currentTermKey).charAt(0) : null;
                const termOk = tKey ? term.startsWith(tKey) : true;
                return termOk && withinSlot(rec, sl);
              });
              if (candidates.length) {
                const prog = candidates[0].programcode || candidates[0].program || '';
                progColor = programFill(prog);
              }
            }
            const bg = progColor || (isEven ? 'FFFFFFFF' : 'FFFAFAFA');
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          }
        }
        row.height = 66;
      }

      // Header bottom border stronger
      for (let c = 1; c <= totalCols; c++) {
        const cell = headerRow.getCell(c);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFB0B0B0' } },
          left: { style: 'thin', color: { argb: 'FFB0B0B0' } },
          bottom: { style: 'medium', color: { argb: 'FF7A7A7A' } },
          right: { style: 'thin', color: { argb: 'FFB0B0B0' } }
        };
      }

      // Outer border thicker for a framed look
      const maxRow = ws.rowCount;
      for (let r = 1; r <= maxRow; r++) {
        for (let c = 1; c <= totalCols; c++) {
          const cell = ws.getRow(r).getCell(c);
          const edgeTop = r === 1;
          const edgeBottom = r === maxRow;
          const edgeLeft = c === 1;
          const edgeRight = c === totalCols;
          if (edgeTop || edgeBottom || edgeLeft || edgeRight) {
            const b = cell.border || {};
            cell.border = {
              top: edgeTop ? { style: 'medium', color: { argb: 'FF7A7A7A' } } : (b.top || { style: 'thin', color: { argb: 'FFE0E0E0' } }),
              left: edgeLeft ? { style: 'medium', color: { argb: 'FF7A7A7A' } } : (b.left || { style: 'thin', color: { argb: 'FFE0E0E0' } }),
              bottom: edgeBottom ? { style: 'medium', color: { argb: 'FF7A7A7A' } } : (b.bottom || { style: 'thin', color: { argb: 'FFE0E0E0' } }),
              right: edgeRight ? { style: 'medium', color: { argb: 'FF7A7A7A' } } : (b.right || { style: 'thin', color: { argb: 'FFE0E0E0' } })
            };
          }
        }
      }

      // Freeze panes (keep title + header and time column visible)
      ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 2 }];

      // Auto-fit columns based on max content width (in characters)
      const colMax = new Array(totalCols).fill(0);
      for (let r = 1; r <= ws.rowCount; r++) {
        for (let c = 1; c <= totalCols; c++) {
          const val = ws.getRow(r).getCell(c).value;
          const s = (val == null) ? '' : String(val);
          const lines = s.split('\n');
          const maxLine = lines.reduce((m, l) => Math.max(m, l.length), 0);
          colMax[c - 1] = Math.max(colMax[c - 1], maxLine);
        }
      }
      for (let c = 1; c <= totalCols; c++) {
        const base = c === 1 ? 6 : 10;
        const max = Math.min(50, Math.max(base, colMax[c - 1] + 2));
        ws.getColumn(c).width = max;
      }

      // Auto-calc row heights based on wrapped content so everything is visible
      const ptsPerLine = 14; // approximate points per wrapped line
      const extraPad = 6;    // extra padding in points
      for (let r = 3; r <= ws.rowCount; r++) {
        let maxLinesInRow = 1;
        for (let c = 1; c <= totalCols; c++) {
          const cell = ws.getRow(r).getCell(c);
          const colWidth = ws.getColumn(c).width || 10; // width in characters
          const usable = Math.max(1, Math.floor(colWidth - 1));
          const text = cell.value == null ? '' : String(cell.value);
          const wrappedLines = text.split('\n').reduce((sum, line) => {
            const len = line.length || 1;
            return sum + Math.max(1, Math.ceil(len / usable));
          }, 0);
          if (wrappedLines > maxLinesInRow) maxLinesInRow = wrappedLines;
        }
        ws.getRow(r).height = (maxLinesInRow * ptsPerLine) + extraPad;
      }
    }

    const fn = `Room_Attendance_${new Date().toISOString().slice(0,10)}_${label.replace(/\s+/g,'_')}.xlsx`;
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fn; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  async function onLoginSubmit({ username, password }) {
    try { await dispatch(loginThunk({ identifier: username, password })).unwrap(); loginModal.onClose(); } catch (e) { toast({ title: 'Login failed', description: e?.message || 'Invalid credentials', status: 'error' }); }
  }
  function onLogout() { dispatch(logoutThunk()); }

  const rooms = matrix.rooms;
  const sessions = ['Morning','Afternoon','Evening'];
  const roomParts = React.useMemo(() => {
    if ((rooms || []).length > ROOM_SPLIT_THRESHOLD) {
      const mid = Math.ceil(rooms.length / 2);
      return [rooms.slice(0, mid), rooms.slice(mid)];
    }
    return [rooms];
  }, [rooms]);
  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <Box minH="100vh" bg={pageBg}>
      {/* Header */}
      <Box bg={headerBg} borderBottomWidth="1px" borderColor={border} px={{ base: 4, md: 8 }} py={4}>
        <HStack justify="space-between" align="center" wrap="wrap" spacing={3}>
          <VStack align="start" spacing={0}>
            <HStack>
              <Icon as={FiCalendar} color={accent} />
              <Heading size="md">Room Attendance</Heading>
            </HStack>
            <Text fontSize="sm" color={subtle}>Day: <Text as="span" fontWeight="700">{getCurrentWeekDays().find(d=>d.code===todayCode)?.label || todayCode}</Text></Text>
          </VStack>
          <HStack spacing={2}>
            <Button leftIcon={<FiDownload />} onClick={onDownloadXlsx} colorScheme="blue" variant="outline" size="sm">Download XLSX</Button>
            {!authUser ? (
              <Button size="sm" onClick={loginModal.onOpen}>Login</Button>
            ) : (
              <Menu>
                <MenuButton as={Button} variant="ghost" size="sm" px={2}>
                  <HStack spacing={2}>
                    <Avatar size="xs" name={authUser.username || authUser.email} src={authUser.avatar || undefined} />
                    <Text fontSize="sm" display={{ base: 'none', md: 'block' }}>{authUser.username || authUser.email}</Text>
                  </HStack>
                </MenuButton>
                <MenuList>
                  <MenuItem icon={<FiUser />} onClick={profileModal.onOpen}>Profile</MenuItem>
                  <MenuItem icon={<FiKey />} onClick={changePwdModal.onOpen}>Change Password</MenuItem>
                  <MenuDivider />
                  <MenuItem icon={<FiLogOut />} onClick={onLogout}>Logout</MenuItem>
                </MenuList>
              </Menu>
            )}
          </HStack>
        </HStack>
      </Box>

      {/* Body */}
      <Box px={{ base: 2, md: 6 }} py={6} maxW="100%" mx="auto">
        {/* Time navigation */}
        <Box mb={4} overflowX="auto">
          <HStack spacing={2} minW="max-content">
            {slots.map((s, i) => (
              <Button key={`slot-${i}`} size="xs" variant={i===slotIndex ? 'solid' : 'outline'} colorScheme={i===slotIndex ? 'blue' : 'gray'} onClick={() => setSlotIndex(i)}>
                {s.label}
              </Button>
            ))}
          </HStack>
        </Box>
        {isMobile ? (
          <VStack align="stretch" spacing={4}>
            {rooms.map((r, idx) => (
              <Box key={`m-${r}-${idx}`} borderWidth="1px" borderColor={border} rounded="lg" p={3}>
                <HStack mb={2} spacing={3}>
                  <Box w="8px" h="8px" rounded="full" bg={dotBg}></Box>
                  <Text fontWeight="700">{r}</Text>
                </HStack>
                {sessions.map((sess) => {
                  const map = matrix.matrix[sess]?.get(r) || new Map();
                  const arr = Array.from(map.keys()).sort();
                  return (
                    <Box key={`m-${r}-${sess}`} mb={2}>
                      <Text fontSize="xs" color={subtle} mb={1}>{sess}</Text>
                      {arr.length === 0 ? (
                        <Text fontSize="xs" color={subtle}>—</Text>
                      ) : (
                        <Wrap spacing={2}>
                          {arr.map((b) => {
                            const candidates = (all || []).filter(c => {
                              const blk = c.section || c.blockCode || c.block_code;
                              if (String(blk) !== String(b)) return false;
                              const daysArr = Array.isArray(c.f2fDays) ? c.f2fDays : String(c.f2fSched || c.f2fsched || c.day).split(',').map(s=>s.trim()).filter(Boolean);
                              const termOk = termMatches(c.term);
                              return termOk && daysArr.includes(todayCode) && withinSlot(c, slots[slotIndex]);
                            });
                            let chosen = null;
                            candidates.forEach(c => { const st = bySched[c.id]; if (st) chosen = st; });
                            const borderColor = (!canAttend || !chosen) ? undefined : (chosen==='present' ? 'green.400' : chosen==='absent' ? 'red.400' : chosen==='late' ? 'orange.400' : chosen==='excused' ? 'blue.400' : undefined);
                            const anim = canAttend && chosen==='present' ? `${presentPulse} 1.8s ease-out infinite` : undefined;
                            const hasCand = candidates.length > 0;
                            const fac = hasCand ? ((candidates[0].faculty || candidates[0].instructor || '') || '') : '';
                            const codeVal = hasCand ? (candidates[0].code || candidates[0].courseName || '') : '';
                            return (
                              <WrapItem key={`m-${r}-${sess}-${b}`}>
                                <VStack spacing={1} align="start">
                                  <Tag variant="subtle" colorScheme={schemeForBlockCode(b)} rounded="full" px={4} py={1.5} display="inline-block" maxW="100%" style={{ fontSize: '12px', lineHeight: 1.2, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }} borderWidth={borderColor ? '2px' : undefined} borderColor={borderColor} sx={anim ? { animation: anim } : undefined}>
                                    <TagLabel display="block" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{b}</TagLabel>
                                  </Tag>
                                  <Text fontSize="10px" color={subtle}>{hasCand ? `${fac}${codeVal ? ' · ' + codeVal : ''}` : 'No teacher available'}</Text>
                              </VStack>
                             </WrapItem>
                           );
                          })}
                        </Wrap>
                      )}
                    </Box>
                  );
                })}
              </Box>
            ))}
          </VStack>
        ) : (
          <VStack align="stretch" spacing={6}>
            {roomParts.map((roomsSlice, partIdx) => (
              <Box key={`part-${partIdx}`} borderWidth="1px" borderColor={border} rounded="lg" p={0} overflowX="auto">
                <Box as="table" w="100%" borderCollapse="separate" style={{ borderSpacing: 0 }}>
                <Box as="thead" position="sticky" top={0} zIndex={1} bg={headerBg}>
                    <Box as="tr">
                    <Box as="th" textAlign="left" p="10px 12px" borderBottomWidth="1px" borderColor={border} position="sticky" left={0} zIndex={2} bg={stickyBg}>Session</Box>
                      {roomsSlice.map((r, idx) => (
                        <Box as="th" key={`${r}-${idx}`} textAlign="left" p="10px 12px" borderBottomWidth="1px" borderColor={border}>
                          <HStack spacing={3}>
                          <Box w="8px" h="8px" rounded="full" bg={dotBg}></Box>
                            <Text fontWeight="600" noOfLines={1}>{r}</Text>
                          </HStack>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  <Box as="tbody">
                    {sessions.map((sess) => (
                      <Box as="tr" key={`${todayCode}-${sess}-${partIdx}`}>
                      <Box as="td" position="sticky" left={0} zIndex={1} bg={stickyBg} p="10px 12px" borderTopWidth="1px" borderColor={border} fontWeight="700">{sess}</Box>
                        {roomsSlice.length === 0 && (
                          <Box as="td" p="10px 12px" borderTopWidth="1px" borderColor={border} colSpan={999}>
                            <Text fontSize="xs" color={subtle}>—</Text>
                          </Box>
                        )}
                        {roomsSlice.map((r, cIdx) => {
                          const map = matrix.matrix[sess]?.get(r) || new Map();
                          const arr = Array.from(map.keys()).sort();
                          return (
                            <Box as="td" key={`${sess}-${r}-${partIdx}`} p="8px 10px" borderTopWidth="1px" borderLeftWidth={cIdx===0? '1px':'1px'} borderColor={border}>
                              {arr.length === 0 ? (
                                <Text fontSize="xs" color={subtle}>—</Text>
                              ) : (
                                <HStack spacing={2} wrap="wrap" align="start">
                                  {arr.map((b) => {
                                    // Determine highlight for this block at current time
                                    const candidates = (all || []).filter(c => {
                                      const blk = c.section || c.blockCode || c.block_code;
                                      if (String(blk) !== String(b)) return false;
                                      const daysArr = Array.isArray(c.f2fDays) ? c.f2fDays : String(c.f2fSched || c.f2fsched || c.day).split(',').map(s=>s.trim()).filter(Boolean);
                                      const termOk = termMatches(c.term);
                                      return termOk && daysArr.includes(todayCode) && withinSlot(c, slots[slotIndex]);
                                    });
                                    let chosen = null;
                                    candidates.forEach(c => { const st = bySched[c.id]; if (st) chosen = st; });
                                    const borderColor = (!canAttend || !chosen) ? undefined : (chosen==='present' ? 'green.400' : chosen==='absent' ? 'red.400' : chosen==='late' ? 'orange.400' : chosen==='excused' ? 'blue.400' : undefined);
                                    const anim = canAttend && chosen==='present' ? `${presentPulse} 1.8s ease-out infinite` : undefined;
                                    if (candidates.length === 0) {
                                      return (
                                        <VStack key={`${sess}-${r}-${b}-${partIdx}`} spacing={1} align="start">
                                          <Tag variant="subtle" colorScheme={schemeForBlockCode(b)} rounded="full" px={6} py={2} display="inline-block" maxW="100%" style={{ fontSize: '12px', lineHeight: 1.2, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                            <TagLabel display="block" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{b}</TagLabel>
                                          </Tag>
                                          <Text fontSize="10px" color={subtle}>No teacher available</Text>
                                        </VStack>
                                      );
                                    }
                                    const fac = (candidates[0].faculty || candidates[0].instructor || '') || '';
                                    const codeVal = (candidates[0].code || candidates[0].courseName || '') || '';
                                    return (
                                      <VStack key={`${sess}-${r}-${b}-${partIdx}`} spacing={1} align="start">
                                        <Tag variant="subtle" colorScheme={schemeForBlockCode(b)} rounded="full" px={6} py={2} display="inline-block" maxW="100%" style={{ fontSize: '12px', lineHeight: 1.2, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }} borderWidth={borderColor ? '2px' : undefined} borderColor={borderColor} sx={anim ? { animation: anim } : undefined}>
                                          <TagLabel display="block" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{b}</TagLabel>
                                        </Tag>
                                        <Text fontSize="10px" color={subtle}>{`${fac}${codeVal ? ' · ' + codeVal : ''}`}</Text>
                                      </VStack>
                                    );
                                  })}
                                </HStack>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            ))}
          </VStack>
        )}
      </Box>

      {/* Footer */}
      <Box as="footer" borderTopWidth="1px" borderColor={border} px={{ base: 4, md: 8 }} py={6} bg={footerBg}>
        <VStack spacing={1} align="center">
          <Text fontSize="sm" fontWeight="700">Kolehiyo ng Pantukan</Text>
          <Text fontSize="xs" color={subtle}>Room attendance view for current day.</Text>
        </VStack>
      </Box>

      {/* Modals */}
      <LoginModal isOpen={loginModal.isOpen} onClose={loginModal.onClose} onSubmit={onLoginSubmit} />
      <ChangePasswordModal isOpen={changePwdModal.isOpen} onClose={changePwdModal.onClose} onSubmit={async (p) => { try { await dispatch(changePasswordThunk(p)).unwrap(); toast({ title: 'Password changed', status: 'success' }); changePwdModal.onClose(); } catch (e) { toast({ title: 'Failed', description: e?.message || 'Unable to change password', status: 'error' }); } }} />
      <ProfileModal isOpen={profileModal.isOpen} onClose={profileModal.onClose} user={authUser} onSubmit={async (p) => { try { await dispatch(updateProfileThunk(p)).unwrap(); toast({ title: 'Profile updated', status: 'success' }); profileModal.onClose(); } catch (e) { toast({ title: 'Failed', description: e?.message || 'Unable to update profile', status: 'error' }); } }} />
    </Box>
  );
}




