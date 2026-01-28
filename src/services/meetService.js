import apiService from './apiService';

/**
 * @typedef {Object} MeetEvent
 * @property {string} timestamp
 * @property {string} meetingCode
 * @property {string} conferenceId
 * @property {string} eventName
 * @property {string} description
 * @property {string} actorEmail
 * @property {string} orgUnit
 * @property {string} ipAddress
 * @property {string} deviceType
 * @property {number|null} participantCountDelta
 */

/**
 * @typedef {Object} MeetClass
 * @property {string} meetingKey
 * @property {string} meetingCode
 * @property {string} conferenceId
 * @property {string} status
 * @property {string} lastActivityAt
 * @property {number} activeParticipantsEstimate
 * @property {number} confidenceScore
 * @property {string} reason
 * @property {string} actorEmail
 * @property {string} orgUnit
 * @property {string} recentEvent
 * @property {number} eventCount
 * @property {number|null} mappedFacultyId
 * @property {string} mappedFacultyName
 * @property {string} mappedFacultyEmail
 */

/**
 * @typedef {Object} MeetClassesResponse
 * @property {MeetClass[]} items
 * @property {string|null} nextPageToken
 * @property {string} generatedAt
 * @property {{ totalEvents: number, totalMeetings: number }} [stats]
 * @property {{ page: number, perPage: number, totalItems: number, totalPages: number, startItem: number, endItem: number, hasPrevPage: boolean, hasNextPage: boolean }} [pagination]
 * @property {string} [cacheStatus]
 */

/**
 * @typedef {Object} MeetTimelineResponse
 * @property {string} conferenceId
 * @property {MeetEvent[]} items
 * @property {string} generatedAt
 */

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    qs.set(key, String(value));
  });
  const out = qs.toString();
  return out ? `?${out}` : '';
}

/**
 * @param {{ from?: string, to?: string, ou?: string, status?: 'live'|'all', pageToken?: string, pageSize?: number, page?: number, perPage?: number }} params
 * @returns {Promise<MeetClassesResponse>}
 */
export async function listMeetClasses(params = {}) {
  const query = buildQuery(params);
  return apiService.requestAbs(`/meet/classes${query}`, { method: 'GET' });
}

/**
 * @param {{ ou?: string, from?: string, to?: string, page?: number, perPage?: number }} params
 * @returns {Promise<MeetClassesResponse>}
 */
export async function listMeetLiveClasses(params = {}) {
  const query = buildQuery(params);
  return apiService.requestAbs(`/meet/classes/live${query}`, { method: 'GET' });
}

/**
 * @param {{ conferenceId: string, from?: string, to?: string, ou?: string }} params
 * @returns {Promise<MeetTimelineResponse>}
 */
export async function getMeetTimeline(params) {
  const { conferenceId, ...rest } = params || {};
  const query = buildQuery(rest);
  return apiService.requestAbs(`/meet/classes/${encodeURIComponent(conferenceId)}${query}`, { method: 'GET' });
}

/**
 * @param {{ meetCode: string, facultyId: number|null }} payload
 * @returns {Promise<{ item: { meetCode: string, facultyId?: number, facultyName?: string, facultyEmail?: string, deleted?: boolean } }>}
 */
export async function upsertMeetMapping(payload) {
  return apiService.requestAbs('/meet/mappings', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

