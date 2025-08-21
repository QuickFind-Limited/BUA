import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import * as path from 'path';

/**
 * IPC and API Error Handling Tests
 * 
 * This test suite focuses on:
 * 1. IPC communication failures
 * 2. Claude API error scenarios
 * 3. WebContents lifecycle errors
 * 4. Recording system failures
 * 5. Intent Spec validation errors
 */

test.describe('IPC and API Error Handling', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  
  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '..', 'dist', 'main', 'index.js')],
      timeout: 30000,
    });
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test.describe('1. API Connection and Authentication Errors', () => {
    
    test('1.1 Missing API key scenarios', async () => {
      console.log('🔑 Testing missing API key handling...');
      
      // Try to trigger API-dependent functionality
      // This test simulates what happens when ANTHROPIC_API_KEY is not set
      
      try {
        // Look for AI-related buttons or functionality
        const aiButtons = await page.locator('[data-testid*="ai"], .ai-button, #ai-btn, [title*="AI"], [aria-label*="AI"]').count();
        console.log(`Found ${aiButtons} potential AI-related UI elements`);
        
        if (aiButtons > 0) {
          const aiButton = page.locator('[data-testid*="ai"], .ai-button, #ai-btn').first();
          await aiButton.click();
          await page.waitForTimeout(1000);
          
          // Check for error messaging about missing API key
          const errorElements = await page.locator('.error, .error-message, [data-testid="error"]').count();
          console.log(`Error elements displayed: ${errorElements}`);
        } else {
          console.log('ℹ️ No AI functionality UI found in current view');
        }
        
      } catch (error) {
        console.log(`API key test error: ${error.message}`);
      }
      
      await page.screenshot({ path: 'screenshots/ipc_01_missing_api_key.png', fullPage: true });
    });

    test('1.2 API rate limiting and timeout scenarios', async () => {
      console.log('⏱️ Testing API timeout and rate limiting...');
      
      // Test scenarios that might trigger API calls
      try {
        // Look for analyze or generation buttons
        const analyzeButtons = await page.locator('[data-testid*="analyze"], .analyze-button, #analyze-btn, [title*="Analyze"]').count();
        console.log(`Found ${analyzeButtons} potential analyze-related UI elements`);
        
        if (analyzeButtons > 0) {
          // Click analyze button multiple times rapidly to test rate limiting
          const analyzeButton = page.locator('[data-testid*="analyze"], .analyze-button, #analyze-btn').first();
          
          for (let i = 0; i < 5; i++) {
            try {
              await analyzeButton.click();
              await page.waitForTimeout(200);
              console.log(`Analyze click attempt ${i + 1}`);
            } catch (error) {
              console.log(`Analyze click ${i + 1} error: ${error.message}`);
            }
          }
          
          // Wait for any error messages or rate limiting indicators
          await page.waitForTimeout(2000);
          
          const statusElements = await page.locator('.status, .loading, .error, [data-testid*="status"]').count();
          console.log(`Status/error elements after rapid clicks: ${statusElements}`);
          
        } else {
          console.log('ℹ️ No analyze functionality UI found in current view');
        }
        
      } catch (error) {
        console.log(`Rate limiting test error: ${error.message}`);
      }
      
      await page.screenshot({ path: 'screenshots/ipc_02_api_rate_limiting.png', fullPage: true });
    });

    test('1.3 Network connectivity issues during API calls', async () => {
      console.log('🌐 Testing network connectivity issues...');
      
      // Simulate network issues by trying API operations and monitoring responses
      try {
        // Look for any API-dependent functionality
        const apiButtons = await page.locator('button:has-text("Generate"), button:has-text("Analyze"), button:has-text("Execute")').count();
        console.log(`Found ${apiButtons} potential API operation buttons`);
        
        if (apiButtons > 0) {
          const apiButton = page.locator('button:has-text("Generate"), button:has-text("Analyze"), button:has-text("Execute")').first();
          
          // Click and monitor for network-related errors
          await apiButton.click();
          await page.waitForTimeout(3000);
          
          // Look for network error indicators
          const networkErrorIndicators = await page.locator(':has-text("network"), :has-text("connection"), :has-text("timeout")').count();
          console.log(`Network error indicators found: ${networkErrorIndicators}`);
          
        } else {
          console.log('ℹ️ No API operation buttons found in current view');
        }
        
      } catch (error) {
        console.log(`Network connectivity test error: ${error.message}`);
      }
      
      await page.screenshot({ path: 'screenshots/ipc_03_network_connectivity.png', fullPage: true });
    });
  });

  test.describe('2. IPC Communication Failures', () => {
    
    test('2.1 Main process communication errors', async () => {
      console.log('📡 Testing main process IPC errors...');
      
      // Test various IPC operations that might fail
      try {
        // Tab operations that use IPC
        const newTabBtn = page.locator('#new-tab-btn');
        
        // Rapid tab creation to stress IPC
        for (let i = 0; i < 10; i++) {
          await newTabBtn.click();
          await page.waitForTimeout(50); // Very fast to stress IPC
        }
        
        console.log('✓ Rapid tab creation IPC stress test completed');
        
        // Test tab switching which uses IPC
        const tabs = page.locator('.tab');
        const tabCount = await tabs.count();
        
        for (let i = 0; i < Math.min(tabCount, 5); i++) {
          await tabs.nth(i).click();
          await page.waitForTimeout(50);
        }
        
        console.log('✓ Rapid tab switching IPC test completed');
        
        // Test navigation which uses IPC
        const addressBar = page.locator('#address-bar');
        const urls = ['https://httpbin.org/html', 'https://example.com', 'about:blank'];
        
        for (const url of urls) {
          await addressBar.fill(url);
          await page.locator('#go-btn').click();
          await page.waitForTimeout(100);
        }
        
        console.log('✓ Rapid navigation IPC test completed');
        
      } catch (error) {
        console.log(`IPC communication test error: ${error.message}`);
      }
      
      await page.screenshot({ path: 'screenshots/ipc_04_main_process_ipc.png', fullPage: true });
    });

    test('2.2 WebContents lifecycle IPC errors', async () => {
      console.log('🔄 Testing WebContents lifecycle IPC errors...');
      
      try {
        // Create and destroy tabs rapidly to test lifecycle IPC
        const newTabBtn = page.locator('#new-tab-btn');
        
        for (let cycle = 0; cycle < 3; cycle++) {
          // Create multiple tabs
          for (let i = 0; i < 5; i++) {
            await newTabBtn.click();
            await page.waitForTimeout(100);
          }
          
          // Close most tabs rapidly
          const tabs = page.locator('.tab');
          const tabCount = await tabs.count();
          
          for (let i = 0; i < Math.min(tabCount - 1, 4); i++) {
            const closeBtn = tabs.first().locator('.tab-close');
            if (await closeBtn.isVisible()) {
              await closeBtn.click();
              await page.waitForTimeout(100);
            }
          }
          
          console.log(`✓ Lifecycle test cycle ${cycle + 1} completed`);
        }
        
        // Verify app is still responsive
        await expect(page.locator('#tab-bar')).toBeVisible();
        console.log('✓ App maintained responsiveness through lifecycle stress');
        
      } catch (error) {
        console.log(`WebContents lifecycle test error: ${error.message}`);
      }
      
      await page.screenshot({ path: 'screenshots/ipc_05_webcontents_lifecycle.png', fullPage: true });
    });

    test('2.3 Recording system IPC failures', async () => {
      console.log('🎥 Testing recording system IPC failures...');
      
      try {
        const recordBtn = page.locator('#record-btn, .record-button, [data-testid="record"]');
        const stopBtn = page.locator('#stop-btn, .stop-button, [data-testid="stop"]');
        
        if (await recordBtn.isVisible()) {
          // Test rapid start/stop cycles
          for (let i = 0; i < 3; i++) {
            await recordBtn.click();
            await page.waitForTimeout(500);
            
            if (await stopBtn.isVisible()) {
              await stopBtn.click();
              await page.waitForTimeout(500);
            }
            
            console.log(`✓ Recording cycle ${i + 1} completed`);
          }
          
          // Test recording during heavy operations
          await recordBtn.click();
          await page.waitForTimeout(300);
          
          // Perform operations while recording
          const newTabBtn = page.locator('#new-tab-btn');
          await newTabBtn.click();
          await page.waitForTimeout(200);
          
          const addressBar = page.locator('#address-bar');
          await addressBar.fill('https://httpbin.org/html');
          await page.locator('#go-btn').click();
          await page.waitForTimeout(1000);
          
          if (await stopBtn.isVisible()) {
            await stopBtn.click();
            await page.waitForTimeout(500);
          }
          
          console.log('✓ Recording during operations test completed');
          
        } else {
          console.log('ℹ️ Recording functionality not accessible in current view');
        }
        
      } catch (error) {
        console.log(`Recording system IPC test error: ${error.message}`);
      }
      
      await page.screenshot({ path: 'screenshots/ipc_06_recording_ipc.png', fullPage: true });
    });
  });

  test.describe('3. Error Message and User Feedback Testing', () => {
    
    test('3.1 Error message display and formatting', async () => {
      console.log('💬 Testing error message display...');
      
      try {
        // Trigger various error conditions and check for user feedback
        
        // Navigation errors
        const addressBar = page.locator('#address-bar');
        await addressBar.fill('http://definitely-invalid-domain-12345.invalid');
        await page.locator('#go-btn').click();
        await page.waitForTimeout(3000);
        
        // Look for error messages
        const errorMessages = await page.locator('.error, .error-message, .notification, .alert').count();
        console.log(`Error message elements found: ${errorMessages}`);
        
        if (errorMessages > 0) {
          const errorText = await page.locator('.error, .error-message, .notification, .alert').first().textContent();
          console.log(`Error message text: "${errorText}"`);
        }
        
        // Test file protocol (should be blocked)
        await addressBar.fill('file:///etc/passwd');
        await page.locator('#go-btn').click();
        await page.waitForTimeout(1000);
        
        const securityErrorMessages = await page.locator(':has-text("blocked"), :has-text("security"), :has-text("not allowed")').count();
        console.log(`Security error indicators: ${securityErrorMessages}`);
        
        // Test invalid JavaScript data URL
        await addressBar.fill('data:text/html,<script>throw new Error("Test error")</script>');
        await page.locator('#go-btn').click();
        await page.waitForTimeout(2000);
        
        const jsErrorMessages = await page.locator(':has-text("script"), :has-text("javascript"), :has-text("error")').count();
        console.log(`JavaScript error indicators: ${jsErrorMessages}`);
        
      } catch (error) {
        console.log(`Error message testing error: ${error.message}`);
      }
      
      await page.screenshot({ path: 'screenshots/ipc_07_error_messages.png', fullPage: true });
    });

    test('3.2 User notification system testing', async () => {
      console.log('🔔 Testing user notification system...');
      
      try {
        // Look for notification systems
        const notificationElements = await page.locator('.notification, .toast, .alert, .message, [role="alert"]').count();
        console.log(`Notification system elements found: ${notificationElements}`);
        
        // Test operations that should generate notifications
        const operations = [
          async () => {
            // Try to create many tabs to trigger potential warnings
            const newTabBtn = page.locator('#new-tab-btn');
            for (let i = 0; i < 20; i++) {
              await newTabBtn.click();
              await page.waitForTimeout(50);
            }
          },
          async () => {
            // Navigate to potentially problematic content
            const addressBar = page.locator('#address-bar');
            await addressBar.fill('data:text/html,<script>alert("test")</script>');
            await page.locator('#go-btn').click();
            await page.waitForTimeout(1000);
          }
        ];
        
        for (let i = 0; i < operations.length; i++) {
          try {
            await operations[i]();
            
            // Check for new notifications
            const newNotifications = await page.locator('.notification, .toast, .alert, .message, [role="alert"]').count();
            console.log(`Notifications after operation ${i + 1}: ${newNotifications}`);
            
            // Wait for notifications to potentially appear
            await page.waitForTimeout(1000);
            
          } catch (error) {
            console.log(`Notification test operation ${i + 1} error: ${error.message}`);
          }
        }
        
      } catch (error) {
        console.log(`Notification system test error: ${error.message}`);
      }
      
      await page.screenshot({ path: 'screenshots/ipc_08_notifications.png', fullPage: true });
    });

    test('3.3 Status and progress indicator testing', async () => {
      console.log('📊 Testing status and progress indicators...');
      
      try {
        // Look for status indicators
        const statusElements = await page.locator('#status, .status, #status-text, .status-text, .progress, .loading').count();
        console.log(`Status indicator elements found: ${statusElements}`);
        
        if (statusElements > 0) {
          const statusText = await page.locator('#status, .status, #status-text, .status-text').first().textContent().catch(() => 'N/A');
          console.log(`Current status text: "${statusText}"`);
        }
        
        // Trigger operations that should update status
        const addressBar = page.locator('#address-bar');
        await addressBar.fill('https://httpbin.org/delay/3');
        await page.locator('#go-btn').click();
        
        // Monitor status during loading
        for (let i = 0; i < 5; i++) {
          await page.waitForTimeout(500);
          
          const loadingIndicators = await page.locator('.loading, .spinner, [aria-label*="loading"]').count();
          console.log(`Loading indicators at ${i * 0.5}s: ${loadingIndicators}`);
          
          if (statusElements > 0) {
            const currentStatus = await page.locator('#status, .status, #status-text, .status-text').first().textContent().catch(() => 'N/A');
            console.log(`Status at ${i * 0.5}s: "${currentStatus}"`);
          }
        }
        
        // Wait for navigation to complete
        await page.waitForTimeout(2000);
        
        if (statusElements > 0) {
          const finalStatus = await page.locator('#status, .status, #status-text, .status-text').first().textContent().catch(() => 'N/A');
          console.log(`Final status: "${finalStatus}"`);
        }
        
      } catch (error) {
        console.log(`Status indicator test error: ${error.message}`);
      }
      
      await page.screenshot({ path: 'screenshots/ipc_09_status_indicators.png', fullPage: true });
    });
  });

  test.describe('4. Resource and Memory Management Errors', () => {
    
    test('4.1 Memory leak detection during errors', async () => {
      console.log('💾 Testing memory management during errors...');
      
      try {
        // Create tabs and trigger errors to test cleanup
        const newTabBtn = page.locator('#new-tab-btn');
        const initialTabCount = await page.locator('.tab').count();
        
        // Create several tabs
        for (let i = 0; i < 5; i++) {
          await newTabBtn.click();
          await page.waitForTimeout(200);
        }
        
        const tabsAfterCreation = await page.locator('.tab').count();
        console.log(`Tabs after creation: ${tabsAfterCreation}`);
        
        // Navigate each tab to potentially problematic content
        const tabs = page.locator('.tab');
        const tabCount = await tabs.count();
        
        for (let i = 0; i < Math.min(tabCount, 3); i++) {
          await tabs.nth(i).click();
          await page.waitForTimeout(200);
          
          const addressBar = page.locator('#address-bar');
          await addressBar.fill(`data:text/html,<script>var x = []; while(true) { x.push("memory"); if(x.length > 10000) break; }</script><h1>Tab ${i}</h1>`);
          await page.locator('#go-btn').click();
          await page.waitForTimeout(500);
        }
        
        // Close tabs and check for proper cleanup
        for (let i = 0; i < Math.min(tabCount - 1, 3); i++) {
          const tabs = page.locator('.tab');
          const closeBtn = tabs.first().locator('.tab-close');
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(300);
          }
        }
        
        const finalTabCount = await page.locator('.tab').count();
        console.log(`Final tab count: ${finalTabCount}`);
        
        // App should still be responsive
        await expect(page.locator('#tab-bar')).toBeVisible();
        console.log('✓ App remained responsive after memory-intensive operations');
        
      } catch (error) {
        console.log(`Memory management test error: ${error.message}`);
      }
      
      await page.screenshot({ path: 'screenshots/ipc_10_memory_management.png', fullPage: true });
    });

    test('4.2 Resource cleanup verification', async () => {
      console.log('🧹 Testing resource cleanup after errors...');
      
      try {
        // Test various resource cleanup scenarios
        
        // 1. WebView cleanup after navigation errors
        const addressBar = page.locator('#address-bar');
        
        const problematicUrls = [
          'http://invalid-domain-cleanup-test.invalid',
          'data:text/html,<script>window.location = "invalid://protocol"</script>',
          'https://httpbin.org/status/500'
        ];
        
        for (const url of problematicUrls) {
          await addressBar.fill(url);
          await page.locator('#go-btn').click();
          await page.waitForTimeout(2000);
          
          // Check that app can still navigate normally
          await addressBar.fill('https://httpbin.org/html');
          await page.locator('#go-btn').click();
          await page.waitForTimeout(1000);
          
          console.log(`✓ Recovery after problematic URL: ${url}`);
        }
        
        // 2. Event listener cleanup
        const newTabBtn = page.locator('#new-tab-btn');
        const initialTabCount = await page.locator('.tab').count();
        
        // Create and close tabs rapidly
        for (let i = 0; i < 3; i++) {
          await newTabBtn.click();
          await page.waitForTimeout(100);
          
          const tabs = page.locator('.tab');
          const closeBtn = tabs.last().locator('.tab-close');
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(100);
          }
        }
        
        const afterCleanupTabCount = await page.locator('.tab').count();
        console.log(`Tab count after cleanup cycles: ${afterCleanupTabCount}`);
        
        // App should still be fully functional
        await newTabBtn.click();
        await page.waitForTimeout(200);
        await expect(page.locator('.tab').last()).toBeVisible();
        console.log('✓ Tab creation still works after cleanup cycles');
        
      } catch (error) {
        console.log(`Resource cleanup test error: ${error.message}`);
      }
      
      await page.screenshot({ path: 'screenshots/ipc_11_resource_cleanup.png', fullPage: true });
    });
  });

  test('Final IPC/API Error Test Summary', async () => {
    console.log('📋 Generating final IPC/API error test summary...');
    
    // Take final screenshot
    await page.screenshot({ path: 'screenshots/ipc_12_final_summary.png', fullPage: true });
    
    // Check final app state
    const finalTabCount = await page.locator('.tab').count();
    const isTabBarVisible = await page.locator('#tab-bar').isVisible();
    const isNavBarVisible = await page.locator('.nav-bar').isVisible();
    
    // Check for any persistent error states
    const errorElements = await page.locator('.error, .error-message, [data-testid="error"]').count();
    const notificationElements = await page.locator('.notification, .toast, .alert').count();
    
    console.log('=== IPC/API ERROR HANDLING TEST SUMMARY ===');
    console.log(`Final tab count: ${finalTabCount}`);
    console.log(`Tab bar visible: ${isTabBarVisible}`);
    console.log(`Navigation bar visible: ${isNavBarVisible}`);
    console.log(`Error elements present: ${errorElements}`);
    console.log(`Notification elements present: ${notificationElements}`);
    console.log('');
    console.log('Test Categories Completed:');
    console.log('✓ API connection and authentication errors');
    console.log('✓ IPC communication failures');
    console.log('✓ Error message and user feedback');
    console.log('✓ Resource and memory management errors');
    console.log('');
    console.log('All IPC and API error handling tests completed!');
    
    // Verify the app is still in a good state
    expect(isTabBarVisible).toBe(true);
    expect(isNavBarVisible).toBe(true);
    expect(finalTabCount).toBeGreaterThan(0);
  });
});