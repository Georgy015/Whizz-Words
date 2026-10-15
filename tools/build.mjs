// Production build for CrazyGames: bundles and minifies the code into dist/,
// adds the CrazyGames SDK, copies assets and zips it for upload.
// Usage: npm run build
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const zipPath = join(root, 'whizz-words-crazygames.zip');

rmSync(dist, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(dist);

await build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  outfile: join(dist, 'game.js'),
  logLevel: 'warning',
});
await build({
  entryPoints: [join(root, 'style.css')],
  bundle: true,
  minify: true,
  external: ['assets/*'], // keep font URLs pointing at the copied files
  outfile: join(dist, 'style.css'),
  logLevel: 'warning',
});

const sdkTag = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>';
let html = readFileSync(join(root, 'index.html'), 'utf8');
if (!html.includes('<script type="module" src="src/main.js"></script>')) throw new Error('index.html script tag changed');
html = html
  .replace('<link rel="stylesheet" href="style.css">', `${sdkTag}\n  <link rel="stylesheet" href="style.css">`)
  .replace('<script type="module" src="src/main.js"></script>', '<script type="module" src="game.js"></script>');
writeFileSync(join(dist, 'index.html'), html);

cpSync(join(root, 'assets'), join(dist, 'assets'), { recursive: true });

execFileSync('zip', ['-r', '-q', '-X', zipPath, '.'], { cwd: dist });

// Report against CrazyGames' limits (250MB total, 1,500 files, 50MB initial).
const files = [];
const walk = (dir) => readdirSync(dir).forEach((f) => {
  const p = join(dir, f);
  if (statSync(p).isDirectory()) walk(p); else files.push(statSync(p).size);
});
walk(dist);
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
console.log(`dist/: ${files.length} files, ${mb(files.reduce((a, b) => a + b, 0))}`);
console.log(`whizz-words-crazygames.zip: ${mb(statSync(zipPath).size)}`);
