# API Integration Documentation

This document describes the seamless integration between the frontend React application and the backend API endpoints.

## Overview

The frontend has been updated to integrate with the server API endpoints at `/api/schedules`, providing real-time data access, advanced filtering, and improved performance while maintaining backward compatibility with existing features.

## Architecture

### API Service Layer (`src/services/apiService.js`)
- Centralized service for all API communications
- Handles request/response formatting
- Provides error handling and retry logic
- Uses configuration from `src/config/apiConfig.js`

### Data Context Updates (`src/context/DataContext.jsx`)
- Enhanced to use API calls instead of static files
- Maintains existing data structure for compatibility
- Adds server-side filtering and pagination capabilities
- Includes fallback to static files if API is unavailable

### Configuration (`src/config/apiConfig.js`)
- Environment-based configuration
- Timeout and retry settings
- Feature flags for different capabilities

## API Endpoints Integration

### Core Endpoints
- `GET /api/schedules` - Get all schedules with filtering/pagination
- `GET /api/schedules/stats` - Get schedule statistics
- `GET /api/schedules/grouped/program` - Grouped by program
- `GET /api/schedules/grouped/department` - Grouped by department

### CRUD Operations
- `POST /api/schedules` - Create new schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule
- `POST /api/schedules/bulk` - Bulk create schedules

### Specialized Endpoints
- `GET /api/schedules/instructor/:instructor` - Get schedules by instructor
- `GET /api/schedules/room/:room` - Get schedules by room
- `GET /api/schedules/department/:dept` - Get schedules by department
- `GET /api/schedules/program/:programcode` - Get schedules by program

## Features

### Enhanced Filtering
- Server-side filtering for better performance
- Client-side filtering as fallback
- Advanced search capabilities
- Filter by instructor, room, department, program, term, etc.

### Real-time Data
- Automatic data refresh capabilities
- Live updates from server
- Fallback to cached data when offline

### Error Handling
- Graceful degradation when API is unavailable
- User-friendly error messages
- Automatic retry mechanisms

### Performance Improvements
- Server-side pagination
- Efficient data transformation
- Optimized API calls

## Usage

### Basic Data Loading
```javascript
import { useData } from './context/DataContext';

// In your component
const { data, loading, error, refreshData } = useData();
```

### API Filtering
```javascript
const { applyApiFilters, clearApiFilters } = useData();

// Apply filters
applyApiFilters({
  instructor: 'John Doe',
  term: '1st',
  room: 'Room 101'
});

// Clear filters
clearApiFilters();
```

### Direct API Calls
```javascript
import apiService from './services/apiService';

// Get faculty schedules
const facultySchedules = await apiService.getFacultySchedules('John Doe');

// Get room utilization
const utilization = await apiService.getRoomUtilization('Room 101');
```

## Configuration

### Environment Variables
Create a `.env` file based on `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:3000/api/schedules
NODE_ENV=development
```

### Feature Flags
Modify `src/config/apiConfig.js` to enable/disable features:

```javascript
ENABLE_API_FILTERING: true,
ENABLE_REAL_TIME_UPDATES: false,
ENABLE_OFFLINE_MODE: true,
```

## Backward Compatibility

- All existing components continue to work without changes
- Data structure remains the same
- Existing filtering and pagination logic preserved
- Static file fallback ensures reliability

## Error Handling

The integration includes comprehensive error handling:

1. **Network Errors**: Automatic retry with exponential backoff
2. **Server Errors**: User-friendly error messages
3. **Timeout**: Configurable timeout with fallback
4. **Validation Errors**: Client-side validation before API calls

## Testing

### Manual Testing
1. Start the backend server
2. Start the frontend development server
3. Verify data loads from API instead of static files
4. Test filtering and search functionality
5. Test error scenarios (disconnect API, invalid data)

### Automated Testing
Add tests for:
- API service functions
- Data transformation logic
- Error handling scenarios
- Fallback mechanisms

## Deployment

### Production
1. Set `NODE_ENV=production` in environment
2. Configure production API base URL
3. Ensure CORS is properly configured on backend
4. Test with production data

### Development
1. Use `.env` file for local configuration
2. Backend should run on `http://localhost:3000`
3. Frontend on `http://localhost:5173`

## Troubleshooting

### Common Issues

1. **API Connection Failed**
   - Check if backend server is running
   - Verify API base URL configuration
   - Check CORS settings

2. **Data Not Loading**
   - Check browser console for errors
   - Verify API endpoints are accessible
   - Check network connectivity

3. **Filtering Not Working**
   - Ensure API filtering is enabled
   - Check filter parameter names match API expectations
   - Verify data transformation logic

### Debug Mode
Enable debug logging by setting:
```javascript
console.log('API Debug:', response);
```

## Future Enhancements

- Real-time WebSocket integration
- Advanced caching strategies
- Batch API operations
- Data synchronization features
- Mobile app integration

## Support

For issues related to API integration:
1. Check this documentation
2. Review browser console errors
3. Verify backend API is functioning
4. Check network connectivity
5. Contact development team with specific error details
