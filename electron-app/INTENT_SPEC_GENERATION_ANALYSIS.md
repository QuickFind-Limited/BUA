# Intent Spec Generation Analysis: AI vs Hardcoded

## Current State: MOSTLY HARDCODED

The Intent Spec generation is currently **95% hardcoded** with only **5% AI-ready** infrastructure.

## What's Hardcoded:

### 1. Step Generation (`intent-spec-generator.js`)
- **Hardcoded**: Converts recording actions to steps using fixed rules
- **Example**: `click` → "Click on element", `input` → "Fill field"
- **Location**: `generateSteps()`, `generateAIInstruction()`, `generatePlaywrightSnippet()`

### 2. Variable Detection (`integrated-recording-main.js`)
- **Hardcoded**: Pattern matching on field names/types
  - `password` field → `PASSWORD` variable
  - `email` field → `EMAIL_ADDRESS` variable
  - URL contains `inventory` → `ITEM_NAME`, `SELLING_PRICE`, etc.
- **Location**: Lines 617-690

### 3. Workflow Analysis (`workflow-analyzer.js`)
- **Hardcoded**: Fixed workflow patterns
  ```javascript
  LOGIN: {
    pattern: ['navigate', 'input:email/username', 'input:password', 'click:submit/login'],
    variables: { email: 'EMAIL', password: 'PASSWORD', username: 'USERNAME' }
  }
  ```
- **Location**: `workflowPatterns` object

### 4. Intent Spec Structure
- **Hardcoded**: Fixed JSON structure with predetermined fields
- **No AI interpretation** of user intent or goals

## What's AI-Ready (But Not Used):

### 1. AI Analysis Function (`llm.ts`)
- **EXISTS**: `analyzeRecording()` function that calls Claude
- **NOT USED**: The main integration file never imports or calls it
- **Location**: `main/llm.ts:258`

### 2. Enhanced Prompts (`enhanced-intent-spec-prompt.ts`)
- **EXISTS**: Sophisticated prompt generation
- **PARTIALLY USED**: Prompt is generated but Claude is never called
- **Comment**: "// Generate the Intent Spec (would normally call Claude here)"

## The Truth:

```javascript
// From intent-spec-generator.js:562-564
// Generate the Intent Spec (would normally call Claude here)
console.log('Enhanced prompt generated for rich recording data');
// For now, return a structured Intent Spec based on the data
```

**The system generates a prompt for AI but then uses hardcoded logic instead!**

## What Should Be AI-Driven:

1. **Intent Understanding**
   - AI should understand WHAT the user is trying to automate
   - Currently: No intent analysis at all

2. **Step Optimization**
   - AI should optimize steps (e.g., skip unnecessary navigations)
   - Currently: Records every single action verbatim

3. **Variable Naming**
   - AI should intelligently name variables based on context
   - Currently: Rule-based pattern matching

4. **Workflow Understanding**
   - AI should understand complex, novel workflows
   - Currently: Only matches predefined patterns

5. **Error Recovery Strategies**
   - AI should suggest recovery approaches
   - Currently: No error recovery planning

## How to Make It AI-Driven:

### Option 1: Use Existing `analyzeRecording` Function
```javascript
// In integrated-recording-main.js
const { analyzeRecording } = require('./main/llm');
const intentSpec = await analyzeRecording(recordingData);
```

### Option 2: Hybrid Approach
1. Use hardcoded logic for basic structure
2. Call AI for:
   - Intent understanding
   - Variable naming suggestions
   - Workflow optimization
   - Error recovery strategies

### Option 3: Full AI Integration
1. Send entire recording to Claude
2. Let AI generate complete Intent Spec
3. Use hardcoded validation/fallbacks

## Current Flow:

```
Recording Data
    ↓
Workflow Analyzer (hardcoded patterns)
    ↓
Intent Spec Generator (hardcoded rules)
    ↓
Variable Extraction (pattern matching)
    ↓
Intent Spec JSON
```

## Ideal AI-Driven Flow:

```
Recording Data
    ↓
Claude AI Analysis
    ├→ Understand Intent
    ├→ Optimize Workflow
    ├→ Name Variables Intelligently
    └→ Generate Recovery Strategies
    ↓
Intent Spec JSON (AI-generated)
    ↓
Validation & Fallbacks (hardcoded safety)
```

## Conclusion:

The system has all the infrastructure for AI analysis but **doesn't use it**. The Intent Spec is generated through:
- Pattern matching
- Rule-based transformations  
- Hardcoded workflow patterns
- Fixed variable naming rules

The comment "would normally call Claude here" reveals this was intended to be AI-driven but was implemented with hardcoded logic instead, likely for:
- Speed (no API calls)
- Reliability (deterministic output)
- Cost (no LLM usage)
- Development simplicity

To make it truly AI-driven, you need to actually call the `analyzeRecording` function that already exists in `llm.ts`.