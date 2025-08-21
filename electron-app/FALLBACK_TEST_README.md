# Execution System Fallback Testing

This directory contains comprehensive tests for the execution system's fallback mechanisms. The tests verify that the system properly handles failures and recovers using alternative execution methods.

## Quick Start

### Run All Fallback Tests
```bash
npm run test:fallback
```

### Run Fallback Tests with Detailed Report
```bash
npm run test:fallback:report
```

### Run All Execution Tests
```bash
npm run test:all
```

## Test Files

### Main Test Suite
- **`tests/execution-fallback.spec.ts`** - Comprehensive fallback mechanism tests
- **`tests/magnitude-execution.spec.ts`** - General execution system tests

### Support Files
- **`scripts/test-fallback.js`** - Test runner with detailed reporting
- **`examples/fallback-demo.ts`** - Interactive demonstration of fallback behaviors
- **`FALLBACK_TESTING_GUIDE.md`** - Detailed testing methodology and scenarios

## Test Categories

### 🔄 AI to Snippet Fallback
Tests the primary fallback mechanism where AI execution fails and the system automatically switches to snippet-based execution.

**Key Tests:**
- Basic AI failure → snippet success
- Event emission during fallback
- Error detail preservation
- Duration tracking

### 🔄 Snippet to AI Fallback  
Tests reverse fallback scenarios (when implemented) where snippet execution fails and falls back to AI.

**Key Tests:**
- Snippet syntax error handling
- Snippet timeout recovery
- Preference-based execution order

### ⛔ No Fallback Scenarios
Tests strict execution mode where fallback is disabled and execution stops on first failure.

**Key Tests:**
- Global fallback disabled
- Step-level fallback="none"
- Execution termination behavior

### 🔗 Recovery and Continuation
Tests that execution properly continues after successful fallback operations.

**Key Tests:**
- Multi-step execution with mixed success/failure
- State preservation across fallbacks
- Statistics accumulation

### 📊 Reporting and Statistics
Tests accuracy of execution reporting including fallback counts, durations, and path usage.

**Key Tests:**
- Fallback count accuracy
- Path usage tracking (AI vs snippet)
- Duration measurement
- Event correlation

### 🛠️ Edge Cases and Error Handling
Tests error handling, cleanup, and edge cases in fallback scenarios.

**Key Tests:**
- Resource cleanup after failures
- Variable substitution in fallback context
- Concurrent execution handling
- Memory leak prevention

## Running Individual Test Categories

### AI to Snippet Fallback Only
```bash
npm test -- tests/execution-fallback.spec.ts --grep "AI to Snippet Fallback"
```

### No Fallback Scenarios Only
```bash
npm test -- tests/execution-fallback.spec.ts --grep "No Fallback Scenarios"
```

### Recovery Tests Only
```bash
npm test -- tests/execution-fallback.spec.ts --grep "Fallback Recovery"
```

## Test Configuration

### Mock Strategy
Tests use Jest mocks to simulate failure conditions:

```typescript
// Force AI execution to fail
(orchestrator as any).executeStepWithAI = jest.fn().mockRejectedValue(
  new Error("Simulated AI execution failure")
);

// Mock snippet execution to succeed
(orchestrator as any).executeStepWithSnippet = jest.fn().mockResolvedValue({
  success: true,
  screenshot: null
});
```

### Expected Test Results

**Successful Fallback:**
```json
{
  "fallbackCount": 1,
  "aiUsageCount": 0,
  "snippetUsageCount": 1,
  "overallSuccess": true,
  "steps": [{
    "pathUsed": "snippet",
    "fallbackOccurred": true,
    "success": true
  }]
}
```

**Failed Execution (Both Methods Fail):**
```json
{
  "fallbackCount": 1,
  "aiUsageCount": 0,
  "snippetUsageCount": 0,
  "overallSuccess": false,
  "steps": [{
    "pathUsed": "snippet",
    "fallbackOccurred": true,
    "success": false,
    "error": "AI failed: Element not found. Fallback failed: Selector timeout"
  }]
}
```

## Interactive Demo

Run the interactive fallback demonstration:

```bash
npx tsx examples/fallback-demo.ts
```

This will show:
- Live fallback behavior
- Event monitoring
- Different orchestrator configurations
- Performance simulation scenarios

## Debugging Test Failures

### Enable Verbose Output
```bash
npm test -- tests/execution-fallback.spec.ts --verbose
```

### Debug Specific Test
```bash
npm test -- tests/execution-fallback.spec.ts --grep "should fallback from AI to snippet" --debug
```

### Check Test Results
After running `npm run test:fallback:report`, check the detailed report:
```bash
cat test-results/fallback-test-report.json
```

## Performance Benchmarks

### Expected Performance Metrics
- **Fallback Success Rate**: ≥95%
- **Average Fallback Time**: ≤2 seconds
- **Memory Usage**: No leaks during repeated fallbacks
- **Event Emission**: All fallback events properly fired

### Performance Test Command
```bash
npm run test:fallback:report
```

This generates performance insights and recommendations.

## Continuous Integration

### CI/CD Test Commands
```bash
# Quick fallback verification
npm run test:fallback

# Full test suite with reporting  
npm run test:all && npm run test:fallback:report
```

### Quality Gates
- All fallback tests must pass
- Fallback success rate ≥95%
- No performance regressions
- Proper error handling verified

## Troubleshooting

### Common Issues

**1. Tests timing out**
```bash
# Increase timeout in playwright.config.ts
timeout: 60000
```

**2. Mock functions not working**
```bash
# Ensure proper TypeScript casting
(orchestrator as any).executeStepWithAI = jest.fn()...
```

**3. Event listeners not firing**
```bash
# Verify event listener setup before test execution
orchestrator.on('fallback-started', callback);
```

### Debug Mode
```typescript
const orchestrator = new ExecutionOrchestrator({
  enableFallback: true,
  saveScreenshots: true, // Capture failure states
  timeout: 60000 // Extended timeout for debugging
});
```

## Contributing

When adding new fallback tests:

1. **Follow naming convention**: `should [behavior] when [condition]`
2. **Include performance verification**: Check durations and resource usage
3. **Test both success and failure paths**: Verify error handling
4. **Add to appropriate test category**: Keep tests organized
5. **Update documentation**: Add new scenarios to this README

### Test Template
```typescript
test('should [expected behavior] when [condition]', async () => {
  // Arrange: Set up test spec and mocks
  const testSpec = createTestSpec(/* ... */);
  
  // Act: Execute with orchestrator
  const report = await orchestrator.execute(testSpec);
  
  // Assert: Verify expected fallback behavior
  expect(report.fallbackCount).toBe(expectedCount);
  expect(report.overallSuccess).toBe(expectedSuccess);
});
```

This comprehensive test suite ensures the execution system's fallback mechanisms provide reliable automation capabilities even when individual execution methods encounter failures.