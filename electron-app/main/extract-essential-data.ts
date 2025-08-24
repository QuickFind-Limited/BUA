/**
 * Extract essential data from recording to reduce size before sending to AI
 * Uses intelligent selection instead of simple first-100 limit
 */

interface RecordingAction {
  type: string;
  timestamp?: number;
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

export function extractEssentialData(recording: any): any {
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
  
  // Use intelligent action extraction
  if (recording.actions && Array.isArray(recording.actions)) {
    essential.actions = extractIntelligentActions(recording.actions);
  }
  
  // Include extractedInputs if present
  if (recording.extractedInputs) {
    essential.extractedInputs = recording.extractedInputs;
  }
  
  // Include capturedInputs if present
  if (recording.capturedInputs) {
    essential.capturedInputs = recording.capturedInputs;
  }
  
  // Extract key DOM snapshots at strategic points
  if (recording.domSnapshots && Array.isArray(recording.domSnapshots)) {
    essential.domSnapshots = extractKeySnapshots(recording.domSnapshots);
  }
  
  // Network patterns summary (not full data)
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
  console.log(`✅ Reduced recording from ${(original/1024).toFixed(1)}KB to ${(reduced/1024).toFixed(1)}KB (${((reduced/original)*100).toFixed(1)}%)`);
  
  return essential;
}

/**
 * Intelligent action extraction that preserves workflow completeness
 */
function extractIntelligentActions(actions: RecordingAction[]): RecordingAction[] {
  const meaningfulTypes = ['click', 'input', 'type', 'fill', 'navigate', 'submit', 'select', 'change'];
  
  // First, filter to only meaningful actions
  let meaningfulActions = actions.filter(a => meaningfulTypes.includes(a.type));
  
  console.log(`📊 Processing ${meaningfulActions.length} meaningful actions from ${actions.length} total`);
  
  // Strategy 1: If under 200 meaningful actions, keep them all
  if (meaningfulActions.length <= 200) {
    console.log(`✅ Keeping all ${meaningfulActions.length} meaningful actions (under 200 limit)`);
    return meaningfulActions.map(simplifyAction);
  }
  
  // Strategy 2: Smart sampling for longer recordings
  console.log(`📊 Intelligently sampling from ${meaningfulActions.length} actions`);
  
  const sampled: RecordingAction[] = [];
  const addedSignatures = new Set<string>();
  
  // 1. Always keep navigation actions (they define workflow structure)
  const navigations = meaningfulActions.filter(a => 
    a.type === 'navigate' || a.url || 
    (a.type === 'click' && a.target?.text?.match(/next|continue|proceed|submit|save|create|add/i))
  );
  navigations.forEach(action => {
    const sig = getActionSignature(action);
    if (!addedSignatures.has(sig)) {
      sampled.push(action);
      addedSignatures.add(sig);
    }
  });
  console.log(`  - Added ${navigations.length} navigation/workflow actions`);
  
  // 2. Keep all form inputs (they contain user data)
  const inputs = meaningfulActions.filter(a => 
    ['input', 'type', 'fill', 'select', 'change'].includes(a.type)
  );
  inputs.forEach(action => {
    const sig = getActionSignature(action);
    if (!addedSignatures.has(sig)) {
      sampled.push(action);
      addedSignatures.add(sig);
    }
  });
  console.log(`  - Added ${inputs.length} input actions`);
  
  // 3. Identify and keep important clicks
  const clickActions = meaningfulActions.filter(a => a.type === 'click');
  const importantClicks = identifyImportantClicks(clickActions);
  importantClicks.forEach(action => {
    const sig = getActionSignature(action);
    if (!addedSignatures.has(sig)) {
      sampled.push(action);
      addedSignatures.add(sig);
    }
  });
  console.log(`  - Added ${importantClicks.length} important clicks from ${clickActions.length} total`);
  
  // 4. Sort by timestamp if available, otherwise maintain original order
  const sorted = sampled.sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return 0; // Maintain original order if no timestamps
  });
  
  // 5. If still over 200, apply time-based sampling
  if (sorted.length > 200) {
    console.log(`  - Applying time-based sampling to reduce from ${sorted.length} to 200`);
    return timeBasedSampling(sorted, 200).map(simplifyAction);
  }
  
  console.log(`✅ Final action count: ${sorted.length}`);
  return sorted.map(simplifyAction);
}

/**
 * Get a unique signature for an action to avoid duplicates
 */
function getActionSignature(action: RecordingAction): string {
  const target = action.target?.selector || action.target?.id || action.target?.text || '';
  const value = action.value || '';
  return `${action.type}:${target}:${value}`;
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
        click.target?.text?.match(/save|submit|create|delete|confirm|add|new|login|sign|next|continue/i) ||
        click.target?.selector?.includes('submit') ||
        click.target?.selector?.includes('save')) {
      important.push(click);
    }
  });
  
  return important;
}

/**
 * Time-based sampling to ensure we capture the entire workflow
 */
function timeBasedSampling(actions: RecordingAction[], targetCount: number): RecordingAction[] {
  if (actions.length <= targetCount) return actions;
  
  const sampled: RecordingAction[] = [];
  const critical: RecordingAction[] = [];
  const regular: RecordingAction[] = [];
  
  // Separate critical from regular actions
  actions.forEach(action => {
    if (isCriticalAction(action)) {
      critical.push(action);
    } else {
      regular.push(action);
    }
  });
  
  // Always keep all critical actions
  sampled.push(...critical);
  
  // Calculate how many regular actions we can keep
  const remainingSlots = targetCount - critical.length;
  if (remainingSlots <= 0) {
    // If we have too many critical actions, just return them
    return critical.slice(0, targetCount);
  }
  
  // Sample regular actions evenly across time
  if (regular.length > remainingSlots) {
    const sampleInterval = Math.floor(regular.length / remainingSlots);
    for (let i = 0; i < regular.length; i += sampleInterval) {
      if (sampled.length < targetCount) {
        sampled.push(regular[i]);
      }
    }
  } else {
    sampled.push(...regular);
  }
  
  // Sort by timestamp if available
  return sampled.sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return 0;
  });
}

/**
 * Check if an action is critical and should always be kept
 */
function isCriticalAction(action: RecordingAction): boolean {
  // Navigation is always critical
  if (action.type === 'navigate' || action.type === 'submit') {
    return true;
  }
  
  // Actions with important text are critical
  if (action.target?.text?.match(/save|submit|confirm|create|delete|login|sign|pay|checkout|purchase/i)) {
    return true;
  }
  
  // Form submissions are critical
  if (action.target?.selector?.includes('submit') || 
      action.target?.selector?.includes('[type="submit"]')) {
    return true;
  }
  
  return false;
}

/**
 * Extract key DOM snapshots at strategic points
 */
function extractKeySnapshots(snapshots: any[]): any[] {
  if (!snapshots || snapshots.length === 0) {
    return [];
  }
  
  if (snapshots.length <= 5) {
    return snapshots.map(snap => ({
      timestamp: snap.timestamp,
      url: snap.url,
      title: snap.title
    }));
  }
  
  // Keep snapshots at: start, 25%, 50%, 75%, end
  // Plus any snapshot with URL changes (important navigation points)
  const strategic: any[] = [];
  const indices = [
    0,
    Math.floor(snapshots.length * 0.25),
    Math.floor(snapshots.length * 0.5),
    Math.floor(snapshots.length * 0.75),
    snapshots.length - 1
  ];
  
  // Add strategic indices
  indices.forEach(i => {
    if (snapshots[i]) {
      strategic.push({
        timestamp: snapshots[i].timestamp,
        url: snapshots[i].url,
        title: snapshots[i].title
      });
    }
  });
  
  // Add snapshots where URL changed (navigation points)
  let lastUrl = '';
  snapshots.forEach(snap => {
    if (snap.url !== lastUrl) {
      strategic.push({
        timestamp: snap.timestamp,
        url: snap.url,
        title: snap.title
      });
      lastUrl = snap.url;
    }
  });
  
  // Remove duplicates and sort by timestamp
  const unique = Array.from(new Map(strategic.map(s => [s.timestamp, s])).values());
  return unique.sort((a, b) => a.timestamp - b.timestamp).slice(0, 10); // Max 10 snapshots
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