
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Custom plugin to generate version.json
const versionGenerator = () => {
  return {
    name: 'version-generator',
    writeBundle() {
      const version = {
        buildId: Date.now().toString(),
        timestamp: new Date().toISOString()
      };
      // Use (process as any).cwd() to avoid TS error: Property 'cwd' does not exist on type 'Process'
      const filePath = path.resolve((process as any).cwd(), 'dist', 'version.json');
      fs.writeFileSync(filePath, JSON.stringify(version));
      console.log(`[Version] Generated version.json: ${version.buildId}`);
    }
  };
};

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Combine loaded env vars with system env vars (critical for Vercel/CI)
  const processEnv = { ...env, ...process.env };

  return {
    plugins: [
      react(),
      versionGenerator() // Add the version generator
    ],
    base: './', // Ensures assets are loaded relatively
    define: {
      // Explicitly expose specific variables to the client.
      // We use || '' to ensure we don't inject 'undefined' which can cause issues.
      'process.env.SUPABASE_URL': JSON.stringify(processEnv.SUPABASE_URL || processEnv.VITE_SUPABASE_URL || ''),
      'process.env.SUPABASE_KEY': JSON.stringify(processEnv.SUPABASE_KEY || processEnv.VITE_SUPABASE_KEY || ''),
      'process.env.API_KEY': JSON.stringify(processEnv.API_KEY || processEnv.VITE_API_KEY || ''),
    }
  };
});
