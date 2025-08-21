# Claude Code SDK Integration

This Electron app integrates with Claude Code SDK to leverage Claude Opus 4.1 for analysis and query operations.

## Prerequisites

1. **API Key**: Set your Anthropic API key as an environment variable:
   ```bash
   export ANTHROPIC_API_KEY="your-api-key-here"
   ```
   
   Or configure it in the Claude Code SDK initialization.

2. **SDK Installation**: The SDK is installed via npm (no CLI required):
   ```bash
   npm install @anthropic-ai/claude-code-sdk
   ```

## Architecture

The app uses a hybrid approach:

### Models Used:
- **Claude Opus 4.1** (`claude-opus-4-1-20250805`): 
  - Recording analysis
  - Query processing
  - Intent Spec generation
  - Decision making (act vs snippet)
  - Used via Claude Code SDK

- **Claude Sonnet 4** (`claude-sonnet-4-20250514`):
  - Action execution in Magnitude flows
  - Used via Claude Code CLI with explicit model specification

## Integration Methods

### Claude Code SDK (No CLI Required)
```typescript
import { ClaudeCode } from '@anthropic-ai/claude-code-sdk';

// Initialize with default Opus 4.1 model
const clientOpus = new ClaudeCode({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultModel: 'claude-opus-4-1-20250805'
});

// Initialize with Sonnet 4 model for specific tasks
const clientSonnet = new ClaudeCode({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultModel: 'claude-sonnet-4-20250514'
});

// Use the SDK directly - no CLI needed
const response = await client.analyze({ content: prompt });
```

## Key Files

- `main/llm.ts`: Claude Code SDK integration layer
- `flows/exampleFlow.ts`: Magnitude runner with hybrid model setup
- `lib/decider.ts`: Opus 4.1 decision logic
- `lib/specToActPrompt.ts`: Prompt builder for actions

## Environment Setup

Set your API key as an environment variable:
```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

The SDK handles all API communication directly - no CLI installation required.

## Running the App

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the TypeScript:
   ```bash
   npm run build
   ```

3. Start the Electron app:
   ```bash
   npm start
   ```

## Model Policy

- **Analysis & Intelligence**: Always uses Claude Code (Opus 4.1)
- **Actions & Automation**: Uses Sonnet 4 via CLI for specific execution
- **Default Behavior**: Claude Code SDK defaults to Opus 4.1

## Troubleshooting

If the SDK is not working:
- Verify API key is set: `echo $ANTHROPIC_API_KEY`
- Check SDK installation: `npm list @anthropic-ai/claude-code-sdk`
- Test connection: The app includes `testConnection()` function
- Review SDK logs for API errors

## Benefits of Claude Code SDK Integration

1. **Direct API Access**: No CLI dependency, pure JavaScript/TypeScript
2. **Model Flexibility**: Easy switching between Opus 4.1 and Sonnet 4
3. **Programmatic Control**: Full control over API parameters
4. **Better Error Handling**: Direct access to SDK errors and responses
5. **Faster Execution**: No CLI process overhead