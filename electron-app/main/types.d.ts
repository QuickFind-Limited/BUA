/**
 * Type definitions for the enhanced recording system
 */

import { WebContents, WebContentsView } from 'electron';
import { EnhancedRecordingController } from './enhanced-recording-controller';

// Extend global Window interface for recording
declare global {
  interface Window {
    recordingSessionId?: string;
    electronAPI?: any;
    Electron?: any;
  }
}

// Extend WebContentsView with url property
declare module 'electron' {
  interface WebContentsView {
    url?: string;
  }
  
  interface WebContents {
    getContentSize?(): { width: number; height: number };
  }
}

// Extend EnhancedRecordingController
declare module './enhanced-recording-controller' {
  interface EnhancedRecordingController {
    pauseRecording?(): void;
    resumeRecording?(): void;
    isPaused?: boolean;
    getSessionId?(): string;
  }
}

// Console API payload type
export interface consoleAPICalledPayload {
  type: string;
  args: any[];
  source?: string;
  timestamp: number;
  [key: string]: any; // Allow additional properties
}

// Recording session types
export interface RecordingSession {
  id: string;
  startTime: number;
  endTime?: number;
  actions: any[];
  metadata: any;
}

export interface CodegenRecordingResult {
  success: boolean;
  data?: any;
  error?: string;
  session?: RecordingSession;
  [key: string]: any; // Allow additional properties
}

// WebContentsTabManager extended interface
export interface WebContentsTabManagerExtended {
  getActiveTab(): WebContents | null;
  getActiveTabId(): string | null;
  getTab(id: string): WebContents | null;
  startRecording(): Promise<void>;
  stopRecording(): Promise<RecordingSession>;
  processRecordedAction(action: any): void;
  generatePlaywrightCode(session?: any): string;
  exportRecordingSession(): RecordingSession;
  importRecordingSession(session: RecordingSession): void;
  startCodegenRecording(): Promise<void>;
  getEnhancedRecordingStatus(): any;
  processEnhancedAction(action: any): void;
  generateEnhancedPlaywrightCode(session?: any): string;
  exportEnhancedRecordingSession(): RecordingSession;
  toggleSidebar?(): void;
  
  // Properties
  recorder?: any;
  codegenRecorder?: any;
  codegenExternalRecorder?: any;
  externalRecorder?: any;
  codegenRecordingActive?: boolean;
}

// Execution result type
export interface ExecutionResult {
  success: boolean;
  error?: string;
  data?: any;
}

// Fallback handler interface
export interface FallbackHandlerExtended {
  executeWithFallback(action: any): Promise<any>;
}

// Node iteration support for older DOM types
declare global {
  interface NodeListOf<TNode = Node> {
    [Symbol.iterator](): Iterator<TNode>;
  }
}

// Element info with coordinates
export interface ElementInfoWithCoordinates {
  tagName: string;
  attributes: Record<string, string>;
  textContent?: string;
  coordinates?: { x: number; y: number };
  [key: string]: any; // Allow additional properties
}

// Performance observer entry quality type
export type LayoutShiftQuality = 'good' | 'better' | 'best' | number | any;

export {};