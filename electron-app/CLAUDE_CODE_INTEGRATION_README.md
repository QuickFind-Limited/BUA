# Claude Code CLI Integration Module

This document describes the comprehensive Claude Code CLI integration system for enhanced browser automation error recovery.

## Overview

The Claude Code Integration Module provides a production-ready system that intelligently combines built-in error recovery strategies with AI-powered solutions from Claude Code CLI. The system includes advanced features like decision-making engines, caching, sandboxing, rate limiting, and comprehensive audit logging.

## Architecture

### Core Components

1. **ClaudeCodeIntegration** (`claude-code-integration.ts`)
   - Main integration class
   - Manages Claude Code CLI process spawning
   - Implements caching, sandboxing, and rate limiting
   - Provides decision engine for strategy selection

2. **EnhancedErrorRecovery** (`enhanced-error-recovery.ts`)
   - Orchestrates recovery attempts
   - Combines AI and built-in strategies
   - Manages fallback scenarios
   - Tracks performance metrics

3. **ConfigManager** (`claude-code-config.ts`)
   - Centralized configuration management
   - Environment-specific profiles
   - Runtime configuration updates
   - Configuration validation

4. **CLI Command** (`cli/commands/analyze-error.ts`)
   - Command-line interface for error analysis
   - Processes error contexts and generates solutions
   - Integrates with Claude Code SDK

## Features

### 1. Intelligent Decision Engine

The system decides whether to use Claude Code or built-in strategies based on:
- Error complexity score
- Number of previous failures
- Known issue patterns
- System resources and time constraints
- Confidence thresholds

```typescript
const decision = await claudeCodeIntegration.shouldUseClaudeCode(error, context);
// Returns: { useClaudeCode: boolean, reasoning: string, confidence: number }
```

### 2. AI-Powered Error Recovery

When Claude Code is selected:
- Spawns Claude Code CLI as child process
- Sends structured error context and analysis prompt
- Receives AI-generated Playwright code solutions
- Validates and executes solutions safely

```typescript
const solution = await claudeCodeIntegration.invokeClaudeCode(error, context);
const result = await claudeCodeIntegration.executeSolution(solution, context);
```

### 3. Code Sandboxing

All AI-generated code is executed in a secure sandbox:
- Validates code against allowed operations
- Prevents dangerous operations (eval, file system access, etc.)
- Enforces execution timeouts
- Tracks security violations

### 4. Intelligent Caching

Successful solutions are cached for reuse:
- SHA-256 hash-based cache keys
- Success/failure rate tracking
- Automatic expiration and cleanup
- Cache size limits and LRU eviction

### 5. Rate Limiting

Protects against API abuse:
- Configurable requests per minute
- Sliding window rate limiting
- Automatic backoff and queuing
- Per-session tracking

### 6. Comprehensive Audit Logging

All operations are logged for compliance and debugging:
- Decision events with reasoning
- Solution invocations and responses
- Execution results and performance metrics
- Cache hits and misses
- Error and failure events

### 7. Performance Monitoring

Real-time performance tracking:
- Success rates by strategy type
- Average response and execution times
- Cache hit rates and effectiveness
- Resource utilization metrics

## Configuration

### Basic Configuration

```typescript
const config: ClaudeCodeConfig = {
  // API Configuration
  apiKey: process.env.ANTHROPIC_API_KEY,
  rateLimitRequestsPerMinute: 30,
  timeoutMs: 120000,
  
  // Decision Engine
  complexityThreshold: 7,
  failureCountThreshold: 2,
  confidenceThreshold: 0.7,
  
  // Caching
  enableCaching: true,
  cacheMaxSize: 1000,
  cacheExpirationHours: 24,
  
  // Security
  enableSandboxing: true,
  allowedOperations: ['click', 'type', 'fill', 'waitFor', 'screenshot'],
  
  // Logging
  enableDetailedLogging: true,
  auditLogPath: './logs/claude-code-audit.log'
};
```

### Environment Profiles

```typescript
// Development
const devConfig = ConfigManager.createProfileConfig('development');

// Production
const prodConfig = ConfigManager.createProfileConfig('production');

// Testing
const testConfig = ConfigManager.createProfileConfig('test');
```

## Usage

### Basic Error Recovery

```typescript
import { enhancedErrorRecovery } from './main/enhanced-error-recovery';

// In your error handling code
try {
  await page.click('#submit-button');
} catch (error) {
  const context = {
    page,
    stepName: 'click_submit',
    selector: '#submit-button',
    retryCount: 1,
    maxRetries: 3
  };
  
  const result = await enhancedErrorRecovery.recoverFromError(error, context);
  
  if (result.success) {
    console.log(`Recovery successful using ${result.solutionSource}: ${result.strategyUsed}`);
  } else {
    console.log(`Recovery failed: ${result.error}`);
  }
}
```

### Integration with HybridErrorRecovery

```typescript
// Replace existing hybrid recovery calls
const hybridRecovery = new HybridErrorRecovery();
const enhancedRecovery = new EnhancedErrorRecovery({
  enableAIRecovery: true,
  maxBuiltInAttempts: 3,
  fallbackToBuiltIn: true
});

// Use enhanced recovery instead
const result = await enhancedRecovery.recoverFromError(error, context);
```

### Configuration Management

```typescript
import { configManager, initializeConfig } from './main/claude-code-config';

// Initialize with defaults
const config = await initializeConfig();

// Update configuration
await configManager.updateConfig({
  claudeCode: {
    confidenceThreshold: 0.8
  }
});

// Watch for changes
const unwatch = configManager.onConfigChange((newConfig) => {
  console.log('Configuration updated:', newConfig);
});
```

## CLI Usage

### Error Analysis Command

```bash
# Analyze an error using Claude Code CLI
echo '{"prompt": "Analyze this error...", "errorContext": {"message": "Element not found", "category": "element_not_found"}}' | \
node dist/cli/index.js analyze-error
```

### Integration with Build Process

```json
{
  "scripts": {
    "build": "tsc",
    "test:recovery": "node test-claude-code-integration.js",
    "start:claude": "node dist/cli/index.js"
  }
}
```

## Security Considerations

### Sandboxing

The system implements multiple security layers:

1. **Code Validation**: Scans for dangerous patterns before execution
2. **Operation Whitelist**: Only allows pre-approved Playwright operations
3. **Timeout Protection**: Enforces execution time limits
4. **Context Isolation**: Executes in controlled environment

### Allowed Operations

Default allowed operations include:
- Basic Playwright actions: `click`, `type`, `fill`, `select`
- Waiting operations: `waitFor`, `waitForSelector`, `waitForTimeout`
- Navigation: `goto`, `reload`, `goBack`, `goForward`
- Element queries: `locator`, `getByRole`, `getByLabel`, `getByText`
- Safe evaluations: `getAttribute`, `textContent`, `innerHTML`

### Forbidden Operations

Explicitly blocked operations:
- `eval()` and `new Function()`
- File system access (`fs`, `require`)
- Process control (`process`, `child_process`)
- Network requests (`fetch`, `XMLHttpRequest`)
- DOM manipulation (`document.write`, `innerHTML` assignment)
- Browser navigation (`window.open`, `location.href`)

## Monitoring and Observability

### Performance Metrics

```typescript
const stats = enhancedRecovery.getPerformanceStats();
console.log({
  totalRecoveries: stats.totalRecoveries,
  successRate: stats.successRate,
  aiSuccessRate: stats.aiSuccessRate,
  averageDecisionTime: stats.averageDecisionTime,
  averageExecutionTime: stats.averageExecutionTime
});
```

### Cache Statistics

```typescript
const cacheStats = claudeCodeIntegration.getCacheStatistics();
console.log({
  cacheSize: cacheStats.size,
  hitRate: cacheStats.hitRate,
  topSolutions: cacheStats.topSolutions
});
```

### Audit Logs

```typescript
const auditStats = claudeCodeIntegration.getAuditStatistics();
console.log({
  totalEvents: auditStats.totalEvents,
  eventsByType: auditStats.eventsByType,
  successRate: auditStats.successRate,
  recentTrends: auditStats.recentTrends
});
```

## Error Handling and Fallbacks

### Decision Failures

If the decision engine fails:
- Defaults to built-in strategies
- Logs the decision error
- Continues with conservative approach

### API Failures

If Claude Code API fails:
- Attempts fallback to built-in strategies
- Respects rate limits and timeout settings
- Caches partial results when possible

### Execution Failures

If solution execution fails:
- Attempts alternative solutions from cache
- Falls back to built-in recovery strategies
- Maintains audit trail for debugging

## Testing

### Running Tests

```bash
# Run comprehensive integration tests
node test-claude-code-integration.js

# Run specific test scenarios
NODE_ENV=test npm run test:recovery
```

### Test Scenarios

The test suite covers:
1. **Timeout Errors**: Simple and complex timeout scenarios
2. **Element Not Found**: Dynamic content and selector issues
3. **Network Errors**: Connection and loading problems
4. **JavaScript Errors**: Runtime and execution issues
5. **Mixed Scenarios**: Multiple error types and fallback chains

### Mock Implementation

For testing without actual Claude Code API:
- `MockClaudeCodeIntegration`: Simulates AI behavior
- `MockEnhancedErrorRecovery`: Provides realistic scenarios
- `ErrorSimulator`: Generates various error types

## Deployment

### Production Checklist

1. **API Key**: Set `ANTHROPIC_API_KEY` environment variable
2. **Configuration**: Use production profile with appropriate limits
3. **Logging**: Configure log rotation and retention
4. **Monitoring**: Set up metrics collection and alerting
5. **Sandboxing**: Ensure sandboxing is enabled in production
6. **Rate Limits**: Configure appropriate API usage limits

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=your_api_key_here

# Optional
NODE_ENV=production
CLAUDE_CODE_CONFIG_PATH=/path/to/config.json
METRICS_PORT=3001
LOG_LEVEL=info
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy application
COPY dist/ ./dist/
COPY logs/ ./logs/

# Set environment
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Start application
CMD ["node", "dist/main/index.js"]
```

## Troubleshooting

### Common Issues

1. **API Key Not Set**
   - Error: "ANTHROPIC_API_KEY environment variable is required"
   - Solution: Set the API key in environment variables

2. **Rate Limit Exceeded**
   - Error: "Rate limit exceeded, waiting..."
   - Solution: Reduce `rateLimitRequestsPerMinute` in configuration

3. **Sandboxing Violations**
   - Error: "Dangerous operation detected"
   - Solution: Review and approve operations in `allowedOperations`

4. **CLI Process Timeout**
   - Error: "Claude Code CLI timeout"
   - Solution: Increase `timeoutMs` in configuration

### Debug Mode

Enable debug logging:

```typescript
const config = await initializeConfig();
await configManager.updateConfig({
  system: { logLevel: 'debug' },
  claudeCode: { enableDetailedLogging: true }
});
```

### Log Analysis

Check audit logs for patterns:

```bash
# View recent events
tail -f logs/claude-code-audit.log | jq .

# Analyze success rates
grep '"success":true' logs/claude-code-audit.log | wc -l
```

## Contributing

### Development Setup

1. Install dependencies: `npm install`
2. Build TypeScript: `npm run build`
3. Run tests: `npm run test:recovery`
4. Set up environment: Copy `.env.example` to `.env`

### Adding New Features

1. Update interfaces in `claude-code-integration.ts`
2. Add implementation in appropriate class
3. Update configuration schema in `claude-code-config.ts`
4. Add tests in `test-claude-code-integration.js`
5. Update documentation

### Code Standards

- Use TypeScript for all new code
- Follow existing error handling patterns
- Add comprehensive logging
- Include security validation
- Write unit and integration tests

## License

This integration module is part of the larger Electron application and follows the same licensing terms.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review audit logs for error patterns
3. Test with mock implementations first
4. Check configuration and environment setup