#!/usr/bin/env node

/**
 * Test script to generate Intent Spec from the most recent recording
 * and display identified variables
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { WorkflowAnalyzer } = require('./main/workflow-analyzer.js');

// Import the Intent Spec generator functions
const { generateIntentSpecFromRichRecording } = require('./main/intent-spec-generator.js');
const { generateEnhancedIntentSpecPrompt, generateVariableExtractionPrompt } = require('./main/enhanced-intent-spec-prompt.js');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function log(message, color = '') {
  console.log(color + message + colors.reset);
}

function logSection(title) {
  console.log('\n' + colors.bright + colors.cyan + '═'.repeat(60) + colors.reset);
  console.log(colors.bright + colors.cyan + `  ${title}` + colors.reset);
  console.log(colors.bright + colors.cyan + '═'.repeat(60) + colors.reset);
}

// Find the most recent recording file
function findMostRecentRecording() {
  const recordingsDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Electron', 'recordings');
  
  if (!fs.existsSync(recordingsDir)) {
    throw new Error(`Recordings directory not found: ${recordingsDir}`);
  }
  
  const files = fs.readdirSync(recordingsDir)
    .filter(f => f.startsWith('recording-session-') && f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(recordingsDir, f),
      mtime: fs.statSync(path.join(recordingsDir, f)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime);
  
  if (files.length === 0) {
    throw new Error('No recording files found');
  }
  
  return files[0];
}

// Extract variables from recording data
function extractVariables(recordingData) {
  const variables = new Map();
  const fieldLastValue = {}; // Track final value for each field
  
  // First pass: collect the final value for each field
  if (recordingData.events) {
    recordingData.events.forEach(event => {
      if (event.type === 'action' && event.data) {
        const action = event.data;
        
        // Look for input actions with values
        if (action.action === 'input' && action.value && action.selector) {
          // Store the last (most complete) value for each field
          fieldLastValue[action.selector] = {
            value: action.value,
            element: action.elementInfo || action.element || {},
            url: action.url,
            timestamp: action.timestamp
          };
        }
      }
    });
  }
  
  // Second pass: process only the final values
  Object.keys(fieldLastValue).forEach(selector => {
    const fieldData = fieldLastValue[selector];
    const action = {
      value: fieldData.value,
      selector: selector,
      url: fieldData.url
    };
    const elementInfo = fieldData.element;
    
    if (action.value) {
          let varName = 'VALUE';
          let varValue = action.value;
          
          // elementInfo already extracted above
          const fieldType = elementInfo.type || '';
          const fieldName = (elementInfo.name || elementInfo.id || '').toLowerCase();
          const placeholder = (elementInfo.placeholder || '').toLowerCase();
          
          // Determine variable type based on field context
          if (fieldType === 'password' || fieldName.includes('password') || fieldName.includes('pass')) {
            varName = 'PASSWORD';
            varValue = '***' + varValue.slice(-2); // Mask password
          } else if (fieldType === 'email' || fieldName.includes('email') || placeholder.includes('email')) {
            varName = 'EMAIL_ADDRESS';
          } else if (fieldName.includes('username') || fieldName.includes('user') || placeholder.includes('username')) {
            varName = 'USERNAME';
          } else if (fieldType === 'tel' || fieldName.includes('phone') || fieldName.includes('tel')) {
            varName = 'PHONE_NUMBER';
          } else if (fieldName.includes('firstname') || fieldName.includes('first_name')) {
            varName = 'FIRST_NAME';
          } else if (fieldName.includes('lastname') || fieldName.includes('last_name')) {
            varName = 'LAST_NAME';
          } else if (fieldName.includes('company') || fieldName.includes('organization')) {
            varName = 'COMPANY_NAME';
          } else if (fieldName.includes('search') || fieldName.includes('query')) {
            varName = 'SEARCH_QUERY';
          } else if (fieldName.includes('amount') || fieldName.includes('price')) {
            varName = 'AMOUNT';
          }
          
          // Context-aware detection for inventory/product pages
          const url = action.url || '';
          const isInventoryPage = url.includes('inventory') || url.includes('product') || url.includes('item');
          if (isInventoryPage && varName === 'VALUE') {
            // Try to detect business fields on inventory pages
            if (fieldName.includes('name') || placeholder.includes('name')) {
              varName = 'ITEM_NAME';
            } else if (fieldName.includes('sell') || placeholder.includes('selling')) {
              varName = 'SELLING_PRICE';
            } else if (fieldName.includes('cost') || placeholder.includes('cost')) {
              varName = 'COST_PRICE';
            } else if (fieldName.includes('sku')) {
              varName = 'SKU';
            } else if (/^\d+(\.\d+)?$/.test(action.value)) {
              // Numeric value - likely a price
              if (!variables.has('SELLING_PRICE')) {
                varName = 'SELLING_PRICE';
              } else if (!variables.has('COST_PRICE')) {
                varName = 'COST_PRICE';
              }
            } else if (action.value.length > 3 && !variables.has('ITEM_NAME')) {
              // Text value - likely item name
              varName = 'ITEM_NAME';
            }
          }
          
          // Store variable with its value and context
          if (!variables.has(varName)) {
            variables.set(varName, {
              name: varName,
              value: varValue,
              fieldType: fieldType,
              fieldName: elementInfo.name || elementInfo.id || '',
              selector: action.selector || '',
              count: 1
            });
          } else {
            variables.get(varName).count++;
          }
        }
  });
  
  return variables;
}

// Main test function
async function testIntentSpecGeneration() {
  try {
    logSection('INTENT SPEC GENERATION TEST');
    
    // Find most recent recording
    log('\n🔍 Finding most recent recording...', colors.yellow);
    const recentFile = findMostRecentRecording();
    log(`📁 Found: ${recentFile.name}`, colors.green);
    log(`   Modified: ${recentFile.mtime.toLocaleString()}`, colors.gray);
    
    // Load recording data
    log('\n📖 Loading recording data...', colors.yellow);
    const recordingData = JSON.parse(fs.readFileSync(recentFile.path, 'utf-8'));
    
    // Show recording summary
    logSection('RECORDING SUMMARY');
    
    const eventCount = recordingData.events?.length || 0;
    const actionCount = recordingData.events?.filter(e => e.type === 'action').length || 0;
    const tabCount = recordingData.tabContexts?.length || Object.keys(recordingData.tabContexts || {}).length || 0;
    
    log(`📊 Total Events: ${eventCount}`, colors.blue);
    log(`🎯 Actions: ${actionCount}`, colors.blue);
    log(`📑 Tabs: ${tabCount}`, colors.blue);
    
    // Extract and show action types
    if (recordingData.events) {
      const actionTypes = {};
      recordingData.events.forEach(event => {
        if (event.type === 'action' && event.data?.action) {
          actionTypes[event.data.action] = (actionTypes[event.data.action] || 0) + 1;
        }
      });
      
      if (Object.keys(actionTypes).length > 0) {
        log('\n📌 Action Types Captured:', colors.cyan);
        Object.entries(actionTypes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .forEach(([type, count]) => {
            log(`   • ${type}: ${count}`, colors.gray);
          });
      }
    }
    
    // Generate Intent Spec
    logSection('GENERATING INTENT SPEC');
    log('⚙️  Processing recording data...', colors.yellow);
    
    const intentSpec = generateIntentSpecFromRichRecording(recordingData);
    
    log(`✅ Intent Spec generated successfully!`, colors.green);
    log(`   Name: ${intentSpec.name}`, colors.gray);
    log(`   URL: ${intentSpec.url || 'Not detected'}`, colors.gray);
    log(`   Steps: ${intentSpec.steps.length}`, colors.gray);
    
    // Analyze workflow
    logSection('WORKFLOW ANALYSIS');
    
    const analyzer = new WorkflowAnalyzer();
    const workflowAnalysis = analyzer.analyzeWorkflow(recordingData.events || []);
    
    log(`\n📊 Workflow Type: ${workflowAnalysis.type}`, colors.cyan);
    log(`🎯 Business Context: ${workflowAnalysis.context.domain}`, colors.cyan);
    log(`📝 Process Type: ${workflowAnalysis.context.processType}`, colors.cyan);
    if (workflowAnalysis.context.isMultiStep) {
      log(`⚡ Multi-step Process Detected`, colors.yellow);
    }
    
    if (Object.keys(workflowAnalysis.suggestedVariables).length > 0) {
      log(`\n💡 Workflow-based Variable Suggestions:`, colors.green);
      Object.entries(workflowAnalysis.suggestedVariables).forEach(([key, value]) => {
        log(`   ${key} → ${value}`, colors.gray);
      });
    }
    
    // Extract and analyze variables
    logSection('VARIABLE DETECTION');
    
    const detectedVariables = extractVariables(recordingData);
    
    if (detectedVariables.size > 0) {
      log(`\n🔤 Detected ${detectedVariables.size} variable(s):`, colors.green);
      
      detectedVariables.forEach((varInfo, varName) => {
        log(`\n   📝 ${varName}`, colors.bright + colors.yellow);
        log(`      Value: "${varInfo.value}"`, colors.gray);
        if (varInfo.fieldName) {
          log(`      Field: ${varInfo.fieldName}`, colors.gray);
        }
        if (varInfo.fieldType) {
          log(`      Type: ${varInfo.fieldType}`, colors.gray);
        }
        if (varInfo.count > 1) {
          log(`      Used: ${varInfo.count} times`, colors.gray);
        }
      });
    } else {
      log('❌ No variables detected in recording', colors.red);
      log('   (No input fields with values were captured)', colors.gray);
    }
    
    // Show Intent Spec params
    logSection('INTENT SPEC PARAMETERS');
    
    if (intentSpec.params && intentSpec.params.length > 0) {
      log(`\n📋 Parameters for automation:`, colors.green);
      intentSpec.params.forEach(param => {
        log(`   • {{${param}}}`, colors.cyan);
      });
    } else {
      log('❌ No parameters in Intent Spec', colors.red);
    }
    
    // Save test results
    const testResultPath = path.join(path.dirname(recentFile.path), `test-intent-spec-${Date.now()}.json`);
    const testResult = {
      timestamp: new Date().toISOString(),
      recordingFile: recentFile.name,
      recordingSummary: {
        eventCount,
        actionCount,
        tabCount
      },
      detectedVariables: Array.from(detectedVariables.values()),
      intentSpec: {
        name: intentSpec.name,
        url: intentSpec.url,
        params: intentSpec.params,
        stepCount: intentSpec.steps.length
      }
    };
    
    fs.writeFileSync(testResultPath, JSON.stringify(testResult, null, 2));
    
    logSection('TEST COMPLETE');
    log(`\n💾 Test results saved to:`, colors.green);
    log(`   ${testResultPath}`, colors.gray);
    
    // Show recommendations
    if (detectedVariables.size === 0 || intentSpec.params.length === 0) {
      logSection('RECOMMENDATIONS');
      log('\n⚠️  To improve variable detection:', colors.yellow);
      log('   1. Ensure you type in form fields during recording', colors.gray);
      log('   2. Include login forms or search boxes', colors.gray);
      log('   3. Fill out any input fields with sample data', colors.gray);
      log('   4. Make sure recording captures input events', colors.gray);
    }
    
  } catch (error) {
    logSection('ERROR');
    log(`\n❌ Test failed: ${error.message}`, colors.red);
    
    if (error.stack) {
      log('\nStack trace:', colors.gray);
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Run the test
console.clear();
log(colors.bright + colors.magenta + '\n🚀 INTENT SPEC GENERATION TEST TOOL\n' + colors.reset);

testIntentSpecGeneration().then(() => {
  log('\n✨ Test completed successfully!\n', colors.bright + colors.green);
}).catch(error => {
  log('\n💥 Unexpected error!\n', colors.bright + colors.red);
  console.error(error);
  process.exit(1);
});