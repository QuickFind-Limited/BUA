# Test Plan: Electron App with Edge WebView2, Playwright Recording, and Intent Spec Generation

## Document Information
- **Version**: 1.0
- **Created**: August 16, 2025
- **Author**: Comprehensive Test Plan Generation
- **Application**: Multi-tab Electron Browser with AI Automation

## Table of Contents
1. [Test Objectives and Scope](#test-objectives-and-scope)
2. [Test Environment](#test-environment)
3. [Test Components Overview](#test-components-overview)
4. [Test Cases](#test-cases)
5. [Test Data](#test-data)
6. [Test Execution Guidelines](#test-execution-guidelines)
7. [Risk Assessment](#risk-assessment)

## Test Objectives and Scope

### Primary Objectives
- Verify Electron application startup and initialization
- Validate multi-tab WebView2 browser functionality
- Test Playwright Codegen recording capabilities
- Verify Intent Spec generation from recordings
- Validate CLI command functionality
- Test AI and snippet execution paths
- Verify fallback mechanisms and error handling
- Ensure UI component functionality and interaction

### Scope
**In Scope:**
- Electron main process functionality
- Multi-tab WebView2 management
- UI components (tab bar, navigation, variables panel)
- Playwright recording and code generation
- Intent Spec creation and validation
- CLI command execution
- AI and snippet execution paths
- Error handling and fallback mechanisms

**Out of Scope:**
- External website functionality
- Network infrastructure testing
- Third-party API reliability
- Operating system specific browser engine bugs

## Test Environment

### System Requirements
- **Operating System**: Windows 10/11 (primary), Windows Server 2019+ (secondary)
- **Architecture**: x64
- **Edge WebView2 Runtime**: Latest stable version
- **Node.js**: v18.0.0 or higher
- **Memory**: Minimum 4GB RAM, Recommended 8GB+
- **Disk Space**: 2GB available space

### Dependencies
- Electron 31.0.0+
- Playwright 1.54.2+
- TypeScript 5.0.0+
- @anthropic-ai/claude-code 1.0.83+
- Edge WebView2 Runtime

### Test Data URLs
- **Primary Test URL**: https://httpbin.org/html
- **Secondary Test URL**: https://example.com
- **Data URL Template**: `data:text/html,<html><body><h1>Test Content</h1></body></html>`
- **Local Test File**: file://test-page.html (for file protocol testing)

## Test Components Overview

### Core Components
1. **Electron Main Process** (`main.ts`)
2. **WebContentsTabManager** (Multi-tab management)
3. **UI Components** (Tab bar, navigation, variables panel)
4. **Playwright Codegen Recorder**
5. **Intent Spec Generator**
6. **CLI Interface**
7. **Execution Engine** (AI and snippet paths)
8. **Fallback Handler**

## Test Cases

### 1. Electron Application Startup Tests

#### TC-001: Application Launch
**Objective**: Verify the Electron application starts successfully
**Priority**: Critical

**Preconditions**:
- WebView2 runtime installed
- Application built (`npm run build`)

**Test Steps**:
1. Execute `npm start` command
2. Wait for application window to appear
3. Verify main window loads

**Expected Results**:
- Application window opens with dimensions 1400x900
- Window title displays "Electron WebView2 Browser"
- Tab bar is visible and functional
- Navigation bar is present with all controls
- Status bar shows "Ready" status
- Initial Google tab is created automatically

**Test Data**: N/A

---

#### TC-002: Development Mode Launch
**Objective**: Verify application starts in development mode with DevTools
**Priority**: Medium

**Test Steps**:
1. Set `NODE_ENV=development`
2. Execute `npm run dev`
3. Verify DevTools opens automatically

**Expected Results**:
- Application launches successfully
- DevTools window is opened by default
- Console shows development mode logs

---

#### TC-003: Application Shutdown
**Objective**: Verify clean application shutdown
**Priority**: High

**Test Steps**:
1. Launch application
2. Create multiple tabs with content
3. Close application via window close button
4. Verify clean shutdown

**Expected Results**:
- All WebView instances are properly disposed
- No memory leaks or hanging processes
- Application exits cleanly

---

### 2. UI Component Tests

#### TC-004: Tab Bar Functionality
**Objective**: Verify tab bar creation, management, and interaction
**Priority**: Critical

**Test Steps**:
1. Launch application
2. Verify initial tab is created
3. Click "New Tab" button (+)
4. Verify new tab appears in tab bar
5. Click between tabs to switch
6. Click close button on tab

**Expected Results**:
- Initial tab appears with proper title
- New tab button creates additional tabs
- Tab switching works correctly
- Active tab is visually highlighted
- Tab close functionality works
- Tab titles update based on page content

**Test Data**:
- Tab count: 1-10 tabs
- Tab titles: "New Tab", page titles from loaded URLs

---

#### TC-005: Navigation Bar Controls
**Objective**: Verify navigation controls functionality
**Priority**: Critical

**Test Steps**:
1. Navigate to test URL via address bar
2. Test back/forward buttons
3. Test reload button
4. Test Go button
5. Verify address bar updates

**Expected Results**:
- Address bar accepts URLs and search terms
- Go button navigates to entered URL
- Back/forward buttons work correctly
- Reload button refreshes current page
- Navigation state updates properly

**Test Data**:
```
URLs: 
- https://httpbin.org/html
- https://example.com
- https://www.google.com
- data:text/html,<h1>Test</h1>
```

---

#### TC-006: Recording Controls
**Objective**: Verify recording button functionality
**Priority**: High

**Test Steps**:
1. Click "Record" button
2. Verify recording state changes
3. Perform user interactions
4. Stop recording
5. Verify "Analyze" button appears

**Expected Results**:
- Record button changes state when clicked
- Recording indicator shows active state
- User interactions are captured
- Stop recording generates output files
- Analyze button becomes available

---

#### TC-007: Variables Panel
**Objective**: Verify variables panel display and functionality
**Priority**: Medium

**Test Steps**:
1. Generate Intent Spec with variables
2. Open variables panel
3. Modify variable values
4. Execute flow with variables
5. Close panel

**Expected Results**:
- Variables panel opens/closes correctly
- Variable form fields are editable
- Variable values are passed to execution
- Flow execution uses provided variables
- Panel state persists during session

**Test Data**:
```json
{
  "EMAIL": "test@example.com",
  "USERNAME": "testuser",
  "PASSWORD": "testpass123",
  "PHONE_NUMBER": "1234567890"
}
```

---

### 3. WebView2 Browser Tests

#### TC-008: Single Tab Navigation
**Objective**: Verify WebView2 basic navigation functionality
**Priority**: Critical

**Test Steps**:
1. Enter URL in address bar
2. Click Go button
3. Verify page loads in WebView
4. Test page interactions
5. Navigate to different URL

**Expected Results**:
- WebView displays web content correctly
- Page interactions work (clicks, scrolling)
- JavaScript execution functions properly
- CSS and media content renders correctly
- Page navigation updates address bar

---

#### TC-009: Multi-Tab Management
**Objective**: Verify multiple WebView tabs work independently
**Priority**: Critical

**Test Steps**:
1. Create first tab, navigate to URL A
2. Create second tab, navigate to URL B
3. Switch between tabs
4. Verify content isolation
5. Close tabs in different orders

**Expected Results**:
- Each tab maintains independent content
- Tab switching shows correct content
- No cross-tab contamination
- Tab closing works correctly
- WebView instances are properly managed

**Test Data**:
- Tab A: https://httpbin.org/html
- Tab B: https://example.com
- Tab C: data:text/html,<h1>Tab C Content</h1>

---

#### TC-010: WebView Security
**Objective**: Verify WebView security policies
**Priority**: High

**Test Steps**:
1. Attempt to navigate to file:// protocol
2. Test Content Security Policy enforcement
3. Verify permission request handling
4. Test new window creation blocking

**Expected Results**:
- file:// protocol navigation is blocked
- CSP headers are properly set
- Permission requests are handled correctly
- New windows open as tabs instead

---

### 4. Playwright Recording Tests

#### TC-011: Recording Session Management
**Objective**: Verify Playwright recording lifecycle
**Priority**: Critical

**Test Steps**:
1. Start recording session
2. Perform user interactions
3. Stop recording session
4. Verify generated files
5. Check recording metadata

**Expected Results**:
- Recording session starts successfully
- User interactions are captured
- Recording stops cleanly
- Spec file is generated (.spec.ts)
- Screenshot is captured
- Metadata file is created

**Test Data**:
```
Session ID: test-recording-{timestamp}
URLs: https://httpbin.org/html, https://example.com
Actions: navigate, click, fill, select, wait
```

---

#### TC-012: Code Generation Quality
**Objective**: Verify generated Playwright code quality
**Priority**: High

**Test Steps**:
1. Record complex user flow
2. Stop recording
3. Analyze generated code
4. Execute generated test
5. Verify test passes

**Expected Results**:
- Generated code follows Playwright best practices
- Code includes proper imports and structure
- Actions are correctly captured
- Selectors are stable and reliable
- Generated test executes successfully

---

#### TC-013: Recording Error Handling
**Objective**: Verify recording handles errors gracefully
**Priority**: Medium

**Test Steps**:
1. Start recording
2. Navigate to invalid URL
3. Perform actions on missing elements
4. Stop recording
5. Verify error handling

**Expected Results**:
- Invalid navigation is handled gracefully
- Missing elements don't crash recording
- Error states are documented
- Fallback code is generated
- Recording session completes

---

### 5. Intent Spec Generation Tests

#### TC-014: Basic Intent Spec Creation
**Objective**: Verify Intent Spec generation from recordings
**Priority**: Critical

**Test Steps**:
1. Create Playwright recording
2. Run Intent Spec generator
3. Verify Intent Spec structure
4. Validate generated parameters
5. Check dual path generation

**Expected Results**:
- Intent Spec follows proper JSON schema
- AI instructions are human-readable
- Snippet code is syntactically correct
- Parameters are extracted correctly
- Both AI and snippet paths are generated

**Test Data**:
```json
{
  "name": "form_submission_flow",
  "url": "https://httpbin.org/forms/post",
  "steps": [
    {"type": "navigate", "prefer": "snippet"},
    {"type": "fill", "prefer": "snippet"},
    {"type": "click", "prefer": "ai"}
  ]
}
```

---

#### TC-015: Parameter Extraction
**Objective**: Verify parameter detection and parameterization
**Priority**: High

**Test Steps**:
1. Record flow with form inputs
2. Generate Intent Spec
3. Verify parameter extraction
4. Test parameter patterns
5. Validate variable substitution

**Expected Results**:
- Email patterns become {{EMAIL}}
- Names become {{USERNAME}}
- Phone numbers become {{PHONE_NUMBER}}
- Generic text becomes parameterized
- Parameters list is complete

---

#### TC-016: Preference Assignment
**Objective**: Verify AI vs snippet preference logic
**Priority**: Medium

**Test Steps**:
1. Generate Intent Spec with preferences
2. Verify navigation steps prefer snippets
3. Verify dynamic elements prefer AI
4. Test custom preference options
5. Validate fallback assignment

**Expected Results**:
- Navigation steps default to snippet
- Text-based selectors prefer AI
- Form fields prefer snippets
- Custom preferences are respected
- Fallback paths are assigned correctly

---

### 6. CLI Command Tests

#### TC-017: Generate Intent Command
**Objective**: Verify CLI intent generation functionality
**Priority**: High

**Test Steps**:
1. Create recording file
2. Execute `claude-code generate-intent --from recording.spec.ts`
3. Test with options: `--with-fallback`, `--prefer-snippet-for`, `--prefer-ai-for`
4. Verify output file generation
5. Validate generated Intent Spec

**Expected Results**:
- Command executes successfully
- Intent Spec file is created
- Command options work correctly
- Error messages are helpful
- Generated spec is valid JSON

**Test Data**:
```bash
claude-code generate-intent --from recordings/test-recording.spec.ts --with-fallback --prefer-snippet-for "navigation,forms" --prefer-ai-for "dynamic_elements"
```

---

#### TC-018: CLI Error Handling
**Objective**: Verify CLI handles invalid inputs gracefully
**Priority**: Medium

**Test Steps**:
1. Run command with missing file
2. Run with invalid options
3. Test with malformed recording
4. Verify error messages
5. Test help command

**Expected Results**:
- Missing files show clear error messages
- Invalid options are rejected gracefully
- Malformed input is handled safely
- Help text is accurate and useful
- Exit codes are appropriate

---

### 7. Execution Path Tests

#### TC-019: AI Execution Path
**Objective**: Verify AI-guided execution functionality
**Priority**: High

**Test Steps**:
1. Create Intent Spec with AI-preferred steps
2. Execute flow using AI path
3. Verify Claude API integration
4. Test dynamic element handling
5. Validate execution success

**Expected Results**:
- AI instructions are processed correctly
- Claude API calls succeed
- Dynamic elements are located properly
- Execution completes successfully
- Results match expected outcomes

---

#### TC-020: Snippet Execution Path
**Objective**: Verify direct Playwright snippet execution
**Priority**: Critical

**Test Steps**:
1. Create Intent Spec with snippet-preferred steps
2. Execute flow using snippet path
3. Verify Playwright execution
4. Test deterministic actions
5. Validate execution performance

**Expected Results**:
- Snippet code executes directly
- Playwright actions perform correctly
- Execution is faster than AI path
- Results are deterministic
- No API calls are made

---

#### TC-021: Mixed Execution Path
**Objective**: Verify flows with both AI and snippet steps
**Priority**: High

**Test Steps**:
1. Create Intent Spec with mixed preferences
2. Execute flow with both path types
3. Verify seamless transition
4. Test context preservation
5. Validate final state

**Expected Results**:
- Execution switches between paths smoothly
- Context is preserved between steps
- Both AI and snippets execute correctly
- Final state matches expectations
- No execution conflicts occur

---

### 8. Fallback Mechanism Tests

#### TC-022: AI to Snippet Fallback
**Objective**: Verify fallback when AI execution fails
**Priority**: High

**Test Steps**:
1. Create Intent Spec with AI preference and snippet fallback
2. Simulate AI execution failure
3. Verify automatic fallback to snippet
4. Test fallback execution success
5. Validate error logging

**Expected Results**:
- AI failure is detected automatically
- Fallback to snippet occurs seamlessly
- Snippet execution succeeds
- Error is logged appropriately
- User is notified of fallback usage

---

#### TC-023: Snippet to AI Fallback
**Objective**: Verify fallback when snippet execution fails
**Priority**: High

**Test Steps**:
1. Create Intent Spec with snippet preference and AI fallback
2. Simulate snippet execution failure
3. Verify automatic fallback to AI
4. Test AI execution success
5. Validate error recovery

**Expected Results**:
- Snippet failure is detected
- Fallback to AI occurs automatically
- AI execution succeeds
- Recovery is transparent to user
- Execution continues normally

---

#### TC-024: No Fallback Failure
**Objective**: Verify behavior when both paths fail
**Priority**: Medium

**Test Steps**:
1. Create Intent Spec with no fallback
2. Simulate primary execution failure
3. Verify error handling
4. Test user notification
5. Validate graceful failure

**Expected Results**:
- Execution stops at failed step
- Clear error message is displayed
- Execution state is preserved
- User can retry or modify
- No system crash occurs

---

### 9. Error Handling Tests

#### TC-025: Network Connection Errors
**Objective**: Verify handling of network-related failures
**Priority**: Medium

**Test Steps**:
1. Disconnect network during navigation
2. Attempt to load external resources
3. Test timeout scenarios
4. Verify error recovery
5. Test offline mode behavior

**Expected Results**:
- Network errors are caught gracefully
- Appropriate error messages displayed
- Timeouts are handled correctly
- User can retry operations
- Offline functionality works where applicable

---

#### TC-026: Invalid Intent Spec Handling
**Objective**: Verify validation of Intent Spec format
**Priority**: Medium

**Test Steps**:
1. Load Intent Spec with missing required fields
2. Test with invalid JSON syntax
3. Load with invalid step definitions
4. Test with missing parameters
5. Verify validation error messages

**Expected Results**:
- Schema validation catches errors
- Clear validation error messages
- Specific field errors are identified
- Invalid specs are rejected safely
- User guidance for fixing errors

---

#### TC-027: Resource Cleanup on Errors
**Objective**: Verify proper cleanup when errors occur
**Priority**: High

**Test Steps**:
1. Start resource-intensive operation
2. Trigger error condition
3. Verify resource cleanup
4. Check for memory leaks
5. Test application stability

**Expected Results**:
- WebView instances are cleaned up
- Browser processes are terminated
- Memory is released properly
- Application remains stable
- Subsequent operations work normally

---

### 10. Performance Tests

#### TC-028: Multi-Tab Performance
**Objective**: Verify performance with multiple tabs
**Priority**: Medium

**Test Steps**:
1. Create 10 tabs simultaneously
2. Navigate each to different URLs
3. Switch between tabs rapidly
4. Monitor memory usage
5. Test tab closing performance

**Expected Results**:
- Tab creation is responsive
- Memory usage scales reasonably
- Tab switching is smooth
- Performance remains acceptable
- Resource cleanup is efficient

**Performance Criteria**:
- Tab creation: < 2 seconds
- Tab switching: < 500ms
- Memory per tab: < 100MB
- Total memory: < 1GB for 10 tabs

---

#### TC-029: Recording Performance
**Objective**: Verify recording doesn't impact browser performance
**Priority**: Medium

**Test Steps**:
1. Start recording session
2. Perform intensive web interactions
3. Monitor performance metrics
4. Compare with non-recording performance
5. Test recording file size

**Expected Results**:
- Recording overhead is minimal
- Web interactions remain responsive
- Performance degradation < 10%
- Recording files are reasonable size
- Memory usage doesn't spike significantly

---

### 11. Integration Tests

#### TC-030: End-to-End Workflow
**Objective**: Verify complete workflow from recording to execution
**Priority**: Critical

**Test Steps**:
1. Start new recording session
2. Navigate and interact with test website
3. Stop recording and generate spec file
4. Generate Intent Spec from recording
5. Execute Intent Spec with variables
6. Verify final state matches recording

**Expected Results**:
- Complete workflow executes successfully
- Each step produces expected outputs
- Final execution matches original recording
- All generated files are valid
- Process is reproducible

**Test Data**:
```
Test Website: https://httpbin.org/forms/post
Form Fields: name, email, message
Expected Result: Form submission success page
```

---

#### TC-031: CLI to GUI Integration
**Objective**: Verify CLI-generated specs work in GUI
**Priority**: High

**Test Steps**:
1. Generate Intent Spec via CLI
2. Load spec in GUI application
3. Execute spec through GUI
4. Modify variables in GUI
5. Re-execute with new variables

**Expected Results**:
- CLI-generated specs load correctly in GUI
- GUI can execute CLI-generated specs
- Variable modification works properly
- Execution results are consistent
- No compatibility issues occur

---

## Test Data

### Standard Test URLs
```
Primary Test Sites:
- https://httpbin.org/html (HTTP testing service)
- https://httpbin.org/forms/post (Form testing)
- https://example.com (Basic content)
- https://www.google.com (Complex site)

Data URLs for Isolated Testing:
- data:text/html,<html><body><h1>Test Page</h1><button id="test-btn">Click Me</button></body></html>
- data:text/html,<html><body><form><input name="test" placeholder="Enter text"><button type="submit">Submit</button></form></body></html>

Invalid URLs for Error Testing:
- http://invalid-domain-that-does-not-exist.com
- file:///invalid/path/file.html
- ftp://unsupported.protocol.com
```

### Sample Intent Spec Data
```json
{
  "name": "test_form_submission",
  "description": "Test form submission with validation",
  "url": "https://httpbin.org/forms/post",
  "params": ["EMAIL", "USERNAME", "MESSAGE"],
  "steps": [
    {
      "name": "step_1_navigate",
      "ai_instruction": "Navigate to the form page",
      "snippet": "await page.goto('https://httpbin.org/forms/post');",
      "prefer": "snippet",
      "fallback": "ai"
    },
    {
      "name": "step_2_fill_email",
      "ai_instruction": "Fill the email field with the provided email address",
      "snippet": "await page.fill('input[name=\"email\"]', '{{EMAIL}}');",
      "prefer": "snippet",
      "fallback": "ai",
      "value": "{{EMAIL}}"
    }
  ]
}
```

### Variable Test Data
```json
{
  "test_variables": {
    "EMAIL": "test.user@example.com",
    "USERNAME": "testuser123",
    "PASSWORD": "SecurePass123!",
    "PHONE_NUMBER": "1234567890",
    "DATE": "2025-08-16",
    "AMOUNT": "99.99",
    "MESSAGE": "This is a test message for form submission."
  }
}
```

## Test Execution Guidelines

### Pre-Test Setup
1. Install all dependencies: `npm install`
2. Build application: `npm run build`
3. Verify WebView2 runtime is installed
4. Clear any previous test data/recordings
5. Ensure network connectivity

### Test Execution Order
1. **Smoke Tests**: Basic application startup (TC-001, TC-002)
2. **Core Functionality**: UI components and WebView (TC-004 to TC-010)
3. **Recording Tests**: Playwright recording functionality (TC-011 to TC-013)
4. **Generation Tests**: Intent Spec creation (TC-014 to TC-016)
5. **CLI Tests**: Command-line interface (TC-017, TC-018)
6. **Execution Tests**: AI and snippet paths (TC-019 to TC-021)
7. **Fallback Tests**: Error recovery mechanisms (TC-022 to TC-024)
8. **Error Handling**: Various error scenarios (TC-025 to TC-027)
9. **Performance Tests**: Load and stress testing (TC-028, TC-029)
10. **Integration Tests**: End-to-end workflows (TC-030, TC-031)

### Test Environment Reset
- Close all browser tabs
- Clear recordings directory
- Reset variables panel
- Clear application logs
- Restart application between test suites

### Pass/Fail Criteria
- **Pass**: All expected results achieved, no critical errors
- **Fail**: Any expected result not achieved, critical errors occur
- **Blocked**: Cannot execute due to environmental issues
- **Skip**: Test not applicable to current configuration

## Risk Assessment

### High Risk Areas
1. **WebView2 Runtime Dependencies**: Application relies on Edge WebView2 runtime
2. **Multi-Process Architecture**: Complex Electron main/renderer process communication
3. **External API Dependencies**: Claude API availability and rate limits
4. **Memory Management**: Potential memory leaks with multiple WebView instances
5. **Cross-Platform Compatibility**: Primary focus on Windows platform

### Mitigation Strategies
1. **Dependency Verification**: Automated checks for WebView2 runtime
2. **Error Handling**: Comprehensive error handling and user feedback
3. **Fallback Mechanisms**: Multiple execution paths for reliability
4. **Resource Management**: Proper cleanup and disposal patterns
5. **Platform Testing**: Focused testing on supported Windows versions

### Critical Success Factors
1. Application starts reliably on target Windows systems
2. Multi-tab WebView functionality works consistently
3. Recording and playback are accurate and reliable
4. Intent Spec generation produces valid, executable specifications
5. Both AI and snippet execution paths function correctly
6. Error conditions are handled gracefully without crashes

---

**Document End**

*This test plan should be reviewed and updated regularly as the application evolves. All test cases should be executed in a controlled environment before production release.*