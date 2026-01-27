// API Configuration for seamless integration
const API_CONFIG = {
  // Base URL for API endpoints
  BASE_URL:
    import.meta.env.MODE === "production"
      ? import.meta.env.VITE_API_BASE_URL
      : "http://localhost:3000",

  // Timeout settings
  TIMEOUT: 10000, // 10 seconds

  // Retry settings
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second

  // Cache settings
  CACHE_ENABLED: true,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes

  // Feature flags
  ENABLE_API_FILTERING: true,
  ENABLE_REAL_TIME_UPDATES: false,
  ENABLE_OFFLINE_MODE: true,

  // Endpoints
  ENDPOINTS: {
    SCHEDULES: "/",
    STATS: "/stats",
    FILTERS: "/filters",
    GROUPED_PROGRAM: "/grouped/program",
    GROUPED_DEPARTMENT: "/grouped/department",
    BY_ID: "/:id",
    BY_PROGRAM: "/program/:programcode",
    BY_INSTRUCTOR: "/instructor/:instructor",
    INSTRUCTOR_LOAD: "/instructor/:instructor/load",
    BY_ROOM: "/room/:room",
    ROOM_UTILIZATION: "/room/:room/utilization",
    BY_DEPARTMENT: "/department/:dept",
    DEPARTMENT_STATS: "/department/:dept/stats",
    CREATE: "/",
    BULK_CREATE: "/bulk",
    UPDATE: "/:id",
    DELETE: "/:id",
  },

  // Default pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,

  // Error messages
  ERROR_MESSAGES: {
    NETWORK_ERROR: "Network error. Please check your connection.",
    SERVER_ERROR: "Server error. Please try again later.",
    TIMEOUT_ERROR: "Request timed out. Please try again.",
    VALIDATION_ERROR: "Invalid data provided.",
    UNAUTHORIZED: "Unauthorized access.",
    NOT_FOUND: "Resource not found.",
  },
};

export default API_CONFIG;
