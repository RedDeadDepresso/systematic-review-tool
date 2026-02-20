// script to convert all relative imports in src/ to absolute imports using @/
// Usage: `pnpm dlx ts-node scripts/convert-imports.ts` (make sure ts-morph is installed)

import { Project } from 'ts-morph';
import path from 'path';

// Initialize project using your tsconfig.json
const project = new Project({ tsConfigFilePath: 'tsconfig.json' });

// Add all TypeScript / TSX files in src/
const srcFiles = project.addSourceFilesAtPaths('src/**/*.{ts,tsx}');

srcFiles.forEach((file) => {
  const fileDir = path.dirname(file.getFilePath());

  file.getImportDeclarations().forEach((imp) => {
    const modulePath = imp.getModuleSpecifierValue();

    // Only modify relative imports
    if (modulePath.startsWith('.')) {
      // Convert relative path to absolute path relative to src/
      const absPath = path.relative(
        path.resolve('src'),
        path.resolve(fileDir, modulePath)
      );
      // POSIX-style path + '@/'
      const newPath = '@/'.concat(absPath.split(path.sep).join('/'));
      imp.setModuleSpecifier(newPath);
    }
  });

  file.saveSync();
});

console.log('All relative imports converted to absolute (@/) paths.');
