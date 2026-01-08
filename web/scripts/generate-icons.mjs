import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// FirstBell primary color
const PRIMARY_COLOR = '#1E3A5F';

async function generateIcon(size, filename) {
  // Create a simple solid color icon with "FB" text
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${PRIMARY_COLOR}"/>
      <text
        x="50%"
        y="50%"
        font-family="Arial, sans-serif"
        font-size="${size * 0.4}px"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
        dominant-baseline="central"
      >FB</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(join(publicDir, filename));

  console.log(`Generated ${filename}`);
}

async function main() {
  // Ensure public directory exists
  await mkdir(publicDir, { recursive: true });

  // Generate icons
  await generateIcon(192, 'icon-192.png');
  await generateIcon(512, 'icon-512.png');
  await generateIcon(180, 'apple-touch-icon.png');
  await generateIcon(32, 'favicon-32x32.png');
  await generateIcon(16, 'favicon-16x16.png');

  console.log('All icons generated!');
}

main().catch(console.error);
