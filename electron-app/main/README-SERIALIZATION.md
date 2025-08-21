# Recording Serialization System

This document describes the recording serialization system that converts Playwright actions into a format optimized for Claude analysis to generate Intent Specifications.

## Overview

The serialization system consists of three main components:

1. **Recording Serializer** (`recording-serializer.ts`) - Converts raw recording data to human-readable format
2. **Intent Spec Prompt Generator** (`intent-spec-prompt.ts`) - Creates detailed prompts for Claude analysis
3. **Enhanced LLM Integration** (`llm.ts`) - Updated to use the new serialization system

## File Structure

```
main/
├── recording-serializer.ts     # Core serialization logic
├── intent-spec-prompt.ts       # Prompt generation for Claude
├── llm.ts                      # Enhanced with serialization
└── test-serialization.ts       # Test and demonstration file
```

## Key Features

### 1. Human-Readable Serialization

The `serializeRecording()` function converts raw Playwright actions into descriptive text:

```typescript
// Input: Raw Playwright action
{
  type: 'click',
  target: { selector: '#login-button', text: 'Sign In' },
  timestamp: 1629123456789
}

// Output: Human-readable description
"2. User clicked on button 'Sign In'"
```

### 2. Security Features

- **Password Masking**: Automatically detects and masks password fields
- **Sensitive Data Protection**: Identifies potential sensitive inputs

### 3. Context Preservation

- **HTML Context**: Captures surrounding HTML for better understanding
- **Element Details**: Preserves placeholders, text content, and attributes
- **Timing Information**: Maintains timestamps for flow analysis

### 4. Variable Extraction Guidance

The prompt system guides Claude to identify values that should be parameterized:

- User credentials (`{{USERNAME}}`, `{{PASSWORD}}`)
- Personal data (`{{EMAIL}}`, `{{FIRST_NAME}}`)
- Dynamic IDs (`{{ORDER_ID}}`, `{{TRANSACTION_ID}}`)
- Configurable values (`{{SEARCH_QUERY}}`, `{{AMOUNT}}`)

## Usage

### Basic Serialization

```typescript
import { serializeRecording } from './recording-serializer';

const rawRecording = [/* Playwright actions */];
const humanReadable = serializeRecording(rawRecording);
console.log(humanReadable);
```

### Intent Spec Generation

```typescript
import { analyzeRecording } from './llm';

const result = await analyzeRecording({
  recordingData: rawRecording,
  context: 'User login flow for e-commerce site'
});

console.log(result); // Intent Spec JSON
```

### Enhanced Analysis with Metadata

```typescript
import { analyzeRecordingWithMetadata } from './llm';

const result = await analyzeRecordingWithMetadata({
  recordingData: rawRecording
});

console.log(result.analysis);          // Intent Spec
console.log(result.metadata);          // Flow complexity, step count, etc.
console.log(result.serializedRecording); // Human-readable format
```

## Output Format

### Serialized Recording Example

```
Recording Session Summary
Started at: 2025-08-16T12:00:05.504Z
Initial URL: https://example.com/login
Total Steps: 5

Detailed Action Sequence:
==================================================

1. User navigated to https://example.com/login
   Timestamp: 2025-08-16T12:00:05.504Z

2. User clicked on input field with placeholder "Email"
   Target: #username-field
   HTML Context: <input type="email" id="username-field" placeholder="Email" />
   Timestamp: 2025-08-16T12:00:06.504Z

3. User typed "user@example.com" in field with placeholder "Email"
   Target: #username-field
   Value: user@example.com
   Field Placeholder: Email
   Timestamp: 2025-08-16T12:00:07.504Z

4. User typed "********" in field with placeholder "Password"
   Target: #password-field
   Field Placeholder: Password
   Timestamp: 2025-08-16T12:00:08.504Z

5. User clicked on button "Sign In"
   Target: #login-button
   Element Text: Sign In
   Timestamp: 2025-08-16T12:00:09.504Z

Summary:
====================
The user performed 5 actions in this recording session. This appears to be a form interaction flow that includes navigation and user input.
```

### Generated Intent Spec Example

```json
{
  "name": "User Login Flow",
  "description": "Authenticates a user by entering credentials and logging into the application",
  "url": "https://example.com/login",
  "params": ["EMAIL", "PASSWORD"],
  "steps": [
    {
      "action": "click",
      "selector": "#username-field",
      "value": "",
      "description": "Focus on the email input field"
    },
    {
      "action": "type",
      "selector": "#username-field", 
      "value": "{{EMAIL}}",
      "description": "Enter the user's email address"
    },
    {
      "action": "type",
      "selector": "#password-field",
      "value": "{{PASSWORD}}",
      "description": "Enter the user's password"
    },
    {
      "action": "click",
      "selector": "#login-button",
      "value": "",
      "description": "Click the login button to submit credentials"
    }
  ],
  "successCheck": ".dashboard-welcome",
  "assertions": [
    {
      "type": "url_contains",
      "selector": "/dashboard",
      "expected": "/dashboard",
      "description": "Verify successful navigation to dashboard"
    }
  ]
}
```

## Testing

Run the test suite to verify functionality:

```bash
cd electron-app
npx ts-node main/test-serialization.ts
```

This will demonstrate:
- Recording serialization
- Prompt generation
- Expected output formats

## API Reference

### Recording Serializer

#### `serializeRecording(recording: any[]): string`

Converts raw Playwright recording data into human-readable format.

**Parameters:**
- `recording`: Array of Playwright action objects

**Returns:** Formatted string describing the user actions

### Intent Spec Prompt Generator

#### `generateIntentSpecPrompt(serializedRecording: string): string`

Creates a comprehensive prompt for Claude to analyze the recording.

**Parameters:**
- `serializedRecording`: Human-readable recording format

**Returns:** Detailed analysis prompt for Claude

#### `generateSimpleIntentSpecPrompt(serializedRecording: string): string`

Creates a simplified prompt for basic Intent Spec extraction.

**Parameters:**
- `serializedRecording`: Human-readable recording format

**Returns:** Simplified analysis prompt

### Enhanced LLM Functions

#### `analyzeRecording(request: AnalysisRequest): Promise<AnalysisResponse>`

Enhanced recording analysis using the new serialization system.

#### `analyzeRecordingWithMetadata(request: AnalysisRequest): Promise<{analysis, metadata, serializedRecording}>`

Extended analysis that includes flow metadata and serialized recording.

#### `validateIntentSpecWithClaude(intentSpec: any): Promise<ValidationResult>`

Validates an Intent Spec using Claude analysis.

## Integration Notes

The serialization system is designed to:

1. **Maintain Backward Compatibility**: Existing code continues to work
2. **Enhance Claude Understanding**: Better prompts lead to higher quality Intent Specs
3. **Preserve Security**: Sensitive data is automatically protected
4. **Support Debugging**: Human-readable format aids in troubleshooting

## Future Enhancements

Potential improvements to consider:

1. **Multi-language Support**: Localized action descriptions
2. **Custom Templates**: Domain-specific serialization formats
3. **Enhanced Context**: Screenshot integration for visual context
4. **Performance Metrics**: Timing analysis for optimization
5. **Error Recovery**: Better handling of malformed recordings