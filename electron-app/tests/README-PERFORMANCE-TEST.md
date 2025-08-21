# Recording Performance Test

This performance test suite verifies that the enhanced recording functionality does not significantly impact the user experience or system performance.

## Test Overview

The `recording-performance.spec.ts` test measures and validates:

1. **CPU Overhead**: CPU usage increase when recording is active
2. **Memory Overhead**: Memory consumption increase during recording
3. **UI Responsiveness**: Delays in user interactions due to recording
4. **Data Capture Quality**: Completeness and accuracy of recorded data

## Performance Thresholds

The test enforces the following performance requirements:

- **CPU Overhead**: < 10% increase from baseline
- **Memory Overhead**: < 100 MB increase from baseline  
- **UI Responsiveness**: < 50% delay increase for user actions
- **Data Completeness**: > 95% of actions captured accurately

## Running the Test

### Quick Run (Recommended)
```bash
npm run test:performance
```
This automatically builds the app if needed and runs the full performance test suite.

### With Interactive Report
```bash
npm run test:performance -- --report
```
Generates and opens an interactive HTML report after test completion.

### Raw Playwright Test (Advanced)
```bash
npm run test:performance:raw
```
Runs the test directly with Playwright (requires manual build: `npm run build`)

### With Custom Configuration
```bash
# Run with headed mode to see UI during test
npm run test:performance:raw -- --headed

# Run with specific timeout
npm run test:performance:raw -- --timeout=120000
```

## Test Structure

### Phase 1: Baseline Measurement
- Launches Electron app without recording
- Performs standard user actions
- Measures resource usage (CPU, memory)
- Records action timing for comparison

### Phase 2: Recording Performance Test
- Starts enhanced recording functionality
- Performs identical user actions
- Measures recording overhead
- Captures data size and completeness

### Phase 3: Validation and Reporting
- Compares recording vs baseline metrics
- Validates against performance thresholds
- Generates detailed performance report
- Provides optimization recommendations

## Test Actions

The test performs these representative user actions:

1. **Navigation**: Loading web pages in browser tabs
2. **Clicking**: Multiple click interactions across the page
3. **Typing**: Text input and form filling
4. **Form Interaction**: Complete form workflows
5. **Scrolling**: Page scrolling and viewport changes
6. **Multiple Actions**: Rapid successive interactions

## Understanding Results

### Success Criteria
All tests must pass for the recording system to be considered performant:

- ✅ **CPU Overhead PASS**: Recording adds < 10% CPU usage
- ✅ **Memory Overhead PASS**: Recording adds < 100 MB memory
- ✅ **UI Responsiveness PASS**: Actions complete within 150% of baseline time
- ✅ **Data Quality PASS**: > 95% of actions captured

### Common Issues and Solutions

#### High CPU Overhead
```
❌ CPU overhead (15.2%) exceeds threshold (10%)
```
**Solutions:**
- Optimize event handlers in recording system
- Implement async processing of recording data
- Reduce frequency of performance monitoring calls

#### High Memory Overhead
```
❌ Memory overhead (120.5 MB) exceeds threshold (100 MB)
```
**Solutions:**
- Implement data streaming instead of buffering
- Add data compression for recorded actions
- Clear unused recording data more frequently

#### Poor Responsiveness
```
❌ Maximum action overhead (75.3%) impacts user experience
```
**Solutions:**
- Use debouncing for rapid action sequences
- Move recording processing to background threads
- Optimize DOM event capture mechanisms

#### Incomplete Data Capture
```
❌ Data completeness (89.2%) below threshold (95%)
```
**Solutions:**
- Review event listener coverage
- Fix race conditions in data capture
- Improve error handling in recording system

## Performance Report

The test generates a detailed Markdown report at:
```
test-results/recording-performance-report-[timestamp].md
```

The report includes:
- Executive summary with pass/fail status
- Detailed metrics breakdown
- Action-by-action performance analysis
- System information and test environment
- Specific recommendations for improvements

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Performance Tests
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:performance
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: performance-report
          path: test-results/recording-performance-report-*.md
```

### Performance Monitoring
```bash
# Run performance test and check thresholds
npm run test:performance || echo "Performance regression detected!"

# Generate trending data
echo "$(date),$(grep 'CPU overhead:' test-results/recording-performance-report-*.md)" >> performance-trends.csv
```

## Troubleshooting

### Test Fails to Start
- Ensure Playwright browsers are installed: `npx playwright install`
- Check Electron app builds: `npm run build`
- Verify environment variables are set

### Inconsistent Results
- Run test multiple times to account for system variance
- Close other applications to reduce system load
- Use dedicated test environment for reliable results

### Recording Not Available
- Test falls back to performance monitoring without actual recording
- Still validates system impact of recording infrastructure
- Check IPC handlers and recording system initialization

## Best Practices

1. **Run on Dedicated Hardware**: Use consistent test environment
2. **Multiple Runs**: Execute test 3-5 times and average results  
3. **System Isolation**: Close unnecessary applications during testing
4. **Regular Monitoring**: Include in CI/CD pipeline for regression detection
5. **Baseline Updates**: Update performance baselines after system changes

## Contributing

When modifying the performance test:

1. Maintain backward compatibility with existing thresholds
2. Add new test actions that represent real user workflows
3. Update documentation for any new metrics or thresholds
4. Validate test changes across different platforms
5. Consider both synthetic and real-world performance scenarios

---

For questions about performance test results or implementation details, please refer to the main project documentation or create an issue with the `performance` label.