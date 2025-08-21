# Multi-Tab Functionality Tests

This directory contains Playwright tests for the Electron app's multi-tab functionality using WebView2.

## Running the Tests

### Prerequisites

1. Ensure all dependencies are installed:
   ```bash
   npm install
   ```

2. Build the Electron app before running tests:
   ```bash
   npm run build
   ```

3. Install Playwright browsers (if not already installed):
   ```bash
   npx playwright install
   ```

### Running Tests

Run all tests:
```bash
npm test
```

Run specific test file:
```bash
npx playwright test tests/multitab.spec.ts
```

Run tests with UI mode for debugging:
```bash
npx playwright test --ui
```

Run tests in headed mode (see the Electron app):
```bash
npx playwright test --headed
```

### Test Coverage

The `multitab.spec.ts` file includes comprehensive tests for:

1. **Application Launch**: Verifies the Electron app starts successfully
2. **URL Loading**: Tests opening URLs in tab A and verifying content loads
3. **Tab Creation**: Tests `window.open()` functionality to create new tabs
4. **Tab Bar Verification**: Ensures new tabs appear in the tab bar
5. **Tab Switching**: Tests switching between multiple tabs
6. **Cross-Tab Interaction**: Verifies automation can interact with content in different tabs
7. **Tab Closing**: Tests closing individual tabs and cleanup
8. **Edge Cases**: Rapid tab switching and stress testing
9. **WebView2 Integration**: Verifies WebView2 isolation and functionality

### Test Structure

Each test follows this pattern:
- **Setup**: Launch Electron app and wait for initialization
- **Action**: Perform the specific multi-tab operation
- **Verification**: Assert expected behavior and state
- **Cleanup**: Close the app properly

### Debugging

- Use `--headed` flag to see the Electron app during testing
- Use `--debug` flag to pause execution and debug step by step
- Screenshots and videos are captured on test failures
- Check `test-results/` directory for artifacts

### Notes

- Tests are designed to work with WebView2 on Windows
- The tests create a realistic multi-tab browser environment
- All interactions are verified to ensure automation compatibility
- Tests include proper timeouts and error handling