#!/usr/bin/env node

/**
 * Test script to verify AI recording analysis is working
 */

const fs = require('fs').promises;
const path = require('path');

// Load the compiled TypeScript modules
const { analyzeRecording } = require('./dist/main/llm.js');

// Create a test recording with realistic data including login
const testRecording = {
  sessionId: 'test-' + Date.now(),
  startTime: Date.now() - 90000,
  endTime: Date.now(),
  duration: 90000,
  url: 'https://inventory.example.com/login',
  events: [
    {
      type: 'action',
      data: {
        action: 'input',
        selector: 'input#username',
        value: 'admin@example.com',
        url: 'https://inventory.example.com/login',
        timestamp: Date.now() - 80000,
        element: {
          tagName: 'INPUT',
          attributes: {
            id: 'username',
            type: 'email',
            placeholder: 'Enter username or email'
          }
        }
      }
    },
    {
      type: 'action',
      data: {
        action: 'input',
        selector: 'input#password',
        value: 'SecurePass123',
        url: 'https://inventory.example.com/login',
        timestamp: Date.now() - 75000,
        element: {
          tagName: 'INPUT',
          attributes: {
            id: 'password',
            type: 'password',
            placeholder: 'Enter password'
          }
        }
      }
    },
    {
      type: 'action',
      data: {
        action: 'click',
        selector: 'button.login-btn',
        url: 'https://inventory.example.com/login',
        timestamp: Date.now() - 70000,
        element: {
          tagName: 'BUTTON',
          textContent: 'Sign In',
          attributes: { class: 'login-btn btn-primary' }
        }
      }
    },
    {
      type: 'action',
      data: {
        action: 'click',
        selector: 'button.add-product',
        url: 'https://inventory.example.com/products',
        timestamp: Date.now() - 50000,
        element: {
          tagName: 'BUTTON',
          textContent: 'Add New Product',
          attributes: { class: 'add-product btn-primary' }
        }
      }
    },
    {
      type: 'action', 
      data: {
        action: 'input',
        selector: 'input#product-name',
        value: 'Test Item 77',
        url: 'https://inventory.example.com/products/new',
        timestamp: Date.now() - 40000,
        element: {
          tagName: 'INPUT',
          attributes: { 
            id: 'product-name',
            placeholder: 'Enter product name',
            type: 'text'
          }
        }
      }
    },
    {
      type: 'action',
      data: {
        action: 'input', 
        selector: 'input#selling-price',
        value: '299.99',
        url: 'https://inventory.example.com/products/new',
        timestamp: Date.now() - 35000,
        element: {
          tagName: 'INPUT',
          attributes: {
            id: 'selling-price',
            placeholder: 'Selling Price',
            type: 'number'
          }
        }
      }
    },
    {
      type: 'action',
      data: {
        action: 'input',
        selector: 'input#cost-price',
        value: '150.00',
        url: 'https://inventory.example.com/products/new', 
        timestamp: Date.now() - 30000,
        element: {
          tagName: 'INPUT',
          attributes: {
            id: 'cost-price',
            placeholder: 'Cost Price',
            type: 'number'
          }
        }
      }
    },
    {
      type: 'action',
      data: {
        action: 'click',
        selector: 'button.save-product',
        url: 'https://inventory.example.com/products/new',
        timestamp: Date.now() - 20000,
        element: {
          tagName: 'BUTTON',
          textContent: 'Save Product',
          attributes: { class: 'save-product btn-success' }
        }
      }
    }
  ],
  domSnapshots: [
    {
      timestamp: Date.now() - 45000,
      html: '<form><input id="product-name"><input id="selling-price"><input id="cost-price"></form>'
    }
  ]
};

async function testAIAnalysis() {
  console.log('🧪 Testing AI Recording Analysis');
  console.log('================================\n');
  
  console.log('📊 Test Recording Summary:');
  console.log(`  - Duration: ${testRecording.duration / 1000}s`);
  console.log(`  - Events: ${testRecording.events.length}`);
  console.log(`  - Starting URL: ${testRecording.url}`);
  console.log('  - Actions:');
  testRecording.events.forEach(event => {
    if (event.data) {
      const d = event.data;
      if (d.action === 'input') {
        // Mask password values
        const displayValue = d.selector.includes('password') ? '****' : d.value;
        console.log(`    • ${d.action} on ${d.selector}: "${displayValue}"`);
      } else {
        console.log(`    • ${d.action} on ${d.selector}`);
      }
    }
  });
  
  console.log('\n🤖 Calling Claude Opus 4.1 for analysis...\n');
  
  try {
    const startTime = Date.now();
    const intentSpec = await analyzeRecording(testRecording);
    const duration = Date.now() - startTime;
    
    console.log(`✅ AI Analysis Complete (${(duration / 1000).toFixed(1)}s)\n`);
    
    console.log('📋 Generated Intent Spec:');
    console.log(`  - Name: ${intentSpec.name}`);
    console.log(`  - Description: ${intentSpec.description}`);
    console.log(`  - Steps: ${intentSpec.steps?.length || 0}`);
    console.log(`  - Variables: ${intentSpec.params?.length || 0}`);
    
    if (intentSpec.params && intentSpec.params.length > 0) {
      console.log('\n🔤 Identified Variables:');
      intentSpec.params.forEach(param => {
        // Handle both string and object formats
        const paramName = typeof param === 'string' ? param : param.name;
        const paramDesc = typeof param === 'object' ? param.description : '';
        console.log(`  • ${paramName}: ${paramDesc || 'Dynamic field'}`);
        if (typeof param === 'object' && param.defaultValue) {
          console.log(`    Default: "${param.defaultValue}"`);
        }
      });
    }
    
    if (intentSpec.steps && intentSpec.steps.length > 0) {
      console.log('\n📝 Workflow Steps:');
      intentSpec.steps.forEach((step, i) => {
        const stepName = step.name || step.action || 'Step';
        const stepDesc = step.ai_instruction || step.description || step.selector || '';
        console.log(`  ${i + 1}. ${stepName}: ${stepDesc}`);
      });
    }
    
    // Save the result for inspection
    const outputPath = path.join(__dirname, 'test-ai-analysis-result.json');
    await fs.writeFile(outputPath, JSON.stringify({
      recording: testRecording,
      intentSpec: intentSpec,
      analysisTime: duration
    }, null, 2));
    
    console.log(`\n💾 Full results saved to: test-ai-analysis-result.json`);
    
    // Verify expected fields were identified
    console.log('\n🔍 Verification:');
    
    // Helper to check params (handles both string and object format)
    const checkParam = (param, keywords) => {
      const paramStr = typeof param === 'string' ? param : (param.name || '');
      return keywords.some(k => paramStr.toLowerCase().includes(k.toLowerCase()));
    };
    
    const hasUsername = intentSpec.params?.some(p => 
      checkParam(p, ['username', 'user', 'email', 'login'])
    );
    const hasPassword = intentSpec.params?.some(p => 
      checkParam(p, ['password', 'pass', 'pwd'])
    );
    const hasProductName = intentSpec.params?.some(p => 
      checkParam(p, ['product', 'name', 'item'])
    );
    const hasSellingPrice = intentSpec.params?.some(p => 
      checkParam(p, ['sell', 'price', 'selling'])
    );
    const hasCostPrice = intentSpec.params?.some(p => 
      checkParam(p, ['cost', 'buy'])
    );
    
    console.log(`  ✓ Username/Email field detected: ${hasUsername ? 'YES' : 'NO'}`);
    console.log(`  ✓ Password field detected: ${hasPassword ? 'YES' : 'NO'}`);
    console.log(`  ✓ Product Name field detected: ${hasProductName ? 'YES' : 'NO'}`);
    console.log(`  ✓ Selling Price field detected: ${hasSellingPrice ? 'YES' : 'NO'}`);
    console.log(`  ✓ Cost Price field detected: ${hasCostPrice ? 'YES' : 'NO'}`);
    
    const allFieldsDetected = hasUsername && hasPassword && hasProductName && hasSellingPrice && hasCostPrice;
    
    if (allFieldsDetected) {
      console.log('\n✅ SUCCESS: AI correctly identified ALL fields including login!');
    } else {
      console.log('\n⚠️  WARNING: Not all expected fields were identified');
      if (!hasUsername || !hasPassword) {
        console.log('   Missing: Login credentials (username/password)');
      }
      if (!hasProductName || !hasSellingPrice || !hasCostPrice) {
        console.log('   Missing: Some product fields');
      }
    }
    
  } catch (error) {
    console.error('\n❌ AI Analysis Failed:', error.message);
    console.error('\nError details:', error);
    
    // Check if it's a configuration issue
    if (error.message.includes('CLAUDE_CODE')) {
      console.log('\n💡 Tip: Make sure Claude Code SDK is running and configured');
    }
  }
}

// Run the test
testAIAnalysis().catch(console.error);