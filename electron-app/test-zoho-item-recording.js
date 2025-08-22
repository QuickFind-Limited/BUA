// Test variable detection for Zoho inventory item creation
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import the analyzeRecording function
const { analyzeRecording } = require('./dist/main/llm');

async function testZohoItemRecording() {
  console.log('\n🔍 Testing Variable Detection for Zoho Inventory Item Creation');
  console.log('================================================================\n');

  try {
    // Load the Zoho item creation recording
    const recordingPath = path.join(__dirname, 'recordings', 'recording-1755711228952.spec.ts');
    
    console.log('📁 Loading recording:', recordingPath);
    const recordingContent = fs.readFileSync(recordingPath, 'utf8');
    
    // Create recording data from the Playwright script
    const recordingData = {
      sessionId: 'zoho-item-test-' + Date.now(),
      startUrl: 'https://accounts.zoho.com/signin',
      endUrl: 'https://inventory.zoho.com/',
      duration: 60000,
      script: recordingContent,
      events: [
        {
          type: 'action',
          data: {
            type: 'navigate',
            url: 'https://accounts.zoho.com/signin',
            timestamp: Date.now()
          }
        },
        {
          type: 'action', 
          data: {
            type: 'input',
            selector: 'textbox[name="Email address or mobile number"]',
            value: 'admin@quickfindai.com',
            timestamp: Date.now() + 1000
          }
        },
        {
          type: 'action',
          data: {
            type: 'input',
            selector: 'textbox[name="Enter password"]',
            value: '#QuickFind',
            timestamp: Date.now() + 2000
          }
        },
        {
          type: 'action',
          data: {
            type: 'click',
            selector: 'button[name="Sign in"]',
            timestamp: Date.now() + 3000
          }
        },
        {
          type: 'action',
          data: {
            type: 'navigate',
            url: 'https://inventory.zoho.com/app',
            timestamp: Date.now() + 4000
          }
        },
        {
          type: 'action',
          data: {
            type: 'click',
            selector: 'button[name="New"]',
            timestamp: Date.now() + 5000
          }
        },
        {
          type: 'action',
          data: {
            type: 'input',
            selector: 'textbox[name="Name"]',
            value: 'test item 88',
            fieldName: 'Name',
            fieldType: 'text',
            url: 'https://inventory.zoho.com/app#/items/new',
            timestamp: Date.now() + 6000
          }
        },
        {
          type: 'action',
          data: {
            type: 'input',
            selector: 'textbox[name="Selling Price*"]',
            value: '67',
            fieldName: 'Selling Price',
            fieldType: 'number',
            url: 'https://inventory.zoho.com/app#/items/new',
            timestamp: Date.now() + 7000
          }
        },
        {
          type: 'action',
          data: {
            type: 'input',
            selector: 'textbox[name="Cost Price*"]',
            value: '59',
            fieldName: 'Cost Price',
            fieldType: 'number',
            url: 'https://inventory.zoho.com/app#/items/new',
            timestamp: Date.now() + 8000
          }
        }
      ]
    };

    console.log('🤖 Analyzing recording for variable detection...\n');
    
    // Analyze the recording
    const startTime = Date.now();
    const intentSpec = await analyzeRecording(recordingData);
    const analysisTime = Date.now() - startTime;
    
    console.log('✅ Analysis completed in', analysisTime, 'ms\n');
    
    // Check variable detection
    console.log('📝 Detected Variables:');
    console.log('=' .repeat(50));
    
    if (intentSpec.params && intentSpec.params.length > 0) {
      intentSpec.params.forEach(param => {
        console.log(`  • ${param}`);
      });
      
      // Check for expected business fields
      const expectedVars = ['ITEM_NAME', 'SELLING_PRICE', 'COST_PRICE', 'EMAIL', 'PASSWORD'];
      const detectedVars = intentSpec.params.map(p => p.toUpperCase());
      
      console.log('\n🎯 Business Field Detection:');
      expectedVars.forEach(varName => {
        const found = detectedVars.some(v => v.includes(varName.replace('_', '')) || v === varName);
        console.log(`  ${found ? '✅' : '❌'} ${varName}`);
      });
    } else {
      console.log('  ❌ No variables detected');
    }
    
    console.log('=' .repeat(50));
    
    // Save the intent spec
    const outputPath = path.join(__dirname, 'recordings', 'zoho-item-intent-spec.json');
    fs.writeFileSync(outputPath, JSON.stringify(intentSpec, null, 2));
    console.log('\n💾 Intent Spec saved to:', outputPath);
    
  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testZohoItemRecording().then(() => {
  console.log('\n✅ Test completed!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});