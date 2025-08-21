/**
 * AI Solution Database Module
 * 
 * SQLite-based persistent storage system for AI-generated solutions with:
 * 1. Comprehensive solution metadata storage
 * 2. Full-text search capabilities
 * 3. Performance-optimized indexing
 * 4. Automatic backup and migration support
 * 5. Solution effectiveness tracking
 * 6. Version compatibility management
 */

import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createHash } from 'crypto';

// Solution database interfaces
export interface StoredSolution {
  id: string;
  errorPattern: string;
  errorSignature: string;
  solutionCode: string;
  explanation: string;
  confidence: number;
  estimatedSuccessRate: number;
  actualSuccessRate: number;
  riskLevel: 'low' | 'medium' | 'high';
  strategy: string;
  tags: string[];
  categories: string[];
  versionCompatibility: {
    electronVersion?: string;
    playwrightVersion?: string;
    nodeVersion?: string;
    platformCompatible: string[];
  };
  performanceMetrics: {
    averageExecutionTime: number;
    memoryUsage?: number;
    cpuUsage?: number;
    networkRequests?: number;
  };
  usageStatistics: {
    totalUses: number;
    successCount: number;
    failureCount: number;
    lastUsed: Date;
    firstUsed: Date;
    recentFailures: Date[];
    recentSuccesses: Date[];
  };
  metadata: {
    model: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    source: 'claude' | 'manual' | 'import';
    reasoning: string;
    requiredPermissions: string[];
    sideEffects: string[];
    warnings: string[];
    deprecated: boolean;
    deprecatedReason?: string;
    deprecatedAt?: Date;
  };
}

export interface SolutionSearchOptions {
  errorPattern?: string;
  errorSignature?: string;
  tags?: string[];
  categories?: string[];
  strategy?: string;
  minConfidence?: number;
  minSuccessRate?: number;
  maxRiskLevel?: 'low' | 'medium' | 'high';
  versionCompatible?: boolean;
  includeDeprecated?: boolean;
  sortBy?: 'relevance' | 'successRate' | 'lastUsed' | 'confidence' | 'performance';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SolutionUpdateStats {
  solutionId: string;
  success: boolean;
  executionTime: number;
  memoryUsage?: number;
  error?: string;
  timestamp: Date;
}

export interface DatabaseBackup {
  version: string;
  timestamp: Date;
  totalSolutions: number;
  metadata: {
    electronVersion?: string;
    playwrightVersion?: string;
    nodeVersion?: string;
    platform: string;
  };
}

export interface MigrationScript {
  version: string;
  description: string;
  up: string[];
  down: string[];
}

/**
 * SQLite Database Manager for AI Solutions
 */
export class SolutionDatabase {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private backupDir: string;
  private isInitialized: boolean = false;
  private currentVersion: string = '1.0.0';

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'solution-library.db');
    this.backupDir = path.dirname(this.dbPath) + '/backups';
  }

  /**
   * Initialize database with schema creation and migration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure directory exists
      const dbDir = path.dirname(this.dbPath);
      await fs.mkdir(dbDir, { recursive: true });
      await fs.mkdir(this.backupDir, { recursive: true });

      // Open database connection
      this.db = await this.openDatabase();
      
      // Run migrations
      await this.runMigrations();
      
      // Create indexes
      await this.createIndexes();
      
      // Setup automatic cleanup
      this.setupPeriodicCleanup();
      
      this.isInitialized = true;
      console.log(`Solution database initialized at: ${this.dbPath}`);
    } catch (error) {
      throw new Error(`Failed to initialize solution database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async openDatabase(): Promise<sqlite3.Database> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          // Enable foreign keys and WAL mode for better performance
          db.run('PRAGMA foreign_keys = ON');
          db.run('PRAGMA journal_mode = WAL');
          db.run('PRAGMA synchronous = NORMAL');
          db.run('PRAGMA cache_size = -64000'); // 64MB cache
          db.run('PRAGMA temp_store = MEMORY');
          resolve(db);
        }
      });
    });
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const migrations: MigrationScript[] = [
      {
        version: '1.0.0',
        description: 'Initial schema creation',
        up: [
          // Solutions table
          `CREATE TABLE IF NOT EXISTS solutions (
            id TEXT PRIMARY KEY,
            error_pattern TEXT NOT NULL,
            error_signature TEXT NOT NULL,
            solution_code TEXT NOT NULL,
            explanation TEXT NOT NULL,
            confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
            estimated_success_rate REAL NOT NULL DEFAULT 0.5,
            actual_success_rate REAL NOT NULL DEFAULT 0,
            risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
            strategy TEXT NOT NULL,
            tags TEXT NOT NULL DEFAULT '[]', -- JSON array
            categories TEXT NOT NULL DEFAULT '[]', -- JSON array
            version_compatibility TEXT NOT NULL DEFAULT '{}', -- JSON object
            performance_metrics TEXT NOT NULL DEFAULT '{}', -- JSON object
            usage_statistics TEXT NOT NULL DEFAULT '{}', -- JSON object
            metadata TEXT NOT NULL DEFAULT '{}', -- JSON object
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
          )`,
          
          // Full-text search virtual table
          `CREATE VIRTUAL TABLE IF NOT EXISTS solutions_fts USING fts5(
            error_pattern,
            solution_code,
            explanation,
            strategy,
            tags,
            categories,
            content='solutions',
            content_rowid='rowid'
          )`,
          
          // Usage tracking table
          `CREATE TABLE IF NOT EXISTS solution_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            solution_id TEXT NOT NULL,
            timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            success INTEGER NOT NULL CHECK (success IN (0, 1)),
            execution_time REAL NOT NULL,
            memory_usage REAL,
            error_message TEXT,
            context TEXT, -- JSON object
            FOREIGN KEY (solution_id) REFERENCES solutions(id) ON DELETE CASCADE
          )`,
          
          // Version compatibility table
          `CREATE TABLE IF NOT EXISTS version_compatibility (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            solution_id TEXT NOT NULL,
            electron_version TEXT,
            playwright_version TEXT,
            node_version TEXT,
            platform TEXT NOT NULL,
            compatible INTEGER NOT NULL CHECK (compatible IN (0, 1)),
            tested_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (solution_id) REFERENCES solutions(id) ON DELETE CASCADE
          )`,
          
          // Database metadata table
          `CREATE TABLE IF NOT EXISTS database_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
          )`,
          
          // Insert initial metadata
          `INSERT OR REPLACE INTO database_metadata (key, value) VALUES ('version', '1.0.0')`,
          `INSERT OR REPLACE INTO database_metadata (key, value) VALUES ('created_at', strftime('%s', 'now'))`,
        ],
        down: [
          'DROP TABLE IF EXISTS solution_usage',
          'DROP TABLE IF EXISTS version_compatibility', 
          'DROP TABLE IF EXISTS database_metadata',
          'DROP TABLE IF EXISTS solutions_fts',
          'DROP TABLE IF EXISTS solutions'
        ]
      }
    ];

    // Check current database version
    let currentDbVersion = '0.0.0';
    try {
      const result = await this.query('SELECT value FROM database_metadata WHERE key = "version"');
      if (result.length > 0) {
        currentDbVersion = result[0].value;
      }
    } catch (error) {
      // Database doesn't exist or has no metadata table
    }

    // Apply migrations
    for (const migration of migrations) {
      if (this.compareVersions(migration.version, currentDbVersion) > 0) {
        console.log(`Applying migration: ${migration.description}`);
        
        for (const statement of migration.up) {
          await this.run(statement);
        }
        
        await this.run(
          'INSERT OR REPLACE INTO database_metadata (key, value) VALUES (?, ?)',
          ['version', migration.version]
        );
      }
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const indexes = [
      // Primary search indexes
      'CREATE INDEX IF NOT EXISTS idx_solutions_error_signature ON solutions(error_signature)',
      'CREATE INDEX IF NOT EXISTS idx_solutions_strategy ON solutions(strategy)',
      'CREATE INDEX IF NOT EXISTS idx_solutions_confidence ON solutions(confidence)',
      'CREATE INDEX IF NOT EXISTS idx_solutions_success_rate ON solutions(actual_success_rate)',
      'CREATE INDEX IF NOT EXISTS idx_solutions_risk_level ON solutions(risk_level)',
      'CREATE INDEX IF NOT EXISTS idx_solutions_updated_at ON solutions(updated_at)',
      
      // Usage tracking indexes
      'CREATE INDEX IF NOT EXISTS idx_usage_solution_id ON solution_usage(solution_id)',
      'CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON solution_usage(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_usage_success ON solution_usage(success)',
      
      // Version compatibility indexes
      'CREATE INDEX IF NOT EXISTS idx_version_solution_id ON version_compatibility(solution_id)',
      'CREATE INDEX IF NOT EXISTS idx_version_platform ON version_compatibility(platform)',
      'CREATE INDEX IF NOT EXISTS idx_version_compatible ON version_compatibility(compatible)',
    ];

    for (const indexSql of indexes) {
      await this.run(indexSql);
    }
  }

  /**
   * Store a new solution in the database
   */
  async storeSolution(solution: StoredSolution): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const sql = `
      INSERT OR REPLACE INTO solutions (
        id, error_pattern, error_signature, solution_code, explanation,
        confidence, estimated_success_rate, actual_success_rate, risk_level, strategy,
        tags, categories, version_compatibility, performance_metrics,
        usage_statistics, metadata, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
    `;

    const params = [
      solution.id,
      solution.errorPattern,
      solution.errorSignature,
      solution.solutionCode,
      solution.explanation,
      solution.confidence,
      solution.estimatedSuccessRate,
      solution.actualSuccessRate,
      solution.riskLevel,
      solution.strategy,
      JSON.stringify(solution.tags),
      JSON.stringify(solution.categories),
      JSON.stringify(solution.versionCompatibility),
      JSON.stringify(solution.performanceMetrics),
      JSON.stringify(solution.usageStatistics),
      JSON.stringify(solution.metadata)
    ];

    await this.run(sql, params);

    // Update FTS index
    await this.updateFTSIndex(solution);
  }

  /**
   * Search for solutions using various criteria
   */
  async searchSolutions(options: SolutionSearchOptions = {}): Promise<StoredSolution[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM solutions WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (options.errorPattern) {
      sql += ` AND error_pattern LIKE ?`;
      params.push(`%${options.errorPattern}%`);
    }

    if (options.errorSignature) {
      sql += ` AND error_signature = ?`;
      params.push(options.errorSignature);
    }

    if (options.strategy) {
      sql += ` AND strategy = ?`;
      params.push(options.strategy);
    }

    if (options.minConfidence !== undefined) {
      sql += ` AND confidence >= ?`;
      params.push(options.minConfidence);
    }

    if (options.minSuccessRate !== undefined) {
      sql += ` AND actual_success_rate >= ?`;
      params.push(options.minSuccessRate);
    }

    if (options.maxRiskLevel) {
      const riskLevels = { low: 1, medium: 2, high: 3 };
      const maxLevel = riskLevels[options.maxRiskLevel];
      sql += ` AND (
        (risk_level = 'low' AND ? >= 1) OR
        (risk_level = 'medium' AND ? >= 2) OR
        (risk_level = 'high' AND ? >= 3)
      )`;
      params.push(maxLevel, maxLevel, maxLevel);
    }

    if (!options.includeDeprecated) {
      sql += ` AND json_extract(metadata, '$.deprecated') IS NOT 1`;
    }

    // Add tag filtering
    if (options.tags && options.tags.length > 0) {
      const tagConditions = options.tags.map(() => `EXISTS (
        SELECT 1 FROM json_each(tags) WHERE json_each.value = ?
      )`);
      sql += ` AND (${tagConditions.join(' OR ')})`;
      params.push(...options.tags);
    }

    // Add category filtering
    if (options.categories && options.categories.length > 0) {
      const categoryConditions = options.categories.map(() => `EXISTS (
        SELECT 1 FROM json_each(categories) WHERE json_each.value = ?
      )`);
      sql += ` AND (${categoryConditions.join(' OR ')})`;
      params.push(...options.categories);
    }

    // Add version compatibility filtering
    if (options.versionCompatible) {
      const currentVersions = await this.getCurrentVersionInfo();
      sql += ` AND (
        json_extract(version_compatibility, '$.electronVersion') IS NULL OR
        json_extract(version_compatibility, '$.electronVersion') = ? OR
        json_extract(version_compatibility, '$.electronVersion') LIKE '%*%'
      )`;
      params.push(currentVersions.electron);
    }

    // Add sorting
    const sortMappings = {
      relevance: 'actual_success_rate DESC, confidence DESC',
      successRate: 'actual_success_rate DESC',
      lastUsed: 'json_extract(usage_statistics, "$.lastUsed") DESC',
      confidence: 'confidence DESC',
      performance: 'json_extract(performance_metrics, "$.averageExecutionTime") ASC'
    };

    const sortBy = options.sortBy || 'relevance';
    const sortOrder = options.sortOrder || 'desc';
    const orderClause = sortMappings[sortBy] || sortMappings.relevance;
    
    sql += ` ORDER BY ${orderClause}`;

    // Add pagination
    if (options.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
      
      if (options.offset) {
        sql += ` OFFSET ?`;
        params.push(options.offset);
      }
    }

    const rows = await this.query(sql, params);
    return rows.map(row => this.mapRowToSolution(row));
  }

  /**
   * Full-text search across solutions
   */
  async fullTextSearch(searchTerm: string, options: SolutionSearchOptions = {}): Promise<StoredSolution[]> {
    if (!this.db) throw new Error('Database not initialized');

    // Use FTS5 for full-text search
    let sql = `
      SELECT solutions.*, solutions_fts.rank
      FROM solutions_fts
      JOIN solutions ON solutions.rowid = solutions_fts.rowid
      WHERE solutions_fts MATCH ?
    `;
    
    const params = [searchTerm];

    // Add additional filtering
    if (options.minConfidence !== undefined) {
      sql += ` AND solutions.confidence >= ?`;
      params.push(options.minConfidence.toString());
    }

    if (options.minSuccessRate !== undefined) {
      sql += ` AND solutions.actual_success_rate >= ?`;
      params.push(options.minSuccessRate.toString());
    }

    if (!options.includeDeprecated) {
      sql += ` AND json_extract(solutions.metadata, '$.deprecated') IS NOT 1`;
    }

    sql += ` ORDER BY solutions_fts.rank, solutions.actual_success_rate DESC, solutions.confidence DESC`;

    if (options.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit.toString());
    }

    const rows = await this.query(sql, params);
    return rows.map(row => this.mapRowToSolution(row));
  }

  /**
   * Find similar solutions using fuzzy matching
   */
  async findSimilarSolutions(
    errorPattern: string, 
    options: SolutionSearchOptions = {}
  ): Promise<Array<StoredSolution & { similarity: number }>> {
    if (!this.db) throw new Error('Database not initialized');

    const errorSignature = this.generateErrorSignature(errorPattern);
    
    // First try exact signature match
    const exactMatches = await this.searchSolutions({
      ...options,
      errorSignature,
      limit: 5
    });

    if (exactMatches.length > 0) {
      return exactMatches.map(solution => ({ ...solution, similarity: 1.0 }));
    }

    // Then try pattern-based fuzzy search
    const fuzzyMatches = await this.query(`
      SELECT *, 
        (CASE 
          WHEN error_signature = ? THEN 1.0
          WHEN error_pattern LIKE ? THEN 0.8
          WHEN error_pattern LIKE ? THEN 0.6
          ELSE 0.4
        END) as similarity
      FROM solutions 
      WHERE (
        error_signature LIKE ? OR
        error_pattern LIKE ? OR
        strategy IN (
          SELECT DISTINCT strategy FROM solutions 
          WHERE error_pattern LIKE ? 
          ORDER BY actual_success_rate DESC 
          LIMIT 3
        )
      )
      AND json_extract(metadata, '$.deprecated') IS NOT 1
      ORDER BY similarity DESC, actual_success_rate DESC, confidence DESC
      LIMIT ?
    `, [
      errorSignature,
      `%${errorPattern}%`,
      `%${this.extractErrorKeywords(errorPattern)}%`,
      `%${errorSignature.substring(0, 8)}%`,
      `%${errorPattern}%`,
      `%${errorPattern}%`,
      options.limit || 10
    ]);

    return fuzzyMatches.map(row => ({
      ...this.mapRowToSolution(row),
      similarity: row.similarity
    }));
  }

  /**
   * Update solution usage statistics
   */
  async updateUsageStatistics(stats: SolutionUpdateStats): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Insert usage record
    await this.run(`
      INSERT INTO solution_usage (
        solution_id, success, execution_time, memory_usage, error_message, context, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      stats.solutionId,
      stats.success ? 1 : 0,
      stats.executionTime,
      stats.memoryUsage || null,
      stats.error || null,
      JSON.stringify({ timestamp: stats.timestamp }),
      Math.floor(stats.timestamp.getTime() / 1000)
    ]);

    // Update solution statistics
    const solution = await this.getSolutionById(stats.solutionId);
    if (solution) {
      const updatedStats = { ...solution.usageStatistics };
      updatedStats.totalUses++;
      
      if (stats.success) {
        updatedStats.successCount++;
        updatedStats.recentSuccesses = [
          stats.timestamp,
          ...updatedStats.recentSuccesses.slice(0, 9)
        ];
      } else {
        updatedStats.failureCount++;
        updatedStats.recentFailures = [
          stats.timestamp,
          ...updatedStats.recentFailures.slice(0, 9)
        ];
      }
      
      updatedStats.lastUsed = stats.timestamp;
      
      // Recalculate actual success rate
      const newSuccessRate = updatedStats.totalUses > 0 
        ? updatedStats.successCount / updatedStats.totalUses 
        : 0;

      // Update performance metrics
      const updatedMetrics = { ...solution.performanceMetrics };
      updatedMetrics.averageExecutionTime = (
        (updatedMetrics.averageExecutionTime * (updatedStats.totalUses - 1)) + stats.executionTime
      ) / updatedStats.totalUses;

      if (stats.memoryUsage) {
        updatedMetrics.memoryUsage = updatedMetrics.memoryUsage 
          ? (updatedMetrics.memoryUsage + stats.memoryUsage) / 2
          : stats.memoryUsage;
      }

      await this.run(`
        UPDATE solutions SET 
          actual_success_rate = ?,
          usage_statistics = ?,
          performance_metrics = ?,
          updated_at = strftime('%s', 'now')
        WHERE id = ?
      `, [
        newSuccessRate,
        JSON.stringify(updatedStats),
        JSON.stringify(updatedMetrics),
        stats.solutionId
      ]);

      // Check if solution should be deprecated due to poor performance
      await this.checkAutoDeprecation(stats.solutionId, newSuccessRate, updatedStats);
    }
  }

  /**
   * Get solution by ID
   */
  async getSolutionById(solutionId: string): Promise<StoredSolution | null> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.query('SELECT * FROM solutions WHERE id = ?', [solutionId]);
    return rows.length > 0 ? this.mapRowToSolution(rows[0]) : null;
  }

  /**
   * Deprecate a solution
   */
  async deprecateSolution(solutionId: string, reason: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const solution = await this.getSolutionById(solutionId);
    if (!solution) {
      throw new Error(`Solution ${solutionId} not found`);
    }

    const updatedMetadata = {
      ...solution.metadata,
      deprecated: true,
      deprecatedReason: reason,
      deprecatedAt: new Date()
    };

    await this.run(`
      UPDATE solutions SET 
        metadata = ?,
        updated_at = strftime('%s', 'now')
      WHERE id = ?
    `, [JSON.stringify(updatedMetadata), solutionId]);
  }

  /**
   * Export solutions for backup or sharing
   */
  async exportSolutions(options: { includeDeprecated?: boolean; format?: 'json' | 'sql' } = {}): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const solutions = await this.searchSolutions({
      includeDeprecated: options.includeDeprecated || false,
      sortBy: 'lastUsed',
      sortOrder: 'desc'
    });

    const exportData = {
      version: this.currentVersion,
      timestamp: new Date().toISOString(),
      totalSolutions: solutions.length,
      solutions,
      metadata: await this.getCurrentVersionInfo()
    };

    if (options.format === 'sql') {
      // Generate SQL INSERT statements
      let sql = '-- AI Solution Library Export\n';
      sql += `-- Generated: ${exportData.timestamp}\n`;
      sql += `-- Total Solutions: ${exportData.totalSolutions}\n\n`;
      
      for (const solution of solutions) {
        sql += this.generateInsertStatement(solution) + '\n';
      }
      
      return sql;
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import solutions from backup or external source
   */
  async importSolutions(data: string, options: { overwrite?: boolean; validate?: boolean } = {}): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    if (!this.db) throw new Error('Database not initialized');

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    try {
      const importData = JSON.parse(data);
      
      if (!importData.solutions || !Array.isArray(importData.solutions)) {
        throw new Error('Invalid import format: missing solutions array');
      }

      for (const solutionData of importData.solutions) {
        try {
          if (options.validate && !this.validateSolutionData(solutionData)) {
            errors.push(`Invalid solution data: ${solutionData.id || 'unknown'}`);
            continue;
          }

          const existing = await this.getSolutionById(solutionData.id);
          if (existing && !options.overwrite) {
            skipped++;
            continue;
          }

          await this.storeSolution(solutionData);
          imported++;
        } catch (error) {
          errors.push(`Failed to import solution ${solutionData.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { imported, skipped, errors };
  }

  /**
   * Create database backup
   */
  async createBackup(): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `solution-library-backup-${timestamp}.db`);
    
    // Create backup directory if it doesn't exist
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    
    // Copy database file
    await fs.copyFile(this.dbPath, backupPath);
    
    // Create metadata file
    const metadataPath = backupPath + '.metadata.json';
    const backupInfo: DatabaseBackup = {
      version: this.currentVersion,
      timestamp: new Date(),
      totalSolutions: await this.getTotalSolutionCount(),
      metadata: await this.getCurrentVersionInfo()
    };
    
    await fs.writeFile(metadataPath, JSON.stringify(backupInfo, null, 2));
    
    // Clean up old backups (keep last 10)
    await this.cleanupOldBackups();
    
    return backupPath;
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    totalSolutions: number;
    activeSolutions: number;
    deprecatedSolutions: number;
    averageSuccessRate: number;
    topStrategies: Array<{ strategy: string; count: number; avgSuccessRate: number }>;
    recentActivity: { period: string; uses: number; successes: number }[];
    performanceMetrics: {
      averageExecutionTime: number;
      fastestSolution: string;
      slowestSolution: string;
    };
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const stats = await this.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN json_extract(metadata, '$.deprecated') IS NOT 1 THEN 1 END) as active,
        COUNT(CASE WHEN json_extract(metadata, '$.deprecated') = 1 THEN 1 END) as deprecated,
        AVG(actual_success_rate) as avg_success_rate
      FROM solutions
    `);

    const topStrategies = await this.query(`
      SELECT 
        strategy,
        COUNT(*) as count,
        AVG(actual_success_rate) as avg_success_rate
      FROM solutions 
      WHERE json_extract(metadata, '$.deprecated') IS NOT 1
      GROUP BY strategy 
      ORDER BY count DESC, avg_success_rate DESC 
      LIMIT 10
    `);

    const recentActivity = await this.query(`
      SELECT 
        date(timestamp, 'unixepoch') as period,
        COUNT(*) as uses,
        SUM(success) as successes
      FROM solution_usage 
      WHERE timestamp > strftime('%s', 'now', '-30 days')
      GROUP BY date(timestamp, 'unixepoch')
      ORDER BY period DESC
      LIMIT 30
    `);

    const performanceData = await this.query(`
      SELECT 
        AVG(json_extract(performance_metrics, '$.averageExecutionTime')) as avg_execution_time,
        (SELECT id FROM solutions ORDER BY json_extract(performance_metrics, '$.averageExecutionTime') ASC LIMIT 1) as fastest,
        (SELECT id FROM solutions ORDER BY json_extract(performance_metrics, '$.averageExecutionTime') DESC LIMIT 1) as slowest
      FROM solutions
      WHERE json_extract(metadata, '$.deprecated') IS NOT 1
    `);

    return {
      totalSolutions: stats[0].total,
      activeSolutions: stats[0].active,
      deprecatedSolutions: stats[0].deprecated,
      averageSuccessRate: stats[0].avg_success_rate || 0,
      topStrategies,
      recentActivity,
      performanceMetrics: {
        averageExecutionTime: performanceData[0].avg_execution_time || 0,
        fastestSolution: performanceData[0].fastest || '',
        slowestSolution: performanceData[0].slowest || ''
      }
    };
  }

  // Private helper methods

  private async updateFTSIndex(solution: StoredSolution): Promise<void> {
    await this.run(`
      INSERT OR REPLACE INTO solutions_fts (
        rowid, error_pattern, solution_code, explanation, strategy, tags, categories
      ) VALUES (
        (SELECT rowid FROM solutions WHERE id = ?),
        ?, ?, ?, ?, ?, ?
      )
    `, [
      solution.id,
      solution.errorPattern,
      solution.solutionCode,
      solution.explanation,
      solution.strategy,
      solution.tags.join(' '),
      solution.categories.join(' ')
    ]);
  }

  private mapRowToSolution(row: any): StoredSolution {
    return {
      id: row.id,
      errorPattern: row.error_pattern,
      errorSignature: row.error_signature,
      solutionCode: row.solution_code,
      explanation: row.explanation,
      confidence: row.confidence,
      estimatedSuccessRate: row.estimated_success_rate,
      actualSuccessRate: row.actual_success_rate,
      riskLevel: row.risk_level,
      strategy: row.strategy,
      tags: JSON.parse(row.tags || '[]'),
      categories: JSON.parse(row.categories || '[]'),
      versionCompatibility: JSON.parse(row.version_compatibility || '{}'),
      performanceMetrics: JSON.parse(row.performance_metrics || '{}'),
      usageStatistics: this.parseUsageStatistics(row.usage_statistics),
      metadata: this.parseMetadata(row.metadata)
    };
  }

  private parseUsageStatistics(json: string): StoredSolution['usageStatistics'] {
    const parsed = JSON.parse(json || '{}');
    return {
      totalUses: parsed.totalUses || 0,
      successCount: parsed.successCount || 0,
      failureCount: parsed.failureCount || 0,
      lastUsed: parsed.lastUsed ? new Date(parsed.lastUsed) : new Date(),
      firstUsed: parsed.firstUsed ? new Date(parsed.firstUsed) : new Date(),
      recentFailures: (parsed.recentFailures || []).map((d: string) => new Date(d)),
      recentSuccesses: (parsed.recentSuccesses || []).map((d: string) => new Date(d))
    };
  }

  private parseMetadata(json: string): StoredSolution['metadata'] {
    const parsed = JSON.parse(json || '{}');
    return {
      model: parsed.model || 'unknown',
      createdBy: parsed.createdBy || 'system',
      createdAt: parsed.createdAt ? new Date(parsed.createdAt) : new Date(),
      updatedAt: parsed.updatedAt ? new Date(parsed.updatedAt) : new Date(),
      source: parsed.source || 'claude',
      reasoning: parsed.reasoning || '',
      requiredPermissions: parsed.requiredPermissions || [],
      sideEffects: parsed.sideEffects || [],
      warnings: parsed.warnings || [],
      deprecated: parsed.deprecated || false,
      deprecatedReason: parsed.deprecatedReason,
      deprecatedAt: parsed.deprecatedAt ? new Date(parsed.deprecatedAt) : undefined
    };
  }

  private generateErrorSignature(errorPattern: string): string {
    // Create a consistent hash for similar error patterns
    const normalized = errorPattern
      .toLowerCase()
      .replace(/\d+/g, 'N') // Replace numbers with N
      .replace(/['"`]/g, '') // Remove quotes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  private extractErrorKeywords(errorPattern: string): string {
    // Extract meaningful keywords from error patterns
    return errorPattern
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !['error', 'failed', 'unable'].includes(word.toLowerCase()))
      .slice(0, 3)
      .join(' ');
  }

  private async checkAutoDeprecation(solutionId: string, successRate: number, stats: StoredSolution['usageStatistics']): Promise<void> {
    // Auto-deprecate if success rate is very low after sufficient attempts
    const minAttempts = 10;
    const failureThreshold = 0.2; // 20% success rate or lower
    
    if (stats.totalUses >= minAttempts && successRate <= failureThreshold) {
      await this.deprecateSolution(solutionId, 
        `Auto-deprecated due to low success rate: ${Math.round(successRate * 100)}% over ${stats.totalUses} attempts`
      );
    }
  }

  private validateSolutionData(data: any): boolean {
    const required = ['id', 'errorPattern', 'solutionCode', 'strategy'];
    return required.every(field => field in data && data[field]);
  }

  private generateInsertStatement(solution: StoredSolution): string {
    return `INSERT OR REPLACE INTO solutions (id, error_pattern, error_signature, solution_code, explanation, confidence, estimated_success_rate, actual_success_rate, risk_level, strategy, tags, categories, version_compatibility, performance_metrics, usage_statistics, metadata) VALUES (${[
      `'${solution.id}'`,
      `'${solution.errorPattern.replace(/'/g, "''")}'`,
      `'${solution.errorSignature}'`,
      `'${solution.solutionCode.replace(/'/g, "''")}'`,
      `'${solution.explanation.replace(/'/g, "''")}'`,
      solution.confidence,
      solution.estimatedSuccessRate,
      solution.actualSuccessRate,
      `'${solution.riskLevel}'`,
      `'${solution.strategy}'`,
      `'${JSON.stringify(solution.tags).replace(/'/g, "''")}'`,
      `'${JSON.stringify(solution.categories).replace(/'/g, "''")}'`,
      `'${JSON.stringify(solution.versionCompatibility).replace(/'/g, "''")}'`,
      `'${JSON.stringify(solution.performanceMetrics).replace(/'/g, "''")}'`,
      `'${JSON.stringify(solution.usageStatistics).replace(/'/g, "''")}'`,
      `'${JSON.stringify(solution.metadata).replace(/'/g, "''")}'`
    ].join(', ')});`;
  }

  private async getCurrentVersionInfo(): Promise<{ electron?: string; playwright?: string; node?: string; platform: string }> {
    return {
      electron: process.versions.electron,
      playwright: require('playwright/package.json').version,
      node: process.versions.node,
      platform: process.platform
    };
  }

  private async getTotalSolutionCount(): Promise<number> {
    const result = await this.query('SELECT COUNT(*) as count FROM solutions');
    return result[0].count;
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(f => f.endsWith('.db') && f.includes('backup'))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          time: fs.stat(path.join(this.backupDir, f)).then(stats => stats.mtime)
        }));

      if (backupFiles.length > 10) {
        const sortedFiles = await Promise.all(
          backupFiles.map(async f => ({ ...f, time: await f.time }))
        );
        sortedFiles.sort((a, b) => b.time.getTime() - a.time.getTime());
        
        // Delete oldest backups beyond the limit
        for (let i = 10; i < sortedFiles.length; i++) {
          await fs.unlink(sortedFiles[i].path);
          // Also delete metadata file if exists
          const metadataPath = sortedFiles[i].path + '.metadata.json';
          try {
            await fs.unlink(metadataPath);
          } catch (error) {
            // Metadata file doesn't exist, ignore
          }
        }
      }
    } catch (error) {
      console.warn('Failed to clean up old backups:', error);
    }
  }

  private setupPeriodicCleanup(): void {
    // Clean up old usage records (older than 90 days)
    setInterval(async () => {
      try {
        await this.run(`
          DELETE FROM solution_usage 
          WHERE timestamp < strftime('%s', 'now', '-90 days')
        `);
      } catch (error) {
        console.warn('Failed to clean up old usage records:', error);
      }
    }, 24 * 60 * 60 * 1000); // Run daily
  }

  private compareVersions(version1: string, version2: string): number {
    const parts1 = version1.split('.').map(Number);
    const parts2 = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    
    return 0;
  }

  // Database operation helpers
  private async run(sql: string, params: any[] = []): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async query(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Close database connection and cleanup
   */
  async close(): Promise<void> {
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        this.db!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.db = null;
      this.isInitialized = false;
    }
  }
}

export default SolutionDatabase;