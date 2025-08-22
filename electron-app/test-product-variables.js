#!/usr/bin/env node

/**
 * Test to verify product field variable detection
 */

const { analyzeRecording } = require('./dist/main/llm.js');

// Product creation recording WITHOUT login
const productRecording = {
  sessionId: 'product-test-' + Date.now(),
  startTime: Date.now() - 60000,
  endTime: Date.now(),
  duration: 60000,
  url: 'https://inventory.example.com/products/new',
  events: [
    {
      type: 'action',
      data: {
        action: 'input',
        selector: 'input#product-name',
        value: 'Test Widget 99',
        url: 'https://inventory.example.com/products/new',
        timestamp: Date.now() - 40000,
        element: {
          tagName: 'INPUT',
          attributes: {
            id: 'product-name',
            name: 'product_name',
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
        value: '399.99',
        url: 'https://inventory.example.com/products/new',
        timestamp: Date.now() - 35000,
        element: {
          tagName: 'INPUT',
          attributes: {
            id: 'selling-price',
            name: 'selling_price',
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
        value: '199.00',
        url: 'https://inventory.example.com/products/new',
        timestamp: Date.now() - 30000,
        element: {
          tagName: 'INPUT',
          attributes: {
            id: 'cost-price',
            name: 'cost_price',
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
  ]
};

async function testProductVariables() {
  console.log('🧪 Testing Product Field Variable Detection\n');
  
  try {
    console.log('🤖 Analyzing recording with product fields...\n');
    const intentSpec = await analyzeRecording(productRecording);
    
    console.log('📋 Intent Spec Generated:');
    console.log(`  Name: ${intentSpec.name}`);
    console.log(`  Variables: ${intentSpec.params?.length || 0}\n`);
    
    if (intentSpec.params && intentSpec.params.length > 0) {
      console.log('🔤 Variables Identified:');
      intentSpec.params.forEach(param => {
        // Handle both string and object format
        const paramName = typeof param === 'string' ? param : param.name;
        console.log(`  • ${paramName}`);
      });
    }
    
    // Check for specific variables
    console.log('\n✅ Verification:');
    const params = intentSpec.params || [];
    const paramStrings = params.map(p => typeof p === 'string' ? p : p.name || '').map(s => s.toUpperCase());
    
    const hasProductName = paramStrings.some(p => 
      p.includes('PRODUCT') || p.includes('NAME') || p.includes('ITEM'));
    const hasSellingPrice = paramStrings.some(p => 
      p.includes('SELL') || p.includes('PRICE'));
    const hasCostPrice = paramStrings.some(p => 
      p.includes('COST') || p.includes('BUY'));
    
    console.log(`  Product Name: ${hasProductName ? '✓ FOUND' : '✗ MISSING'}`);
    console.log(`  Selling Price: ${hasSellingPrice ? '✓ FOUND' : '✗ MISSING'}`);
    console.log(`  Cost Price: ${hasCostPrice ? '✓ FOUND' : '✗ MISSING'}`);
    
    if (hasProductName && hasSellingPrice && hasCostPrice) {
      console.log('\n✅ SUCCESS: All product fields detected as variables!');
    } else {
      console.log('\n❌ FAILURE: Some product fields were not detected as variables');
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

testProductVariables().catch(console.error);