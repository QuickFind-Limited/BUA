/**
 * AI Solution Library Manager
 * 
 * Main library management system that provides:
 * 1. Intelligent solution retrieval with fuzzy matching
 * 2. Integration with Claude Code system
 * 3. Continuous learning and adaptation
 * 4. Performance-based solution ranking
 * 5. Version-aware filtering and compatibility
 * 6. Community sharing and export capabilities
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import * as path from 'path';
import * as os from 'os';
import SolutionDatabase, { 
  StoredSolution, 
  SolutionSearchOptions, 
  SolutionUpdateStats 
} from './solution-database';
import { 
  ClaudeSolution, 
  ErrorContext, 
  ClaudeCodeIntegration 
} from './claude-code-integration';
import { ErrorCategory, RecoveryContext, RecoveryResult } from './hybrid-error-recovery';

// Solution library interfaces
export interface SolutionRequest {
  error: Error | any;
  errorContext: ErrorContext;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  timeLimit?: number;
  fallbackAllowed?: boolean;
  excludeSolutions?: string[];
}

export interface SolutionResponse {
  solutions: Array<StoredSolution & { 
    relevanceScore: number; 
    confidence: number;
    estimatedDuration: number;
    riskAssessment: string;
  }>;
  fallbackToClaudeCode: boolean;
  searchStrategy: string;
  totalSearchTime: number;
  cacheHit: boolean;
  metadata: {
    databaseStats: any;
    versionCompatibility: boolean;
    searchTerms: string[];
    filtersCriteria: any;
  };
}

export interface LearningFeedback {
  solutionId: string;
  success: boolean;
  executionTime: number;
  memoryUsage?: number;
  error?: string;
  context?: any;
  improvements?: string;
  alternativeSolutions?: string[];
}

export interface LibraryConfiguration {
  database: {
    path?: string;
    maxCacheSize: number;
    backupInterval: number; // hours
    cleanupInterval: number; // hours
  };
  search: {
    maxResults: number;
    fuzzyMatchThreshold: number;
    relevanceWeights: {
      successRate: number;
      confidence: number;
      recency: number;
      performance: number;
      compatibility: number;
    };
    timeoutMs: number;
  };
  learning: {
    enableContinuousLearning: boolean;
    deprecationThreshold: number; // success rate below which solutions get deprecated
    minUsageForDeprecation: number;
    evolutionEnabled: boolean; // allow solutions to evolve
    communitySharing: boolean;
  };
  integration: {
    enableClaudeCodeFallback: boolean;
    claudeCodeTimeout: number;
    preferLocalSolutions: boolean;
    localConfidenceThreshold: number;
  };
  performance: {
    maxConcurrentSearches: number;
    cacheSearchResults: boolean;
    prefetchSimilar: boolean;
    backgroundIndexing: boolean;
  };
}

export interface SolutionEvolution {
  originalSolutionId: string;
  evolvedSolutionId: string;
  evolutionReason: string;
  improvements: string[];
  performanceGain: number;
  confidenceIncrease: number;
  timestamp: Date;
}

export interface CommunityExport {
  solutions: StoredSolution[];
  metadata: {
    exportedBy: string;
    exportedAt: Date;
    version: string;
    compatibility: any;
    anonymized: boolean;
  };
  statistics: {
    totalSolutions: number;
    averageSuccessRate: number;
    topCategories: Array<{ category: string; count: number }>;
    performanceMetrics: any;
  };
}

/**
 * Main Solution Library Manager Class
 */
export class SolutionLibrary extends EventEmitter {
  private database: SolutionDatabase;
  private config: LibraryConfiguration;
  private claudeCodeIntegration?: ClaudeCodeIntegration;
  private searchCache: Map<string, { result: SolutionResponse; timestamp: Date }> = new Map();
  private isInitialized: boolean = false;
  private backgroundTasks: Set<NodeJS.Timeout> = new Set();
  private concurrentSearches: number = 0;
  private evolutionHistory: Map<string, SolutionEvolution[]> = new Map();
  
  constructor(config?: Partial<LibraryConfiguration>) {
    super();
    this.config = this.mergeConfiguration(config);
    this.database = new SolutionDatabase(this.config.database.path);
    this.setupEventHandlers();
  }

  /**
   * Initialize the solution library
   */
  async initialize(claudeCodeIntegration?: ClaudeCodeIntegration): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.emit('initialization:start');
      
      // Initialize database
      await this.database.initialize();
      
      // Store Claude Code integration reference
      if (claudeCodeIntegration) {
        this.claudeCodeIntegration = claudeCodeIntegration;
      }
      
      // Setup background tasks
      this.setupBackgroundTasks();
      
      // Warm up cache with common solutions
      if (this.config.performance.prefetchSimilar) {
        this.warmupCache();
      }
      
      this.isInitialized = true;
      this.emit('initialization:complete');
      
      console.log('AI Solution Library initialized successfully');
    } catch (error) {
      this.emit('initialization:error', error);
      throw new Error(`Failed to initialize Solution Library: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find solutions for a given error with intelligent ranking
   */
  async findSolutions(request: SolutionRequest): Promise<SolutionResponse> {
    if (!this.isInitialized) {
      throw new Error('Solution Library not initialized');
    }

    // Check rate limiting
    if (this.concurrentSearches >= this.config.performance.maxConcurrentSearches) {
      throw new Error('Too many concurrent searches, please try again');
    }

    const searchStartTime = Date.now();
    this.concurrentSearches++;
    
    try {
      this.emit('search:start', request);
      
      // Check cache first
      const cacheKey = this.generateSearchCacheKey(request);
      const cachedResult = this.getCachedSearchResult(cacheKey);
      if (cachedResult) {
        this.emit('search:cache_hit', request);
        return cachedResult;
      }

      // Perform intelligent search
      const searchResult = await this.performIntelligentSearch(request);
      
      // Cache the result if enabled
      if (this.config.performance.cacheSearchResults) {
        this.cacheSearchResult(cacheKey, searchResult);
      }
      
      // Record search metrics
      const searchTime = Date.now() - searchStartTime;
      this.emit('search:complete', { request, result: searchResult, duration: searchTime });
      
      return searchResult;
    } finally {
      this.concurrentSearches--;
    }
  }

  /**
   * Learn from solution execution feedback
   */
  async learn(feedback: LearningFeedback): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Solution Library not initialized');
    }

    if (!this.config.learning.enableContinuousLearning) {
      return;
    }

    try {
      this.emit('learning:start', feedback);
      
      // Update solution statistics
      const stats: SolutionUpdateStats = {
        solutionId: feedback.solutionId,
        success: feedback.success,
        executionTime: feedback.executionTime,
        memoryUsage: feedback.memoryUsage,
        error: feedback.error,
        timestamp: new Date()
      };
      
      await this.database.updateUsageStatistics(stats);
      
      // Check if solution needs evolution
      if (this.config.learning.evolutionEnabled && !feedback.success && feedback.improvements) {
        await this.evolveUnsafe(feedback);
      }
      
      // Generate new solutions from failures if we have alternative solutions
      if (!feedback.success && feedback.alternativeSolutions) {
        await this.generateAlternativeSolutions(feedback);
      }
      
      this.emit('learning:complete', feedback);
    } catch (error) {
      this.emit('learning:error', { feedback, error });
      console.error('Failed to process learning feedback:', error);
    }
  }

  /**
   * Store a new solution from Claude Code
   */
  async storeSolutionFromClaudeCode(
    claudeSolution: ClaudeSolution,
    errorContext: ErrorContext,
    result?: RecoveryResult
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Solution Library not initialized');
    }

    try {
      // Convert Claude solution to StoredSolution format
      const storedSolution: StoredSolution = {
        id: claudeSolution.id,
        errorPattern: errorContext.errorMessage,
        errorSignature: this.generateErrorSignature(errorContext.errorMessage),
        solutionCode: claudeSolution.code,
        explanation: claudeSolution.explanation,
        confidence: claudeSolution.confidence,
        estimatedSuccessRate: claudeSolution.estimatedSuccessRate,
        actualSuccessRate: result ? (result.success ? 1.0 : 0.0) : claudeSolution.estimatedSuccessRate,
        riskLevel: claudeSolution.riskLevel,
        strategy: claudeSolution.strategy,
        tags: this.extractTagsFromContext(errorContext),
        categories: this.categorizeError(errorContext),
        versionCompatibility: {
          electronVersion: process.versions.electron,
          playwrightVersion: this.getPlaywrightVersion(),
          nodeVersion: process.versions.node,
          platformCompatible: [process.platform]
        },
        performanceMetrics: {
          averageExecutionTime: result?.duration || claudeSolution.timeEstimate,
          memoryUsage: 0,
          cpuUsage: 0,
          networkRequests: 0
        },
        usageStatistics: {
          totalUses: result ? 1 : 0,
          successCount: result?.success ? 1 : 0,
          failureCount: result?.success ? 0 : 1,
          lastUsed: new Date(),
          firstUsed: new Date(),
          recentFailures: result?.success ? [] : [new Date()],
          recentSuccesses: result?.success ? [new Date()] : []
        },
        metadata: {
          model: claudeSolution.metadata.model,
          createdBy: 'claude-code-integration',
          createdAt: claudeSolution.metadata.timestamp,
          updatedAt: new Date(),
          source: 'claude',
          reasoning: claudeSolution.metadata.reasoning,
          requiredPermissions: claudeSolution.requiredPermissions,
          sideEffects: [],
          warnings: [],
          deprecated: false
        }
      };

      await this.database.storeSolution(storedSolution);
      this.emit('solution:stored', { solution: storedSolution, source: 'claude' });
      
      return storedSolution.id;
    } catch (error) {
      this.emit('solution:store_error', { claudeSolution, error });
      throw new Error(`Failed to store Claude solution: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export solutions for community sharing
   */
  async exportForCommunity(options: {
    anonymize?: boolean;
    minSuccessRate?: number;
    includeMetrics?: boolean;
    categories?: string[];
  } = {}): Promise<CommunityExport> {
    if (!this.isInitialized) {
      throw new Error('Solution Library not initialized');
    }

    const searchOptions: SolutionSearchOptions = {
      minSuccessRate: options.minSuccessRate || 0.7,
      categories: options.categories,
      includeDeprecated: false,
      sortBy: 'successRate',
      sortOrder: 'desc'
    };

    const solutions = await this.database.searchSolutions(searchOptions);
    const stats = await this.database.getStatistics();

    // Anonymize solutions if requested
    const exportSolutions: StoredSolution[] = options.anonymize 
      ? solutions.map(this.anonymizeSolution.bind(this))
      : solutions;

    const communityExport: CommunityExport = {
      solutions: exportSolutions,
      metadata: {
        exportedBy: options.anonymize ? 'anonymous' : os.userInfo().username,
        exportedAt: new Date(),
        version: '1.0.0',
        compatibility: {
          electron: process.versions.electron,
          playwright: this.getPlaywrightVersion(),
          node: process.versions.node,
          platform: process.platform
        },
        anonymized: options.anonymize || false
      },
      statistics: {
        totalSolutions: solutions.length,
        averageSuccessRate: stats.averageSuccessRate,
        topCategories: this.extractTopCategories(solutions),
        performanceMetrics: options.includeMetrics ? stats.performanceMetrics : undefined
      }
    };

    this.emit('export:complete', { export: communityExport, options });
    return communityExport;
  }

  /**
   * Import solutions from community or backup
   */
  async importSolutions(
    data: CommunityExport | string,
    options: { 
      overwrite?: boolean; 
      validate?: boolean;
      trustLevel?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    if (!this.isInitialized) {
      throw new Error('Solution Library not initialized');
    }

    try {
      const importData = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Validate import data
      if (!this.validateImportData(importData)) {
        throw new Error('Invalid import data format');
      }

      // Filter solutions based on trust level
      const filteredSolutions = this.filterSolutionsByTrust(
        importData.solutions,
        options.trustLevel || 'medium'
      );

      // Import filtered solutions using database method
      const result = await this.database.importSolutions(
        JSON.stringify({ solutions: filteredSolutions }),
        {
          overwrite: options.overwrite,
          validate: options.validate
        }
      );

      this.emit('import:complete', { result, options });
      return result;
    } catch (error) {
      this.emit('import:error', { data, error });
      throw new Error(`Failed to import solutions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get library statistics and health metrics
   */
  async getLibraryHealth(): Promise<{
    database: any;
    cache: { size: number; hitRate: number };
    search: { averageTime: number; concurrentSearches: number };
    learning: { evolutionsCount: number; recentActivity: any };
    integration: { claudeCodeAvailable: boolean; fallbackRate: number };
  }> {
    if (!this.isInitialized) {
      throw new Error('Solution Library not initialized');
    }

    const databaseStats = await this.database.getStatistics();
    
    return {
      database: databaseStats,
      cache: {
        size: this.searchCache.size,
        hitRate: this.calculateCacheHitRate()
      },
      search: {
        averageTime: this.calculateAverageSearchTime(),
        concurrentSearches: this.concurrentSearches
      },
      learning: {
        evolutionsCount: this.getTotalEvolutions(),
        recentActivity: this.getRecentLearningActivity()
      },
      integration: {
        claudeCodeAvailable: !!this.claudeCodeIntegration,
        fallbackRate: this.calculateFallbackRate()
      }
    };
  }

  // Private methods

  private mergeConfiguration(userConfig?: Partial<LibraryConfiguration>): LibraryConfiguration {
    const defaultConfig: LibraryConfiguration = {
      database: {
        path: path.join(process.cwd(), 'data', 'solution-library.db'),
        maxCacheSize: 1000,
        backupInterval: 24, // hours
        cleanupInterval: 168 // 7 days
      },
      search: {
        maxResults: 10,
        fuzzyMatchThreshold: 0.6,
        relevanceWeights: {
          successRate: 0.3,
          confidence: 0.25,
          recency: 0.15,
          performance: 0.15,
          compatibility: 0.15
        },
        timeoutMs: 5000
      },
      learning: {
        enableContinuousLearning: true,
        deprecationThreshold: 0.2,
        minUsageForDeprecation: 5,
        evolutionEnabled: true,
        communitySharing: false
      },
      integration: {
        enableClaudeCodeFallback: true,
        claudeCodeTimeout: 30000,
        preferLocalSolutions: true,
        localConfidenceThreshold: 0.7
      },
      performance: {
        maxConcurrentSearches: 5,
        cacheSearchResults: true,
        prefetchSimilar: true,
        backgroundIndexing: true
      }
    };

    return this.deepMerge(defaultConfig, userConfig || {});
  }

  private async performIntelligentSearch(request: SolutionRequest): Promise<SolutionResponse> {
    const searchStartTime = Date.now();
    let fallbackToClaudeCode = false;
    let searchStrategy = 'intelligent_multi_stage';
    
    try {
      // Stage 1: Exact signature match
      const exactMatches = await this.database.searchSolutions({
        errorSignature: this.generateErrorSignature(request.errorContext.errorMessage),
        minSuccessRate: 0.5,
        maxRiskLevel: request.urgency === 'critical' ? 'low' : 'high',
        includeDeprecated: false,
        limit: 5
      });

      if (exactMatches.length > 0) {
        searchStrategy = 'exact_signature_match';
        return this.buildSolutionResponse(exactMatches, request, searchStrategy, Date.now() - searchStartTime, true);
      }

      // Stage 2: Fuzzy similarity search
      const similarSolutions = await this.database.findSimilarSolutions(
        request.errorContext.errorMessage,
        {
          minSuccessRate: 0.3,
          maxRiskLevel: request.urgency === 'critical' ? 'medium' : 'high',
          includeDeprecated: false,
          limit: 10
        }
      );

      if (similarSolutions.length > 0) {
        searchStrategy = 'fuzzy_similarity_match';
        const rankedSolutions = this.rankSolutionsByRelevance(similarSolutions, request);
        return this.buildSolutionResponse(rankedSolutions, request, searchStrategy, Date.now() - searchStartTime, false);
      }

      // Stage 3: Category and strategy-based search
      const categoryMatches = await this.database.searchSolutions({
        categories: this.categorizeError(request.errorContext),
        strategy: this.inferStrategy(request.errorContext),
        minSuccessRate: 0.2,
        includeDeprecated: false,
        sortBy: 'successRate',
        limit: 5
      });

      if (categoryMatches.length > 0) {
        searchStrategy = 'category_strategy_match';
        const rankedSolutions = this.rankSolutionsByRelevance(categoryMatches, request);
        return this.buildSolutionResponse(rankedSolutions, request, searchStrategy, Date.now() - searchStartTime, false);
      }

      // Stage 4: Full-text search as last resort
      const keywords = this.extractKeywords(request.errorContext.errorMessage);
      if (keywords.length > 0) {
        const textMatches = await this.database.fullTextSearch(keywords.join(' OR '), {
          minSuccessRate: 0.1,
          includeDeprecated: false,
          limit: 8
        });

        if (textMatches.length > 0) {
          searchStrategy = 'full_text_search';
          const rankedSolutions = this.rankSolutionsByRelevance(textMatches, request);
          return this.buildSolutionResponse(rankedSolutions, request, searchStrategy, Date.now() - searchStartTime, false);
        }
      }

      // Stage 5: Decide on Claude Code fallback
      if (this.shouldFallbackToClaudeCode(request)) {
        fallbackToClaudeCode = true;
        searchStrategy = 'claude_code_fallback';
      }

      return this.buildSolutionResponse([], request, searchStrategy, Date.now() - searchStartTime, false, fallbackToClaudeCode);

    } catch (error) {
      this.emit('search:error', { request, error });
      throw error;
    }
  }

  private shouldFallbackToClaudeCode(request: SolutionRequest): boolean {
    if (!this.config.integration.enableClaudeCodeFallback) {
      return false;
    }

    if (!this.claudeCodeIntegration) {
      return false;
    }

    if (request.fallbackAllowed === false) {
      return false;
    }

    // Fallback for critical or high urgency errors
    if (request.urgency === 'critical' || request.urgency === 'high') {
      return true;
    }

    // Fallback if we have time limit and Claude Code can meet it
    if (request.timeLimit && request.timeLimit > this.config.integration.claudeCodeTimeout) {
      return true;
    }

    return false;
  }

  private rankSolutionsByRelevance(
    solutions: (StoredSolution & { similarity?: number })[], 
    request: SolutionRequest
  ): (StoredSolution & { similarity?: number })[] {
    const weights = this.config.search.relevanceWeights;
    
    return solutions
      .map(solution => ({
        ...solution,
        relevanceScore: this.calculateRelevanceScore(solution, request, weights)
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private calculateRelevanceScore(
    solution: StoredSolution & { similarity?: number },
    request: SolutionRequest,
    weights: LibraryConfiguration['search']['relevanceWeights']
  ): number {
    let score = 0;
    
    // Success rate component
    score += solution.actualSuccessRate * weights.successRate;
    
    // Confidence component
    score += solution.confidence * weights.confidence;
    
    // Recency component (newer solutions get higher scores)
    const daysSinceLastUse = (Date.now() - solution.usageStatistics.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 1 - (daysSinceLastUse / 365)); // Decay over a year
    score += recencyScore * weights.recency;
    
    // Performance component (faster execution gets higher scores)
    const performanceScore = solution.performanceMetrics.averageExecutionTime > 0 
      ? Math.max(0, 1 - (solution.performanceMetrics.averageExecutionTime / 60000)) // Normalize to 1 minute
      : 0.5;
    score += performanceScore * weights.performance;
    
    // Compatibility component
    const compatibilityScore = this.calculateCompatibilityScore(solution);
    score += compatibilityScore * weights.compatibility;
    
    // Similarity bonus if available
    if (solution.similarity !== undefined) {
      score *= (1 + solution.similarity * 0.5); // Up to 50% bonus for high similarity
    }
    
    // Urgency adjustments
    if (request.urgency === 'critical') {
      if (solution.riskLevel === 'low') {
        score *= 1.2; // Prefer low-risk solutions for critical errors
      } else if (solution.riskLevel === 'high') {
        score *= 0.8; // Penalize high-risk solutions
      }
    }
    
    return score;
  }

  private calculateCompatibilityScore(solution: StoredSolution): number {
    let score = 1.0;
    
    // Platform compatibility
    if (solution.versionCompatibility.platformCompatible) {
      if (!solution.versionCompatibility.platformCompatible.includes(process.platform)) {
        score *= 0.5;
      }
    }
    
    // Version compatibility (simplified - in practice would need more sophisticated version matching)
    if (solution.versionCompatibility.electronVersion) {
      const currentElectron = process.versions.electron;
      if (currentElectron && solution.versionCompatibility.electronVersion !== currentElectron) {
        score *= 0.9; // Small penalty for version mismatch
      }
    }
    
    return score;
  }

  private buildSolutionResponse(
    solutions: any[], 
    request: SolutionRequest, 
    searchStrategy: string, 
    searchTime: number, 
    cacheHit: boolean,
    fallbackToClaudeCode: boolean = false
  ): SolutionResponse {
    return {
      solutions: solutions.map(solution => ({
        ...solution,
        relevanceScore: solution.relevanceScore || 0,
        estimatedDuration: solution.performanceMetrics?.averageExecutionTime || 5000,
        riskAssessment: this.generateRiskAssessment(solution, request)
      })),
      fallbackToClaudeCode,
      searchStrategy,
      totalSearchTime: searchTime,
      cacheHit,
      metadata: {
        databaseStats: {}, // Would populate with relevant stats
        versionCompatibility: true,
        searchTerms: this.extractKeywords(request.errorContext.errorMessage),
        filtersCriteria: {
          urgency: request.urgency,
          timeLimit: request.timeLimit,
          excludeSolutions: request.excludeSolutions
        }
      }
    };
  }

  private generateRiskAssessment(solution: StoredSolution, request: SolutionRequest): string {
    const risk = solution.riskLevel;
    const successRate = solution.actualSuccessRate;
    const urgency = request.urgency;
    
    if (risk === 'high' && urgency === 'critical') {
      return 'High risk solution for critical issue - use with extreme caution';
    } else if (risk === 'high') {
      return 'High risk solution - thoroughly test before deployment';
    } else if (successRate < 0.5) {
      return 'Low success rate - consider as last resort';
    } else if (risk === 'low' && successRate > 0.8) {
      return 'Low risk, high success rate - recommended';
    } else {
      return 'Moderate risk - standard precautions apply';
    }
  }

  private async evolveUnsafe(feedback: LearningFeedback): Promise<void> {
    try {
      const originalSolution = await this.database.getSolutionById(feedback.solutionId);
      if (!originalSolution) {
        return;
      }

      // Create evolved solution based on feedback
      const evolvedSolution: StoredSolution = {
        ...originalSolution,
        id: this.generateSolutionId(),
        solutionCode: this.applySolutionImprovements(originalSolution.solutionCode, feedback.improvements!),
        explanation: `${originalSolution.explanation}\n\nEvolved based on feedback: ${feedback.improvements}`,
        estimatedSuccessRate: Math.min(1.0, originalSolution.estimatedSuccessRate + 0.1),
        confidence: Math.min(1.0, originalSolution.confidence + 0.05),
        metadata: {
          ...originalSolution.metadata,
          source: 'claude' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          reasoning: `Evolved from ${feedback.solutionId} due to: ${feedback.improvements}`
        },
        usageStatistics: {
          totalUses: 0,
          successCount: 0,
          failureCount: 0,
          lastUsed: new Date(),
          firstUsed: new Date(),
          recentFailures: [],
          recentSuccesses: []
        }
      };

      await this.database.storeSolution(evolvedSolution);
      
      // Track evolution
      const evolution: SolutionEvolution = {
        originalSolutionId: feedback.solutionId,
        evolvedSolutionId: evolvedSolution.id,
        evolutionReason: feedback.improvements!,
        improvements: feedback.improvements!.split(',').map(i => i.trim()),
        performanceGain: 0, // Will be calculated as feedback comes in
        confidenceIncrease: 0.05,
        timestamp: new Date()
      };
      
      this.trackEvolution(evolution);
      this.emit('evolution:created', evolution);
      
    } catch (error) {
      this.emit('evolution:error', { feedback, error });
    }
  }

  private applySolutionImprovements(originalCode: string, improvements: string): string {
    // This is a simplified implementation - in practice would need more sophisticated code modification
    // For now, just add a comment with the improvements
    return `// Evolved solution with improvements: ${improvements}\n${originalCode}`;
  }

  private async generateAlternativeSolutions(feedback: LearningFeedback): Promise<void> {
    // This would integrate with Claude Code to generate alternative solutions
    // For now, just emit an event
    this.emit('alternatives:requested', feedback);
  }

  private generateErrorSignature(errorMessage: string): string {
    const normalized = errorMessage
      .toLowerCase()
      .replace(/\d+/g, 'N')
      .replace(/['"`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  private extractTagsFromContext(context: ErrorContext): string[] {
    const tags: string[] = [];
    
    if (context.selector) tags.push('selector-based');
    if (context.value) tags.push('input-related');
    if (context.retryCount > 0) tags.push('retry-needed');
    if (context.category) tags.push(`category-${context.category}`);
    if (context.stepName) tags.push(`step-${context.stepName.toLowerCase().replace(/\s+/g, '-')}`);
    
    return tags;
  }

  private categorizeError(context: ErrorContext): string[] {
    const categories: string[] = [];
    
    categories.push(context.category);
    
    if (context.selector) {
      categories.push('ui-interaction');
    }
    
    if (context.errorMessage.includes('timeout')) {
      categories.push('timing');
    }
    
    if (context.errorMessage.includes('network')) {
      categories.push('network');
    }
    
    return categories.filter(Boolean);
  }

  private inferStrategy(context: ErrorContext): string {
    if (context.errorMessage.includes('timeout')) return 'wait_strategy';
    if (context.errorMessage.includes('not found')) return 'element_location';
    if (context.errorMessage.includes('click')) return 'interaction_retry';
    if (context.errorMessage.includes('network')) return 'network_retry';
    return 'generic_retry';
  }

  private extractKeywords(errorMessage: string): string[] {
    return errorMessage
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !['error', 'failed', 'unable', 'cannot'].includes(word))
      .slice(0, 5);
  }

  private getPlaywrightVersion(): string {
    try {
      return require('playwright/package.json').version;
    } catch {
      return 'unknown';
    }
  }

  private generateSolutionId(): string {
    return `sol-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cache management
  private generateSearchCacheKey(request: SolutionRequest): string {
    const keyData = {
      errorMessage: request.errorContext.errorMessage,
      urgency: request.urgency,
      timeLimit: request.timeLimit,
      excludeSolutions: request.excludeSolutions?.sort()
    };
    
    return createHash('sha256').update(JSON.stringify(keyData)).digest('hex').substring(0, 16);
  }

  private getCachedSearchResult(cacheKey: string): SolutionResponse | null {
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp.getTime() < 300000) { // 5 minutes cache
      return { ...cached.result, cacheHit: true };
    }
    return null;
  }

  private cacheSearchResult(cacheKey: string, result: SolutionResponse): void {
    if (this.searchCache.size >= 100) { // Limit cache size
      const oldestKey = Array.from(this.searchCache.keys())[0];
      this.searchCache.delete(oldestKey);
    }
    
    this.searchCache.set(cacheKey, { result, timestamp: new Date() });
  }

  // Utility methods
  private anonymizeSolution(solution: StoredSolution): StoredSolution {
    return {
      ...solution,
      metadata: {
        ...solution.metadata,
        createdBy: 'anonymous',
        reasoning: solution.metadata.reasoning.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]')
      }
    };
  }

  private extractTopCategories(solutions: StoredSolution[]): Array<{ category: string; count: number }> {
    const categoryCount = new Map<string, number>();
    
    solutions.forEach(solution => {
      solution.categories.forEach(category => {
        categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
      });
    });
    
    return Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private validateImportData(data: any): boolean {
    return data && Array.isArray(data.solutions) && data.metadata && data.statistics;
  }

  private filterSolutionsByTrust(solutions: StoredSolution[], trustLevel: 'low' | 'medium' | 'high'): StoredSolution[] {
    const thresholds = {
      low: { minSuccessRate: 0.1, maxRisk: 'high' as const },
      medium: { minSuccessRate: 0.5, maxRisk: 'medium' as const },
      high: { minSuccessRate: 0.8, maxRisk: 'low' as const }
    };
    
    const threshold = thresholds[trustLevel];
    
    return solutions.filter(solution => 
      solution.actualSuccessRate >= threshold.minSuccessRate &&
      this.riskLevelToNumber(solution.riskLevel) <= this.riskLevelToNumber(threshold.maxRisk)
    );
  }

  private riskLevelToNumber(risk: 'low' | 'medium' | 'high'): number {
    return { low: 1, medium: 2, high: 3 }[risk];
  }

  private setupEventHandlers(): void {
    this.on('error', (error) => {
      console.error('Solution Library error:', error);
    });
    
    this.on('learning:complete', (feedback) => {
      console.log(`Solution ${feedback.solutionId} learning feedback processed: ${feedback.success ? 'success' : 'failure'}`);
    });
  }

  private setupBackgroundTasks(): void {
    // Periodic backup
    const backupInterval = setInterval(async () => {
      try {
        await this.database.createBackup();
        this.emit('backup:complete');
      } catch (error) {
        this.emit('backup:error', error);
      }
    }, this.config.database.backupInterval * 60 * 60 * 1000);
    
    this.backgroundTasks.add(backupInterval);
    
    // Cache cleanup
    const cacheCleanupInterval = setInterval(() => {
      this.cleanupSearchCache();
    }, 300000); // Every 5 minutes
    
    this.backgroundTasks.add(cacheCleanupInterval);
  }

  private cleanupSearchCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.searchCache.entries()) {
      if (now - cached.timestamp.getTime() > 300000) { // 5 minutes
        this.searchCache.delete(key);
      }
    }
  }

  private async warmupCache(): Promise<void> {
    // Warm up cache with common error patterns
    const commonPatterns = [
      'timeout', 'not found', 'click failed', 'navigation error',
      'element not visible', 'permission denied', 'network error'
    ];
    
    for (const pattern of commonPatterns) {
      try {
        await this.database.searchSolutions({
          errorPattern: pattern,
          limit: 5,
          sortBy: 'successRate',
          sortOrder: 'desc'
        });
      } catch (error) {
        // Ignore warmup errors
      }
    }
  }

  private trackEvolution(evolution: SolutionEvolution): void {
    const evolutions = this.evolutionHistory.get(evolution.originalSolutionId) || [];
    evolutions.push(evolution);
    this.evolutionHistory.set(evolution.originalSolutionId, evolutions);
  }

  // Statistics methods
  private calculateCacheHitRate(): number {
    // This would be tracked over time in a real implementation
    return 0.75; // Placeholder
  }

  private calculateAverageSearchTime(): number {
    // This would be tracked over time in a real implementation
    return 250; // Placeholder in ms
  }

  private getTotalEvolutions(): number {
    return Array.from(this.evolutionHistory.values()).reduce((sum, evolutions) => sum + evolutions.length, 0);
  }

  private getRecentLearningActivity(): any {
    // This would provide recent learning statistics
    return { recentFeedback: 10, evolutionsToday: 2 };
  }

  private calculateFallbackRate(): number {
    // This would be tracked over time in a real implementation
    return 0.15; // Placeholder - 15% of searches fallback to Claude Code
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Cleanup resources and close connections
   */
  async cleanup(): Promise<void> {
    this.removeAllListeners();
    
    // Clear background tasks
    for (const task of this.backgroundTasks) {
      clearInterval(task);
    }
    this.backgroundTasks.clear();
    
    // Clear caches
    this.searchCache.clear();
    this.evolutionHistory.clear();
    
    // Close database
    if (this.database) {
      await this.database.close();
    }
    
    this.isInitialized = false;
    this.emit('cleanup:complete');
  }
}

export default SolutionLibrary;