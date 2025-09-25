// Test script to verify API integration
// Run with: node test-api-integration.js

const API_BASE_URL = "http://localhost:3000/api/schedules";

async function testApiIntegration() {
  console.log("🧪 Testing API Integration...\n");

  try {
    // Test 1: Basic connectivity
    console.log("1. Testing basic connectivity...");
    const response = await fetch(`${API_BASE_URL}/health`);
    if (response.ok) {
      const health = await response.json();
      console.log("✅ Health check passed:", health);
    } else {
      throw new Error(`Health check failed: ${response.status}`);
    }

    // Test 2: Get all schedules
    console.log("\n2. Testing get all schedules...");
    const schedulesResponse = await fetch(`${API_BASE_URL}/`);
    if (schedulesResponse.ok) {
      const schedules = await schedulesResponse.json();
      console.log(
        `✅ Schedules endpoint working. Found ${
          schedules.data?.length || schedules.length || 0
        } schedules`
      );
    } else {
      throw new Error(`Schedules endpoint failed: ${schedulesResponse.status}`);
    }

    // Test 3: Get schedule statistics
    console.log("\n3. Testing schedule statistics...");
    const statsResponse = await fetch(`${API_BASE_URL}/stats`);
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log("✅ Stats endpoint working:", stats);
    } else {
      throw new Error(`Stats endpoint failed: ${statsResponse.status}`);
    }

    // Test 4: Test filtering
    console.log("\n4. Testing filtering...");
    const filterResponse = await fetch(`${API_BASE_URL}/?term=1st`);
    if (filterResponse.ok) {
      const filtered = await filterResponse.json();
      console.log(
        `✅ Filtering working. Found ${
          filtered.data?.length || filtered.length || 0
        } schedules for 1st term`
      );
    } else {
      throw new Error(`Filtering failed: ${filterResponse.status}`);
    }

    // Test 5: Test grouping
    console.log("\n5. Testing grouping by program...");
    const groupResponse = await fetch(`${API_BASE_URL}/grouped/program`);
    if (groupResponse.ok) {
      const grouped = await groupResponse.json();
      console.log(
        "✅ Grouping working:",
        Object.keys(grouped || {}).length,
        "programs found"
      );
    } else {
      throw new Error(`Grouping failed: ${groupResponse.status}`);
    }

    console.log("\n🎉 All API integration tests passed!");
    console.log(
      "✅ Your frontend should now seamlessly integrate with the backend API."
    );
  } catch (error) {
    console.error("\n❌ API integration test failed:", error.message);
    console.log("\n🔧 Troubleshooting steps:");
    console.log("1. Make sure your backend server is running on port 3000");
    console.log("2. Check if the API endpoints are accessible");
    console.log("3. Verify CORS settings allow your frontend domain");
    console.log("4. Check the browser console for detailed error messages");
  }
}

// Run the test
testApiIntegration();
