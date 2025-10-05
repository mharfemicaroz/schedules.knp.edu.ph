import React from 'react';
import {
  Box,
  Heading,
  HStack,
  Text,
  useColorModeValue,
  Wrap,
  WrapItem,
  Tag,
  TagLabel,
  Tooltip,
  Badge,
  Skeleton,
  Divider,
  Button,
} from '@chakra-ui/react';
import { FiPrinter } from 'react-icons/fi';
// PDF download removed as requested
import { useDispatch, useSelector } from 'react-redux';
import { selectBlocks } from '../store/blockSlice';
import { loadBlocksThunk } from '../store/blockThunks';
import { getCurrentWeekDays } from '../utils/week';
import { getExamDateSet } from '../utils/scheduleUtils';

// Color scheme by program code
function schemeForBlockCode(code) {
  const s = String(code || '').toUpperCase();
  if (s.includes('BSAB')) return 'green';
  if (s.includes('BSBA')) return 'yellow';
  if (s.includes('BSCRIM')) return 'red';
  if (s.includes('BSED') || s.includes('BTLED')) return 'blue';
  if (s.includes('BSTM')) return 'purple';
  if (s.includes('BSENTREP')) return 'orange';
  return 'gray';
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_FULL = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SESSIONS = ['Morning', 'Afternoon', 'Evening'];
const ROOM_SPLIT_THRESHOLD = 10; // auto-split when a day has more than this many rooms

function getWeekStartDate(weekStartISO) {
  if (weekStartISO) {
    const d = new Date(weekStartISO);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day); // Monday-based
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0,0,0,0);
  return monday;
}

export default function WeeklyRoomMap_LandscapeZoom_Split({ weekStartISO }) {
  const border = useColorModeValue('gray.200', 'gray.700');
  const cellBg = useColorModeValue('white', 'gray.800');
  const stickyBg = useColorModeValue('white', 'gray.900');
  const subtle = useColorModeValue('gray.600', 'gray.400');
  const headerBg = useColorModeValue('gray.50', 'gray.900');

  const dispatch = useDispatch();
  const blocks = useSelector(selectBlocks);
  const acadData = useSelector(s => s.data.acadData);

  const [sections, setSections] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const [pageWidth, setPageWidth] = React.useState(1200);

  const containerRef = React.useRef(null);
  const [containerWidth, setContainerWidth] = React.useState(0);

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // Manual zoom controls removed; auto-fit width adjusts scale
  const zoomFitWidth = React.useCallback((targetWidth) => {
    const w = targetWidth || containerWidth || (containerRef.current?.clientWidth || 0);
    if (!w || !pageWidth) return;
    const scale = clamp(parseFloat((w / pageWidth).toFixed(3)), 0.4, 3);
    setZoom(scale);
  }, [containerWidth, pageWidth]);

  const weekDays = React.useMemo(() => getCurrentWeekDays(), []);
  const autoExamDays = React.useMemo(() => {
    const set = new Set();
    try {
      const examSet = getExamDateSet(acadData);
      weekDays.forEach(wd => {
        const d = new Date(wd.date); d.setHours(0,0,0,0);
        if (examSet.has(d.getTime())) set.add(wd.code);
      });
    } catch {}
    return set;
  }, [acadData, weekDays]);
  const daysWithExams = React.useMemo(() => {
    const s = new Set();
    (blocks || []).forEach(b => { const d = String(b.examDay || '').trim(); if (d) s.add(d); });
    return s;
  }, [blocks]);

  const handleReload = async () => {
    setIsLoading(true);
    try { await dispatch(loadBlocksThunk({})); } finally { setIsLoading(false); }
  };

  React.useEffect(() => { handleReload(); }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    const tokens = (s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
    const norm = (v) => String(v || 'N/A').trim().split(/\s+/).join(' ').toUpperCase();
    const canonSession = (v) => {
      const s = String(v || '').trim().toLowerCase();
      if (s.includes('even')) return 'Evening';
      if (s.includes('after')) return 'Afternoon';
      if (s.includes('morn')) return 'Morning';
      if (s === 'am') return 'Morning';
      if (s === 'pm') return 'Afternoon';
      return 'Morning';
    };

    const out = weekDays.map((wd) => {
      const day = wd.code;
      const hasExamData = daysWithExams.has(day);
      const useExamMode = autoExamDays.has(day) && hasExamData;

      if (useExamMode) {
        const displayByKey = new Map();
        (blocks || []).forEach(b => {
          if (String(b.examDay || '').trim() !== String(day)) return;
          tokens(b.examRoom).forEach(r => { const key = norm(r); if (!displayByKey.has(key)) displayByKey.set(key, r || 'N/A'); });
        });
        const rooms = Array.from(displayByKey.values()).sort((a,b)=>String(a).localeCompare(String(b)));
        const matrix = { Morning: new Map(), Afternoon: new Map(), Evening: new Map() };
        rooms.forEach(r => { matrix.Morning.set(r, new Map()); matrix.Afternoon.set(r, new Map()); matrix.Evening.set(r, new Map()); });
        (blocks || []).forEach(b => {
          if (String(b.examDay || '').trim() !== String(day)) return;
          const session = canonSession(b.examSession || 'Morning');
          tokens(b.examRoom).forEach(r => {
            const room = displayByKey.get(norm(r)) || 'N/A';
            const block = b.blockCode || b.block_code || 'N/A';
            if (!matrix[session]) matrix[session] = new Map(rooms.map(rr => [rr, new Map()]));
            if (!matrix[session].has(room)) matrix[session].set(room, new Map());
            const m = matrix[session].get(room);
            if (!m.has(block)) m.set(block, '');
          });
        });
        return { day, label: wd.label, rooms, matrix, mode: 'exam' };
      }

      // Regular F2F mapping with index-aligned room/day pairing when both are multiple
      const getRoomsForDay = (b, d) => {
        const roomsArr = tokens(b.room);
        const daysArr = tokens(b.f2fSched);
        if (roomsArr.length > 1 && daysArr.length > 1) {
          const out = [];
          const len = Math.min(roomsArr.length, daysArr.length);
          for (let i = 0; i < len; i++) {
            if (String(daysArr[i]) === String(d)) out.push(roomsArr[i]);
          }
          return out;
        }
        return daysArr.includes(d) ? roomsArr : [];
      };

      const displayByKey = new Map();
      (blocks || []).forEach(b => {
        const roomsForThisDay = getRoomsForDay(b, day);
        roomsForThisDay.forEach(r => { const key = norm(r); if (!displayByKey.has(key)) displayByKey.set(key, r || 'N/A'); });
      });
      const rooms = Array.from(displayByKey.values()).sort((a,b)=>String(a).localeCompare(String(b)));
      const matrix = { Morning: new Map(), Afternoon: new Map(), Evening: new Map() };
      rooms.forEach(r => { matrix.Morning.set(r, new Map()); matrix.Afternoon.set(r, new Map()); matrix.Evening.set(r, new Map()); });
      (blocks || []).forEach(b => {
        const session = canonSession(b.session || 'Morning');
        const roomsForThisDay = getRoomsForDay(b, day);
        roomsForThisDay.forEach(r => {
          const room = displayByKey.get(norm(r)) || 'N/A';
          const block = b.blockCode || b.block_code || 'N/A';
          if (!matrix[session]) matrix[session] = new Map(rooms.map(rr => [rr, new Map()]));
          if (!matrix[session].has(room)) matrix[session].set(room, new Map());
          const m = matrix[session].get(room);
          if (!m.has(block)) m.set(block, '');
        });
      });
      return { day, label: wd.label, rooms, matrix, mode: 'regular' };
    });

    setSections(out);

    const longest = Math.max(4, ...((blocks || []).map(b => String(b.blockCode || b.block_code || '').length)));
    const SESSION_COL_W = 160;
    const MIN_COL_W = 140;
    const MAX_COL_W = 360;
    const CHAR_W = 8;
    const colWidth = clamp(Math.round(longest * CHAR_W + 32), MIN_COL_W, MAX_COL_W);

    const maxRooms = out.reduce((m, s) => Math.max(m, s.rooms.length), 0);
    const splitWidthRooms = maxRooms > ROOM_SPLIT_THRESHOLD ? Math.ceil(maxRooms/2) : maxRooms;
    const computedPageWidth = SESSION_COL_W + (splitWidthRooms * colWidth);
    setPageWidth(Math.max(1200, computedPageWidth));

  }, [blocks, weekDays, autoExamDays, daysWithExams]);

  React.useEffect(() => {
    if (containerWidth > 0 && pageWidth > 0) zoomFitWidth();
  }, [containerWidth, pageWidth, zoomFitWidth]);

  // ZoomControls removed

  // Utility to split rooms into two halves
  const splitRooms = (rooms) => {
    if (!rooms || rooms.length <= ROOM_SPLIT_THRESHOLD) return [rooms];
    const half = Math.ceil(rooms.length / 2);
    return [rooms.slice(0, half), rooms.slice(half)];
  };

  const TableForRooms = ({ day, rooms, matrix, indexLabel }) => (
    <Box as="table" w="100%" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'auto' }}>
      <Box as="thead">
        <Box as="tr" bg={useColorModeValue('gray.100','gray.800')}>
          <Box as="th" position="sticky" left={0} zIndex={1} bg={stickyBg} p="10px 12px" textAlign="left" borderRightWidth="1px" borderColor={border} width="160px">
            Session
          </Box>
          {rooms.map((r) => (
            <Box as="th" key={`${day}-${indexLabel}-${r}`} p="10px 12px" textAlign="left" borderLeftWidth="1px" borderColor={border} style={{ minWidth: '140px' }}>
              <Text fontWeight="700" noOfLines={1}>{r}</Text>
            </Box>
          ))}
        </Box>
      </Box>
      <Box as="tbody">
        {SESSIONS.map((sess) => (
          <Box as="tr" key={`${day}-${indexLabel}-${sess}`} _hover={{ bg: useColorModeValue('gray.50','gray.800') }}>
            <Box as="td" position="sticky" left={0} zIndex={1} bg={stickyBg} p="10px 12px" borderTopWidth="1px" borderColor={border} fontWeight="700">{sess}</Box>
            {rooms.length === 0 && (
              <Box as="td" p="10px 12px" borderTopWidth="1px" borderColor={border} colSpan={999}>
                {isLoading ? <Skeleton height="16px" /> : <Text fontSize="xs" color={subtle}>—</Text>}
              </Box>
            )}
            {rooms.map((r, cIdx) => {
              const map = matrix[sess]?.get(r) || new Map();
              const arr = Array.from(map.keys()).sort();
              return (
                <Box as="td" key={`${day}-${indexLabel}-${sess}-${r}`} p="8px 10px" borderTopWidth="1px" borderLeftWidth={cIdx===0? '1px':'1px'} borderColor={border} overflow="visible">
                  {arr.length === 0 ? (
                    <Text fontSize="xs" color={subtle}>—</Text>
                  ) : (
                    <Wrap spacing={2} shouldWrapChildren>
                      {arr.map((b) => (
                        <WrapItem key={`${day}-${indexLabel}-${sess}-${r}-${b}`} maxW="100%">
                          <Tooltip label={b} hasArrow openDelay={200}>
                            <Tag
                              variant="subtle"
                              colorScheme={schemeForBlockCode(b)}
                              rounded="full"
                              px={6}
                              py={2}
                              display="inline-block"
                              maxW="100%"
                              style={{ fontSize: '12px', lineHeight: 1.2, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                            >
                              <TagLabel display="block" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{b}</TagLabel>
                            </Tag>
                          </Tooltip>
                        </WrapItem>
                      ))}
                    </Wrap>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );

  const handlePrint = React.useCallback(() => { window.print(); }, []);

  return (
    <Box p={{ base: 2, md: 4 }}>
      <HStack justify="space-between" align="center" mb={2} className="no-print">
        <Heading size="md">Classroom Assignment</Heading>
        <HStack>
          <Button leftIcon={<FiPrinter />} size="sm" variant="outline" onClick={handlePrint}>Print</Button>
        </HStack>
      </HStack>

      <Divider mb={3} />

      <Box ref={containerRef} className="doc-viewer" overflowX="auto" overflowY="auto" p={{ base: 1, md: 2 }}>
        <Box width={`${pageWidth}px`}>
          {sections.map((t, idx) => {
            const roomParts = splitRooms(t.rooms);
            return (
              <Box key={t.day} bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" boxShadow="md" mb={6}>
                {/* Day header with actual date */}
                <Box px={4} py={3} bg={headerBg} borderBottomWidth="1px" borderColor={border} position="sticky" top={0} zIndex={2} roundedTop="xl">
                  <HStack justify="space-between">
                    <HStack spacing={3} align="center">
                      <Heading size="sm">{t.label || `${t.day}`}</Heading>
                      {t.mode === 'exam' && (
                        <Badge size="sm" colorScheme="green" variant="subtle" rounded="full">Exam</Badge>
                      )}
                    </HStack>
                  <HStack color={subtle} fontSize="sm">
                      <Badge colorScheme="purple" variant="subtle" rounded="full">Rooms: {t.rooms.length}</Badge>
                      <Badge colorScheme="teal" variant="subtle" rounded="full">
                        Blocks: {(() => { const set = new Set(); ['Morning','Afternoon','Evening'].forEach(ses => { t.rooms.forEach(r => { (t.matrix[ses]?.get(r) || new Map()).forEach((_, b) => set.add(b)); }); }); return set.size; })()}
                      </Badge>
                      {roomParts.length > 1 && <Badge colorScheme="blue" variant="subtle" rounded="full">Split view</Badge>}
                    </HStack>
                  </HStack>
                </Box>

                {roomParts.map((roomsSlice, partIdx) => (
                  <Box key={`${t.day}-part-${partIdx}`}>
                    {roomParts.length > 1 && (
                      <Box px={4} py={2} bg={useColorModeValue('white','gray.900')} borderTopWidth={partIdx===0? '0':'1px'} borderColor={border}>
                        <Text fontSize="sm" color={subtle}>Rooms {partIdx+1} of {roomParts.length}</Text>
                      </Box>
                    )}
                    <TableForRooms day={t.day} rooms={roomsSlice} matrix={t.matrix} indexLabel={partIdx+1} />
                  </Box>
                ))}

                {/* Page break between days for print */}
                <Box h="1px" className="print-break" />
              </Box>
            );
          })}
        </Box>
      </Box>

      <style>{`
        .doc-viewer { background: transparent; }
        @media print {
          @page { size: 8.5in 13in landscape; margin: 8mm; }
          .no-print { display: none !important; }
          .print-break { page-break-after: always; }
          html, body { background: white !important; }
          .doc-viewer { padding: 0 !important; }
          .doc-viewer > div { width: 100% !important; }
          .doc-viewer table { table-layout: fixed !important; width: 100% !important; border-spacing: 0 !important; }
          .doc-viewer th, .doc-viewer td { padding: 4px 6px !important; font-size: 11px !important; word-wrap: break-word; white-space: normal; overflow-wrap: anywhere; position: static !important; }
          .doc-viewer th { min-width: 100px !important; }
          .doc-viewer h1, .doc-viewer h2, .doc-viewer h3, .doc-viewer h4 { font-size: 14px !important; margin: 0 0 4px !important; }
          /* Fit the content to printable width */
          .doc-viewer > div { width: 100% !important; }
          /* Avoid truncation of long labels */
          th, td { word-wrap: break-word; white-space: normal; }
        }
      `}</style>
    </Box>
  );
}
