/**
 * Claude Code CLI - Error Analysis Command
 * 
 * Analyzes browser automation errors and provides AI-generated solutions
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import { getQueryFunction } from '../../main/llm';

interface ErrorAnalysisRequest {
  prompt: string;
  errorContext: {
    message: string;
    category: string;
    selector?: string;
    pageUrl?: string;
  };
}

interface ErrorSolution {
  strategy: string;
  code: string;
  explanation: string;
  confidence: number;
  estimatedSuccessRate: number;
  riskLevel: 'low' | 'medium' | 'high';
  requiredPermissions: string[];
  timeEstimate: number;
  reasoning: string;
}

export async function analyzeErrorCommand(): Promise<void> {
  try {
    // Read input from stdin
    const input = await readStdin();
    
    if (!input) {
      throw new Error('No input provided');
    }

    const request: ErrorAnalysisRequest = JSON.parse(input);
    
    if (!request.prompt || !request.errorContext) {
      throw new Error('Invalid input format. Expected prompt and errorContext');
    }

    // Get Claude Code query function
    const query = await getQueryFunction();
    
    // Enhanced prompt for error analysis
    const enhancedPrompt = buildErrorAnalysisPrompt(request);
    
    let result = '';
    
    // Use Claude Code SDK with Opus 4.1 for error analysis
    for await (const message of query({
      prompt: enhancedPrompt,
      options: {
        maxTurns: 2
      }
    })) {
      if (message.type === 'result' && message.subtype === 'success') {
        result = message.result;
      }
    }

    if (!result) {
      throw new Error('No result returned from Claude');
    }

    // Parse and validate the solution
    const solution = parseSolution(result);
    
    // Output the solution as JSON
    console.log(JSON.stringify(solution, null, 2));
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({
      error: true,
      message: errorMessage
    }));
    process.exit(1);
  }
}

function buildErrorAnalysisPrompt(request: ErrorAnalysisRequest): string {
  const { prompt, errorContext } = request;
  
  return `${prompt}

ADDITIONAL CONTEXT FOR ANALYSIS:
- Error occurred in browser automation context
- Current error handling has failed
- Need a reliable, executable solution
- Solution will be executed in sandboxed environment
- Must provide confidence and risk assessment

ERROR CONTEXT DETAILS:
- Message: ${errorContext.message}
- Category: ${errorContext.category}
- Selector: ${errorContext.selector || 'Not provided'}
- Page URL: ${errorContext.pageUrl || 'Not provided'}

CRITICAL REQUIREMENTS:
1. Provide ONLY executable Playwright code in the 'code' field
2. Code must be safe and follow best practices
3. Include proper error handling where appropriate
4. Confidence must be realistic (0-1 scale)
5. Risk level must be accurate assessment
6. Explanation should be clear and actionable

EXAMPLE RESPONSE FORMAT:
{
  "strategy": "retry_with_alternative_selector",
  "code": "await page.waitForSelector('[data-testid=\"submit-btn\"]', { timeout: 10000 });\\nawait page.click('[data-testid=\"submit-btn\"]');",
  "explanation": "The error suggests the original selector is not found. This solution waits for an alternative selector with a data-testid attribute, which is more reliable than class-based selectors.",
  "confidence": 0.85,
  "estimatedSuccessRate": 0.9,
  "riskLevel": "low",
  "requiredPermissions": ["page_interaction"],
  "timeEstimate": 5000,
  "reasoning": "Using data-testid selectors is a best practice for test automation as they are less likely to change compared to CSS classes or XPath selectors."
}

IMPORTANT: Respond with ONLY the JSON object, no additional text or markdown formatting.`;
}

function parseSolution(response: string): ErrorSolution {
  try {
    // Clean response
    let cleanedResponse = response.trim();
    
    // Extract JSON from response if wrapped
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0];
    }

    const parsed = JSON.parse(cleanedResponse);
    
    // Validate required fields
    const requiredFields = ['strategy', 'code', 'explanation', 'confidence'];
    for (const field of requiredFields) {
      if (!(field in parsed)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate data types and ranges
    if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
      throw new Error('Confidence must be a number between 0 and 1');
    }

    if (parsed.estimatedSuccessRate && (typeof parsed.estimatedSuccessRate !== 'number' || parsed.estimatedSuccessRate < 0 || parsed.estimatedSuccessRate > 1)) {
      throw new Error('EstimatedSuccessRate must be a number between 0 and 1');
    }

    if (parsed.riskLevel && !['low', 'medium', 'high'].includes(parsed.riskLevel)) {
      throw new Error('RiskLevel must be "low", "medium", or "high"');
    }

    // Set defaults for optional fields
    const solution: ErrorSolution = {
      strategy: parsed.strategy,
      code: parsed.code,
      explanation: parsed.explanation,
      confidence: parsed.confidence,
      estimatedSuccessRate: parsed.estimatedSuccessRate || 0.5,
      riskLevel: parsed.riskLevel || 'medium',
      requiredPermissions: parsed.requiredPermissions || ['page_interaction'],
      timeEstimate: parsed.timeEstimate || 10000,
      reasoning: parsed.reasoning || parsed.explanation
    };

    return solution;
    
  } catch (error) {
    throw new Error(`Failed to parse solution: ${error instanceof Error ? error.message : 'Parse error'}`);
  }
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    
    process.stdin.on('end', () => {
      resolve(data.trim());
    });
    
    process.stdin.on('error', (error) => {
      reject(error);
    });
    
    // Set timeout for reading input
    setTimeout(() => {
      reject(new Error('Timeout reading from stdin'));
    }, 30000); // 30 second timeout
  });
}

// Export the command for use in CLI
export const analyzeErrorCmd = new Command()
  .name('analyze-error')
  .description('Analyze browser automation errors and provide AI solutions')
  .action(analyzeErrorCommand);