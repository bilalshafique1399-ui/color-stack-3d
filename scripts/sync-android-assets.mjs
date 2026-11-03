import fs from 'node:fs';
import path from 'node:path';

/**
 * Copies the built Vite `dist/` bundle directly into `android/app/src/main/assets/`
 * so the standalone Android WebView APK has all game files (index.html, assets/*, icons)
 * without requiring Capacitor CLI or node_modules during Gradle builds.
 */
const distDir = path.resolve('dist');
const androidAssetsDir = path.resolve('android/app/src/main/assets');

if (!fs.existsSync(distDir)) {
  console.error('Error: dist/ directory not found. Run `npm run build` first.');
  process.exit(1);
}

// Clear old assets cleanly
fs.rmSync(androidAssetsDir, { recursive: true, force: true });
fs.mkdirSync(androidAssetsDir, { recursive: true });

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (entry.endsWith('.zip')) continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.copyFileSync(src, dest);
}

copyRecursive(distDir, androidAssetsDir);

// Patch android/app/src/main/assets/index.html to use relative paths (./assets/...)
// and strip crossorigin attributes so both https://appassets.androidplatform.net/index.html
// and file:///android_asset/index.html work reliably.
const androidIndexPath = path.join(androidAssetsDir, 'index.html');
if (fs.existsSync(androidIndexPath)) {
  let html = fs.readFileSync(androidIndexPath, 'utf8');
  html = html
    .replace(/\scrossorigin(?:="[^"]*")?/g, '')
    .replace(
      /(src|href)="\/(assets\/|favicon\.ico|favicon-32x32\.png|pwa-192x192\.png|pwa-512x512\.png|icon\.svg|apple-touch-icon\.png|manifest\.webmanifest)/g,
      '$1="./$2',
    );
  fs.writeFileSync(androidIndexPath, html, 'utf8');
}

console.log(`Synced Vite dist/ into ${androidAssetsDir}`);
