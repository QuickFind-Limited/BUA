/**
 * Extract essential data from recording to reduce size before sending to AI
 */

export function extractEssentialData(recording: any): any {
  console.log('📊 Extracting essential data from recording...');
  
  const original = JSON.stringify(recording).length;
  
  const essential: any = {
    sessionId: recording.sessionId,
    url: recording.url,
    title: recording.title,
    duration: recording.duration,
    viewport: recording.viewport,
    userAgent: recording.userAgent
  };
  
  // Extract key actions (limit to important ones)
  if (recording.actions && Array.isArray(recording.actions)) {
    essential.actions = recording.actions
      .filter((a: any) => {
        // Keep only meaningful actions
        return ['click', 'input', 'type', 'fill', 'navigate', 'submit', 'select'].includes(a.type);
      })
      .slice(0, 100) // Limit to first 100 meaningful actions
      .map((a: any) => ({
        type: a.type,
        target: a.target ? {
          selector: a.target.selector,
          text: a.target.text?.substring(0, 50),
          id: a.target.id,
          name: a.target.name,
          placeholder: a.target.placeholder
        } : undefined,
        value: a.value?.substring(0, 100),
        url: a.url
      }));
  }
  
  // Include extractedInputs if present
  if (recording.extractedInputs) {
    essential.extractedInputs = recording.extractedInputs;
  }
  
  // Include capturedInputs if present
  if (recording.capturedInputs) {
    essential.capturedInputs = recording.capturedInputs;
  }
  
  // Extract key DOM snapshots (just first and last)
  if (recording.domSnapshots && Array.isArray(recording.domSnapshots)) {
    essential.domSnapshots = [
      recording.domSnapshots[0],
      recording.domSnapshots[recording.domSnapshots.length - 1]
    ].filter(Boolean).map((snap: any) => ({
      timestamp: snap.timestamp,
      url: snap.url,
      title: snap.title,
      // Don't include the actual HTML
    }));
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
  
  // Don't include mutations - they're huge and not essential
  // Don't include console logs - they're redundant with extractedInputs
  // Don't include full network data - just patterns
  
  const reduced = JSON.stringify(essential).length;
  console.log(`✅ Reduced recording from ${(original/1024).toFixed(1)}KB to ${(reduced/1024).toFixed(1)}KB (${((reduced/original)*100).toFixed(1)}%)`);
  
  return essential;
}