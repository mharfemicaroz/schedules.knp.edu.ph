import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  useColorModeValue,
  Badge,
  Tag,
  TagLabel,
  Icon,
  Spinner,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Progress,
  Divider,
} from '@chakra-ui/react';
import { FiCalendar, FiFlag, FiBookOpen, FiCheckCircle } from 'react-icons/fi';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import apiService from '../services/apiService';

function parseDate(val) {
  if (!val) return null;
  if (Array.isArray(val)) return val.map(parseDate).filter(Boolean);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(d) {
  if (!d) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    weekday: 'short',
  });
}

function sanitize(str) {
  // Remove stray backslashes and non-printable characters
  return String(str ?? '')
    .replace(/\\/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .trim();
}

/** Make this global so all components can use it */
function expandDateRangeToken(token) {
  const m = String(token || '').match(/^(\w+)\s+(\d+)-(\d+),\s*(\d{4})$/);
  if (!m) return [];
  const month = m[1];
  const startD = parseInt(m[2], 10);
  const endD = parseInt(m[3], 10);
  const year = parseInt(m[4], 10);
  const start = new Date(`${month} ${startD}, ${year}`);
  if (isNaN(start.getTime())) return [];
  const out = [];
  for (let d = startD; d <= endD; d++) {
    const dt = new Date(`${month} ${d}, ${year}`);
    if (!isNaN(dt.getTime())) out.push(dt);
  }
  return out;
}

function EventRow({ event }) {
  const subtle = useColorModeValue('gray.600', 'gray.400');
  const baseIconColor = useColorModeValue('brand.600', 'brand.300');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = event.start || (Array.isArray(event.date) ? parseDate(event.date[0]) : parseDate(event.date));
  const end = event.end || (Array.isArray(event.date) ? parseDate(event.date[event.date.length - 1]) : parseDate(event.date));
  const status = start && end
    ? (end < today ? 'past' : (start <= today && today <= end ? 'current' : 'upcoming'))
    : 'upcoming';
  const baseIcon = /exam/i.test(event.event)
    ? FiBookOpen
    : /start|enrol/i.test(event.event)
    ? FiFlag
    : /submission|grades/i.test(event.event)
    ? FiCheckCircle
    : FiCalendar;
  const icon = status === 'past' ? FiCheckCircle : baseIcon;
  const iconColor = status === 'past' ? 'green.400' : status === 'current' ? 'orange.400' : baseIconColor;
  const titleDecor = status === 'past' ? 'line-through' : 'none';
  const leftBorder = status === 'current' ? '4px solid' : '0';
  const leftBorderColor = status === 'current' ? 'orange.400' : 'transparent';
  return (
    <HStack align="start" spacing={4} py={2} borderLeft={leftBorder} borderLeftColor={leftBorderColor} pl={3}>
      <Icon as={icon} color={iconColor} boxSize={5} mt={1} />
      <VStack align="start" spacing={0} flex={1}>
        <Text fontWeight="600" textDecoration={titleDecor}>{sanitize(event.event)}</Text>
        {event.date_range ? (
          <Text fontSize="sm" color={subtle}>
            {sanitize(event.date_range)}
          </Text>
        ) : Array.isArray(event.date) ? (
          <Text fontSize="sm" color={subtle}>
            {event.date.map((d) => formatDate(parseDate(d))).join(' • ')}
          </Text>
        ) : (
          <Text fontSize="sm" color={subtle}>{formatDate(parseDate(event.date))}</Text>
        )}
      </VStack>
    </HStack>
  );
}

function TermCard({ title, start, end, activities }) {
  const border = useColorModeValue('gray.200', 'gray.700');
  const bg = useColorModeValue('white', 'gray.800');
  const subtle = useColorModeValue('gray.600', 'gray.400');
  const now = new Date();
  const ds = parseDate(start);
  const de = parseDate(end);

  const progress = useMemo(() => {
    if (!(ds && de)) return 0;
    const total = de - ds;
    const elapsed = Math.min(Math.max(now - ds, 0), total);
    return total > 0 ? Math.round((elapsed / total) * 100) : 0;
  }, [ds, de, now]);

  const timeline = useMemo(() => {
    const out = [];
    const dayMs = 24 * 60 * 60 * 1000;
    function enumerateWeeks(rangeStart, rangeEnd, startIndex) {
      const items = [];
      if (!(rangeStart && rangeEnd) || rangeEnd < rangeStart) return items;
      let idx = startIndex;
      let cur = new Date(rangeStart);
      cur.setHours(0, 0, 0, 0);
      const endLim = new Date(rangeEnd);
      endLim.setHours(0, 0, 0, 0);
      while (cur <= endLim) {
        const wd = cur.getDay();
        const daysToSun = (7 - wd) % 7;
        let wkEnd = new Date(cur.getTime() + daysToSun * dayMs);
        if (wkEnd > endLim) wkEnd = endLim;
        items.push({ event: `Week ${idx}`, date_range: `${formatDate(cur)} - ${formatDate(wkEnd)}`, start: new Date(cur), end: new Date(wkEnd) });
        idx += 1;
        cur = new Date(wkEnd.getTime() + dayMs);
      }
      return { items, nextIndex: idx };
    }
    let lastPointer = ds || null;
    let weekIndex = 1;
    (activities || []).forEach((a) => {
      const name = sanitize(a.event || '');
      // derive start/end for activity
      let aStart = null;
      let aEnd = null;
      if (a.date_range) {
        const arr = expandDateRangeToken(sanitize(a.date_range));
        if (arr.length) {
          aStart = arr[0];
          aEnd = arr[arr.length - 1];
        }
      } else if (Array.isArray(a.date)) {
        const arr = a.date.map(parseDate).filter(Boolean).sort((x, y) => x - y);
        if (arr.length) {
          aStart = arr[0];
          aEnd = arr[arr.length - 1];
        }
      } else if (a.date) {
        const d = parseDate(a.date);
        if (d) aStart = aEnd = d;
      }
      const isExam = /exam/i.test(name);
      if (isExam) {
        const parsed = parseDate(a.date);
        const firstExam = Array.isArray(parsed) ? parsed[0] : parsed;
        if (firstExam && lastPointer) {
          const until = new Date(firstExam.getTime() - dayMs);
          const { items, nextIndex } = enumerateWeeks(lastPointer, until, weekIndex);
          out.push(...items);
          weekIndex = nextIndex;
        }
        out.push({ ...a, start: aStart || firstExam, end: aEnd || firstExam });
        const lastExam = Array.isArray(parsed) ? parsed[parsed.length - 1] : parsed;
        if (lastExam) lastPointer = new Date(lastExam.getTime() + dayMs);
        return;
      }
      out.push({ ...a, start: aStart, end: aEnd });
      if (/start of classes/i.test(name)) {
        const d = parseDate(a.date);
        const first = Array.isArray(d) ? d[0] : d;
        if (first) lastPointer = first;
      }
    });
    if (lastPointer && de && lastPointer <= de) {
      const { items } = enumerateWeeks(lastPointer, de, weekIndex);
      out.push(...items);
    }
    return out;
  }, [activities, ds, de]);

  return (
    <Box borderWidth="1px" borderColor={border} bg={bg} rounded="xl" p={4}>
      <HStack justify="space-between" mb={2}>
        <HStack>
          <Icon as={FiCalendar} />
          <Heading size="sm">{title}</Heading>
        </HStack>
        <Tag colorScheme="brand" variant="subtle">
          <TagLabel>{progress}%</TagLabel>
        </Tag>
      </HStack>
      <Text fontSize="sm" color={subtle} mb={2}>
        {formatDate(ds)} - {formatDate(de)}
      </Text>
      <Progress value={progress} size="sm" colorScheme="brand" rounded="md" mb={3} />
      <Divider my={3} />
      <VStack align="stretch" spacing={1}>
        {timeline.map((a, idx) => (
          <EventRow key={idx} event={a} />
        ))}
      </VStack>
    </Box>
  );
}

export default function AcademicCalendar() {
  const [data, setData] = useState(null);
  const [holidays, setHolidays] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const calendarRef = useRef(null);
  const [calendarKey, setCalendarKey] = useState(0);

  useEffect(() => {
    let mounted = true;

    // Load both academic calendar and holidays data from API
    const loadData = async () => {
      try {
        const [acadJson, holidaysArr] = await Promise.all([
          apiService.getAcademicCalendar(),
          apiService.getHolidays(2025)
        ]);

        if (!mounted) return;

        setData(acadJson.data || acadJson);
        setHolidays(Array.isArray(holidaysArr) ? holidaysArr : []);
        setLoading(false);
      } catch (e) {
        if (!mounted) return;
        setError(e);
        setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  // Force calendar to re-render and update size when tab changes
  const handleTabChange = useCallback((index) => {
    setActiveTab(index);
    if (index === 1) {
      // Force calendar to re-render with new key
      setCalendarKey(prev => prev + 1);
    }
  }, []);

  // Update calendar size when tab becomes active
  useEffect(() => {
    if (activeTab === 1) {
      const updateSize = () => {
        if (calendarRef.current) {
          const calendarApi = calendarRef.current.getApi();
          calendarApi.updateSize();
        }
      };

      // Use requestAnimationFrame for better timing
      const timer = setTimeout(() => {
        requestAnimationFrame(updateSize);
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [activeTab, calendarKey]);

  // Also listen for window resize to update calendar size
  useEffect(() => {
    const handleResize = () => {
      if (calendarRef.current && activeTab === 1) {
        const calendarApi = calendarRef.current.getApi();
        calendarApi.updateSize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]);

  const subtle = useColorModeValue('gray.600', 'gray.400');
  const cal = (data && Array.isArray(data) ? data[0]?.academic_calendar : null) || {};
  const sy = sanitize(cal.school_year);
  const first = cal.first_semester || {};
  const firstTerm = first.first_term || {};
  const secondTerm = first.second_term || {};

  function collectEvents() {
    const events = [];
    const buckets = [
      { term: 'First Term', obj: firstTerm },
      { term: 'Second Term', obj: secondTerm },
    ];
    buckets.forEach(({ term, obj }) => {
      const list = obj.activities || [];
      list.forEach((a) => {
        const title = sanitize(a.event || '');
        let dates = [];
        if (a.date_range) {
          dates = expandDateRangeToken(sanitize(a.date_range));
        } else if (Array.isArray(a.date)) {
          dates = a.date.map((d) => parseDate(d)).filter(Boolean);
        } else if (a.date) {
          const d = parseDate(a.date);
          if (d) dates = [d];
        }
        if (dates.length === 0) return;
        dates.forEach((d) => {
          events.push({ date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), title, term });
        });
      });
    });
    return events;
  }

  const allEvents = useMemo(() => collectEvents(), [data]); // (kept for possible future use)
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const cardBg = useColorModeValue('white', 'gray.800');
  const eventText = useColorModeValue('#1A202C', '#E2E8F0');

  function typeColor(title) {
    const t = String(title).toLowerCase();
    if (t.includes('prelim') || t.includes('midterm') || t.includes('final')) return 'pink.400';
    if (t.includes('enrol')) return 'purple.400';
    if (t.includes('start')) return 'green.400';
    if (t.includes('submission') || t.includes('grades')) return 'blue.400';
    return 'brand.400';
  }

  // Generate itemized weeks for calendar view
  const generateItemizedWeeks = useMemo(() => {
    const weeks = [];
    const dayMs = 24 * 60 * 60 * 1000;

    function enumerateWeeks(rangeStart, rangeEnd, startIndex, term) {
      const items = [];
      if (!(rangeStart && rangeEnd) || rangeEnd < rangeStart) return items;
      let idx = startIndex;
      let cur = new Date(rangeStart);
      cur.setHours(0, 0, 0, 0);
      const endLim = new Date(rangeEnd);
      endLim.setHours(0, 0, 0, 0);
      while (cur <= endLim) {
        const wd = cur.getDay();
        const daysToSun = (7 - wd) % 7;
        let wkEnd = new Date(cur.getTime() + daysToSun * dayMs);
        if (wkEnd > endLim) wkEnd = endLim;
        items.push({
          title: `📅 ${term} - Week ${idx}`,
          start: new Date(cur),
          end: new Date(wkEnd.getTime() + dayMs),
          allDay: true,
          display: 'block',
          backgroundColor: 'var(--chakra-colors-teal-400)',
          borderColor: 'var(--chakra-colors-teal-400)',
          classNames: ['fc-event--week'],
          extendedProps: {
            isWeek: true,
            weekNumber: idx,
            term: term
          }
        });
        idx += 1;
        cur = new Date(wkEnd.getTime() + dayMs);
      }
      return { items, nextIndex: idx };
    }

    const firstStart = parseDate(firstTerm.start);
    const firstEnd = parseDate(firstTerm.end);
    const secondStart = parseDate(secondTerm.start);
    const secondEnd = parseDate(secondTerm.end);

    let weekIndex = 1;

    // Generate weeks for First Term
    if (firstStart && firstEnd) {
      const { items, nextIndex } = enumerateWeeks(firstStart, firstEnd, weekIndex, 'First Term');
      weeks.push(...items);
      weekIndex = nextIndex;
    }

    // Generate weeks for Second Term
    if (secondStart && secondEnd) {
      const { items } = enumerateWeeks(secondStart, secondEnd, weekIndex, 'Second Term');
      weeks.push(...items);
    }

    return weeks;
  }, [firstTerm, secondTerm]);

  const fcEvents = useMemo(() => {
    const events = [];
    const buckets = [
      { term: 'First Term', obj: firstTerm },
      { term: 'Second Term', obj: secondTerm },
    ];
    const dayMs = 24 * 60 * 60 * 1000;

    function pushSpan(title, term, startDate, endDateInclusive) {
      const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const end = new Date(
        endDateInclusive.getFullYear(),
        endDateInclusive.getMonth(),
        endDateInclusive.getDate() + 1
      );
      const color = typeColor(title);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const status = end < today ? 'past' : (start <= today && today < end ? 'current' : 'upcoming');
      const bgVar = status === 'past' ? 'gray-400' : color.replace('.', '-');
      const classes = [status === 'past' ? 'fc-event--past' : '', status === 'current' ? 'fc-event--current' : ''].filter(Boolean);
      events.push({
        title: `${title}`,
        start,
        end,
        allDay: true,
        display: 'block',
        backgroundColor: `var(--chakra-colors-${bgVar})`,
        borderColor: `var(--chakra-colors-${bgVar})`,
        classNames: classes,
      });
    }

    buckets.forEach(({ term, obj }) => {
      const list = obj.activities || [];
      list.forEach((a) => {
        const title = sanitize(a.event || '');
        if (a.date_range) {
          const range = expandDateRangeToken(sanitize(a.date_range));
          if (range.length) pushSpan(`${title} (${term})`, term, range[0], range[range.length - 1]);
          return;
        }
        let dates = [];
        if (Array.isArray(a.date)) dates = a.date.map((d) => parseDate(d)).filter(Boolean);
        else if (a.date) {
          const d = parseDate(a.date);
          if (d) dates = [d];
        }
        if (!dates.length) return;
        dates.sort((a, b) => a - b);
        let i = 0;
        while (i < dates.length) {
          let j = i;
          while (j + 1 < dates.length && dates[j + 1] - dates[j] === dayMs) j++;
          pushSpan(`${title} (${term})`, term, dates[i], dates[j]);
          i = j + 1;
        }
      });
    });

    // Add itemized weeks to calendar events
    events.push(...generateItemizedWeeks);

    // Add holidays to calendar events
    if (holidays && Array.isArray(holidays)) {
      holidays.forEach((holiday) => {
        const holidayDate = parseDate(holiday.date);
        if (holidayDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const status = holidayDate < today ? 'past' : (holidayDate.getTime() === today.getTime() ? 'current' : 'upcoming');
          const isRegularHoliday = holiday.type && holiday.type.toLowerCase().includes('regular');
          const bgColor = status === 'past' ? 'gray.400' :
                         isRegularHoliday ? 'red.400' : 'orange.400';

          events.push({
            title: `🏖️ ${holiday.name}`,
            start: holidayDate,
            end: new Date(holidayDate.getTime() + dayMs), // Make it span the day
            allDay: true,
            display: 'block',
            backgroundColor: `var(--chakra-colors-${bgColor.replace('.', '-')})`,
            borderColor: `var(--chakra-colors-${bgColor.replace('.', '-')})`,
            classNames: ['fc-event--holiday', status === 'past' ? 'fc-event--past' : '', status === 'current' ? 'fc-event--current' : ''].filter(Boolean),
            extendedProps: {
              isHoliday: true,
              holidayType: holiday.type
            }
          });
        }
      });
    }

    return events;
  }, [firstTerm, secondTerm, holidays, generateItemizedWeeks]);

  if (loading)
    return (
      <HStack justify="center" py={10}>
        <Spinner /> <Text color={subtle}>Loading calendar…</Text>
      </HStack>
    );

  if (error)
    return (
      <VStack py={10}>
        <Text color="red.500">Failed to load academic calendar.</Text>
        <Text fontSize="sm" color={subtle}>
          {String(error)}
        </Text>
      </VStack>
    );

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Academic Calendar</Heading>
        <HStack spacing={2}>
          {sy && (
            <Badge colorScheme="brand" fontSize="0.9em">
              SY {sy}
            </Badge>
          )}
          {holidays && holidays.length > 0 && (
            <Badge colorScheme="red" variant="subtle" fontSize="0.9em">
              {holidays.length} Holidays
            </Badge>
          )}
        </HStack>
      </HStack>

      <Tabs variant="enclosed-colored" colorScheme="brand" index={activeTab} onChange={handleTabChange}>
        <TabList>
          <Tab>List</Tab>
          <Tab>Calendar</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <Tabs variant="enclosed" colorScheme="brand">
              <TabList>
                <Tab>First Term</Tab>
                <Tab>Second Term</Tab>
              </TabList>
              <TabPanels>
                <TabPanel px={0}>
                  <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                    <TermCard title="First Term" start={firstTerm.start} end={firstTerm.end} activities={firstTerm.activities || []} />
                  </SimpleGrid>
                </TabPanel>
                <TabPanel px={0}>
                  <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                    <TermCard title="Second Term" start={secondTerm.start} end={secondTerm.end} activities={secondTerm.activities || []} />
                  </SimpleGrid>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </TabPanel>

          <TabPanel px={0}>
            <Box
              borderWidth="1px"
              borderColor={cardBorder}
              rounded="xl"
              overflow="hidden"
              bg={cardBg}
              minHeight="700px"
              position="relative"
            >
              <FullCalendar
                key={calendarKey}
                ref={calendarRef}
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                height="100%"
                expandRows={true}
                headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                weekNumbers={false}
                dayMaxEvents={4}
                fixedWeekCount={false}
                events={fcEvents}
                eventTextColor={eventText}
                contentHeight="auto"
                eventDisplay="block"
                displayEventTime={false}
                eventMouseEnter={(info) => {
                  if (info.event.extendedProps.isHoliday) {
                    info.el.title = `${info.event.title.replace('🏖️ ', '')} - ${info.event.extendedProps.holidayType}`;
                  } else if (info.event.extendedProps.isWeek) {
                    info.el.title = `${info.event.title.replace('📅 ', '')} - Week ${info.event.extendedProps.weekNumber}`;
                  }
                }}
              />
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
