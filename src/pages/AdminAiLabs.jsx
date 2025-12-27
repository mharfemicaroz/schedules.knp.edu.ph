import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Collapse,
  Container,
  Divider,
  Heading,
  HStack,
  IconButton,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  Text,
  Textarea,
  useColorModeValue,
  useDisclosure,
  useToast,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { Bot, ChevronDown, ChevronUp, Database, Sparkles } from 'lucide-react';
import { useSelector } from 'react-redux';
import apiService from '../services/apiService';

const MODEL = 'x-ai/grok-4.1-fast';
const AI_DEFAULTS = { model: MODEL, temperature: 0.45, max_tokens: 900 };
const DOMAIN_KEYWORDS = [
  'schedule',
  'block',
  'room',
  'prospectus',
  'attendance',
  'faculty',
  'instructor',
  'student',
  'acad',
  'holiday',
  'settings',
  'guest',
  'load',
  'section',
  'program',
  'department',
];
const OFF_TOPIC = ['planet', 'politics', 'recipe', 'game', 'movie', 'music', 'zodiac', 'astrology'];

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

function extractSingle(resp) {
  const payload = resp?.data ?? resp;
  return payload?.data ?? payload;
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

function pickAttendance(items = [], limit = 30) {
  return items.slice(0, limit).map((r) => ({
    id: r.id ?? null,
    scheduleId: r.scheduleId ?? r.schedule_id ?? null,
    faculty: r.faculty ?? r.instructor ?? null,
    room: r.room ?? null,
    status: r.status ?? r.attendance ?? null,
    timeIn: r.timeIn ?? r.time_in ?? null,
    timeOut: r.timeOut ?? r.time_out ?? null,
    date: r.date ?? r.day ?? null,
  }));
}

function pickUsers(users = [], limit = 25) {
  return users.slice(0, limit).map((u) => ({
    id: u.id ?? null,
    name: [u.firstname, u.middlename, u.lastname].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || u.name || u.email || null,
    firstname: u.firstname ?? null,
    middlename: u.middlename ?? null,
    lastname: u.lastname ?? null,
    role: u.role ?? u.user_type ?? null,
    position: u.position ?? null,
    email: u.email ?? null,
    dept: u.department ?? u.dept ?? null,
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

function pickGuests(items = [], limit = 25) {
  return items.slice(0, limit).map((g) => ({
    id: g.id ?? null,
    name: g.name ?? null,
    role: g.role ?? null,
    route: g.route ?? g.path ?? null,
    created_at: g.created_at ?? g.createdAt ?? null,
  }));
}

function looksCampusRelated(text) {
  const t = (text || '').toLowerCase();
  if (!t.trim()) return true;
  const hasDomain = DOMAIN_KEYWORDS.some((k) => t.includes(k));
  const hasOffTopic = OFF_TOPIC.some((k) => t.includes(k));
  if (hasOffTopic && !hasDomain) return false;
  if (hasDomain) return true;
  return t.trim().split(/\s+/).length <= 3;
}

function getScopeBlockMessage(text) {
  return [
    'This AI is focused on schedules, blocks, attendance, prospectus, faculty, students, and admin settings.',
    'The question looks outside that scope:',
    `"${text || 'no question provided'}"`,
    'Ask about classes, rooms, programs, academic calendar, guests, or attendance instead.',
  ].join('\n');
}

const promptTabs = [
  {
    key: 'overview',
    title: 'Overview',
    items: [
      { label: 'Today at a glance', text: 'Summarize today: classes running, rooms in use, any overlaps, and urgent attendance gaps.' },
      { label: 'Week risks', text: 'Scan this week for overloaded faculty, underused rooms, and any schedule clashes to resolve early.' },
    ],
  },
  {
    key: 'schedules',
    title: 'Schedules',
    items: [
      { label: 'Balance teaching load', text: 'Identify faculty with high loads or overload and propose specific swaps or reassignments.' },
      { label: 'Room efficiency', text: 'Find overbooked or idle rooms and recommend a schedule shuffle to improve utilization.' },
    ],
  },
  {
    key: 'blocks',
    title: 'Blocks',
    items: [
      { label: 'Block sanity check', text: 'Check blocks for missing sections, conflicting rooms, or inconsistent program codes.' },
      { label: 'Prospectus alignment', text: 'Compare active blocks with the prospectus and flag courses/units that are missing per year/semester.' },
    ],
  },
  {
    key: 'attendance',
    title: 'Attendance',
    items: [
      { label: 'Absence hotspots', text: 'Find classes with repeated absences or missing time-out entries and suggest follow-ups for program chairs.' },
      { label: 'Room attendance', text: 'Summarize attendance by room to spot chronically low-occupancy sessions.' },
    ],
  },
  {
    key: 'people',
    title: 'People',
    items: [
      { label: 'Faculty coverage', text: 'Map faculty to departments and spot unassigned, unknown, or duplicate instructors in schedules.' },
      { label: 'Role hygiene', text: 'List admin/manager/checker accounts and recommend least-privilege adjustments.' },
    ],
  },
  {
    key: 'calendar',
    title: 'Calendar',
    items: [
      { label: 'Key dates', text: 'Summarize upcoming academic calendar events and holidays that may disrupt classes this week and next.' },
      { label: 'Guest usage', text: 'Review guest access logs and suggest controls to reduce unnecessary guest accounts.' },
    ],
  },
];

const AdminAiLabs = () => {
  const toast = useToast();
  const outputRef = useRef(null);
  const accessToken = useSelector((s) => s.auth.accessToken);
  const [puterReady, setPuterReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [context, setContext] = useState({
    schedules: null,
    blocks: null,
    attendance: null,
    settings: null,
    holidays: null,
    guests: null,
    updatedAt: null,
  });
  const promptsDisclosure = useDisclosure({ defaultIsOpen: true });
  const bgLayer = useColorModeValue('linear-gradient(135deg, #eef2ff 0%, #f9fafb 35%, #e0f2fe 100%)', 'linear-gradient(135deg, #0f172a 0%, #0b1224 40%, #0f172a 100%)');
  const cardBg = useColorModeValue('white', 'gray.800');

  useEffect(() => {
    if (accessToken) apiService.setAuthToken(accessToken);
  }, [accessToken]);

  useEffect(() => {
    ensurePuterScriptLoaded()
      .then(() => setPuterReady(true))
      .catch((e) => {
        setPuterReady(false);
        setOutput(`Error loading Puter.js: ${e.message}`);
      });
  }, []);

  useEffect(() => {
    if (!outputRef.current) return;
    outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const tools = useMemo(
    () => [
      {
        type: 'function',
        function: {
          name: 'fetch_schedules',
          description: 'List schedules with optional filters (sy, sem, programcode, instructor, room, block, limit).',
          parameters: {
            type: 'object',
            properties: {
              params: {
                type: 'object',
                properties: {
                  sy: { type: 'string' },
                  sem: { type: 'string' },
                  programcode: { type: 'string' },
                  instructor: { type: 'string' },
                  room: { type: 'string' },
                  block: { type: 'string' },
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
          name: 'fetch_schedule_by_id',
          description: 'Get a single schedule by ID.',
          parameters: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fetch_schedule_stats',
          description: 'Get aggregated schedule stats.',
          parameters: { type: 'object', properties: {} },
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
          name: 'fetch_block_stats',
          description: 'Get block statistics.',
          parameters: { type: 'object', properties: {} },
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
          name: 'fetch_attendance',
          description: 'List attendance records (by schedule, faculty, room, date).',
          parameters: {
            type: 'object',
            properties: {
              params: {
                type: 'object',
                properties: {
                  scheduleId: { type: 'number' },
                  faculty: { type: 'string' },
                  room: { type: 'string' },
                  date: { type: 'string' },
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
          name: 'fetch_attendance_stats',
          description: 'Get attendance stats (optionally by faculty).',
          parameters: {
            type: 'object',
            properties: {
              params: {
                type: 'object',
                properties: {
                  faculty: { type: 'string' },
                  room: { type: 'string' },
                  date: { type: 'string' },
                },
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fetch_users',
          description: 'List users/admins (filter by role or email).',
          parameters: {
            type: 'object',
            properties: {
              params: {
                type: 'object',
                properties: {
                  role: { type: 'string' },
                  email: { type: 'string' },
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
          name: 'fetch_user_by_id',
          description: 'Get a single user by ID.',
          parameters: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fetch_faculty',
          description: 'List faculty directory (dept, designation, employment).',
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
          name: 'fetch_faculty_by_id',
          description: 'Get a single faculty record by ID.',
          parameters: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
        },
      },
      {
        type: 'function',
        function: {
          name: 'verify_student',
          description: 'Verify a student by ID and birth date (DD/MM/YYYY).',
          parameters: { type: 'object', properties: { studentid: { type: 'string' }, birthDateDMY: { type: 'string' } } },
        },
      },
      {
        type: 'function',
        function: {
          name: 'check_evaluation',
          description: 'Check if an evaluation exists for an access code and student name.',
          parameters: { type: 'object', properties: { accessCode: { type: 'string' }, studentName: { type: 'string' } } },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fetch_academic_calendar',
          description: 'Get academic calendar content for a school year.',
          parameters: { type: 'object', properties: { school_year: { type: 'string' } } },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fetch_holidays',
          description: 'List holidays for a given year.',
          parameters: { type: 'object', properties: { year: { type: 'number' } } },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fetch_settings',
          description: 'Get system settings (SY/Sem, load view).',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fetch_guests',
          description: 'List guest access logs (filter by role/route).',
          parameters: {
            type: 'object',
            properties: {
              params: {
                type: 'object',
                properties: {
                  role: { type: 'string' },
                  route: { type: 'string' },
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
          name: 'fetch_guest_stats',
          description: 'Get guest usage stats.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_cached_snapshot',
          description: 'Get the cached snapshot built from recent refresh.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'refresh_cached_snapshot',
          description: 'Refresh cached snapshot (schedules, blocks, attendance stats, settings, holidays, guests).',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number' },
              year: { type: 'number' },
            },
          },
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
      if (toolName === 'fetch_schedule_by_id') {
        const res = await apiService.getScheduleById(args.id);
        const item = extractSingle(res);
        return pickSchedules([item], 1)[0] ?? null;
      }
      if (toolName === 'fetch_schedule_stats') {
        return await apiService.getScheduleStats();
      }
      if (toolName === 'fetch_blocks') {
        const res = await apiService.getBlocks(params);
        const { items } = extractListPayload(res);
        const limit = Number(params.limit || 20);
        return { total: Array.isArray(items) ? items.length : null, items: pickBlocks(items || [], limit) };
      }
      if (toolName === 'fetch_block_stats') {
        return await apiService.getBlockStats();
      }
      if (toolName === 'fetch_prospectus') {
        const res = await apiService.getProspectus(params);
        const { items } = extractListPayload(res);
        const limit = Number(params.limit || 30);
        return { total: Array.isArray(items) ? items.length : null, items: pickProspectus(items || [], limit) };
      }
      if (toolName === 'fetch_attendance') {
        const res = await apiService.listAttendance(params);
        const { items } = extractListPayload(res);
        const limit = Number(params.limit || 30);
        return { total: Array.isArray(items) ? items.length : null, items: pickAttendance(items || [], limit) };
      }
      if (toolName === 'fetch_attendance_stats') {
        return await apiService.getAttendanceStats(params);
      }
      if (toolName === 'fetch_users') {
        const res = await apiService.listUsers(params);
        const { items } = extractListPayload(res);
        const limit = Number(params.limit || 25);
        return { total: Array.isArray(items) ? items.length : null, items: pickUsers(items || [], limit) };
      }
      if (toolName === 'fetch_user_by_id') {
        const res = await apiService.getUser(args.id);
        const item = extractSingle(res);
        return pickUsers([item], 1)[0] ?? null;
      }
      if (toolName === 'fetch_faculty') {
        const res = await apiService.getFaculties(params);
        const { items } = extractListPayload(res);
        const limit = Number(params.limit || 25);
        return { total: Array.isArray(items) ? items.length : null, items: pickFaculty(items || [], limit) };
      }
      if (toolName === 'fetch_faculty_by_id') {
        const res = await apiService.getFaculty(args.id);
        const item = extractSingle(res);
        return pickFaculty([item], 1)[0] ?? null;
      }
      if (toolName === 'verify_student') {
        return await apiService.verifyStudent(args.studentid, args.birthDateDMY);
      }
      if (toolName === 'check_evaluation') {
        return await apiService.checkEvaluationExists(args.accessCode, args.studentName);
      }
      if (toolName === 'fetch_academic_calendar') {
        return await apiService.getAcademicCalendar({ school_year: args.school_year });
      }
      if (toolName === 'fetch_holidays') {
        return await apiService.getHolidays(args.year);
      }
      if (toolName === 'fetch_settings') {
        return await apiService.getSettings();
      }
      if (toolName === 'fetch_guests') {
        const res = await apiService.listGuests(params);
        const { items } = extractListPayload(res);
        const limit = Number(params.limit || 25);
        return { total: Array.isArray(items) ? items.length : null, items: pickGuests(items || [], limit) };
      }
      if (toolName === 'fetch_guest_stats') {
        return await apiService.getGuestStats();
      }
      if (toolName === 'get_cached_snapshot') {
        return { ...context };
      }
      if (toolName === 'refresh_cached_snapshot') {
        const limit = Number(args?.limit || 30);
        const year = Number(args?.year) || new Date().getFullYear();
        const [schedRes, blockRes, attendanceStatsRes, settingsRes, holidayRes, guestRes] = await Promise.allSettled([
          apiService.getAllSchedules({ limit }),
          apiService.getBlocks({ limit }),
          apiService.getAttendanceStats(),
          apiService.getSettings(),
          apiService.getHolidays(year),
          Promise.allSettled([apiService.listGuests({ limit }), apiService.getGuestStats()]),
        ]);
        const schedules = schedRes.status === 'fulfilled' ? pickSchedules(extractListPayload(schedRes.value).items || [], limit) : null;
        const blocks = blockRes.status === 'fulfilled' ? pickBlocks(extractListPayload(blockRes.value).items || [], limit) : null;
        const attendanceStats = attendanceStatsRes.status === 'fulfilled' ? attendanceStatsRes.value : null;
        const settings = settingsRes.status === 'fulfilled' ? settingsRes.value : null;
        const holidays = holidayRes.status === 'fulfilled' ? holidayRes.value : null;
        let guests = null;
        let guestStats = null;
        if (guestRes.status === 'fulfilled') {
          const [listRes, statsRes] = guestRes.value;
          if (listRes.status === 'fulfilled') {
            const { items } = extractListPayload(listRes.value);
            guests = pickGuests(items || [], limit);
          }
          if (statsRes.status === 'fulfilled') {
            guestStats = statsRes.value;
          }
        }
        const next = {
          schedules: schedules ? { items: schedules } : null,
          blocks: blocks ? { items: blocks } : null,
          attendance: attendanceStats,
          settings,
          holidays,
          guests: guests ? { items: guests, stats: guestStats } : null,
          updatedAt: new Date().toISOString(),
        };
        setContext(next);
        return {
          ok: true,
          updatedAt: next.updatedAt,
          counts: {
            schedules: schedules?.length ?? 0,
            blocks: blocks?.length ?? 0,
            guests: guests?.length ?? 0,
          },
        };
      }
      return { error: 'Unknown tool' };
    } catch (err) {
      return { error: err?.message || String(err) };
    }
  };

  const askAI = async () => {
    const text = (prompt || '').trim();
    if (!text) return;
    if (!looksCampusRelated(text)) {
      setOutput(getScopeBlockMessage(text));
      toast({ status: 'info', title: 'Out of scope', duration: 2200 });
      return;
    }
    if (!puterReady) {
      toast({ status: 'warning', title: 'Puter.js not ready yet' });
      return;
    }
    setLoading(true);
    setOutput('');
    try {
      const system = {
        role: 'system',
        content:
          'You are KNP Scheduling AI Labs. Stay within schedules, blocks, rooms, prospectus, attendance, settings, users, guests, and academic calendar. ' +
          'Use tools when you need live data. Be concise, action-oriented, and include a short recommendation when relevant. Always provide a final answer after tool calls.',
      };
      let messages = [system, { role: 'user', content: text }];
      for (let i = 0; i < 6; i++) {
        const resp = await window.puter.ai.chat(messages, { ...AI_DEFAULTS, tools });
        const toolCalls = resp?.message?.tool_calls || [];
        if (toolCalls.length === 0) {
          const finalText = getContentFromResponse(resp) || 'No response text returned.';
          setOutput(finalText);
          return;
        }
        messages = [...messages, resp.message];
        for (const tc of toolCalls) {
          const name = tc?.function?.name;
          const callArgs = safeJsonParse(tc?.function?.arguments || '{}', {});
          const result = await runTool(name, callArgs);
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
        }
      }
      setOutput('AI requested too many tool steps. Try a narrower question.');
    } catch (e) {
      setOutput(`Error: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box bg={bgLayer} minH="100vh" py={8} px={{ base: 3, md: 6 }}>
      <Container maxW="7xl">
        <Stack spacing={6}>
          <Card bg={cardBg} shadow="xl" borderRadius="2xl" borderWidth="1px" borderColor={useColorModeValue('gray.200', 'gray.700')}>
            <CardBody>
              <Stack spacing={4}>
                <HStack justify="space-between" align={{ base: 'stretch', md: 'center' }} flexDir={{ base: 'column', md: 'row' }} gap={3}>
                  <Box>
                    <HStack spacing={3}>
                      <Tag colorScheme="purple" size="sm">
                        Admin
                      </Tag>
                      <Tag colorScheme="blue" size="sm">
                        AI Labs
                      </Tag>
                    </HStack>
                    <Heading size="lg" mt={2}>
                      AI Labs - Scheduling and Admin
                    </Heading>
                    <Text color={useColorModeValue('gray.600', 'gray.300')} mt={1}>
                      Ask for summaries, risks, and quick fixes using live data from schedules, blocks, attendance, settings, and guests.
                    </Text>
                  </Box>
                  <HStack spacing={3} align="center">
                    <Tag variant="subtle" colorScheme={puterReady ? 'green' : 'yellow'}>
                      {puterReady ? 'Puter ready' : 'Loading Puter...'}
                    </Tag>
                    <Tag variant="outline" colorScheme="blue">
                      {MODEL}
                    </Tag>
                  </HStack>
                </HStack>
              </Stack>
            </CardBody>
          </Card>

          <Card bg={cardBg} borderRadius="2xl" borderWidth="1px" borderColor={useColorModeValue('gray.200', 'gray.700')}>
            <CardHeader pb={2}>
              <HStack justify="space-between" align="center">
                <HStack spacing={2}>
                  <Database size={18} />
                  <Heading size="sm">Built-in prompts</Heading>
                  <Tag size="sm" variant="subtle" colorScheme="purple">
                    Compact
                  </Tag>
                </HStack>
                <HStack spacing={2}>
                  <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.400')}>
                    {promptsDisclosure.isOpen ? 'Shown' : 'Hidden'}
                  </Text>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label="Toggle prompts"
                    icon={promptsDisclosure.isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    onClick={promptsDisclosure.onToggle}
                  />
                </HStack>
              </HStack>
            </CardHeader>
            <CardBody pt={0}>
              <Collapse in={promptsDisclosure.isOpen} animateOpacity>
                <Box borderWidth="1px" borderColor={useColorModeValue('gray.200', 'gray.700')} borderRadius="xl" p={3} bg={useColorModeValue('gray.50', 'blackAlpha.300')}>
                  <Tabs variant="soft-rounded" colorScheme="blue" size="sm">
                    <TabList overflowX="auto" overflowY="hidden" pb={1} sx={{ '::-webkit-scrollbar': { height: '6px' }, '::-webkit-scrollbar-thumb': { borderRadius: '999px' } }}>
                      {promptTabs.map((t) => (
                        <Tab key={t.key} whiteSpace="nowrap" flexShrink={0}>
                          {t.title}
                        </Tab>
                      ))}
                    </TabList>
                    <TabPanels pt={3}>
                      {promptTabs.map((t) => (
                        <TabPanel key={t.key} p={0}>
                          <Wrap spacing={2}>
                            {t.items.map((p) => (
                              <WrapItem key={p.label}>
                                <Button size="xs" variant="outline" borderRadius="full" leftIcon={<Sparkles size={14} />} onClick={() => setPrompt(p.text)}>
                                  {p.label}
                                </Button>
                              </WrapItem>
                            ))}
                          </Wrap>
                        </TabPanel>
                      ))}
                    </TabPanels>
                  </Tabs>
                </Box>
              </Collapse>
            </CardBody>
          </Card>

          <Card bg={cardBg} borderRadius="2xl" borderWidth="1px" borderColor={useColorModeValue('gray.200', 'gray.700')}>
            <CardHeader pb={0}>
              <HStack spacing={2}>
                <Bot size={18} />
                <Heading size="sm">Ask AI</Heading>
              </HStack>
            </CardHeader>
            <CardBody>
              <Stack spacing={3}>
                <Textarea
                  placeholder="Ask about schedules, rooms, attendance, blocks, prospectus, guests, or settings."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) askAI();
                  }}
                />
                <HStack justify="space-between" align={{ base: 'stretch', md: 'center' }} flexDir={{ base: 'column', md: 'row' }} gap={3}>
                  <HStack spacing={2}>
                    <Button onClick={askAI} isLoading={loading} isDisabled={!puterReady} colorScheme="blue">
                      Ask
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPrompt('');
                        setOutput('');
                      }}
                      isDisabled={loading}
                    >
                      Clear
                    </Button>
                  </HStack>
                  <HStack spacing={3}>
                    <Tag variant="subtle" colorScheme="green">
                      Tools ready
                    </Tag>
                    <Tag variant="subtle" colorScheme="blue">
                      {context.updatedAt ? `Snapshot ${new Date(context.updatedAt).toLocaleTimeString()}` : 'No snapshot yet'}
                    </Tag>
                  </HStack>
                </HStack>
              </Stack>
            </CardBody>
          </Card>

          <Card bg={cardBg} borderRadius="2xl" borderWidth="1px" borderColor={useColorModeValue('gray.200', 'gray.700')}>
            <CardBody>
              <VStack align="stretch" spacing={2}>
                <HStack justify="space-between">
                  <Heading size="md">AI Output</Heading>
                  <Tag variant="outline" colorScheme={loading ? 'orange' : 'gray'}>
                    {loading ? 'Running...' : 'Idle'}
                  </Tag>
                </HStack>
                <Divider />
                <Box
                  ref={outputRef}
                  borderWidth="1px"
                  borderColor={useColorModeValue('gray.200', 'gray.700')}
                  borderRadius="lg"
                  p={4}
                  minH="220px"
                  maxH="520px"
                  overflow="auto"
                  whiteSpace="pre-wrap"
                  bg={useColorModeValue('gray.50', 'blackAlpha.300')}
                >
                  {output || 'Output will appear here...'}
                </Box>
              </VStack>
            </CardBody>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
};

export default AdminAiLabs;
