import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * Pure Node.js ZIP archiver (zero external binary dependencies)
 * Packages the configured Android + Capacitor + Web source into
 * /public/color-stack-android-apk-project.zip for 1-click download,
 * preserving Unix execute permissions (+x) on gradlew and build-apk.sh.
 */
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const entries = [];

const EXCLUDED_NAMES = new Set([
  'node_modules',
  '.git',
  '.gradle',
  '.idea',
  'build',
  'dist',
  'dev-dist',
  'local.properties',
  '.DS_Store',
  'Thumbs.db',
  'color-stack-android-apk-project.zip',
  'ColorStack3D-debug.apk',
  'ColorStack3D-APK-RealAds.apk',
]);

const EXECUTABLE_PATHS = new Set(['android/gradlew', 'build-apk.sh']);

function addFile(relPath) {
  const fullPath = path.resolve(relPath);
  if (!fs.existsSync(fullPath)) return;
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(fullPath)) {
      if (
        EXCLUDED_NAMES.has(child) ||
        child.endsWith('.iml') ||
        child.endsWith('.apk') ||
        child.endsWith('.aab')
      ) {
        continue;
      }
      addFile(path.posix.join(relPath, child));
    }
    return;
  }

  const normalizedRel = relPath.replace(/\\/g, '/');
  const rawData = fs.readFileSync(fullPath);
  const compressed = zlib.deflateRawSync(rawData);
  const crc = crc32(rawData);
  const nameBuf = Buffer.from(normalizedRel, 'utf8');
  const isExecutable = EXECUTABLE_PATHS.has(normalizedRel);

  entries.push({
    nameBuf,
    rawSize: rawData.length,
    compData: compressed,
    crc,
    isExecutable,
  });
}

const targets = [
  'android',
  'src',
  'public',
  'scripts',
  '.github',
  '.npmrc',
  '.gitattributes',
  '.gitignore',
  'build-apk.sh',
  'firebase-applet-config.json',
  'firebase-blueprint.json',
  'firestore.rules',
  'index.html',
  'server.ts',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
];

for (const t of targets) {
  addFile(t);
}

const localParts = [];
const centralParts = [];
let offset = 0;

for (const e of entries) {
  const localHeader = Buffer.alloc(30 + e.nameBuf.length);
  localHeader.writeUInt32LE(0x04034b50, 0); // signature
  localHeader.writeUInt16LE(20, 4); // version needed
  localHeader.writeUInt16LE(0, 6); // flags
  localHeader.writeUInt16LE(8, 8); // deflate
  localHeader.writeUInt16LE(0, 10); // mod time
  localHeader.writeUInt16LE(0x5821, 12); // mod date
  localHeader.writeUInt32LE(e.crc, 14);
  localHeader.writeUInt32LE(e.compData.length, 18);
  localHeader.writeUInt32LE(e.rawSize, 22);
  localHeader.writeUInt16LE(e.nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);
  e.nameBuf.copy(localHeader, 30);

  localParts.push(localHeader, e.compData);

  const unixMode = e.isExecutable ? 0o100755 : 0o100644;
  const externalAttrs = (unixMode << 16) >>> 0;

  const centralHeader = Buffer.alloc(46 + e.nameBuf.length);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE((3 << 8) | 20, 4); // Unix (3) + PKZIP 2.0 (20)
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(8, 10);
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0x5821, 14);
  centralHeader.writeUInt32LE(e.crc, 16);
  centralHeader.writeUInt32LE(e.compData.length, 20);
  centralHeader.writeUInt32LE(e.rawSize, 24);
  centralHeader.writeUInt16LE(e.nameBuf.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(externalAttrs, 38);
  centralHeader.writeUInt32LE(offset, 42);
  e.nameBuf.copy(centralHeader, 46);

  centralParts.push(centralHeader);
  offset += localHeader.length + e.compData.length;
}

const centralBuf = Buffer.concat(centralParts);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(entries.length, 8);
eocd.writeUInt16LE(entries.length, 10);
eocd.writeUInt32LE(centralBuf.length, 12);
eocd.writeUInt32LE(offset, 16);
eocd.writeUInt16LE(0, 20);

const outZip = path.resolve('public/color-stack-android-apk-project.zip');
fs.writeFileSync(outZip, Buffer.concat([...localParts, centralBuf, eocd]));
console.log(`Packaged ${entries.length} files into ${outZip}`);
