import { ipcMain, dialog, app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';

// Type definitions
interface ErrorRecoverySettings {
  enabled: boolean;
  complexityThreshold: number;
  retryLimit: number;
  timeout: number;
  enableAuditLog: boolean;
  autoExportSettings: boolean;
}

interface RecoveryStatistics {
  totalAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  averageResponseTime: number;
  lastRecoveryTime?: string;
}

interface AuditLogEntry {
  timestamp: string;
  action: string;
  details: string;
  success: boolean;
}

interface CachedSolution {
  errorHash: string;
  solution: string;
  timestamp: string;
  useCount: number;
  successRate: number;
}

// Validation schemas
const SettingsSchema = z.object({
  enabled: z.boolean(),
  complexityThreshold: z.number().min(1).max(10),
  retryLimit: z.number().min(1).max(10),
  timeout: z.number().min(5000).max(300000),
  enableAuditLog: z.boolean(),
  autoExportSettings: z.boolean()
});

const StatisticsSchema = z.object({
  totalAttempts: z.number().min(0),
  successfulRecoveries: z.number().min(0),
  failedRecoveries: z.number().min(0),
  averageResponseTime: z.number().min(0),
  lastRecoveryTime: z.string().optional()
});

const AuditLogEntrySchema = z.object({
  timestamp: z.string(),
  action: z.string(),
  details: z.string(),
  success: z.boolean()
});

export class SettingsManager {
  private readonly configPath: string;
  private readonly statisticsPath: string;
  private readonly auditLogPath: string;
  private readonly cachePath: string;
  private readonly backupPath: string;
  
  private settings: ErrorRecoverySettings;
  private statistics: RecoveryStatistics;
  private auditLogs: AuditLogEntry[] = [];
  private solutionCache: Map<string, CachedSolution> = new Map();
  
  private readonly defaultSettings: ErrorRecoverySettings = {
    enabled: true,
    complexityThreshold: 5,
    retryLimit: 3,
    timeout: 30000,
    enableAuditLog: true,
    autoExportSettings: false
  };
  
  private readonly defaultStatistics: RecoveryStatistics = {
    totalAttempts: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    averageResponseTime: 0
  };

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'error-recovery-settings.json');
    this.statisticsPath = path.join(userDataPath, 'recovery-statistics.json');
    this.auditLogPath = path.join(userDataPath, 'audit-logs.json');
    this.cachePath = path.join(userDataPath, 'solution-cache.json');
    this.backupPath = path.join(userDataPath, 'backups');
    
    this.settings = { ...this.defaultSettings };
    this.statistics = { ...this.defaultStatistics };
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupPath, { recursive: true });
      
      // Load existing data
      await this.loadSettings();
      await this.loadStatistics();
      await this.loadAuditLogs();
      await this.loadSolutionCache();
      
      // Setup auto-export if enabled
      this.setupAutoExport();
      
      console.log('SettingsManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SettingsManager:', error);
    }
  }

  // Settings management
  private async loadSettings(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(data);
      const validated = SettingsSchema.parse(parsed);
      this.settings = {
        enabled: validated.enabled,
        complexityThreshold: validated.complexityThreshold,
        retryLimit: validated.retryLimit,
        timeout: validated.timeout,
        enableAuditLog: validated.enableAuditLog,
        autoExportSettings: validated.autoExportSettings
      };
      
      await this.addAuditLog('settings_loaded', 'Settings loaded from disk', true);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Failed to load settings, using defaults:', error);
        await this.addAuditLog('settings_load_failed', `Failed to load settings: ${error}`, false);
      }
      // Use default settings
      this.settings = { ...this.defaultSettings };
      await this.saveSettings();
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      // Validate settings before saving
      const validated = SettingsSchema.parse(this.settings);
      await fs.writeFile(this.configPath, JSON.stringify(validated, null, 2), 'utf-8');
      
      await this.addAuditLog('settings_saved', 'Settings saved to disk', true);
      
      // Update auto-export setup
      this.setupAutoExport();
      
      // Broadcast settings change to all components
      this.broadcastSettingsChange();
    } catch (error) {
      console.error('Failed to save settings:', error);
      await this.addAuditLog('settings_save_failed', `Failed to save settings: ${error}`, false);
      throw error;
    }
  }

  // Statistics management
  private async loadStatistics(): Promise<void> {
    try {
      const data = await fs.readFile(this.statisticsPath, 'utf-8');
      const parsed = JSON.parse(data);
      const validated = StatisticsSchema.parse(parsed);
      this.statistics = {
        totalAttempts: validated.totalAttempts,
        successfulRecoveries: validated.successfulRecoveries,
        failedRecoveries: validated.failedRecoveries,
        averageResponseTime: validated.averageResponseTime,
        lastRecoveryTime: validated.lastRecoveryTime
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Failed to load statistics, using defaults:', error);
      }
      this.statistics = { ...this.defaultStatistics };
      await this.saveStatistics();
    }
  }

  private async saveStatistics(): Promise<void> {
    try {
      const validated = StatisticsSchema.parse(this.statistics);
      await fs.writeFile(this.statisticsPath, JSON.stringify(validated, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save statistics:', error);
      throw error;
    }
  }

  // Audit log management
  private async loadAuditLogs(): Promise<void> {
    try {
      const data = await fs.readFile(this.auditLogPath, 'utf-8');
      const parsed = JSON.parse(data);
      const validatedLogs = z.array(AuditLogEntrySchema).parse(parsed);
      this.auditLogs = validatedLogs.map(log => ({
        timestamp: log.timestamp,
        action: log.action,
        details: log.details,
        success: log.success
      }));
      
      // Keep only the last 1000 entries
      if (this.auditLogs.length > 1000) {
        this.auditLogs = this.auditLogs.slice(-1000);
        await this.saveAuditLogs();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Failed to load audit logs:', error);
      }
      this.auditLogs = [];
    }
  }

  private async saveAuditLogs(): Promise<void> {
    try {
      if (!this.settings.enableAuditLog) return;
      
      await fs.writeFile(this.auditLogPath, JSON.stringify(this.auditLogs, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save audit logs:', error);
    }
  }

  private async addAuditLog(action: string, details: string, success: boolean): Promise<void> {
    if (!this.settings.enableAuditLog) return;
    
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      action,
      details,
      success
    };
    
    this.auditLogs.push(entry);
    
    // Keep only the last 1000 entries
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(-1000);
    }
    
    await this.saveAuditLogs();
  }

  // Solution cache management
  private async loadSolutionCache(): Promise<void> {
    try {
      const data = await fs.readFile(this.cachePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      this.solutionCache = new Map();
      for (const [key, value] of Object.entries(parsed)) {
        this.solutionCache.set(key, value as CachedSolution);
      }
      
      await this.addAuditLog('cache_loaded', `Loaded ${this.solutionCache.size} cached solutions`, true);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Failed to load solution cache:', error);
      }
      this.solutionCache = new Map();
    }
  }

  private async saveSolutionCache(): Promise<void> {
    try {
      const cacheObject = Object.fromEntries(this.solutionCache);
      await fs.writeFile(this.cachePath, JSON.stringify(cacheObject, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save solution cache:', error);
    }
  }

  // Auto-export functionality
  private autoExportTimer?: NodeJS.Timeout;

  private setupAutoExport(): void {
    if (this.autoExportTimer) {
      clearInterval(this.autoExportTimer);
    }
    
    if (this.settings.autoExportSettings) {
      // Export settings daily
      this.autoExportTimer = setInterval(async () => {
        try {
          await this.exportSettingsToFile();
          await this.addAuditLog('auto_export', 'Settings auto-exported', true);
        } catch (error) {
          await this.addAuditLog('auto_export_failed', `Auto-export failed: ${error}`, false);
        }
      }, 24 * 60 * 60 * 1000); // 24 hours
    }
  }

  // Export/Import functionality
  private async exportSettingsToFile(filePath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = filePath || path.join(this.backupPath, `settings-backup-${timestamp}.json`);
    
    const exportData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      settings: this.settings,
      statistics: this.statistics,
      auditLogs: this.auditLogs.slice(-100), // Include last 100 audit logs
      solutionCache: Object.fromEntries(this.solutionCache)
    };
    
    await fs.writeFile(defaultPath, JSON.stringify(exportData, null, 2), 'utf-8');
    return defaultPath;
  }

  private async importSettingsFromFile(filePath: string): Promise<ErrorRecoverySettings> {
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Validate the import data
    if (!parsed.settings) {
      throw new Error('Invalid settings file: missing settings data');
    }
    
    const validated = SettingsSchema.parse(parsed.settings);
    this.settings = {
      enabled: validated.enabled,
      complexityThreshold: validated.complexityThreshold,
      retryLimit: validated.retryLimit,
      timeout: validated.timeout,
      enableAuditLog: validated.enableAuditLog,
      autoExportSettings: validated.autoExportSettings
    };
    await this.saveSettings();
    
    // Optionally import statistics and cache
    if (parsed.statistics) {
      try {
        const validatedStats = StatisticsSchema.parse(parsed.statistics);
        this.statistics = {
          totalAttempts: validatedStats.totalAttempts,
          successfulRecoveries: validatedStats.successfulRecoveries,
          failedRecoveries: validatedStats.failedRecoveries,
          averageResponseTime: validatedStats.averageResponseTime,
          lastRecoveryTime: validatedStats.lastRecoveryTime
        };
        await this.saveStatistics();
      } catch (error) {
        console.warn('Failed to import statistics:', error);
      }
    }
    
    if (parsed.solutionCache) {
      try {
        this.solutionCache = new Map(Object.entries(parsed.solutionCache));
        await this.saveSolutionCache();
      } catch (error) {
        console.warn('Failed to import solution cache:', error);
      }
    }
    
    await this.addAuditLog('settings_imported', `Settings imported from ${filePath}`, true);
    return this.settings;
  }

  // Public API methods
  public async getSettings(): Promise<ErrorRecoverySettings> {
    return { ...this.settings };
  }

  public async updateSettings(newSettings: Partial<ErrorRecoverySettings>): Promise<void> {
    const merged = { ...this.settings, ...newSettings };
    const validated = SettingsSchema.parse(merged);
    
    this.settings = {
      enabled: validated.enabled,
      complexityThreshold: validated.complexityThreshold,
      retryLimit: validated.retryLimit,
      timeout: validated.timeout,
      enableAuditLog: validated.enableAuditLog,
      autoExportSettings: validated.autoExportSettings
    };
    await this.saveSettings();
    
    await this.addAuditLog('settings_updated', 'Settings updated via API', true);
  }

  public async getStatistics(): Promise<RecoveryStatistics> {
    return { ...this.statistics };
  }

  public async updateStatistics(stats: Partial<RecoveryStatistics>): Promise<void> {
    this.statistics = { ...this.statistics, ...stats };
    await this.saveStatistics();
  }

  public async recordRecoveryAttempt(success: boolean, responseTime: number): Promise<void> {
    this.statistics.totalAttempts++;
    
    if (success) {
      this.statistics.successfulRecoveries++;
    } else {
      this.statistics.failedRecoveries++;
    }
    
    // Update average response time
    const totalTime = this.statistics.averageResponseTime * (this.statistics.totalAttempts - 1) + responseTime;
    this.statistics.averageResponseTime = Math.round(totalTime / this.statistics.totalAttempts);
    
    this.statistics.lastRecoveryTime = new Date().toISOString();
    
    await this.saveStatistics();
    await this.addAuditLog('recovery_attempt', `Recovery ${success ? 'succeeded' : 'failed'} in ${responseTime}ms`, success);
  }

  public async getAuditLogs(): Promise<AuditLogEntry[]> {
    return [...this.auditLogs];
  }

  public async clearAuditLogs(): Promise<void> {
    this.auditLogs = [];
    await this.saveAuditLogs();
    await this.addAuditLog('audit_logs_cleared', 'Audit logs cleared by user', true);
  }

  public async clearSolutionCache(): Promise<void> {
    const cacheSize = this.solutionCache.size;
    this.solutionCache.clear();
    await this.saveSolutionCache();
    await this.addAuditLog('cache_cleared', `Cleared ${cacheSize} cached solutions`, true);
  }

  public async getCachedSolution(errorHash: string): Promise<CachedSolution | null> {
    return this.solutionCache.get(errorHash) || null;
  }

  public async cacheSolution(errorHash: string, solution: string, success: boolean): Promise<void> {
    const existing = this.solutionCache.get(errorHash);
    
    if (existing) {
      existing.useCount++;
      existing.successRate = (existing.successRate + (success ? 1 : 0)) / 2;
      existing.timestamp = new Date().toISOString();
    } else {
      this.solutionCache.set(errorHash, {
        errorHash,
        solution,
        timestamp: new Date().toISOString(),
        useCount: 1,
        successRate: success ? 1 : 0
      });
    }
    
    await this.saveSolutionCache();
  }

  // Settings validation and migration
  public validateSettings(settings: any): boolean {
    try {
      SettingsSchema.parse(settings);
      return true;
    } catch (error) {
      console.error('Settings validation failed:', error);
      return false;
    }
  }

  public sanitizeSettings(settings: any): ErrorRecoverySettings {
    try {
      const validated = SettingsSchema.parse(settings);
      return {
        enabled: validated.enabled,
        complexityThreshold: validated.complexityThreshold,
        retryLimit: validated.retryLimit,
        timeout: validated.timeout,
        enableAuditLog: validated.enableAuditLog,
        autoExportSettings: validated.autoExportSettings
      };
    } catch (error) {
      console.warn('Settings sanitization failed, using defaults:', error);
      return { ...this.defaultSettings };
    }
  }

  // Migration support for future versions
  private async migrateSettings(version: string): Promise<void> {
    // Placeholder for future migrations
    console.log(`Settings migration for version ${version} not needed`);
  }

  // Broadcast settings changes to renderer processes
  private broadcastSettingsChange(): void {
    // This would typically broadcast to all renderer processes
    // Implementation depends on your app's architecture
    console.log('Settings changed, broadcasting to renderer processes');
  }

  // Cleanup
  public dispose(): void {
    if (this.autoExportTimer) {
      clearInterval(this.autoExportTimer);
    }
  }

  // IPC Handler registration
  public registerIpcHandlers(): void {
    // Get settings
    ipcMain.handle('settings:get', async () => {
      try {
        const settings = await this.getSettings();
        return { success: true, data: settings };
      } catch (error) {
        console.error('Failed to get settings via IPC:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Save settings
    ipcMain.handle('settings:save', async (event, settings: Partial<ErrorRecoverySettings>) => {
      try {
        await this.updateSettings(settings);
        return { success: true };
      } catch (error) {
        console.error('Failed to save settings via IPC:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Get statistics
    ipcMain.handle('settings:getStatistics', async () => {
      try {
        const statistics = await this.getStatistics();
        return { success: true, data: statistics };
      } catch (error) {
        console.error('Failed to get statistics via IPC:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Get audit logs
    ipcMain.handle('settings:getAuditLogs', async () => {
      try {
        const logs = await this.getAuditLogs();
        return { success: true, data: logs };
      } catch (error) {
        console.error('Failed to get audit logs via IPC:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Clear cache
    ipcMain.handle('settings:clearCache', async () => {
      try {
        await this.clearSolutionCache();
        return { success: true };
      } catch (error) {
        console.error('Failed to clear cache via IPC:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Export settings
    ipcMain.handle('settings:export', async () => {
      try {
        const result = await dialog.showSaveDialog({
          title: 'Export Error Recovery Settings',
          defaultPath: `error-recovery-settings-${new Date().toISOString().split('T')[0]}.json`,
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Export cancelled' };
        }

        const filePath = await this.exportSettingsToFile(result.filePath);
        return { success: true, filePath };
      } catch (error) {
        console.error('Failed to export settings via IPC:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Import settings
    ipcMain.handle('settings:import', async () => {
      try {
        const result = await dialog.showOpenDialog({
          title: 'Import Error Recovery Settings',
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          properties: ['openFile']
        });

        if (result.canceled || !result.filePaths.length) {
          return { success: false, error: 'Import cancelled' };
        }

        const settings = await this.importSettingsFromFile(result.filePaths[0]);
        return { success: true, data: settings };
      } catch (error) {
        console.error('Failed to import settings via IPC:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Clear audit logs
    ipcMain.handle('settings:clearAuditLogs', async () => {
      try {
        await this.clearAuditLogs();
        return { success: true };
      } catch (error) {
        console.error('Failed to clear audit logs via IPC:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    console.log('Settings IPC handlers registered');
  }
}

// Export singleton instance
export const settingsManager = new SettingsManager();