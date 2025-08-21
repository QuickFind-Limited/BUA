import { ScreenshotComparison } from '../flows/types';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Improved ScreenshotComparator with proper image handling
 */
export class ScreenshotComparator {
  private comparisonCache: Map<string, ScreenshotComparison> = new Map();
  private anthropicClient: Anthropic | null = null;

  private getAnthropicClient(): Anthropic {
    if (!this.anthropicClient) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
      }
      this.anthropicClient = new Anthropic({ apiKey });
    }
    return this.anthropicClient;
  }

  /**
   * Compare two screenshots with improved handling
   */
  async compareScreenshots(
    actualPath: string,
    expectedPath: string
  ): Promise<ScreenshotComparison> {
    try {
      // Verify files exist
      if (!fs.existsSync(actualPath)) {
        throw new Error(`Actual screenshot not found: ${actualPath}`);
      }
      if (!fs.existsSync(expectedPath)) {
        throw new Error(`Expected screenshot not found: ${expectedPath}`);
      }

      // First, check if images are identical using hash
      const actualHash = this.getFileHash(actualPath);
      const expectedHash = this.getFileHash(expectedPath);
      
      if (actualHash === expectedHash) {
        return {
          match: true,
          similarity: 100,
          suggestions: [],
          differences: []
        };
      }

      // Get file sizes for initial assessment
      const actualSize = fs.statSync(actualPath).size;
      const expectedSize = fs.statSync(expectedPath).size;
      
      // If files are too large for AI comparison, use enhanced basic comparison
      const maxSizeForAI = 500 * 1024; // 500KB per image
      if (actualSize > maxSizeForAI || expectedSize > maxSizeForAI) {
        console.log('Screenshots too large for AI comparison, using enhanced basic analysis');
        return this.performEnhancedBasicComparison(actualPath, expectedPath);
      }

      // Try AI comparison with proper image message format
      try {
        return await this.performProperAIComparison(actualPath, expectedPath);
      } catch (aiError) {
        console.warn('AI comparison failed:', aiError);
        return this.performEnhancedBasicComparison(actualPath, expectedPath);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown comparison error';
      return {
        match: false,
        similarity: 0,
        suggestions: [`Comparison failed: ${errorMessage}`],
        differences: [{ type: 'error', message: errorMessage }]
      };
    }
  }

  /**
   * Perform AI comparison using proper Claude Vision API format
   */
  private async performProperAIComparison(
    actualPath: string,
    expectedPath: string
  ): Promise<ScreenshotComparison> {
    const client = this.getAnthropicClient();
    
    // Read images as base64
    const actualImage = fs.readFileSync(actualPath, 'base64');
    const expectedImage = fs.readFileSync(expectedPath, 'base64');

    // Use proper message format for Claude Vision
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514', // Use Sonnet 4 for vision tasks
      max_tokens: 1500,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Compare these two screenshots and analyze their visual similarity.

Please analyze:
1. Overall visual similarity (0-100%)
2. Key differences in layout, content, or UI elements
3. Whether the current state matches the expected success criteria

Return ONLY valid JSON in this format:
{
  "match": boolean,
  "similarity": number (0-100),
  "differences": [
    {
      "type": "layout|content|element|color|text",
      "description": "Description of the difference",
      "severity": "low|medium|high",
      "location": "Where the difference occurs"
    }
  ],
  "suggestions": ["Specific suggestions for improvement"]
}`
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: actualImage
            }
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: expectedImage
            }
          }
        ]
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    try {
      const parsed = JSON.parse(content.text);
      return {
        match: parsed.match,
        similarity: parsed.similarity,
        suggestions: parsed.suggestions || [],
        differences: parsed.differences || []
      };
    } catch (parseError) {
      // Try to extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          match: parsed.match,
          similarity: parsed.similarity,
          suggestions: parsed.suggestions || [],
          differences: parsed.differences || []
        };
      }
      throw parseError;
    }
  }

  /**
   * Enhanced basic comparison with more detailed analysis
   */
  private performEnhancedBasicComparison(
    actualPath: string,
    expectedPath: string
  ): ScreenshotComparison {
    const actualStats = fs.statSync(actualPath);
    const expectedStats = fs.statSync(expectedPath);
    
    // Calculate size-based similarity
    const sizeDifference = Math.abs(actualStats.size - expectedStats.size);
    const avgSize = (actualStats.size + expectedStats.size) / 2;
    const sizeSimilarity = Math.max(0, 100 - (sizeDifference / avgSize) * 100);
    
    // Determine match based on thresholds
    const isMatch = sizeSimilarity > 90;
    
    const differences = [];
    const suggestions = [];
    
    if (sizeDifference > 0) {
      const percentDiff = ((sizeDifference / expectedStats.size) * 100).toFixed(1);
      differences.push({
        type: 'content',
        description: `File size differs by ${(sizeDifference / 1024).toFixed(1)}KB (${percentDiff}%)`,
        severity: sizeDifference > expectedStats.size * 0.2 ? 'high' : 
                  sizeDifference > expectedStats.size * 0.1 ? 'medium' : 'low',
        location: 'Overall screenshot'
      });
    }
    
    // Provide intelligent suggestions based on size difference
    if (sizeDifference > expectedStats.size * 0.3) {
      suggestions.push('Significant size difference - the page state may be completely different');
      suggestions.push('Verify that the automation reached the correct page');
      suggestions.push('Check for dynamic content that may have loaded differently');
    } else if (sizeDifference > expectedStats.size * 0.1) {
      suggestions.push('Moderate size difference - some page elements may differ');
      suggestions.push('Check for dynamic content like timestamps, notifications, or user data');
    } else if (sizeDifference > 0) {
      suggestions.push('Minor size difference - likely due to small UI variations');
      suggestions.push('This level of difference is typically acceptable');
    }
    
    // Add suggestions based on file sizes
    if (actualStats.size > 2 * 1024 * 1024) {
      suggestions.push('Consider using viewport screenshots instead of full-page for faster comparison');
    }
    
    return {
      match: isMatch,
      similarity: parseFloat(sizeSimilarity.toFixed(1)),
      suggestions,
      differences
    };
  }

  /**
   * Calculate file hash for exact comparison
   */
  private getFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  /**
   * Fallback basic comparison when AI analysis fails
   */
  private async performBasicComparison(
    actualPath: string,
    expectedPath: string
  ): Promise<ScreenshotComparison> {
    try {
      // Get file stats for basic comparison
      const actualStats = fs.statSync(actualPath);
      const expectedStats = fs.statSync(expectedPath);

      // Basic file size comparison
      const sizeDifference = Math.abs(actualStats.size - expectedStats.size);
      const sizeSimilarity = Math.max(0, 100 - (sizeDifference / expectedStats.size) * 100);

      // Read files to compare basic properties
      const actualBuffer = fs.readFileSync(actualPath);
      const expectedBuffer = fs.readFileSync(expectedPath);

      // Simple buffer comparison for exact match
      const exactMatch = actualBuffer.equals(expectedBuffer);
      
      if (exactMatch) {
        return {
          match: true,
          similarity: 100,
          suggestions: [],
          differences: []
        };
      }

      // Provide basic analysis
      const suggestions = [];
      if (sizeDifference > expectedStats.size * 0.1) {
        suggestions.push('Significant size difference detected - content may have changed substantially');
      }

      if (sizeSimilarity < 50) {
        suggestions.push('Consider reviewing the success criteria - the current state differs significantly from expected');
      } else {
        suggestions.push('Minor differences detected - may need fine-tuning of element selectors or timing');
      }

      return {
        match: sizeSimilarity > 90,
        similarity: sizeSimilarity,
        suggestions,
        differences: [
          {
            type: 'content',
            description: `File size difference: ${sizeDifference} bytes`,
            severity: sizeDifference > expectedStats.size * 0.1 ? 'high' : 'low',
            location: 'Overall image'
          }
        ]
      };

    } catch (error) {
      return {
        match: false,
        similarity: 0,
        suggestions: ['Basic comparison failed - manual review required'],
        differences: [
          {
            type: 'error',
            description: error instanceof Error ? error.message : 'Unknown error',
            severity: 'high',
            location: 'Comparison process'
          }
        ]
      };
    }
  }

  /**
   * Parse AI response into structured format
   */
  private parseAIResponse(response: any): any {
    try {
      // If response is already parsed
      if (typeof response === 'object' && response.match !== undefined) {
        return response;
      }

      // If response is a string, try to parse as JSON
      if (typeof response === 'string') {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonString = jsonMatch ? jsonMatch[1] : response;
        
        return JSON.parse(jsonString);
      }

      throw new Error('Invalid response format');

    } catch (error) {
      console.warn('Failed to parse AI response:', error);
      
      // Return default structure
      return {
        match: false,
        similarity: 50,
        suggestions: ['Unable to parse comparison results - manual review recommended'],
        differences: [
          {
            type: 'error',
            description: 'Failed to parse AI analysis',
            severity: 'medium',
            location: 'Analysis process'
          }
        ]
      };
    }
  }

  /**
   * Suggest updates based on differences analysis
   */
  async suggestUpdates(differences: any[]): Promise<string[]> {
    const suggestions: string[] = [];

    for (const diff of differences) {
      switch (diff.type) {
        case 'layout':
          suggestions.push(`Consider updating selectors for layout changes in ${diff.location}`);
          break;
          
        case 'content':
          suggestions.push(`Content differences detected in ${diff.location} - verify expected text or values`);
          break;
          
        case 'element':
          suggestions.push(`UI element changes in ${diff.location} - update target selectors`);
          break;
          
        case 'timing':
          suggestions.push(`Timing issues detected - consider adding wait conditions or increasing timeouts`);
          break;
          
        case 'text':
          suggestions.push(`Text content differences in ${diff.location} - update expected values`);
          break;
          
        case 'color':
          suggestions.push(`Visual styling changes detected - verify UI state or update success criteria`);
          break;
          
        default:
          if (diff.severity === 'high') {
            suggestions.push(`Critical difference in ${diff.location}: ${diff.description}`);
          } else {
            suggestions.push(`Consider reviewing ${diff.location} for: ${diff.description}`);
          }
      }
    }

    // Add general suggestions based on patterns
    if (differences.length > 3) {
      suggestions.push('Multiple differences detected - consider comprehensive review of Intent Spec');
    }

    if (differences.some(d => d.severity === 'high')) {
      suggestions.push('High-severity differences found - manual verification recommended');
    }

    // Remove duplicates and sort by priority
    const uniqueSuggestions = Array.from(new Set(suggestions));
    
    return uniqueSuggestions.sort((a, b) => {
      // Prioritize critical suggestions
      if (a.includes('Critical') && !b.includes('Critical')) return -1;
      if (!a.includes('Critical') && b.includes('Critical')) return 1;
      return 0;
    });
  }

  /**
   * Clear comparison cache
   */
  clearCache(): void {
    this.comparisonCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.comparisonCache.size,
      keys: Array.from(this.comparisonCache.keys())
    };
  }

  /**
   * Validate screenshot file
   */
  private validateScreenshot(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        return false;
      }

      // Basic image file validation
      const ext = path.extname(filePath).toLowerCase();
      return ['.png', '.jpg', '.jpeg', '.bmp', '.gif'].includes(ext);

    } catch {
      return false;
    }
  }
}