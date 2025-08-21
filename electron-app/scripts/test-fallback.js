#!/usr/bin/env node

/**
 * Fallback Testing Script
 * 
 * This script runs the execution fallback tests and generates a comprehensive report
 * showing the behavior of the fallback mechanisms under various scenarios.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Fallback Mechanism Tests...\n');

// Test configuration
const testConfig = {
  testFile: 'tests/execution-fallback.spec.ts',
  outputDir: path.join(__dirname, '..', 'test-results'),
  reportFile: 'fallback-test-report.json'
};

// Ensure output directory exists
if (!fs.existsSync(testConfig.outputDir)) {
  fs.mkdirSync(testConfig.outputDir, { recursive: true });
}

// Test scenarios to run
const testScenarios = [
  {
    name: 'AI to Snippet Fallback',
    grep: 'AI to Snippet Fallback',
    description: 'Tests primary fallback mechanism when AI execution fails'
  },
  {
    name: 'Snippet to AI Fallback', 
    grep: 'Snippet to AI Fallback',
    description: 'Tests reverse fallback when snippet execution fails'
  },
  {
    name: 'No Fallback Scenarios',
    grep: 'No Fallback Scenarios',
    description: 'Tests behavior when fallback is disabled'
  },
  {
    name: 'Fallback Recovery',
    grep: 'Fallback Recovery and Continuation',
    description: 'Tests execution continuation after successful fallback'
  },
  {
    name: 'Fallback Reporting',
    grep: 'Fallback Reporting and Statistics',
    description: 'Tests accuracy of fallback statistics and reporting'
  },
  {
    name: 'Edge Cases',
    grep: 'Edge Cases and Error Handling',
    description: 'Tests error handling and edge cases in fallback scenarios'
  }
];

// Results tracking
const testResults = {
  timestamp: new Date().toISOString(),
  totalScenarios: testScenarios.length,
  passedScenarios: 0,
  failedScenarios: 0,
  scenarios: [],
  summary: {}
};

console.log(`📋 Running ${testScenarios.length} fallback test scenarios...\n`);

// Run each test scenario
for (const scenario of testScenarios) {
  console.log(`\n🧪 Testing: ${scenario.name}`);
  console.log(`   ${scenario.description}`);
  
  const scenarioResult = {
    name: scenario.name,
    description: scenario.description,
    status: 'unknown',
    duration: 0,
    output: '',
    error: null
  };
  
  try {
    const startTime = Date.now();
    
    // Run the specific test scenario
    const command = `npm test -- ${testConfig.testFile} --grep "${scenario.grep}" --reporter json`;
    const output = execSync(command, { 
      encoding: 'utf8',
      timeout: 60000 // 60 second timeout per scenario
    });
    
    const endTime = Date.now();
    scenarioResult.duration = endTime - startTime;
    scenarioResult.output = output;
    scenarioResult.status = 'passed';
    testResults.passedScenarios++;
    
    console.log(`   ✅ PASSED (${scenarioResult.duration}ms)`);
    
  } catch (error) {
    scenarioResult.status = 'failed';
    scenarioResult.error = error.message;
    scenarioResult.output = error.stdout || error.message;
    testResults.failedScenarios++;
    
    console.log(`   ❌ FAILED: ${error.message.split('\n')[0]}`);
  }
  
  testResults.scenarios.push(scenarioResult);
}

// Generate summary
testResults.summary = {
  successRate: (testResults.passedScenarios / testResults.totalScenarios * 100).toFixed(1),
  totalDuration: testResults.scenarios.reduce((sum, s) => sum + s.duration, 0),
  averageDuration: Math.round(testResults.scenarios.reduce((sum, s) => sum + s.duration, 0) / testResults.scenarios.length)
};

// Save detailed results
const reportPath = path.join(testConfig.outputDir, testConfig.reportFile);
fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));

// Display final results
console.log('\n\n📊 FALLBACK TEST RESULTS SUMMARY');
console.log('═'.repeat(50));
console.log(`Total Scenarios: ${testResults.totalScenarios}`);
console.log(`Passed: ${testResults.passedScenarios} ✅`);
console.log(`Failed: ${testResults.failedScenarios} ❌`);
console.log(`Success Rate: ${testResults.summary.successRate}%`);
console.log(`Total Duration: ${testResults.summary.totalDuration}ms`);
console.log(`Average Duration: ${testResults.summary.averageDuration}ms`);
console.log(`\nDetailed Report: ${reportPath}`);

// Show individual scenario results
console.log('\n📋 SCENARIO BREAKDOWN');
console.log('─'.repeat(50));
testResults.scenarios.forEach(scenario => {
  const status = scenario.status === 'passed' ? '✅' : '❌';
  console.log(`${status} ${scenario.name} (${scenario.duration}ms)`);
  if (scenario.status === 'failed') {
    console.log(`    Error: ${scenario.error}`);
  }
});

// Generate fallback behavior demonstration
console.log('\n\n🔄 FALLBACK BEHAVIOR DEMONSTRATION');
console.log('═'.repeat(50));

const fallbackDemo = {
  "Normal Execution (AI Success)": {
    steps: [{ pathUsed: "ai", fallbackOccurred: false }],
    fallbackCount: 0,
    pattern: "AI → Success"
  },
  "Single Fallback (AI Fail → Snippet Success)": {
    steps: [{ pathUsed: "snippet", fallbackOccurred: true }],
    fallbackCount: 1,
    pattern: "AI → Fail → Snippet → Success"
  },
  "Complete Failure (Both Fail)": {
    steps: [{ pathUsed: "snippet", fallbackOccurred: true, success: false }],
    fallbackCount: 1,
    pattern: "AI → Fail → Snippet → Fail"
  },
  "No Fallback Mode": {
    steps: [{ pathUsed: "ai", fallbackOccurred: false, success: false }],
    fallbackCount: 0,
    pattern: "AI → Fail → Stop (No Fallback)"
  },
  "Mixed Execution": {
    steps: [
      { pathUsed: "ai", fallbackOccurred: false },
      { pathUsed: "snippet", fallbackOccurred: true },
      { pathUsed: "ai", fallbackOccurred: false }
    ],
    fallbackCount: 1,
    pattern: "AI → Snippet (fallback) → AI"
  }
};

Object.entries(fallbackDemo).forEach(([scenario, config]) => {
  console.log(`\n${scenario}:`);
  console.log(`  Pattern: ${config.pattern}`);
  console.log(`  Fallback Count: ${config.fallbackCount}`);
  console.log(`  Steps: ${config.steps.length}`);
});

// Performance insights
console.log('\n\n⚡ PERFORMANCE INSIGHTS');
console.log('═'.repeat(50));

const avgDuration = testResults.summary.averageDuration;
const successRate = parseFloat(testResults.summary.successRate);

if (successRate >= 95) {
  console.log('✅ Excellent: Fallback success rate is optimal (≥95%)');
} else if (successRate >= 85) {
  console.log('⚠️  Good: Fallback success rate is acceptable (≥85%)');
} else {
  console.log('❌ Poor: Fallback success rate needs improvement (<85%)');
}

if (avgDuration <= 2000) {
  console.log('✅ Excellent: Average fallback time is optimal (≤2s)');
} else if (avgDuration <= 5000) {
  console.log('⚠️  Good: Average fallback time is acceptable (≤5s)');
} else {
  console.log('❌ Poor: Average fallback time is too slow (>5s)');
}

// Exit with appropriate code
const exitCode = testResults.failedScenarios > 0 ? 1 : 0;
console.log(`\n${exitCode === 0 ? '🎉' : '💥'} Test execution completed with exit code: ${exitCode}`);

process.exit(exitCode);