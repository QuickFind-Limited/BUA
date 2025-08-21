import * as fs from 'fs';
import * as path from 'path';
import { IntentSpec, FlowResult, FlowMetrics } from '../flows/types';

export interface SavedFlow {
  id: string;
  spec: IntentSpec;
  variables: Record<string, string>;
  result: FlowResult;
  executionHistory: ExecutionRecord[];
  metadata: {
    createdAt: Date;
    lastExecuted: Date;
    executionCount: number;
    tags: string[];
    notes?: string;
  };
}

export interface ExecutionRecord {
  id: string;
  timestamp: Date;
  variables: Record<string, string>;
  result: FlowResult;
  duration: number;
  success: boolean;
  error?: string;
}

export interface FlowSearchFilter {
  name?: string;
  tags?: string[];
  success?: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

/**
 * Manages storage and retrieval of executed flows
 */
export class FlowStorage {
  private storageDir: string;
  private flowsDir: string;
  private historyDir: string;

  constructor(baseDir?: string) {
    this.storageDir = baseDir || path.join(process.cwd(), 'flows', 'saved');
    this.flowsDir = path.join(this.storageDir, 'flows');
    this.historyDir = path.join(this.storageDir, 'history');

    this.ensureDirectories();
  }

  /**
   * Save an executed flow with its results
   */
  async saveExecutedFlow(
    spec: IntentSpec,
    variables: Record<string, string>,
    result: FlowResult,
    tags: string[] = [],
    notes?: string
  ): Promise<string> {
    try {
      const flowId = this.generateFlowId(spec.name);
      const timestamp = new Date();

      // Create execution record
      const executionRecord: ExecutionRecord = {
        id: this.generateExecutionId(),
        timestamp,
        variables,
        result,
        duration: result.metrics?.duration || 0,
        success: result.success,
        error: result.error
      };

      // Check if flow already exists
      const existingFlow = await this.loadFlow(flowId);
      
      if (existingFlow) {
        // Update existing flow
        existingFlow.variables = variables;
        existingFlow.result = result;
        existingFlow.executionHistory.push(executionRecord);
        existingFlow.metadata.lastExecuted = timestamp;
        existingFlow.metadata.executionCount++;
        
        if (tags.length > 0) {
          existingFlow.metadata.tags = [...new Set([...existingFlow.metadata.tags, ...tags])];
        }
        
        if (notes) {
          existingFlow.metadata.notes = notes;
        }

        await this.saveFlow(existingFlow);
        return flowId;
      } else {
        // Create new saved flow
        const savedFlow: SavedFlow = {
          id: flowId,
          spec,
          variables,
          result,
          executionHistory: [executionRecord],
          metadata: {
            createdAt: timestamp,
            lastExecuted: timestamp,
            executionCount: 1,
            tags,
            notes
          }
        };

        await this.saveFlow(savedFlow);
        return flowId;
      }
    } catch (error) {
      throw new Error(`Failed to save flow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load a saved flow by ID
   */
  async loadFlow(flowId: string): Promise<SavedFlow | null> {
    try {
      const filePath = path.join(this.flowsDir, `${flowId}.json`);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = fs.readFileSync(filePath, 'utf-8');
      const savedFlow = JSON.parse(data) as SavedFlow;
      
      // Convert date strings back to Date objects
      savedFlow.metadata.createdAt = new Date(savedFlow.metadata.createdAt);
      savedFlow.metadata.lastExecuted = new Date(savedFlow.metadata.lastExecuted);
      savedFlow.executionHistory = savedFlow.executionHistory.map(record => ({
        ...record,
        timestamp: new Date(record.timestamp)
      }));

      return savedFlow;
    } catch (error) {
      console.error(`Failed to load flow ${flowId}:`, error);
      return null;
    }
  }

  /**
   * Save a flow to storage
   */
  private async saveFlow(savedFlow: SavedFlow): Promise<void> {
    try {
      const filePath = path.join(this.flowsDir, `${savedFlow.id}.json`);
      const data = JSON.stringify(savedFlow, null, 2);
      
      fs.writeFileSync(filePath, data, 'utf-8');
      
      // Also save to history
      await this.saveToHistory(savedFlow);
    } catch (error) {
      throw new Error(`Failed to save flow to storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save execution to history
   */
  private async saveToHistory(savedFlow: SavedFlow): Promise<void> {
    try {
      const latestExecution = savedFlow.executionHistory[savedFlow.executionHistory.length - 1];
      if (!latestExecution) return;

      const historyFile = path.join(this.historyDir, `${new Date().toISOString().split('T')[0]}.json`);
      
      let historyData: any[] = [];
      if (fs.existsSync(historyFile)) {
        const existing = fs.readFileSync(historyFile, 'utf-8');
        historyData = JSON.parse(existing);
      }

      historyData.push({
        flowId: savedFlow.id,
        flowName: savedFlow.spec.name,
        execution: latestExecution
      });

      fs.writeFileSync(historyFile, JSON.stringify(historyData, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`Failed to save to history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all saved flows
   */
  async listFlows(filter?: FlowSearchFilter): Promise<SavedFlow[]> {
    try {
      const files = fs.readdirSync(this.flowsDir)
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));

      const flows: SavedFlow[] = [];
      
      for (const flowId of files) {
        const flow = await this.loadFlow(flowId);
        if (flow && this.matchesFilter(flow, filter)) {
          flows.push(flow);
        }
      }

      // Sort by last executed date (most recent first)
      flows.sort((a, b) => b.metadata.lastExecuted.getTime() - a.metadata.lastExecuted.getTime());

      return flows;
    } catch (error) {
      throw new Error(`Failed to list flows: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a saved flow
   */
  async deleteFlow(flowId: string): Promise<boolean> {
    try {
      const filePath = path.join(this.flowsDir, `${flowId}.json`);
      
      if (!fs.existsSync(filePath)) {
        return false;
      }

      fs.unlinkSync(filePath);
      return true;
    } catch (error) {
      console.error(`Failed to delete flow ${flowId}:`, error);
      return false;
    }
  }

  /**
   * Get flow execution statistics
   */
  async getFlowStats(flowId: string): Promise<{
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    lastExecution: Date;
    recentErrors: string[];
  } | null> {
    try {
      const flow = await this.loadFlow(flowId);
      if (!flow) {
        return null;
      }

      const executions = flow.executionHistory;
      const successful = executions.filter(ex => ex.success);
      const totalExecutions = executions.length;
      const successRate = totalExecutions > 0 ? (successful.length / totalExecutions) * 100 : 0;
      const averageDuration = totalExecutions > 0 
        ? executions.reduce((sum, ex) => sum + ex.duration, 0) / totalExecutions 
        : 0;

      const recentErrors = executions
        .filter(ex => !ex.success && ex.error)
        .slice(-5) // Last 5 errors
        .map(ex => ex.error!)
        .filter((error, index, arr) => arr.indexOf(error) === index); // Unique errors

      return {
        totalExecutions,
        successRate,
        averageDuration,
        lastExecution: flow.metadata.lastExecuted,
        recentErrors
      };
    } catch (error) {
      console.error(`Failed to get flow stats for ${flowId}:`, error);
      return null;
    }
  }

  /**
   * Export flow for sharing
   */
  async exportFlow(flowId: string): Promise<string | null> {
    try {
      const flow = await this.loadFlow(flowId);
      if (!flow) {
        return null;
      }

      // Create export with only essential data
      const exportData = {
        spec: flow.spec,
        metadata: {
          name: flow.spec.name,
          description: flow.spec.description,
          tags: flow.metadata.tags,
          notes: flow.metadata.notes
        },
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error(`Failed to export flow ${flowId}:`, error);
      return null;
    }
  }

  /**
   * Import flow from export data
   */
  async importFlow(exportData: string, overwrite: boolean = false): Promise<string | null> {
    try {
      const data = JSON.parse(exportData);
      
      if (!data.spec || !data.spec.name || !data.spec.steps) {
        throw new Error('Invalid export data format');
      }

      const spec = data.spec as IntentSpec;
      const flowId = this.generateFlowId(spec.name);

      // Check if flow exists
      if (!overwrite && await this.loadFlow(flowId)) {
        throw new Error(`Flow ${spec.name} already exists. Use overwrite option to replace.`);
      }

      // Create new saved flow from import
      const savedFlow: SavedFlow = {
        id: flowId,
        spec,
        variables: {},
        result: {
          success: false,
          logs: [],
          data: {}
        },
        executionHistory: [],
        metadata: {
          createdAt: new Date(),
          lastExecuted: new Date(),
          executionCount: 0,
          tags: data.metadata?.tags || [],
          notes: data.metadata?.notes
        }
      };

      await this.saveFlow(savedFlow);
      return flowId;
    } catch (error) {
      console.error('Failed to import flow:', error);
      return null;
    }
  }

  /**
   * Clean up old execution history
   */
  async cleanupHistory(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      let cleanedCount = 0;
      const flows = await this.listFlows();

      for (const flow of flows) {
        const originalCount = flow.executionHistory.length;
        flow.executionHistory = flow.executionHistory.filter(
          ex => ex.timestamp > cutoffDate
        );

        if (flow.executionHistory.length < originalCount) {
          await this.saveFlow(flow);
          cleanedCount += originalCount - flow.executionHistory.length;
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error('Failed to cleanup history:', error);
      return 0;
    }
  }

  /**
   * Check if flow matches filter criteria
   */
  private matchesFilter(flow: SavedFlow, filter?: FlowSearchFilter): boolean {
    if (!filter) return true;

    if (filter.name && !flow.spec.name.toLowerCase().includes(filter.name.toLowerCase())) {
      return false;
    }

    if (filter.tags && filter.tags.length > 0) {
      const hasMatchingTag = filter.tags.some(tag => 
        flow.metadata.tags.some(flowTag => 
          flowTag.toLowerCase().includes(tag.toLowerCase())
        )
      );
      if (!hasMatchingTag) return false;
    }

    if (filter.success !== undefined) {
      const latestResult = flow.executionHistory[flow.executionHistory.length - 1];
      if (latestResult && latestResult.success !== filter.success) {
        return false;
      }
    }

    if (filter.dateRange) {
      const lastExecuted = flow.metadata.lastExecuted;
      if (lastExecuted < filter.dateRange.from || lastExecuted > filter.dateRange.to) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate unique flow ID
   */
  private generateFlowId(flowName: string): string {
    const sanitized = flowName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    return `${sanitized}-${Date.now()}`;
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectories(): void {
    try {
      [this.storageDir, this.flowsDir, this.historyDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });
    } catch (error) {
      console.warn(`Failed to create storage directories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get storage directory path
   */
  getStorageDir(): string {
    return this.storageDir;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalFlows: number;
    totalExecutions: number;
    storageSize: number;
    oldestFlow: Date | null;
    newestFlow: Date | null;
  }> {
    try {
      const flows = await this.listFlows();
      const totalFlows = flows.length;
      const totalExecutions = flows.reduce((sum, flow) => sum + flow.executionHistory.length, 0);
      
      let storageSize = 0;
      try {
        const getDirectorySize = (dirPath: string): number => {
          let size = 0;
          const files = fs.readdirSync(dirPath);
          for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
              size += getDirectorySize(filePath);
            } else {
              size += stats.size;
            }
          }
          return size;
        };
        
        storageSize = getDirectorySize(this.storageDir);
      } catch (error) {
        console.warn('Failed to calculate storage size:', error);
      }

      const dates = flows.map(f => f.metadata.createdAt).sort((a, b) => a.getTime() - b.getTime());
      const oldestFlow = dates.length > 0 ? dates[0] : null;
      const newestFlow = dates.length > 0 ? dates[dates.length - 1] : null;

      return {
        totalFlows,
        totalExecutions,
        storageSize,
        oldestFlow,
        newestFlow
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        totalFlows: 0,
        totalExecutions: 0,
        storageSize: 0,
        oldestFlow: null,
        newestFlow: null
      };
    }
  }
}