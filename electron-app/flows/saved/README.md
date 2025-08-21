# Saved Flows Directory

This directory stores executed flows for reuse and analysis.

## Structure

```
saved/
├── flows/          # Individual flow files (JSON)
├── history/        # Daily execution history
└── README.md       # This file
```

## Flow Files

Each executed flow is saved as a JSON file in the `flows/` directory with the following structure:

```json
{
  "id": "unique-flow-id",
  "spec": {
    "name": "Flow Name",
    "startUrl": "https://example.com",
    "params": ["variable1", "variable2"],
    "steps": [...],
    "successCheck": "success condition"
  },
  "variables": {
    "variable1": "value1",
    "variable2": "value2"
  },
  "result": {
    "success": true,
    "data": {...},
    "logs": [...],
    "metrics": {...},
    "screenshots": [...]
  },
  "executionHistory": [...],
  "metadata": {
    "createdAt": "2025-01-01T00:00:00.000Z",
    "lastExecuted": "2025-01-01T00:00:00.000Z",
    "executionCount": 1,
    "tags": ["tag1", "tag2"],
    "notes": "Optional notes"
  }
}
```

## History Files

Daily execution history is stored in the `history/` directory with files named by date (YYYY-MM-DD.json).

## Usage

The FlowStorage class provides methods to:
- Save executed flows
- Load saved flows
- List and filter flows
- Export/import flows
- Manage execution history
- Get storage statistics

## Automatic Cleanup

Old execution history can be automatically cleaned up using the `cleanupHistory()` method to prevent storage bloat.