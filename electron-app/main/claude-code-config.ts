/**
 * Claude Code Integration Configuration
 * 
 * Centralized configuration management for Claude Code CLI integration
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { ClaudeCodeConfig } from './claude-code-integration';
import { EnhancedRecoveryOptions } from './enhanced-error-recovery';

export interface SystemConfig {
  // Claude Code Integration
  claudeCode: ClaudeCodeConfig;
  
  // Enhanced Recovery Options
  enhancedRecovery: EnhancedRecoveryOptions;
  
  // System-wide options
  system: {
    environment: 'development' | 'production' | 'test';
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    enableMetrics: boolean;
    metricsPort?: number;
    configVersion: string;
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: SystemConfig | null = null;
  private configPath: string;
  private watchers: Array<(config: SystemConfig) => void> = [];

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'claude-code-config.json');
  }

  public static getInstance(configPath?: string): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(configPath);
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration from file or create default
   */
  public async loadConfig(): Promise<SystemConfig> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configData);
      
      // Validate and merge with defaults
      this.config = this.validateAndMergeConfig(parsedConfig);
      
      console.log(`Configuration loaded from: ${this.configPath}`);
      return this.config;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        console.log('Configuration file not found, creating default configuration');
        this.config = this.getDefaultConfig();
        await this.saveConfig();
        return this.config;
      } else {
        console.error('Error loading configuration:', error);
        console.log('Using default configuration');
        this.config = this.getDefaultConfig();
        return this.config;
      }
    }
  }

  /**
   * Save current configuration to file
   */
  public async saveConfig(): Promise<void> {
    if (!this.config) {
      throw new Error('No configuration to save');
    }

    try {
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      const configJson = JSON.stringify(this.config, null, 2);
      await fs.writeFile(this.configPath, configJson, 'utf-8');
      
      console.log(`Configuration saved to: ${this.configPath}`);
    } catch (error) {
      console.error('Error saving configuration:', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): SystemConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * Update configuration
   */
  public async updateConfig(updates: Partial<SystemConfig>): Promise<SystemConfig> {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }

    // Deep merge updates
    this.config = this.deepMerge(this.config, updates);
    
    // Save to file
    await this.saveConfig();
    
    // Notify watchers
    this.notifyWatchers();
    
    return this.config;
  }

  /**
   * Watch for configuration changes
   */
  public onConfigChange(callback: (config: SystemConfig) => void): () => void {
    this.watchers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.watchers.indexOf(callback);
      if (index > -1) {
        this.watchers.splice(index, 1);
      }
    };
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): SystemConfig {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const logsDir = path.join(process.cwd(), 'logs');

    return {
      claudeCode: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        rateLimitRequestsPerMinute: isDevelopment ? 60 : 30,
        timeoutMs: 120000,
        maxRetries: 3,
        complexityThreshold: 7,
        failureCountThreshold: 2,
        confidenceThreshold: 0.7,
        enableCaching: true,
        cacheMaxSize: 1000,
        cacheExpirationHours: 24,
        enableSandboxing: !isDevelopment, // Disable in development for easier debugging
        sandboxTimeoutMs: 30000,
        allowedOperations: [
          // Playwright actions
          'click', 'type', 'fill', 'select', 'check', 'uncheck',
          'waitFor', 'waitForSelector', 'waitForTimeout', 'waitForLoadState',
          'goto', 'reload', 'goBack', 'goForward',
          'screenshot', 'locator', 'getByRole', 'getByLabel', 'getByText',
          'scrollIntoViewIfNeeded', 'hover', 'focus', 'blur',
          'getAttribute', 'textContent', 'innerHTML', 'evaluate',
          
          // Additional safe operations
          'clear', 'dblclick', 'selectOption', 'setInputFiles',
          'waitForFunction', 'waitForResponse', 'waitForEvent',
          'press', 'keyboard', 'mouse', 'dragAndDrop'
        ],
        auditLogPath: path.join(logsDir, 'claude-code-audit.log'),
        enableDetailedLogging: isDevelopment,
        logRetentionDays: 30
      },
      
      enhancedRecovery: {
        enableAIRecovery: true,
        maxBuiltInAttempts: 3,
        aiConfidenceThreshold: 0.7,
        fallbackToBuiltIn: true,
        enableDetailedLogging: isDevelopment,
        logSuccessfulStrategies: true,
        trackPerformanceMetrics: true,
        aiRecoveryConfig: {
          // Override Claude Code config for recovery context
          complexityThreshold: 6, // Lower threshold for recovery scenarios
          confidenceThreshold: 0.6, // Slightly lower for recovery attempts
          enableSandboxing: true, // Always enable for recovery
          rateLimitRequestsPerMinute: isDevelopment ? 40 : 20
        }
      },
      
      system: {
        environment: (process.env.NODE_ENV as any) || 'development',
        logLevel: isDevelopment ? 'debug' : 'info',
        enableMetrics: true,
        metricsPort: process.env.METRICS_PORT ? parseInt(process.env.METRICS_PORT) : 3001,
        configVersion: '1.0.0'
      }
    };
  }

  /**
   * Validate and merge configuration with defaults
   */
  private validateAndMergeConfig(userConfig: any): SystemConfig {
    const defaultConfig = this.getDefaultConfig();
    
    // Basic validation
    if (!userConfig || typeof userConfig !== 'object') {
      console.warn('Invalid configuration format, using defaults');
      return defaultConfig;
    }

    // Deep merge with defaults
    const mergedConfig = this.deepMerge(defaultConfig, userConfig);
    
    // Specific validations
    this.validateClaudeCodeConfig(mergedConfig.claudeCode);
    this.validateSystemConfig(mergedConfig.system);
    
    return mergedConfig;
  }

  private validateClaudeCodeConfig(config: ClaudeCodeConfig): void {
    // Validate API key
    if (!config.apiKey && !process.env.ANTHROPIC_API_KEY) {
      console.warn('No Anthropic API key configured. AI recovery will be disabled.');
    }

    // Validate numeric values
    if (config.rateLimitRequestsPerMinute <= 0) {
      console.warn('Invalid rate limit, using default: 30');
      config.rateLimitRequestsPerMinute = 30;
    }

    if (config.timeoutMs <= 0) {
      console.warn('Invalid timeout, using default: 120000ms');
      config.timeoutMs = 120000;
    }

    if (config.confidenceThreshold < 0 || config.confidenceThreshold > 1) {
      console.warn('Invalid confidence threshold, using default: 0.7');
      config.confidenceThreshold = 0.7;
    }

    // Validate cache settings
    if (config.cacheMaxSize <= 0) {
      console.warn('Invalid cache size, using default: 1000');
      config.cacheMaxSize = 1000;
    }

    // Validate allowed operations
    if (!Array.isArray(config.allowedOperations) || config.allowedOperations.length === 0) {
      console.warn('Invalid allowed operations, using defaults');
      config.allowedOperations = this.getDefaultConfig().claudeCode.allowedOperations;
    }
  }

  private validateSystemConfig(config: SystemConfig['system']): void {
    // Validate environment
    if (!['development', 'production', 'test'].includes(config.environment)) {
      console.warn('Invalid environment, using development');
      config.environment = 'development';
    }

    // Validate log level
    if (!['debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
      console.warn('Invalid log level, using info');
      config.logLevel = 'info';
    }

    // Validate metrics port
    if (config.metricsPort && (config.metricsPort < 1 || config.metricsPort > 65535)) {
      console.warn('Invalid metrics port, using default: 3001');
      config.metricsPort = 3001;
    }
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  private notifyWatchers(): void {
    if (!this.config) return;
    
    for (const callback of this.watchers) {
      try {
        callback(this.config);
      } catch (error) {
        console.error('Error in config change callback:', error);
      }
    }
  }

  /**
   * Create configuration profiles for different environments
   */
  public static createProfileConfig(profile: 'development' | 'production' | 'test'): Partial<SystemConfig> {
    const baseConfig: Partial<SystemConfig> = {
      system: {
        environment: profile,
        logLevel: 'info',
        enableMetrics: true,
        configVersion: '1.0.0'
      }
    };

    switch (profile) {
      case 'development':
        return {
          ...baseConfig,
          claudeCode: {
            rateLimitRequestsPerMinute: 60,
            timeoutMs: 120000,
            maxRetries: 3,
            complexityThreshold: 6,
            failureCountThreshold: 2,
            confidenceThreshold: 0.6,
            enableCaching: true,
            cacheMaxSize: 1000,
            cacheExpirationHours: 24,
            enableSandboxing: false,
            sandboxTimeoutMs: 30000,
            allowedOperations: [],
            auditLogPath: '',
            enableDetailedLogging: true,
            logRetentionDays: 30
          },
          enhancedRecovery: {
            enableAIRecovery: true,
            maxBuiltInAttempts: 3,
            aiConfidenceThreshold: 0.6,
            fallbackToBuiltIn: true,
            enableDetailedLogging: true,
            logSuccessfulStrategies: true,
            trackPerformanceMetrics: true
          },
          system: {
            ...baseConfig.system,
            logLevel: 'debug'
          }
        };

      case 'production':
        return {
          ...baseConfig,
          claudeCode: {
            rateLimitRequestsPerMinute: 30,
            timeoutMs: 120000,
            maxRetries: 3,
            complexityThreshold: 7,
            failureCountThreshold: 2,
            confidenceThreshold: 0.8,
            enableCaching: true,
            cacheMaxSize: 1000,
            cacheExpirationHours: 24,
            enableSandboxing: true,
            sandboxTimeoutMs: 30000,
            allowedOperations: [],
            auditLogPath: '',
            enableDetailedLogging: false,
            logRetentionDays: 30
          },
          enhancedRecovery: {
            enableAIRecovery: true,
            maxBuiltInAttempts: 3,
            aiConfidenceThreshold: 0.8,
            fallbackToBuiltIn: true,
            enableDetailedLogging: false,
            logSuccessfulStrategies: true,
            trackPerformanceMetrics: true
          },
          system: {
            ...baseConfig.system,
            logLevel: 'warn'
          }
        };

      case 'test':
        return {
          ...baseConfig,
          claudeCode: {
            rateLimitRequestsPerMinute: 120,
            timeoutMs: 120000,
            maxRetries: 3,
            complexityThreshold: 5,
            failureCountThreshold: 2,
            confidenceThreshold: 0.5,
            enableCaching: false,
            cacheMaxSize: 1000,
            cacheExpirationHours: 24,
            enableSandboxing: false,
            sandboxTimeoutMs: 30000,
            allowedOperations: [],
            auditLogPath: '',
            enableDetailedLogging: true,
            logRetentionDays: 30
          },
          enhancedRecovery: {
            enableAIRecovery: false,
            maxBuiltInAttempts: 3,
            aiConfidenceThreshold: 0.7,
            fallbackToBuiltIn: true,
            enableDetailedLogging: true,
            logSuccessfulStrategies: false,
            trackPerformanceMetrics: false
          },
          system: {
            ...baseConfig.system,
            logLevel: 'debug',
            enableMetrics: false
          }
        };

      default:
        return baseConfig;
    }
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();

// Export utility functions
export async function initializeConfig(configPath?: string): Promise<SystemConfig> {
  const manager = ConfigManager.getInstance(configPath);
  return await manager.loadConfig();
}

export function getConfig(): SystemConfig {
  return configManager.getConfig();
}

export async function updateConfig(updates: Partial<SystemConfig>): Promise<SystemConfig> {
  return await configManager.updateConfig(updates);
}

export function watchConfig(callback: (config: SystemConfig) => void): () => void {
  return configManager.onConfigChange(callback);
}

export default ConfigManager;