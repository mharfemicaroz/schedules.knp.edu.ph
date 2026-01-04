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
  return String(str ?? '')
    .replace(/\\/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .trim();
}

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

function earliestLatestFromActivities(list = []) {
  const dates = [];
  list.forEach((a) => {
    if (a.date_range) {
      const arr = expandDateRangeToken(sanitize(a.date_range));
      if (arr.length) {
        dates.push(arr[0]);
        dates.push(arr[arr.length - 1]);
      }
      return;
    }
    if (Array.isArray(a.date)) {
      a.date.map(parseDate).filter(Boolean).forEach((d) => dates.push(d));
    } else if (a.date) {
      const d = parseDate(a.date);
      if (d) dates.push(d);
    }
  });
  if (!dates.length) return { start: null, end: null };
  dates.sort((a, b) => a - b);
  return { start: dates[0], end: dates[dates.length - 1] };
}

function buildTermsFromCalendar(calRaw) {
  const cal = calRaw || {};
  const terms = [];

  const pushTerm = (semester, term, node = {}, extras = {}) => {
    if (!node) return;
    const activities = Array.isArray(node.activities) ? node.activities : [];
    if (!node.start && !extras.start && activities.length === 0) return;
    terms.push({
      id: `${semester}-${term}`,
      semester,
      term,
      start: node.start || extras.start || null,
      end: node.end || extras.end || null,
      activities,
    });
  };

  if (cal.first_semester) {
    pushTerm('1st Semester', 'First Term', cal.first_semester.first_term);
    pushTerm('1st Semester', 'Second Term', cal.first_semester.second_term);
  }

  if (cal.second_semester) {
    const sem = cal.second_semester;
    pushTerm('2nd Semester', 'First Term', sem.first_term);
    pushTerm('2nd Semester', 'Second Term', sem.second_term);

    if (Array.isArray(sem.pre_semester_activities) && sem.pre_semester_activities.length) {
      const { start, end } = earliestLatestFromActivities(sem.pre_semester_activities);
      pushTerm('2nd Semester', 'Pre-Semester', { activities: sem.pre_semester_activities, start, end });
    }

    if (Array.isArray(sem.enrollment_period) && sem.enrollment_period.length) {
      const { start, end } = earliestLatestFromActivities(sem.enrollment_period);
      pushTerm('2nd Semester', 'Enrollment', { activities: sem.enrollment_period, start, end });
    }
  }

  if (cal.summer?.term) {
    const term = cal.summer.term;
    const derived = { ...term };
    if (!derived.start || !derived.end) {
      const { start, end } = earliestLatestFromActivities(term.activities || []);
      derived.start = derived.start || start;
      derived.end = derived.end || end;
    }
    pushTerm('Summer', 'Summer Term', derived);
  }

  return terms;
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
  const activityList = Array.isArray(activities) ? activities : [];

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
      {activityList.length === 0 ? (
        <Text fontSize="sm" color={subtle}>No activities listed for this term yet.</Text>
      ) : (
        <VStack align="stretch" spacing={1}>
          {activityList.map((a, idx) => (
            <EventRow key={idx} event={a} />
          ))}
        </VStack>
      )}
    </Box>
  );
}

export default function AcademicCalendar() {
  const [data, setData] = useState(null);
  const [holidays, setHolidays] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [semesterFilter, setSemesterFilter] = useState('all');
  const calendarRef = useRef(null);
  const [calendarKey, setCalendarKey] = useState(0);

  useEffect(() => {
    let mounted = true;
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
    return () => { mounted = false; };
  }, []);

  const handleTabChange = useCallback((index) => {
    setActiveTab(index);
    if (index === 1) setCalendarKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (activeTab === 1) {
      const timer = setTimeout(() => {
        if (calendarRef.current) {
          calendarRef.current.getApi().updateSize();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeTab, calendarKey]);

  useEffect(() => {
    const onResize = () => {
      if (calendarRef.current && activeTab === 1) {
        calendarRef.current.getApi().updateSize();
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeTab]);

  const subtle = useColorModeValue('gray.600', 'gray.400');
  const cal = (data && Array.isArray(data) ? data[0]?.academic_calendar : null) || {};
  const sy = sanitize(cal.school_year);
  const terms = useMemo(() => buildTermsFromCalendar(cal), [cal]);
  const filteredTerms = useMemo(
    () => terms.filter(t => semesterFilter === 'all' ? true : t.semester === semesterFilter),
    [terms, semesterFilter]
  );
  const groupedBySemester = useMemo(() => {
    const map = new Map();
    filteredTerms.forEach((t) => {
      if (!map.has(t.semester)) map.set(t.semester, []);
      map.get(t.semester).push(t);
    });
    const order = ['1st Semester', '2nd Semester', 'Summer'];
    return order
      .filter((s) => map.has(s))
      .map((s) => ({ semester: s, items: map.get(s) }));
  }, [filteredTerms]);

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

  const fcEvents = useMemo(() => {
    const events = [];
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
    terms.forEach((t) => {
      const list = t.activities || [];
      const termLabel = `${t.semester} - ${t.term}`;
      list.forEach((a) => {
        const title = sanitize(a.event || '');
        if (a.date_range) {
          const range = expandDateRangeToken(sanitize(a.date_range));
          if (range.length) pushSpan(`${title} (${termLabel})`, termLabel, range[0], range[range.length - 1]);
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
          pushSpan(`${title} (${termLabel})`, termLabel, dates[i], dates[j]);
          i = j + 1;
        }
      });
    });
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
            title: `${holiday.name}`,
            start: holidayDate,
            end: new Date(holidayDate.getTime() + dayMs),
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
  }, [terms, holidays]);

  const filteredEvents = useMemo(
    () => fcEvents.filter(e => semesterFilter === 'all' ? true : (e.title || '').includes(semesterFilter)),
    [fcEvents, semesterFilter]
  );

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
      <Text fontSize="sm" color={subtle} mb={4}>
        Pick a semester filter to see a friendly list of term timelines or browse events on the calendar. Holidays are also shown on the calendar.
      </Text>

      <Tabs variant="enclosed-colored" colorScheme="brand" index={activeTab} onChange={handleTabChange}>
        <TabList>
          <Tab>List</Tab>
          <Tab>Calendar</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <HStack spacing={2} mb={3} flexWrap="wrap">
              {[
                { key: 'all', label: 'All' },
                { key: '1st Semester', label: '1st Semester' },
                { key: '2nd Semester', label: '2nd Semester' },
                { key: 'Summer', label: 'Summer' },
              ].map((opt) => (
                <Tag
                  key={opt.key}
                  cursor="pointer"
                  colorScheme={semesterFilter === opt.key ? 'brand' : 'gray'}
                  variant={semesterFilter === opt.key ? 'solid' : 'subtle'}
                  onClick={() => setSemesterFilter(opt.key)}
                >
                  <TagLabel>{opt.label}</TagLabel>
                </Tag>
              ))}
            </HStack>
            {groupedBySemester.map(section => (
              <Box key={section.semester} mb={6}>
                <HStack mb={2} spacing={3}>
                  <Heading size="sm">{section.semester}</Heading>
                  <Badge colorScheme="brand" variant="subtle">{section.items.length} term(s)</Badge>
                </HStack>
                <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                  {section.items.map((t) => (
                    <TermCard
                      key={t.id}
                      title={t.term}
                      start={t.start}
                      end={t.end}
                      activities={t.activities || []}
                    />
                  ))}
                </SimpleGrid>
              </Box>
            ))}
            {groupedBySemester.length === 0 && (
              <Box borderWidth="1px" borderColor={cardBorder} bg={cardBg} rounded="md" p={4}>
                <Text color={subtle}>No academic calendar entries found for this semester.</Text>
              </Box>
            )}
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
                events={filteredEvents}
                eventTextColor={eventText}
                contentHeight="auto"
                eventDisplay="block"
                displayEventTime={false}
                eventOrder="start"
                eventMouseEnter={(info) => {
                  if (info.event.extendedProps.isHoliday) {
                    info.el.title = `${info.event.title} - ${info.event.extendedProps.holidayType}`;
                  } else if (info.event.extendedProps.isWeek) {
                    info.el.title = `${info.event.title} - Week ${info.event.extendedProps.weekNumber}`;
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
