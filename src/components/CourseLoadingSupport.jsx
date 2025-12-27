import React from 'react';
import {
  Box,
  HStack,
  VStack,
  Text,
  Button,
  Wrap,
  WrapItem,
  Input,
  IconButton,
  Tag,
  Tooltip,
  Spinner,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiMessageCircle, FiX, FiHelpCircle, FiSend } from 'react-icons/fi';
import apiService from '../services/apiService';

const SUPPORT_MODEL = 'x-ai/grok-4.1-fast';
const SUPPORT_AI_DEFAULTS = { model: SUPPORT_MODEL, temperature: 0.6, max_tokens: 1000000 };

function ensurePuterScriptLoaded() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Window not available'));
    if (window.puter) return resolve(true);
    const existing = document.querySelector('script[src="https://js.puter.com/v2/"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => reject(new Error('Failed to load Puter.js')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://js.puter.com/v2/';
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error('Failed to load Puter.js'));
    document.body.appendChild(s);
  });
}

function safeJsonParse(str, fallback = {}) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function getContentFromResponse(resp) {
  const msg = resp?.message || {};
  const c = (msg?.content ?? '').trim();
  if (c) return c;
  const reason = msg?.reasoning;
  if (typeof reason === 'string' && reason.trim()) return reason.trim();
  const rd = Array.isArray(msg?.reasoning_details) ? msg.reasoning_details : [];
  const summary = rd.find((x) => x?.type === 'reasoning.summary')?.summary;
  if (typeof summary === 'string' && summary.trim()) return summary.trim();
  const topLevel = resp?.result?.message?.content;
  if (typeof topLevel === 'string' && topLevel.trim()) return topLevel.trim();
  return '';
}

function extractListPayload(resp) {
  const payload = resp?.data ?? resp;
  if (Array.isArray(payload)) return { items: payload, total: payload.length, meta: null };
  if (Array.isArray(payload?.data)) return { items: payload.data, total: payload?.total ?? payload.data.length, meta: payload.meta ?? null };
  return { items: [], total: 0, meta: null };
}

function pickSchedules(rows = [], limit = 40) {
  return rows.slice(0, limit).map((r) => ({
    id: r.id ?? r.schedule_id ?? null,
    course: r.courseName ?? r.code ?? r.course ?? null,
    title: r.courseTitle ?? r.title ?? null,
    faculty: r.faculty ?? r.instructor ?? r.facultyName ?? null,
    dept: r.dept ?? r.department ?? null,
    room: r.room ?? null,
    day: r.day ?? r.session ?? null,
    time: r.time ?? r.schedule ?? null,
    term: r.term ?? r.sem ?? r.semester ?? null,
    sy: r.sy ?? r.schoolyear ?? r.school_year ?? null,
    block: r.block ?? r.blockCode ?? r.section ?? null,
    program: r.programcode ?? r.program ?? null,
    units: r.unit ?? null,
  }));
}

function pickBlocks(rows = [], limit = 20) {
  return rows.slice(0, limit).map((r) => ({
    id: r.id ?? null,
    block: r.block ?? r.blockCode ?? r.code ?? null,
    programcode: r.programcode ?? r.program ?? null,
    yearlevel: r.yearlevel ?? r.year ?? null,
    section: r.section ?? null,
    size: r.size ?? r.capacity ?? null,
  }));
}

function pickProspectus(items = [], limit = 30) {
  return items.slice(0, limit).map((r) => ({
    id: r.id ?? null,
    courseName: r.courseName ?? r.code ?? null,
    courseTitle: r.courseTitle ?? r.title ?? null,
    programcode: r.programcode ?? r.program ?? null,
    semester: r.semester ?? r.sem ?? r.term ?? null,
    yearlevel: r.yearlevel ?? r.year ?? null,
    unit: r.unit ?? null,
  }));
}

function pickFaculty(items = [], limit = 25) {
  return items.slice(0, limit).map((f) => ({
    id: f.id ?? null,
    faculty: f.faculty ?? f.name ?? null,
    dept: f.dept ?? f.department ?? null,
    designation: f.designation ?? null,
    employment: f.employment ?? null,
    loadReleaseUnits: f.loadReleaseUnits ?? f.load_release_units ?? null,
  }));
}

function formatUnits(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(1) : '0.0';
}

function summarizeToolOutputs(outputs = []) {
  const trimmed = outputs.slice(-6);
  const flat = trimmed.map((o) => {
    const content = typeof o.result === 'string' ? o.result : JSON.stringify(o.result);
    const safe = content.length > 1200 ? `${content.slice(0, 1200)}…` : content;
    return `${o.name}${o.args ? ` ${JSON.stringify(o.args)}` : ''}: ${safe}`;
  });
  return flat.join('\n');
}

export default function CourseLoadingSupport({
  viewMode,
  role,
  selectedBlock,
  selectedFaculty,
  rows = [],
  facultySchedules = { items: [] },
  blocksAll = [],
  facultyAll = [],
  prospectus = [],
  existing = [],
  settingsLoad = {},
  facultyUnitStats = {},
  accessToken = null,
  onSupportApi = null,
  toggleId = 'course-loading-support-toggle',
}) {
  const panelBg = useColorModeValue('white', 'gray.800');
  const dividerBorder = useColorModeValue('gray.100', 'gray.700');
  const subtle = useColorModeValue('gray.600', 'gray.300');
  const supportTranscriptBg = useColorModeValue('gray.50', 'blackAlpha.300');
  const supportUserBg = useColorModeValue('blue.50', 'blue.900');
  const supportAiBg = useColorModeValue('gray.100', 'gray.700');
  const supportGlow = useColorModeValue('blue.100', 'blue.600');

  const [supportOpen, setSupportOpen] = React.useState(false);
  const [supportMessages, setSupportMessages] = React.useState([
    { role: 'ai', text: 'Hi! I can summarize schedules, faculty load, blocks, courses, and prospectus items from this page. Ask me anything or pick a quick prompt.' },
  ]);
  const [supportDraft, setSupportDraft] = React.useState('');
  const [supportBusy, setSupportBusy] = React.useState(false);
  const [supportPuterReady, setSupportPuterReady] = React.useState(false);
  const [supportWide, setSupportWide] = React.useState(false);
  const [supportFull, setSupportFull] = React.useState(false);
  const supportListRef = React.useRef(null);
  const supportInputRef = React.useRef(null);

  const supportControlApi = React.useMemo(() => ({
    open: () => setSupportOpen(true),
    close: () => setSupportOpen(false),
    toggle: () => setSupportOpen((v) => !v),
    setWide: (val = true) => setSupportWide(Boolean(val)),
    setFull: (val = true) => setSupportFull(Boolean(val)),
    focusInput: () => {
      try { supportInputRef.current?.focus(); } catch {}
    },
  }), []);

  React.useEffect(() => {
    if (typeof onSupportApi === 'function') {
      onSupportApi(supportControlApi);
    }
  }, [onSupportApi, supportControlApi]);

  React.useEffect(() => {
    if (!supportOpen) return;
    const el = supportListRef.current;
    if (!el) return;
    try { el.scrollTop = el.scrollHeight; } catch {}
  }, [supportMessages, supportOpen]);

  React.useEffect(() => {
    let alive = true;
    ensurePuterScriptLoaded()
      .then(() => { if (alive) setSupportPuterReady(true); })
      .catch(() => { if (alive) setSupportPuterReady(false); });
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    if (accessToken) {
      try { apiService.setAuthToken(accessToken); } catch {}
    }
  }, [accessToken]);

  const supportPrompts = React.useMemo(() => {
    const prompts = [
      'Highlight conflicts or locked items for this block.',
      'Which courses still need term or time?',
      'Give me a save-ready checklist.',
    ];
    if (selectedFaculty) {
      prompts.unshift(`Summarize load for ${selectedFaculty.name || selectedFaculty.faculty}`);
    }
    if (selectedBlock) {
      prompts.unshift(`What is inside block ${selectedBlock.blockCode || 'selection'}?`);
    }
    return prompts.slice(0, 5);
  }, [selectedBlock, selectedFaculty]);

  const supportSnapshot = React.useMemo(() => {
    const blockRows = Array.isArray(rows) ? rows : [];
    const blockLabelParts = selectedBlock ? [
      selectedBlock.blockCode || '',
      selectedBlock.programcode || '',
      selectedBlock.yearlevel ? `Y${selectedBlock.yearlevel}` : '',
      selectedBlock.section ? `Sec ${selectedBlock.section}` : '',
    ].filter(Boolean) : [];
    const blockLabel = blockLabelParts.join(' · ');
    const selectedCount = blockRows.filter((r) => r._selected).length;
    const conflictCount = blockRows.filter((r) => String(r._status || '').toLowerCase() === 'conflict').length;
    const missingCount = blockRows.filter((r) => !String(r._term || '').trim() || !String(r._time || '').trim() || !String(r._faculty || '').trim()).length;
    const lockedCount = blockRows.filter((r) => r._locked).length;
    const facItems = Array.isArray(facultySchedules?.items) ? facultySchedules.items : [];
    const facSaved = facItems.filter((it) => !String(it.id || '').startsWith('tmp:')).length;
    const facDraft = facItems.length - facSaved;
    return {
      blockLabel,
      blockCourseCount: blockRows.length,
      selectedCount,
      conflictCount,
      missingCount,
      lockedCount,
      counts: {
        blocks: Array.isArray(blocksAll) ? blocksAll.length : 0,
        faculty: Array.isArray(facultyAll) ? facultyAll.length : 0,
        prospectus: Array.isArray(prospectus) ? prospectus.length : 0,
        schedules: Array.isArray(existing) ? existing.length : 0,
      },
      faculty: {
        name: selectedFaculty ? (selectedFaculty.name || selectedFaculty.faculty || '') : '',
        dept: selectedFaculty ? (selectedFaculty.department || selectedFaculty.dept || '') : '',
        items: facItems.length,
        saved: facSaved,
        draft: facDraft,
        units: facultyUnitStats?.totalUnits ?? 0,
      },
      settings: {
        sy: settingsLoad?.school_year || '',
        sem: settingsLoad?.semester || '',
      },
      viewMode,
    };
  }, [blocksAll, existing, facultyAll, facultySchedules, facultyUnitStats?.totalUnits, prospectus, rows, selectedBlock, selectedFaculty, settingsLoad, viewMode]);

  const supportContextText = React.useMemo(() => {
    const lines = [];
    lines.push(`View: ${viewMode}; Role: ${role || 'unknown'}`);
    if (selectedBlock) {
      const parts = [
        selectedBlock.blockCode || '',
        selectedBlock.programcode || '',
        selectedBlock.yearlevel ? `Year ${selectedBlock.yearlevel}` : '',
        selectedBlock.section ? `Sec ${selectedBlock.section}` : '',
      ].filter(Boolean);
      lines.push(`Block focus: ${parts.join(' | ')}`);
    }
    if (selectedFaculty) {
      lines.push(`Faculty focus: ${selectedFaculty.name || selectedFaculty.faculty || ''} (${selectedFaculty.department || selectedFaculty.dept || 'n/a'})`);
    }
    lines.push(`Settings -> SY:${supportSnapshot?.settings?.sy || 'n/a'} Semester:${supportSnapshot?.settings?.sem || 'n/a'}`);
    lines.push(`Counts -> blocks:${supportSnapshot?.counts?.blocks ?? 0} faculty:${supportSnapshot?.counts?.faculty ?? 0} prospectus:${supportSnapshot?.counts?.prospectus ?? 0} schedules:${supportSnapshot?.counts?.schedules ?? 0}`);
    if (supportSnapshot?.blockLabel) {
      lines.push(`Block status -> courses:${supportSnapshot.blockCourseCount} selected:${supportSnapshot.selectedCount} locked:${supportSnapshot.lockedCount} conflicts:${supportSnapshot.conflictCount} missing:${supportSnapshot.missingCount}`);
    }
    if (supportSnapshot?.faculty?.name) {
      lines.push(`Faculty load -> ${supportSnapshot.faculty.items} items (${supportSnapshot.faculty.saved} saved / ${supportSnapshot.faculty.draft} draft), units:${formatUnits(supportSnapshot.faculty.units)}`);
    }
    const rowsSample = (rows || []).slice(0, 8).map((r) => {
      return [
        r.courseName || r.code || r.title || 'Course',
        r.blockCode || r.section || '',
        `term:${r._term || r.term || ''}`,
        `time:${r._time || r.time || r.schedule || ''}`,
        `day:${r._day || r.day || ''}`,
        `faculty:${r._faculty || r.faculty || r.instructor || ''}`,
        r._status ? `status:${r._status}` : '',
      ].filter(Boolean).join(' | ');
    });
    if (rowsSample.length) {
      lines.push('Visible block items sample:');
      lines.push(...rowsSample);
    }
    const facSample = Array.isArray(facultySchedules?.items) ? facultySchedules.items.slice(0, 6).map((f) => {
      return [
        f.courseName || f.code || f.title || 'Course',
        f.blockCode || f.section || '',
        `term:${f._term || f.term || f.semester || ''}`,
        `time:${f._time || f.time || f.schedule || ''}`,
        `day:${f._day || f.day || ''}`,
        `faculty:${f._faculty || f.faculty || f.instructor || ''}`,
        f._status ? `status:${f._status}` : '',
      ].filter(Boolean).join(' | ');
    }) : [];
    if (facSample.length) {
      lines.push('Faculty view sample:');
      lines.push(...facSample);
    }
    return lines.join('\n');
  }, [viewMode, role, selectedBlock, selectedFaculty, supportSnapshot, rows, facultySchedules]);

  const tools = React.useMemo(
    () => [
      {
        type: 'function',
        function: {
          name: 'fetch_schedules',
          description: 'List schedules (filters: sy, semester, programcode, block, instructor, room, limit).',
          parameters: {
            type: 'object',
            properties: {
              params: {
                type: 'object',
                properties: {
                  sy: { type: 'string' },
                  semester: { type: 'string' },
                  programcode: { type: 'string' },
                  block: { type: 'string' },
                  instructor: { type: 'string' },
                  room: { type: 'string' },
                  limit: { type: 'number' },
                },
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fetch_blocks',
          description: 'List blocks (programcode, yearlevel, section).',
          parameters: {
            type: 'object',
            properties: {
              params: {
                type: 'object',
                properties: {
                  programcode: { type: 'string' },
                  yearlevel: { type: 'string' },
                  section: { type: 'string' },
                  limit: { type: 'number' },
                },
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fetch_prospectus',
          description: 'List prospectus entries (programcode, semester, yearlevel).',
          parameters: {
            type: 'object',
            properties: {
              params: {
                type: 'object',
                properties: {
                  programcode: { type: 'string' },
                  semester: { type: 'string' },
                  yearlevel: { type: 'string' },
                  limit: { type: 'number' },
                },
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fetch_faculty',
          description: 'List faculty directory (dept, employment, designation).',
          parameters: {
            type: 'object',
            properties: {
              params: {
                type: 'object',
                properties: {
                  dept: { type: 'string' },
                  employment: { type: 'string' },
                  designation: { type: 'string' },
                  limit: { type: 'number' },
                },
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fetch_settings',
          description: 'Get system settings (SY/Sem).',
          parameters: { type: 'object', properties: {} },
        },
      },
    ],
    [],
  );

  const runTool = async (toolName, args) => {
    try {
      const params = args?.params || {};
      if (toolName === 'fetch_schedules') {
        const res = await apiService.getAllSchedules(params);
        const { items } = extractListPayload(res);
        const limit = Number(params.limit || 40);
        return { total: Array.isArray(items) ? items.length : null, items: pickSchedules(items || [], limit) };
      }
      if (toolName === 'fetch_blocks') {
        const res = await apiService.getBlocks(params);
        const { items } = extractListPayload(res);
        const limit = Number(params.limit || 20);
        return { total: Array.isArray(items) ? items.length : null, items: pickBlocks(items || [], limit) };
      }
      if (toolName === 'fetch_prospectus') {
        const res = await apiService.getProspectus(params);
        const { items } = extractListPayload(res);
        const limit = Number(params.limit || 30);
        return { total: Array.isArray(items) ? items.length : null, items: pickProspectus(items || [], limit) };
      }
      if (toolName === 'fetch_faculty') {
        const res = await apiService.getFaculties(params);
        const { items } = extractListPayload(res);
        const limit = Number(params.limit || 25);
        return { total: Array.isArray(items) ? items.length : null, items: pickFaculty(items || [], limit) };
      }
      if (toolName === 'fetch_settings') {
        return await apiService.getSettings();
      }
      return { error: 'Unknown tool' };
    } catch (err) {
      return { error: err?.message || String(err) };
    }
  };

  const buildSupportReply = React.useCallback((text) => {
    const q = String(text || '').toLowerCase();
    const lines = [];
    const hasBlockIntent = q.includes('block') || q.includes('course') || q.includes('section') || supportSnapshot.viewMode === 'blocks';
    const hasFacultyIntent = q.includes('faculty') || q.includes('instructor') || supportSnapshot.viewMode === 'faculty';
    if (supportSnapshot.blockLabel && hasBlockIntent) {
      lines.push(`Block ${supportSnapshot.blockLabel}: ${supportSnapshot.blockCourseCount} course(s) in view${supportSnapshot.missingCount ? `; ${supportSnapshot.missingCount} need term/time/faculty` : ''}${supportSnapshot.conflictCount ? `; ${supportSnapshot.conflictCount} flagged conflict(s)` : ''}.`);
      if (supportSnapshot.selectedCount || supportSnapshot.lockedCount) {
        lines.push(`${supportSnapshot.selectedCount} selected to save right now${supportSnapshot.lockedCount ? `; ${supportSnapshot.lockedCount} locked item(s) stay read-only` : ''}.`);
      }
    }
    if (supportSnapshot.faculty.name && hasFacultyIntent) {
      lines.push(
        `${supportSnapshot.faculty.name}${supportSnapshot.faculty.dept ? ` (${supportSnapshot.faculty.dept})` : ''}: ${supportSnapshot.faculty.items} schedule(s), ${supportSnapshot.faculty.saved} saved / ${supportSnapshot.faculty.draft} draft, projected ${formatUnits(supportSnapshot.faculty.units)} units.`
      );
    }
    if (q.includes('prospectus')) {
      lines.push(`${supportSnapshot.counts.prospectus} prospectus course(s) available; current block view auto-filters by program/year.`);
    }
    if (q.includes('schedule') || q.includes('summary')) {
      const sy = supportSnapshot.settings.sy || 'current SY';
      const sem = supportSnapshot.settings.sem || '';
      lines.push(`Global schedules cache: ${supportSnapshot.counts.schedules} item(s) across ${sy}${sem ? ` / ${sem}` : ''}.`);
    }
    if (!lines.length) {
      lines.push('I can summarize the active block, your selected faculty, or highlight missing term/time slots—ask about blocks, faculty load, conflicts, or prospectus gaps.');
    }
    lines.push(`Snapshot: ${supportSnapshot.counts.blocks} block(s), ${supportSnapshot.counts.faculty} faculty, ${supportSnapshot.counts.prospectus} prospectus rows.`);
  return lines.map((l) => `• ${l}`).join('\n');
}, [supportSnapshot]);

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(text, keyPrefix = 'inline') {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <Text as="span" fontWeight="bold" key={`${keyPrefix}-b-${idx}`}>{part.slice(2, -2)}</Text>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <Text as="span" fontStyle="italic" key={`${keyPrefix}-i-${idx}`}>{part.slice(1, -1)}</Text>;
    }
    return <Text as="span" key={`${keyPrefix}-t-${idx}`}>{part}</Text>;
  });
}

function renderTable(lines, key = 'tbl') {
  if (!lines.length) return null;
  const rows = lines.map((ln) => ln.split('|').filter((c) => c.trim().length).map((c) => c.trim()));
  if (rows.length < 2) return null;
  const header = rows[0];
  const bodyRows = rows.slice(2); // skip separator row
  return (
    <Box overflowX="auto" key={key}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th key={`${key}-h-${i}`} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #CBD5E0' }}>
                {escapeHtml(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((r, ri) => (
            <tr key={`${key}-r-${ri}`}>
              {r.map((cell, ci) => (
                <td key={`${key}-c-${ri}-${ci}`} style={{ padding: '6px 8px', borderBottom: '1px solid #EDF2F7' }}>
                  {escapeHtml(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

function renderMessageContent(text) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  let tableBuf = [];
  const flushTable = () => {
    if (tableBuf.length) {
      blocks.push({ type: 'table', lines: tableBuf });
      tableBuf = [];
    }
  };
  lines.forEach((ln) => {
    if (/^\s*\|.*\|\s*$/.test(ln)) {
      tableBuf.push(ln);
    } else {
      flushTable();
      if (ln.trim()) {
        blocks.push({ type: 'text', line: ln });
      }
    }
  });
  flushTable();
  return blocks.map((blk, idx) => {
    if (blk.type === 'table') return renderTable(blk.lines, `tbl-${idx}`);
    return (
      <Text key={`t-${idx}`} fontSize="sm" lineHeight="1.45" whiteSpace="pre-wrap">
        {renderInline(blk.line, `ln-${idx}`)}
      </Text>
    );
  });
}

  const handleSupportAsk = React.useCallback(async (message) => {
    const query = typeof message === 'string' ? message : supportDraft;
    const next = String(query || '').trim();
    if (!next || supportBusy) return;
    setSupportMessages((prev) => [...prev, { role: 'user', text: next }]);
    setSupportDraft('');
    setSupportBusy(true);
    const ready = typeof window !== 'undefined' && window.puter && window.puter.ai && typeof window.puter.ai.chat === 'function' && supportPuterReady;
    if (!ready) {
      const reply = buildSupportReply(next);
      setSupportMessages((prev) => [...prev, { role: 'ai', text: `${reply}\n(Puter AI not ready yet; showing quick snapshot instead.)` }]);
      setSupportBusy(false);
      return;
    }

    try {
      // Phase 1: planning + tool calls
      const planningSystem = {
        role: 'system',
        content: 'You are the Course Loading AI support assistant. Decide which tools to call to gather the minimum data needed to answer the question. Respond with tool calls only; do not give the final answer in this phase.',
      };
      const contextMessage = { role: 'system', content: `Current page context:\n${supportContextText || 'No context available.'}` };
      let messages = [planningSystem, contextMessage, { role: 'user', content: next }];
      const toolOutputs = [];
      let planningNote = '';
      for (let step = 0; step < 4; step++) {
        const resp = await window.puter.ai.chat(messages, { ...SUPPORT_AI_DEFAULTS, tools });
        const toolCalls = resp?.message?.tool_calls || [];
        if (toolCalls.length === 0) {
          planningNote = getContentFromResponse(resp) || '';
          break;
        }
        messages = [...messages, resp.message];
        for (const tc of toolCalls) {
          const name = tc?.function?.name;
          const callArgs = safeJsonParse(tc?.function?.arguments || '{}', {});
          const result = await runTool(name, callArgs);
          toolOutputs.push({ name, args: callArgs, result });
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
        }
      }

      // Phase 2: final answer using collected data
      const finalSystem = {
        role: 'system',
        content: 'You are the Course Loading AI support assistant. Answer in a compact, skimmable format: prefer 3-6 bullet lines, bold key labels, and use a short markdown table (max 5 rows) when comparing courses/faculty/blocks. Keep under 10 lines. Focus on schedules, blocks, faculty load, conflicts, and prospectus alignment.',
      };
      const toolSummary = toolOutputs.length ? summarizeToolOutputs(toolOutputs) : 'No tool data fetched.';
      const finalMessages = [
        finalSystem,
        { role: 'system', content: `Context:\n${supportContextText || 'No context available.'}` },
        { role: 'system', content: `Tool results:\n${toolSummary}` },
        planningNote ? { role: 'assistant', content: `Planning note: ${planningNote}` } : null,
        { role: 'user', content: next },
      ].filter(Boolean);
      const finalResp = await window.puter.ai.chat(finalMessages, { ...SUPPORT_AI_DEFAULTS });
      const reply = getContentFromResponse(finalResp) || 'No response text returned.';
      setSupportMessages((prev) => [...prev, { role: 'ai', text: reply }]);
    } catch (e) {
      const fallback = buildSupportReply(next);
      setSupportMessages((prev) => [...prev, { role: 'ai', text: `AI error: ${e?.message || String(e)}\n${fallback}` }]);
    } finally {
      setSupportBusy(false);
    }
  }, [buildSupportReply, runTool, supportBusy, supportDraft, supportPuterReady, supportContextText, tools]);

  return (
    <Box position="fixed" bottom={{ base: '18px', md: '24px' }} right={{ base: '16px', md: '28px' }} zIndex={40}>
      {supportOpen && (
        <Box
          w={supportFull ? 'calc(100vw - 24px)' : (supportWide ? { base: '94vw', md: '720px', lg: '860px' } : { base: '92vw', sm: '360px', md: '420px' })}
          maxW={supportFull ? 'calc(100vw - 24px)' : undefined}
          h={supportFull ? 'calc(88vh)' : 'auto'}
          mb={supportFull ? 0 : 3}
          bg={panelBg}
          borderWidth="1px"
          borderColor={supportGlow}
          rounded={supportFull ? 'xl' : '2xl'}
          boxShadow="2xl"
          overflow="hidden"
          position={supportFull ? 'fixed' : 'relative'}
          top={supportFull ? '12px' : undefined}
          left={supportFull ? '12px' : undefined}
          right={supportFull ? '12px' : undefined}
          bottom={supportFull ? '12px' : undefined}
          zIndex={supportFull ? 50 : 40}
        >
          <Box bgGradient="linear(to-r, blue.500, purple.500)" color="white" px={4} py={3}>
            <HStack justify="space-between" align="center">
              <VStack align="start" spacing={0}>
                <Text fontSize="xs" opacity={0.8}>AI Support</Text>
                <Text fontWeight="700" fontSize="sm">Course Loading Assistant</Text>
                <Text fontSize="xs" opacity={0.8}>Ask about schedules, faculty, blocks, courses, or prospectus.</Text>
              </VStack>
              <HStack spacing={2}>
                <Tag size="sm" colorScheme="blackAlpha" variant="solid" bg="whiteAlpha.300">Live</Tag>
                <Button size="xs" variant="outline" colorScheme="whiteAlpha" onClick={() => setSupportWide((v) => !v)}>
                  {supportWide ? 'Compact' : 'Wide'}
                </Button>
                <Button size="xs" variant="outline" colorScheme="whiteAlpha" onClick={() => setSupportFull((v) => !v)}>
                  {supportFull ? 'Exit Full' : 'Fullscreen'}
                </Button>
                <IconButton
                  aria-label="Close AI support"
                  icon={<FiX />}
                  size="sm"
                  variant="ghost"
                  color="white"
                  _hover={{ bg: 'whiteAlpha.200' }}
                  onClick={() => setSupportOpen(false)}
                />
              </HStack>
            </HStack>
          </Box>
          <VStack align="stretch" spacing={3} p={3} h={supportFull ? 'calc(100% - 70px)' : 'auto'}>
            <Box
              ref={supportListRef}
              maxH={supportFull ? '100%' : '280px'}
              flex={supportFull ? '1 1 auto' : undefined}
              overflowY="auto"
              borderWidth="1px"
              borderColor={dividerBorder}
              rounded="lg"
              px={3}
              py={2}
              bg={supportTranscriptBg}
            >
              <VStack align="stretch" spacing={2}>
                {supportMessages.map((msg, idx) => (
                  <HStack key={`${msg.role}-${idx}`} justify={msg.role === 'user' ? 'flex-end' : 'flex-start'}>
                    <Box
                      maxW="94%"
                      bg={msg.role === 'user' ? supportUserBg : supportAiBg}
                      color={msg.role === 'user' ? 'blue.900' : subtle}
                      px={3}
                      py={2}
                      rounded="lg"
                      borderWidth="1px"
                      borderColor={msg.role === 'user' ? supportGlow : dividerBorder}
                      boxShadow="sm"
                    >
                      <VStack align="stretch" spacing={1} fontSize="sm">
                        {renderMessageContent(msg.text)}
                      </VStack>
                    </Box>
                  </HStack>
                ))}
                {supportBusy && (
                  <HStack spacing={2} color={subtle}>
                    <Spinner size="xs" />
                    <Text fontSize="sm">Thinking about this view...</Text>
                  </HStack>
                )}
              </VStack>
            </Box>
            <Wrap spacing={2}>
              {supportPrompts.map((p) => (
                <WrapItem key={p}>
                  <Button size="xs" variant="ghost" colorScheme="blue" onClick={() => handleSupportAsk(p)} leftIcon={<FiHelpCircle />}>
                    {p}
                  </Button>
                </WrapItem>
              ))}
            </Wrap>
            <HStack spacing={2}>
              <Input
                placeholder="Ask about schedules, faculty, or blocks..."
                value={supportDraft}
                onChange={(e)=>setSupportDraft(e.target.value)}
                onKeyDown={(e)=>{ if (e.key === 'Enter') { handleSupportAsk(); } }}
                isDisabled={supportBusy || !supportPuterReady}
                ref={supportInputRef}
              />
              <IconButton
                aria-label="Send AI question"
                icon={<FiSend />}
                colorScheme="blue"
                onClick={()=>handleSupportAsk()}
                isLoading={supportBusy}
                isDisabled={supportBusy || !supportPuterReady}
              />
            </HStack>
          </VStack>
        </Box>
      )}
      <Tooltip label={supportOpen ? 'Hide AI assistant' : 'Ask AI about this page'} openDelay={200}>
        <IconButton
          id={toggleId}
          aria-label="Toggle AI assistant"
          icon={supportOpen ? <FiX /> : <FiMessageCircle />}
          size="lg"
          colorScheme="purple"
          boxShadow="xl"
          borderRadius="full"
          onClick={()=>setSupportOpen((v)=>!v)}
        />
      </Tooltip>
    </Box>
  );
}
