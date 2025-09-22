# Role-Based Sidebar Menu Implementation

## Plan Implementation Steps

### 1. Create visitor context/hook to manage visitor role state
- [x] Create separate VisitorContext for role management
- [x] Create function to fetch visitor role from server
- [x] Add role state and setter to context

### 2. Add role retrieval functionality
- [x] Create utility function to get visitor role from server API
- [x] Handle IP-based role retrieval
- [x] Add error handling for role fetch

### 3. Modify Sidebar component
- [x] Import visitor role from context
- [x] Add conditional rendering logic
- [x] Show only "Classroom Assignment" and "Academic Calendar" for students
- [x] Show all menu items for other roles

### 4. Update FirstVisitModal
- [x] Trigger role state update after successful submission
- [x] Refresh role data when visitor info is submitted

### 5. Testing
- [ ] Test role-based menu visibility
- [ ] Verify student role restrictions
- [ ] Ensure other roles see all items
