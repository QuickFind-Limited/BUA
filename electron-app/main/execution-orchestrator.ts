import { 
  IntentSpec, 
  IntentStep, 
  ExecutionReport, 
  StepExecutionResult, 
  ExecutionOrchestratorOptions,
  FlowResult 
} from '../flows/types';
import { MagnitudeExecutor } from './magnitude-executor';
import { PlaywrightExecutor } from './playwright-executor';
import { ScreenshotComparator } from './screenshot-comparator';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';

/**
 * ExecutionOrchestrator manages the execution of Intent Specs with fallback handling
 * and comprehensive reporting. It coordinates between AI-driven execution and 
 * snippet-based fallbacks while tracking usage patterns and success rates.
 */
export class ExecutionOrchestrator extends EventEmitter {
  private magnitudeExecutor: MagnitudeExecutor;
  private playwrightExecutor: PlaywrightExecutor;
  private screenshotComparator: ScreenshotComparator;
  private options: ExecutionOrchestratorOptions;

  constructor(options: ExecutionOrchestratorOptions = {}) {
    super();
    this.options = {
      enableFallback: true,
      screenshotComparison: true,
      saveScreenshots: true,
      timeout: 30000,
      ...options
    };

    this.magnitudeExecutor = new MagnitudeExecutor({
      headless: false,
      timeout: this.options.timeout,
      saveScreenshots: this.options.saveScreenshots
    });

    this.playwrightExecutor = new PlaywrightExecutor({
      headless: false,
      timeout: this.options.timeout,
      saveScreenshots: this.options.saveScreenshots
    });

    this.screenshotComparator = new ScreenshotComparator();
  }

  /**
   * Execute an Intent Spec with fallback handling and comprehensive reporting
   */
  async execute(
    intentSpec: IntentSpec,
    variables: Record<string, string> = {}
  ): Promise<ExecutionReport> {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();
    
    const report: ExecutionReport = {
      executionId,
      steps: [],
      aiUsageCount: 0,
      snippetUsageCount: 0,
      fallbackCount: 0,
      screenshots: [],
      overallSuccess: true,
      suggestions: [],
      totalDuration: 0
    };

    this.emit('execution-started', { executionId, intentSpec });

    try {
      // Execute each step with fallback handling
      for (let i = 0; i < intentSpec.steps.length; i++) {
        const step = intentSpec.steps[i];
        
        this.emit('step-started', { 
          stepIndex: i, 
          step, 
          totalSteps: intentSpec.steps.length 
        });

        const stepResult = await this.executeStepWithFallback(
          step, 
          variables, 
          i, 
          intentSpec
        );

        // Track usage statistics
        if (stepResult.pathUsed === 'ai') {
          report.aiUsageCount++;
        } else {
          report.snippetUsageCount++;
        }

        if (stepResult.fallbackOccurred) {
          report.fallbackCount++;
        }

        if (!stepResult.success) {
          report.overallSuccess = false;
        }

        report.steps.push(stepResult);

        this.emit('step-completed', stepResult);

        // Stop execution if step failed and no fallback available
        if (!stepResult.success && !this.options.enableFallback) {
          break;
        }
      }

      // Take final screenshot if enabled
      if (this.options.saveScreenshots) {
        const finalScreenshot = await this.captureScreenshot('final-state');
        if (finalScreenshot) {
          report.screenshots.push(finalScreenshot);
        }

        // Compare with success state if available
        if (this.options.screenshotComparison) {
          const comparisonResult = await this.performScreenshotComparison(
            finalScreenshot,
            intentSpec,
            report
          );
          
          if (comparisonResult) {
            this.emit('screenshot-comparison', comparisonResult);
          }
        }
      }

      report.totalDuration = Date.now() - startTime;

      this.emit('execution-completed', report);
      return report;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      report.overallSuccess = false;
      report.totalDuration = Date.now() - startTime;
      
      this.emit('execution-failed', { error: errorMessage, report });
      
      // Add error to the last step or create a new one
      if (report.steps.length > 0) {
        const lastStep = report.steps[report.steps.length - 1];
        lastStep.success = false;
        lastStep.error = errorMessage;
      } else {
        report.steps.push({
          name: 'Execution Failed',
          pathUsed: 'ai',
          fallbackOccurred: false,
          success: false,
          error: errorMessage,
          duration: report.totalDuration
        });
      }

      return report;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Execute a single step with fallback handling
   */
  private async executeStepWithFallback(
    step: IntentStep,
    variables: Record<string, string>,
    stepIndex: number,
    intentSpec: IntentSpec
  ): Promise<StepExecutionResult> {
    const stepStartTime = Date.now();
    const stepName = step.description || `${step.action} on ${step.selector || step.target}`;

    // First, try AI-driven execution
    let result: StepExecutionResult = {
      name: stepName,
      pathUsed: 'ai',
      fallbackOccurred: false,
      success: false,
      duration: 0
    };

    try {
      // Use MagnitudeExecutor for AI-driven execution
      const aiResult = await this.executeStepWithAI(step, variables);
      
      result.success = aiResult.success;
      result.error = aiResult.error;
      result.screenshot = aiResult.screenshot;
      result.duration = Date.now() - stepStartTime;

      if (result.success) {
        return result;
      }

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'AI execution failed';
    }

    // If AI execution failed and fallback is enabled, try snippet-based execution
    if (!result.success && this.options.enableFallback) {
      try {
        this.emit('fallback-started', { stepIndex, step });

        const fallbackResult = await this.executeStepWithSnippet(step, variables);
        
        result.pathUsed = 'snippet';
        result.fallbackOccurred = true;
        result.success = fallbackResult.success;
        result.error = fallbackResult.error;
        result.screenshot = fallbackResult.screenshot;
        result.duration = Date.now() - stepStartTime;

        this.emit('fallback-completed', { stepIndex, success: result.success });

      } catch (fallbackError) {
        result.error = `AI failed: ${result.error}. Fallback failed: ${
          fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
        }`;
      }
    }

    return result;
  }

  /**
   * Execute step using AI (MagnitudeExecutor)
   */
  private async executeStepWithAI(
    step: IntentStep,
    variables: Record<string, string>
  ): Promise<{ success: boolean; error?: string; screenshot?: string }> {
    try {
      // Create a minimal spec for single step execution
      const tempSpec: IntentSpec = {
        name: 'temp-step',
        url: 'current',
        params: [],
        steps: [step]
      };

      const result = await this.magnitudeExecutor.executeFlow(tempSpec, variables, {
        saveScreenshots: this.options.saveScreenshots
      });

      return {
        success: result.success,
        error: result.error,
        screenshot: result.screenshots?.[0]
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI execution error'
      };
    }
  }

  /**
   * Execute step using snippet-based approach (PlaywrightExecutor)
   */
  private async executeStepWithSnippet(
    step: IntentStep,
    variables: Record<string, string>
  ): Promise<{ success: boolean; error?: string; screenshot?: string }> {
    try {
      // Substitute variables in step
      const processedStep = this.substituteVariables(step, variables);
      
      // Execute with Playwright directly
      const result = await this.playwrightExecutor.executeAction(processedStep);
      
      let screenshot: string | undefined;
      if (this.options.saveScreenshots && result.success) {
        screenshot = await this.playwrightExecutor.takeScreenshot(`snippet-step-${Date.now()}`);
      }

      return {
        success: result.success,
        error: result.error,
        screenshot
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Snippet execution error'
      };
    }
  }

  /**
   * Capture screenshot with timestamp
   */
  private async captureScreenshot(name: string): Promise<string | null> {
    try {
      if (this.playwrightExecutor) {
        return await this.playwrightExecutor.takeScreenshot(`${name}-${Date.now()}`);
      }
      return null;
    } catch (error) {
      console.warn('Screenshot capture failed:', error);
      return null;
    }
  }

  /**
   * Substitute variables in step
   */
  private substituteVariables(step: IntentStep, variables: Record<string, string>): IntentStep {
    const substituteInString = (str: string | undefined): string | undefined => {
      if (!str) return str;
      let result = str;
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        result = result.replace(new RegExp(placeholder, 'g'), value);
      }
      return result;
    };

    return {
      ...step,
      selector: substituteInString(step.selector),
      target: substituteInString(step.target),
      value: substituteInString(step.value),
      description: substituteInString(step.description)
    };
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Perform screenshot comparison with proper threshold handling
   */
  private async performScreenshotComparison(
    finalScreenshot: string,
    intentSpec: IntentSpec,
    report: ExecutionReport
  ): Promise<any | null> {
    try {
      // Find success state screenshot from recordings
      const successScreenshotPath = this.findSuccessScreenshot(intentSpec);
      
      if (!successScreenshotPath) {
        console.warn('No success state screenshot found for comparison');
        report.suggestions = report.suggestions || [];
        report.suggestions.push('No success state screenshot available for comparison');
        return null;
      }

      // Perform the comparison
      const comparison = await this.screenshotComparator.compareScreenshots(
        finalScreenshot,
        successScreenshotPath
      );

      // Apply threshold logic
      const thresholdResult = this.evaluateComparisonThresholds(comparison);
      
      // Update report with comparison results
      report.successStateMatch = thresholdResult.match;
      report.comparisonSimilarity = comparison.similarity;
      report.comparisonStatus = thresholdResult.status;
      report.suggestions = [...(report.suggestions || []), ...comparison.suggestions, ...thresholdResult.suggestions];
      
      console.log(`Screenshot comparison completed: ${thresholdResult.status} (${comparison.similarity}% similarity)`);
      
      return {
        ...comparison,
        thresholdResult,
        successScreenshotPath
      };
      
    } catch (error) {
      console.error('Screenshot comparison failed:', error);
      report.suggestions = report.suggestions || [];
      report.suggestions.push(`Screenshot comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Find success state screenshot from recordings
   */
  private findSuccessScreenshot(intentSpec: IntentSpec): string | null {
    try {
      // Check if success_screenshot is explicitly defined
      if (intentSpec.success_screenshot && fs.existsSync(intentSpec.success_screenshot)) {
        return intentSpec.success_screenshot;
      }

      // Look for success state screenshot in recordings directory
      const recordingsDir = path.join(__dirname, '..', 'recordings');
      
      if (!fs.existsSync(recordingsDir)) {
        console.warn('Recordings directory not found');
        return null;
      }

      // Try different naming patterns
      const possibleNames = [
        `${intentSpec.name}-success-state.png`,
        `${intentSpec.name.replace(/\s+/g, '-').toLowerCase()}-success-state.png`,
        `${intentSpec.name.replace(/\s+/g, '_').toLowerCase()}-success-state.png`
      ];

      // Look for files with success-state pattern
      const files = fs.readdirSync(recordingsDir);
      const successFiles = files.filter(file => file.includes('success-state.png'));
      
      // Try exact matches first
      for (const name of possibleNames) {
        const filePath = path.join(recordingsDir, name);
        if (fs.existsSync(filePath)) {
          return filePath;
        }
      }
      
      // If no exact match, use the most recent success state screenshot
      if (successFiles.length > 0) {
        const mostRecent = successFiles
          .map(file => ({ 
            file, 
            path: path.join(recordingsDir, file), 
            mtime: fs.statSync(path.join(recordingsDir, file)).mtime 
          }))
          .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];
        
        console.log(`Using most recent success screenshot: ${mostRecent.file}`);
        return mostRecent.path;
      }
      
      return null;
      
    } catch (error) {
      console.error('Error finding success screenshot:', error);
      return null;
    }
  }

  /**
   * Evaluate comparison results against thresholds
   */
  private evaluateComparisonThresholds(comparison: any): {
    match: boolean;
    status: 'success' | 'partial' | 'mismatch';
    suggestions: string[];
  } {
    const similarity = comparison.similarity;
    const suggestions: string[] = [];
    
    if (similarity > 80) {
      return {
        match: true,
        status: 'success',
        suggestions: ['Screenshot comparison successful - execution matches expected state']
      };
    } else if (similarity >= 60) {
      suggestions.push('Partial match detected - execution may be mostly correct with minor differences');
      suggestions.push('Review the differences to determine if they are acceptable');
      
      if (comparison.differences && comparison.differences.length > 0) {
        const highSeverityDiffs = comparison.differences.filter((d: any) => d.severity === 'high');
        if (highSeverityDiffs.length > 0) {
          suggestions.push('High-severity differences found - manual review recommended');
        }
      }
      
      return {
        match: false,
        status: 'partial',
        suggestions
      };
    } else {
      suggestions.push('Significant mismatch detected - execution state differs substantially from expected');
      suggestions.push('Verify that the automation completed successfully');
      suggestions.push('Check for navigation errors or timing issues');
      
      return {
        match: false,
        status: 'mismatch',
        suggestions
      };
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      await Promise.all([
        this.magnitudeExecutor?.stop(),
        this.playwrightExecutor?.cleanup()
      ]);
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  /**
   * Get execution statistics
   */
  getStatistics(): {
    totalExecutions: number;
    successRate: number;
    fallbackRate: number;
    aiUsageRate: number;
  } {
    // This would be implemented with persistent storage in a real system
    return {
      totalExecutions: 0,
      successRate: 0,
      fallbackRate: 0,
      aiUsageRate: 0
    };
  }

  /**
   * Stop current execution
   */
  async stop(): Promise<void> {
    this.emit('execution-stopped');
    await this.cleanup();
  }
}