/**
 * Improved extraction of essential data from recording
 * Uses intelligent selection instead of simple first-100 limit
 */

interface RecordingAction {
  type: string;
  timestamp: number;
  target?: {
    selector?: string;
    text?: string;
    id?: string;
    name?: string;
    placeholder?: string;
  };
  value?: string;
  url?: string;
}

interface Recording {
  sessionId: string;
  url: string;
  title: string;
  duration: number;
  viewport: any;
  userAgent: string;
  actions: RecordingAction[];
  domSnapshots?: any[];
  networkRequests?: any[];
  extractedInputs?: Record<string, string>;
  capturedInputs?: Record<string, string>;
}

export function extractEssentialDataImproved(recording: Recording): any {
  console.log('📊 Extracting essential data from recording (improved algorithm)...');
  const original = JSON.stringify(recording).length;

  const essential: any = {
    sessionId: recording.sessionId,
    url: recording.url,
    title: recording.title,
    duration: recording.duration,
    viewport: recording.viewport,
    userAgent: recording.userAgent
  };

  // Improved action extraction with intelligent selection
  if (recording.actions && Array.isArray(recording.actions)) {
    essential.actions = extractIntelligentActions(recording.actions);
  }

  // Include extracted inputs if present
  if (recording.extractedInputs) {
    essential.extractedInputs = recording.extractedInputs;
  }
  if (recording.capturedInputs) {
    essential.capturedInputs = recording.capturedInputs;
  }

  // Extract key DOM snapshots (strategic points, not just first/last)
  if (recording.domSnapshots && Array.isArray(recording.domSnapshots)) {
    essential.domSnapshots = extractKeySnapshots(recording.domSnapshots);
  }

  // Network patterns (unchanged)
  if (recording.networkRequests && Array.isArray(recording.networkRequests)) {
    const apis = new Set<string>();
    recording.networkRequests.forEach((req: any) => {
      if (req.url && (req.url.includes('/api/') || req.url.includes('/v1/'))) {
        try {
          const url = new URL(req.url);
          apis.add(url.hostname + url.pathname.split('/').slice(0, 3).join('/'));
        } catch {}
      }
    });
    essential.apiPatterns = Array.from(apis).slice(0, 10);
  }

  const reduced = JSON.stringify(essential).length;
  console.log(`✅ Reduced recording from ${(original / 1024).toFixed(1)}KB to ${(reduced / 1024).toFixed(1)}KB (${((reduced / original) * 100).toFixed(1)}%)`);
  
  return essential;
}

/**
 * Intelligent action extraction that preserves workflow completeness
 */
function extractIntelligentActions(actions: RecordingAction[]): RecordingAction[] {
  const meaningfulTypes = ['click', 'input', 'type', 'fill', 'navigate', 'submit', 'select', 'change'];
  
  // First, filter to only meaningful actions
  let meaningfulActions = actions.filter(a => meaningfulTypes.includes(a.type));
  
  // Strategy 1: If under 200 meaningful actions, keep them all
  if (meaningfulActions.length <= 200) {
    console.log(`✅ Keeping all ${meaningfulActions.length} meaningful actions (under 200 limit)`);
    return meaningfulActions.map(simplifyAction);
  }
  
  // Strategy 2: Smart sampling for longer recordings
  console.log(`📊 Intelligently sampling from ${meaningfulActions.length} actions`);
  
  const sampled: RecordingAction[] = [];
  
  // 1. Always keep navigation actions (they define workflow structure)
  const navigations = meaningfulActions.filter(a => 
    a.type === 'navigate' || a.url || 
    (a.type === 'click' && a.target?.text?.match(/next|continue|proceed|submit/i))
  );
  sampled.push(...navigations);
  
  // 2. Keep all form inputs (they contain user data)
  const inputs = meaningfulActions.filter(a => 
    ['input', 'type', 'fill', 'select', 'change'].includes(a.type)
  );
  sampled.push(...inputs);
  
  // 3. Identify and keep pattern-breaking actions (likely important)
  const clickActions = meaningfulActions.filter(a => a.type === 'click');
  const importantClicks = identifyImportantClicks(clickActions);
  sampled.push(...importantClicks);
  
  // 4. Remove duplicates while preserving order
  const deduped = removeDuplicateActions(sampled);
  
  // 5. If still over 200, apply time-based sampling
  if (deduped.length > 200) {
    return timeBasedSampling(deduped, 200);
  }
  
  return deduped.map(simplifyAction);
}

/**
 * Identify clicks that are likely important (not repetitive)
 */
function identifyImportantClicks(clicks: RecordingAction[]): RecordingAction[] {
  const important: RecordingAction[] = [];
  const selectorCounts = new Map<string, number>();
  
  // Count selector frequency
  clicks.forEach(click => {
    const selector = click.target?.selector || click.target?.id || '';
    selectorCounts.set(selector, (selectorCounts.get(selector) || 0) + 1);
  });
  
  // Keep clicks that are unique or infrequent (likely important)
  clicks.forEach(click => {
    const selector = click.target?.selector || click.target?.id || '';
    const count = selectorCounts.get(selector) || 0;
    
    // Keep if: unique, has important text, or is a submit/save action
    if (count <= 2 || 
        click.target?.text?.match(/save|submit|create|delete|confirm|add|new/i) ||
        click.target?.selector?.includes('submit') ||
        click.target?.selector?.includes('save')) {
      important.push(click);
    }
  });
  
  return important;
}

/**
 * Remove duplicate actions (same type and target)
 */
function removeDuplicateActions(actions: RecordingAction[]): RecordingAction[] {
  const seen = new Set<string>();
  const deduped: RecordingAction[] = [];
  
  actions.forEach(action => {
    // Create a signature for the action
    const signature = `${action.type}:${action.target?.selector || action.target?.id || ''}:${action.value || ''}`;
    
    // Skip if we've seen this exact action recently (within last 5 actions)
    const recentSignatures = Array.from(seen).slice(-5);
    if (!recentSignatures.includes(signature)) {
      deduped.push(action);
      seen.add(signature);
    }
  });
  
  return deduped;
}

/**
 * Time-based sampling to ensure we capture the entire workflow
 */
function timeBasedSampling(actions: RecordingAction[], targetCount: number): RecordingAction[] {
  if (actions.length <= targetCount) return actions;
  
  const sampled: RecordingAction[] = [];
  const timeRange = actions[actions.length - 1].timestamp - actions[0].timestamp;
  const sampleInterval = timeRange / targetCount;
  
  let lastSampleTime = actions[0].timestamp;
  
  actions.forEach(action => {
    // Always keep first and last actions
    if (action === actions[0] || action === actions[actions.length - 1]) {
      sampled.push(action);
      return;
    }
    
    // Sample based on time intervals
    if (action.timestamp >= lastSampleTime + sampleInterval) {
      sampled.push(action);
      lastSampleTime = action.timestamp;
    }
    
    // Always keep critical actions regardless of sampling
    if (action.type === 'submit' || 
        action.type === 'navigate' ||
        action.target?.text?.match(/save|submit|confirm/i)) {
      sampled.push(action);
    }
  });
  
  return sampled;
}

/**
 * Extract key DOM snapshots at strategic points
 */
function extractKeySnapshots(snapshots: any[]): any[] {
  if (snapshots.length <= 5) {
    return snapshots.map(snap => ({
      timestamp: snap.timestamp,
      url: snap.url,
      title: snap.title
    }));
  }
  
  // Keep snapshots at: start, 25%, 50%, 75%, end
  const indices = [
    0,
    Math.floor(snapshots.length * 0.25),
    Math.floor(snapshots.length * 0.5),
    Math.floor(snapshots.length * 0.75),
    snapshots.length - 1
  ];
  
  return indices.map(i => ({
    timestamp: snapshots[i].timestamp,
    url: snapshots[i].url,
    title: snapshots[i].title
  }));
}

/**
 * Simplify action data to reduce size
 */
function simplifyAction(action: RecordingAction): any {
  return {
    type: action.type,
    target: action.target ? {
      selector: action.target.selector,
      text: action.target.text?.substring(0, 50),
      id: action.target.id,
      name: action.target.name,
      placeholder: action.target.placeholder
    } : undefined,
    value: action.value?.substring(0, 100),
    url: action.url,
    timestamp: action.timestamp
  };
}