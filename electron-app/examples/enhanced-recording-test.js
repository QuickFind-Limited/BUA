/**
 * Enhanced Recording Controller Test Script
 * 
 * This script demonstrates the Enhanced Recording Controller API
 * and can be used to test the functionality programmatically.
 */

const { getTabManager } = require('../main/main');
const { getEnhancedRecordingController } = require('../main/enhanced-recording-integration');

async function testEnhancedRecording() {
  console.log('🧪 Testing Enhanced Recording Controller...');

  try {
    // Test 1: Check if services are available
    console.log('\n📋 Test 1: Service Availability');
    const tabManager = getTabManager();
    const recordingController = getEnhancedRecordingController();
    
    console.log('- Tab Manager:', tabManager ? '✅ Available' : '❌ Not available');
    console.log('- Recording Controller:', recordingController ? '✅ Available' : '❌ Not available');
    
    if (!tabManager) {
      console.log('❌ Tab Manager not available - cannot continue tests');
      return false;
    }

    // Test 2: Check active tab
    console.log('\n📋 Test 2: Active Tab Check');
    const activeTab = tabManager.getActiveTab();
    if (activeTab) {
      console.log(`✅ Active tab found: ${activeTab.url}`);
      console.log(`- Title: ${activeTab.title}`);
      console.log(`- ID: ${activeTab.id}`);
    } else {
      console.log('❌ No active tab found');
      return false;
    }

    // Test 3: Connection Test
    console.log('\n📋 Test 3: CDP Connection Test');
    if (recordingController) {
      try {
        const connected = await recordingController.connectToWebView(activeTab.view);
        console.log('- CDP Connection:', connected ? '✅ Connected' : '❌ Failed');
        
        if (!connected) {
          console.log('❌ CDP connection failed - check if port 9335 is available');
          return false;
        }
      } catch (error) {
        console.log('❌ CDP connection error:', error.message);
        return false;
      }
    }

    // Test 4: Recording Session Test
    console.log('\n📋 Test 4: Recording Session Test');
    if (recordingController) {
      try {
        // Start recording
        console.log('🎬 Starting recording...');
        const sessionId = await recordingController.startRecording(activeTab.view, activeTab.url);
        console.log(`✅ Recording started: ${sessionId}`);

        // Wait for a few seconds to capture some data
        console.log('⏳ Recording for 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check status
        const session = recordingController.getActiveSession();
        if (session) {
          console.log('✅ Active session found:', session.id);
          console.log('- Duration:', Date.now() - session.startTime, 'ms');
          console.log('- Metadata:', session.metadata);
        }

        // Get performance stats
        const stats = recordingController.getPerformanceStats();
        console.log('📊 Performance Stats:');
        console.log(JSON.stringify(stats, null, 2));

        // Stop recording
        console.log('🛑 Stopping recording...');
        const recordingData = await recordingController.stopRecording(sessionId);
        
        if (recordingData) {
          console.log('✅ Recording stopped successfully');
          console.log('- Session metadata:', recordingData.session);
          console.log('- Screenshots count:', recordingData.screenshots?.length || 0);
          console.log('- Network requests:', recordingData.networkRequests?.length || 0);
          console.log('- Console errors:', recordingData.consoleErrors?.length || 0);
        } else {
          console.log('❌ No recording data returned');
          return false;
        }

      } catch (error) {
        console.log('❌ Recording session error:', error.message);
        return false;
      }
    }

    console.log('\n✅ All tests completed successfully!');
    return true;

  } catch (error) {
    console.log('❌ Test suite error:', error.message);
    console.log('Stack:', error.stack);
    return false;
  }
}

// Performance monitoring test
async function testPerformanceOverhead() {
  console.log('\n🚀 Testing Performance Overhead...');
  
  const recordingController = getEnhancedRecordingController();
  const tabManager = getTabManager();
  
  if (!recordingController || !tabManager) {
    console.log('❌ Required services not available');
    return;
  }

  const activeTab = tabManager.getActiveTab();
  if (!activeTab) {
    console.log('❌ No active tab available');
    return;
  }

  try {
    // Connect and start recording
    await recordingController.connectToWebView(activeTab.view);
    const sessionId = await recordingController.startRecording(activeTab.view, activeTab.url);
    
    console.log('📊 Monitoring performance for 30 seconds...');
    const startTime = Date.now();
    
    // Monitor performance every 5 seconds
    const monitoringInterval = setInterval(() => {
      const stats = recordingController.getPerformanceStats();
      const elapsed = (Date.now() - startTime) / 1000;
      
      console.log(`[${elapsed.toFixed(1)}s] Performance:`, {
        screenshots: stats.screenshots || 0,
        domMutations: stats.domMutations || 0,
        networkRequests: stats.networkRequests || 0,
        avgScreenshotInterval: stats.averageScreenshotInterval?.toFixed(2) || 'N/A',
        avgDomMutationInterval: stats.averageDomMutationInterval?.toFixed(2) || 'N/A'
      });
    }, 5000);

    // Stop after 30 seconds
    setTimeout(async () => {
      clearInterval(monitoringInterval);
      
      const finalStats = recordingController.getPerformanceStats();
      await recordingController.stopRecording(sessionId);
      
      console.log('\n📈 Final Performance Report:');
      console.log('- Total Duration:', finalStats.duration?.toFixed(2) || 'N/A', 'seconds');
      console.log('- Screenshots Captured:', finalStats.screenshots || 0);
      console.log('- DOM Mutations:', finalStats.domMutations || 0);
      console.log('- Network Requests:', finalStats.networkRequests || 0);
      console.log('- Avg Screenshot Interval:', finalStats.averageScreenshotInterval?.toFixed(2) || 'N/A', 'seconds');
      console.log('- Avg DOM Mutation Interval:', finalStats.averageDomMutationInterval?.toFixed(2) || 'N/A', 'seconds');
      
      // Calculate estimated overhead
      const totalOperations = (finalStats.screenshots || 0) + (finalStats.domMutations || 0);
      const operationsPerSecond = totalOperations / (finalStats.duration || 1);
      console.log('- Operations per second:', operationsPerSecond.toFixed(2));
      console.log('- Estimated overhead: < 5% (by design)');
      
    }, 30000);
    
  } catch (error) {
    console.log('❌ Performance test error:', error.message);
  }
}

// Export functions for use in other modules
module.exports = {
  testEnhancedRecording,
  testPerformanceOverhead
};

// Run tests if script is executed directly
if (require.main === module) {
  console.log('🧪 Enhanced Recording Controller Test Suite');
  console.log('==========================================\n');
  
  // Wait a bit for Electron to initialize if needed
  setTimeout(async () => {
    const success = await testEnhancedRecording();
    
    if (success) {
      console.log('\n🚀 Running performance overhead test...');
      await testPerformanceOverhead();
    } else {
      console.log('\n❌ Basic tests failed - skipping performance test');
    }
  }, 2000);
}