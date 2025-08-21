# Model Usage Policy

## Core Principle
**Claude Opus 4.1** (`claude-opus-4-1-20250805`) is used for **EVERYTHING** except Magnitude's `act` operation.

## Model Assignments

### Claude Opus 4.1 - Used For:
- ✅ **Recording Analysis** - Converting recordings to Intent Specs
- ✅ **Decision Making** - Choosing between act vs snippet execution
- ✅ **Query/Extraction** - Magnitude's `query` operations for data extraction
- ✅ **Prompt Building** - Converting Intent Specs to actionable prompts
- ✅ **General Intelligence** - All reasoning, analysis, and understanding tasks
- ✅ **Test Connection** - API connectivity testing
- ✅ **All External Logic** - Any helper functions outside of Magnitude act

### Claude Sonnet 4 - Used ONLY For:
- ✅ **Magnitude Act** - Browser automation actions within Magnitude flows

## Implementation Details

### SDK Configuration
```typescript
// Opus 4.1 Instance (default for everything)
const opusClient = new ClaudeCode({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultModel: 'claude-opus-4-1-20250805'
});

// Sonnet 4 Instance (ONLY for Magnitude act)
const sonnetClient = new ClaudeCode({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultModel: 'claude-sonnet-4-20250514'
});
```

### IPC Endpoints

| Endpoint | Model Used | Purpose |
|----------|------------|---------|
| `llm:analyzeRecording` | Opus 4.1 | Analyze recordings, generate Intent Specs |
| `llm:decide` | Opus 4.1 | Decide act vs snippet execution |
| `llm:query` | Opus 4.1 | General query processing |
| `magnitude:act` | Sonnet 4 | Magnitude browser automation only |
| `magnitude:query` | Opus 4.1 | Magnitude data extraction |
| `flows:runOne` | Both | Opus for query, Sonnet for act |

## Why This Split?

1. **Opus 4.1** provides superior reasoning and analysis capabilities, making it ideal for:
   - Understanding user intent
   - Making strategic decisions
   - Extracting and structuring data
   - Building complex prompts

2. **Sonnet 4** is optimized for:
   - Fast, reliable browser automation
   - Executing specific actions in Magnitude flows
   - Lower latency for repetitive tasks

## Key Functions

### Always Opus 4.1:
```typescript
analyzeRecording()      // Recording → Intent Spec
makeDecision()         // Act vs Snippet decision
processQuery()         // General queries
extractDataForMagnitudeQuery()  // Data extraction
buildPromptFromSpec()  // Prompt generation
```

### Only Sonnet 4:
```typescript
executeMagnitudeAct()  // Browser automation in Magnitude
```

## Environment Setup

Set your Anthropic API key:
```bash
export ANTHROPIC_API_KEY="your-api-key"
```

Both models will be accessed through the Claude Code SDK using this single API key.