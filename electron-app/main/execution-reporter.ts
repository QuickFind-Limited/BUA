import { ExecutionReport, StepExecutionResult } from '../flows/types';

/**
 * ExecutionReporter generates comprehensive reports for Intent Spec executions,
 * including usage patterns, fallback statistics, and improvement suggestions.
 */
export class ExecutionReporter {
  
  /**
   * Generate a comprehensive execution report
   */
  generateReport(execution: ExecutionReport): string {
    const report = [
      this.generateHeader(execution),
      this.generateSummary(execution),
      this.generateStepDetails(execution),
      this.generateUsageAnalysis(execution),
      this.generateSuccessAnalysis(execution),
      this.generateRecommendations(execution)
    ].join('\n\n');

    return report;
  }

  /**
   * Generate report header
   */
  private generateHeader(execution: ExecutionReport): string {
    return `
==============================================
    INTENT SPEC EXECUTION REPORT
==============================================
Execution ID: ${execution.executionId}
Timestamp: ${new Date().toISOString()}
Duration: ${this.formatDuration(execution.totalDuration)}
Overall Success: ${execution.overallSuccess ? '✓ PASSED' : '✗ FAILED'}
==============================================`;
  }

  /**
   * Generate execution summary
   */
  private generateSummary(execution: ExecutionReport): string {
    const successfulSteps = execution.steps.filter(s => s.success).length;
    const successRate = execution.steps.length > 0 
      ? Math.round((successfulSteps / execution.steps.length) * 100) 
      : 0;

    return `
EXECUTION SUMMARY
================
Total Steps: ${execution.steps.length}
Successful Steps: ${successfulSteps}
Success Rate: ${successRate}%

EXECUTION PATHS
===============
AI Used: ${execution.aiUsageCount} times (${this.getPercentage(execution.aiUsageCount, execution.steps.length)}%)
Snippets Used: ${execution.snippetUsageCount} times (${this.getPercentage(execution.snippetUsageCount, execution.steps.length)}%)
Fallbacks Occurred: ${execution.fallbackCount} times (${this.getPercentage(execution.fallbackCount, execution.steps.length)}%)`;
  }

  /**
   * Generate detailed step breakdown
   */
  private generateStepDetails(execution: ExecutionReport): string {
    let details = `
STEP DETAILS
============`;

    execution.steps.forEach((step, index) => {
      const status = step.success ? '✓' : '✗';
      const fallbackIndicator = step.fallbackOccurred ? ' (FALLBACK)' : '';
      const pathIndicator = step.pathUsed.toUpperCase();
      const duration = this.formatDuration(step.duration);

      details += `
${index + 1}. ${step.name}
   Status: ${status} ${pathIndicator}${fallbackIndicator}
   Duration: ${duration}`;

      if (step.error) {
        details += `
   Error: ${step.error}`;
      }

      if (step.screenshot) {
        details += `
   Screenshot: ${step.screenshot}`;
      }
    });

    return details;
  }

  /**
   * Generate usage analysis
   */
  private generateUsageAnalysis(execution: ExecutionReport): string {
    const analysis = `
USAGE ANALYSIS
==============`;

    if (execution.fallbackCount > 0) {
      const fallbackRate = this.getPercentage(execution.fallbackCount, execution.steps.length);
      return analysis + `
⚠️  High Fallback Usage Detected (${fallbackRate}%)
   
   Analysis:
   - ${execution.fallbackCount} step(s) required fallback to snippet-based execution
   - This suggests AI reasoning may need improvement for these actions
   - Consider reviewing the failing steps for pattern optimization
   
   Fallback Steps:
${execution.steps
  .filter(s => s.fallbackOccurred)
  .map((s, idx) => `   - Step ${idx + 1}: ${s.name}`)
  .join('\n')}`;
    }

    if (execution.aiUsageCount === execution.steps.length) {
      return analysis + `
✓ Optimal AI Performance
   
   Analysis:
   - All steps executed successfully using AI reasoning
   - No fallbacks required
   - Intent Spec is well-optimized for AI execution`;
    }

    if (execution.snippetUsageCount === execution.steps.length) {
      return analysis + `
📋 Snippet-Only Execution
   
   Analysis:
   - All steps executed using snippet-based approach
   - This may indicate conservative execution or AI availability issues
   - Consider enabling AI execution for improved adaptability`;
    }

    return analysis + `
🔄 Mixed Execution Approach
   
   Analysis:
   - Combination of AI (${execution.aiUsageCount}) and snippet (${execution.snippetUsageCount}) execution
   - Balanced approach providing both intelligence and reliability
   - Review failed AI steps for potential improvements`;
  }

  /**
   * Generate success state analysis
   */
  private generateSuccessAnalysis(execution: ExecutionReport): string {
    let analysis = `
SUCCESS STATE ANALYSIS
=====================`;

    if (execution.successStateMatch !== undefined) {
      if (execution.successStateMatch) {
        analysis += `
✓ Success State Verified
   
   The final execution state matches the expected success screenshot.
   The Intent Spec appears to be working correctly.`;
      } else {
        analysis += `
⚠️  Success State Mismatch Detected
   
   The final execution state does not match the expected success screenshot.
   This may indicate:
   - Changes in the target application's UI
   - Need for Intent Spec updates
   - Timing or synchronization issues`;
      }
    } else {
      analysis += `
ℹ️  No Success State Comparison Available
   
   Consider adding a success screenshot to the Intent Spec for automated
   verification of execution results.`;
    }

    if (execution.screenshots.length > 0) {
      analysis += `
   
   Screenshots Captured: ${execution.screenshots.length}
${execution.screenshots.map(s => `   - ${s}`).join('\n')}`;
    }

    return analysis;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(execution: ExecutionReport): string {
    const recommendations: string[] = [];

    // Performance recommendations
    if (execution.fallbackCount > execution.steps.length * 0.3) {
      recommendations.push('🔧 High fallback rate detected - consider reviewing step definitions for AI optimization');
    }

    if (execution.totalDuration > 60000) {
      recommendations.push('⏱️  Long execution time - consider adding more specific selectors or optimizing wait conditions');
    }

    // Success recommendations
    if (!execution.overallSuccess) {
      recommendations.push('❌ Execution failed - review error messages and consider adding retry logic');
    }

    if (execution.successStateMatch === false) {
      recommendations.push('📸 Update success screenshot or review success criteria');
    }

    // AI usage recommendations
    if (execution.aiUsageCount === 0) {
      recommendations.push('🤖 Consider enabling AI execution for better adaptability');
    }

    if (execution.snippetUsageCount === 0 && execution.fallbackCount > 0) {
      recommendations.push('📋 Consider implementing snippet-based fallbacks for critical steps');
    }

    // Custom suggestions from screenshot comparison
    if (execution.suggestions.length > 0) {
      recommendations.push('💡 Screenshot Analysis Suggestions:');
      execution.suggestions.forEach(suggestion => {
        recommendations.push(`   - ${suggestion}`);
      });
    }

    // Default recommendations if none specific
    if (recommendations.length === 0) {
      recommendations.push('✅ Execution completed successfully - no specific recommendations at this time');
    }

    return `
RECOMMENDATIONS
===============
${recommendations.join('\n')}

For more details, review the execution logs and screenshots.
Consider updating the Intent Spec based on these findings.`;
  }

  /**
   * Generate JSON report for programmatic use
   */
  generateJSONReport(execution: ExecutionReport): string {
    const report = {
      ...execution,
      generatedAt: new Date().toISOString(),
      summary: {
        successfulSteps: execution.steps.filter(s => s.success).length,
        successRate: execution.steps.length > 0 
          ? Math.round((execution.steps.filter(s => s.success).length / execution.steps.length) * 100) 
          : 0,
        fallbackRate: this.getPercentage(execution.fallbackCount, execution.steps.length),
        aiUsageRate: this.getPercentage(execution.aiUsageCount, execution.steps.length)
      },
      analysis: {
        performanceScore: this.calculatePerformanceScore(execution),
        reliabilityScore: this.calculateReliabilityScore(execution),
        adaptabilityScore: this.calculateAdaptabilityScore(execution)
      }
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate CSV report for data analysis
   */
  generateCSVReport(execution: ExecutionReport): string {
    const headers = [
      'ExecutionID',
      'StepIndex',
      'StepName',
      'PathUsed',
      'FallbackOccurred',
      'Success',
      'Duration',
      'Error',
      'Timestamp'
    ];

    const rows = execution.steps.map((step, index) => [
      execution.executionId,
      index,
      `"${step.name}"`,
      step.pathUsed,
      step.fallbackOccurred,
      step.success,
      step.duration,
      step.error ? `"${step.error}"` : '',
      new Date().toISOString()
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Calculate performance score (0-100)
   */
  private calculatePerformanceScore(execution: ExecutionReport): number {
    if (execution.steps.length === 0) return 0;

    const successRate = (execution.steps.filter(s => s.success).length / execution.steps.length) * 100;
    const fallbackPenalty = (execution.fallbackCount / execution.steps.length) * 20;
    const durationPenalty = Math.min(execution.totalDuration / 60000 * 10, 20); // Penalty for >1min

    return Math.max(0, Math.round(successRate - fallbackPenalty - durationPenalty));
  }

  /**
   * Calculate reliability score (0-100)
   */
  private calculateReliabilityScore(execution: ExecutionReport): number {
    if (execution.steps.length === 0) return 0;

    const successRate = (execution.steps.filter(s => s.success).length / execution.steps.length) * 100;
    const consistencyBonus = execution.fallbackCount === 0 ? 10 : 0;

    return Math.min(100, Math.round(successRate + consistencyBonus));
  }

  /**
   * Calculate adaptability score (0-100)
   */
  private calculateAdaptabilityScore(execution: ExecutionReport): number {
    if (execution.steps.length === 0) return 0;

    const aiUsageRate = (execution.aiUsageCount / execution.steps.length) * 100;
    const successfulFallbacks = execution.steps.filter(s => s.fallbackOccurred && s.success).length;
    const fallbackSuccessBonus = execution.fallbackCount > 0 
      ? (successfulFallbacks / execution.fallbackCount) * 20 
      : 0;

    return Math.min(100, Math.round(aiUsageRate + fallbackSuccessBonus));
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  /**
   * Calculate percentage with safety check
   */
  private getPercentage(value: number, total: number): number {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  }
}