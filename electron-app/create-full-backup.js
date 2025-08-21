const fs = require('fs');
const path = require('path');

const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '_');
const backupDir = path.join('backups', `full-system-backup-${timestamp}`);

// Create backup directory
fs.mkdirSync(backupDir, { recursive: true });

// Files and directories to copy (excluding previous backups)
const items = [
  '.env',
  '.gitignore', 
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'playwright.config.ts',
  'preload.js',
  'main',
  'ui',
  'flows',
  'dist'
];

// Copy each item
items.forEach(item => {
  const src = path.join('.', item);
  const dest = path.join(backupDir, item);
  
  if (!fs.existsSync(src)) {
    console.log(`Skipping ${item} (not found)`);
    return;
  }
  
  if (fs.statSync(src).isDirectory()) {
    // Recursively copy directory
    const copyDir = (s, d) => {
      fs.mkdirSync(d, { recursive: true });
      fs.readdirSync(s).forEach(file => {
        const srcFile = path.join(s, file);
        const destFile = path.join(d, file);
        if (fs.statSync(srcFile).isDirectory()) {
          // Skip backup directories and node_modules
          if (file === 'backups' || file.includes('backup-') || file === 'node_modules') return;
          copyDir(srcFile, destFile);
        } else {
          fs.copyFileSync(srcFile, destFile);
        }
      });
    };
    console.log(`Copying directory: ${item}`);
    copyDir(src, dest);
  } else {
    console.log(`Copying file: ${item}`);
    fs.copyFileSync(src, dest);
  }
});

// Create restoration instructions
const instructions = `# Full System Backup - ${timestamp}

This is a complete backup of the CUA application that can be used for full restoration.

## Contents
- All source code (main, ui, flows)
- Configuration files (package.json, tsconfig.json, etc.)
- Build output (dist)
- Environment configuration (.env)

## Restoration Instructions

1. **Create new project directory:**
   \`\`\`bash
   mkdir cua-restored
   cd cua-restored
   \`\`\`

2. **Copy all backup contents to the new directory:**
   \`\`\`bash
   cp -r /path/to/backup/* .
   \`\`\`

3. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

4. **Set up environment variables:**
   - Ensure .env file has your ANTHROPIC_API_KEY

5. **Build the application:**
   \`\`\`bash
   npm run build
   \`\`\`

6. **Run the application:**
   \`\`\`bash
   npm run dev
   \`\`\`

## Key Features Included
- Enhanced Flow Executor with pre-flight analysis
- Dual-model architecture (Opus for analysis, Sonnet for runtime)
- Dynamic skip logic without hardcoding
- CDP connection on port 9335
- Playwright snippet execution with getByRole support
- AI-based state detection
- Error recovery and fallback mechanisms

## System Requirements
- Node.js 20.x or higher
- npm 10.x or higher
- Windows, macOS, or Linux
- Anthropic API key

## Notes
- This backup was created on ${new Date().toISOString()}
- Git history is not included (start fresh repo if needed)
- Previous backups are excluded to keep size manageable
- To restore to a different machine, just follow the instructions above
`;

fs.writeFileSync(path.join(backupDir, 'RESTORE_INSTRUCTIONS.md'), instructions);

// Create a package info file
const packageInfo = {
  backupDate: new Date().toISOString(),
  nodeVersion: process.version,
  platform: process.platform,
  filesIncluded: items,
  keyFeatures: [
    'Enhanced Flow Executor',
    'Pre-flight Analysis',
    'Dynamic Skip Logic',
    'Dual-model Architecture',
    'AI-based State Detection'
  ]
};

fs.writeFileSync(path.join(backupDir, 'backup-info.json'), JSON.stringify(packageInfo, null, 2));

console.log('=============================================');
console.log('Full system backup created successfully!');
console.log('Location:', backupDir);
console.log('Files backed up:', items.length);
console.log('=============================================');