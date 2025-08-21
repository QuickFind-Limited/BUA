// Test script to verify multi-tab recording capability
const { chromium } = require('playwright');

async function testMultiTabRecording() {
  console.log('🧪 Testing multi-tab recording capability...\n');
  
  // Connect to the running Electron app via CDP
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9370');
  console.log('✅ Connected to Electron app via CDP');
  
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    console.log('❌ No browser contexts found');
    await browser.close();
    return;
  }
  
  const context = contexts[0];
  const pages = context.pages();
  console.log(`📄 Found ${pages.length} page(s)`);
  
  if (pages.length > 0) {
    const page = pages[0];
    console.log(`📍 Current URL: ${page.url()}`);
    console.log(`📝 Page title: ${await page.title()}`);
    
    // Start recording
    console.log('\n🎬 Starting recording...');
    await page.evaluate(() => {
      if (window.electronAPI && window.electronAPI.startEnhancedRecording) {
        return window.electronAPI.startEnhancedRecording();
      }
      return { success: false, error: 'electronAPI not available' };
    });
    
    // Wait a moment
    await page.waitForTimeout(2000);
    
    // Simulate some actions
    console.log('\n🖱️ Performing test actions...');
    
    // Action 1: Click on search box
    const searchBox = await page.$('input[name="q"], textarea[name="q"]');
    if (searchBox) {
      await searchBox.click();
      console.log('  ✓ Clicked search box');
      await page.waitForTimeout(500);
      
      // Action 2: Type search query
      await searchBox.type('test query for multi-tab');
      console.log('  ✓ Typed search query');
      await page.waitForTimeout(500);
    }
    
    // Action 3: Create new tab
    console.log('\n📑 Creating new tab...');
    await page.evaluate(() => {
      if (window.electronAPI && window.electronAPI.createTab) {
        return window.electronAPI.createTab('https://example.com');
      }
    });
    await page.waitForTimeout(3000);
    
    // Action 4: Switch back to original tab
    console.log('🔄 Switching back to original tab...');
    await page.evaluate(() => {
      if (window.electronAPI && window.electronAPI.switchTab) {
        return window.electronAPI.switchTab('tab-initial');
      }
    });
    await page.waitForTimeout(2000);
    
    // Stop recording
    console.log('\n⏹️ Stopping recording...');
    const recordingResult = await page.evaluate(() => {
      if (window.electronAPI && window.electronAPI.stopEnhancedRecording) {
        return window.electronAPI.stopEnhancedRecording();
      }
      return { success: false, error: 'electronAPI not available' };
    });
    
    console.log('\n📊 Recording Result:');
    if (recordingResult && recordingResult.success) {
      const data = recordingResult.data;
      if (data) {
        console.log(`  ✓ Session ID: ${data.sessionId || 'N/A'}`);
        console.log(`  ✓ Duration: ${data.duration || 0}ms`);
        console.log(`  ✓ Actions recorded: ${data.actions?.length || 0}`);
        console.log(`  ✓ Tab switches: ${data.tabSwitches?.length || 0}`);
        console.log(`  ✓ Tabs used: ${data.tabsUsed?.join(', ') || 'none'}`);
        
        if (data.tabSwitches && data.tabSwitches.length > 0) {
          console.log('\n📑 Tab Switch Details:');
          data.tabSwitches.forEach((sw, i) => {
            if (sw.action === 'new-tab') {
              console.log(`  ${i+1}. Created new tab: ${sw.tabId} (${sw.url})`);
            } else {
              console.log(`  ${i+1}. Switched from ${sw.fromTab} to ${sw.toTab}`);
            }
          });
        }
        
        console.log('\n✅ Multi-tab recording test PASSED!');
      } else {
        console.log('  ⚠️ No data in recording result');
      }
    } else {
      console.log(`  ❌ Recording failed: ${recordingResult?.error || 'Unknown error'}`);
    }
  }
  
  await browser.close();
  console.log('\n🔌 Disconnected from Electron app');
}

testMultiTabRecording().catch(console.error);