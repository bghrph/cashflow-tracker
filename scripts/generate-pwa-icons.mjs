// Regenerate PWA/iOS icon assets from public/favicon.svg.
// Run with: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svg = readFileSync(join(root, 'public', 'favicon.svg'));

// Plain icons: logo fills the canvas (used for any-purpose + apple-touch-icon)
const plainSizes = [192, 512];
// Maskable icon: logo scaled down within ~80% safe zone on the brand background,
// per https://web.dev/articles/maskable-icon — Android may crop to a circle.
const maskableSize = 512;
const maskableSafeZoneRatio = 0.8;
const brandBg = '#0A6B4E';

async function run() {
  for (const size of plainSizes) {
    await sharp(svg).resize(size, size).png().toFile(join(root, 'public', `pwa-${size}x${size}.png`));
  }

  await sharp(svg).resize(180, 180).png().toFile(join(root, 'public', 'apple-touch-icon.png'));

  const inner = Math.round(maskableSize * maskableSafeZoneRatio);
  const logo = await sharp(svg).resize(inner, inner).toBuffer();
  await sharp({
    create: {
      width: maskableSize,
      height: maskableSize,
      channels: 4,
      background: brandBg,
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(join(root, 'public', 'pwa-maskable-512x512.png'));

  console.log('Generated PWA icons in public/: pwa-192x192.png, pwa-512x512.png, pwa-maskable-512x512.png, apple-touch-icon.png');
}

run();
