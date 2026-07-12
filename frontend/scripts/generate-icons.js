// scripts/generate-icons.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const WORKSPACE_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(WORKSPACE_DIR, 'public');
const ICONS_DIR = path.join(PUBLIC_DIR, 'icons');

// Source image from conversation assets
const CONVERSATION_SOURCE_IMAGE = 'C:/Users/austi/.gemini/antigravity-ide/brain/49cfcf9b-5737-4837-9dab-5696c7fbbde8/media__1783880095759.png';
const SOURCE_PNG_PATH = path.join(PUBLIC_DIR, 'icon.png');

// 1. Copy source image to the repository if it exists
if (fs.existsSync(CONVERSATION_SOURCE_IMAGE)) {
  fs.copyFileSync(CONVERSATION_SOURCE_IMAGE, SOURCE_PNG_PATH);
  console.log(`Copied new source logo to repository: ${SOURCE_PNG_PATH}`);
} else if (!fs.existsSync(SOURCE_PNG_PATH)) {
  console.error(`Source image not found! Checked: \n- ${CONVERSATION_SOURCE_IMAGE}\n- ${SOURCE_PNG_PATH}`);
  process.exit(1);
}

// Ensure target directories exist
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

async function generate() {
  console.log('Generating PWA icons from new source image public/icon.png...');

  // 1. Standard 192x192
  await sharp(SOURCE_PNG_PATH)
    .resize(192, 192)
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-192.png'));
  console.log('Created: icons/icon-192.png');

  // 2. Standard 512x512
  await sharp(SOURCE_PNG_PATH)
    .resize(512, 512)
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-512.png'));
  console.log('Created: icons/icon-512.png');

  // 3. Apple Touch Icon (180x180)
  await sharp(SOURCE_PNG_PATH)
    .resize(180, 180)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'apple-icon.png'));
  console.log('Created: apple-icon.png');

  // 4. Maskable Icon (512x512)
  // We extract a 90x90 region from the 155x156 source (which lies completely within the green background)
  // to avoid leaking off-white background corners when cropped by the OS.
  const croppedBookBuffer = await sharp(SOURCE_PNG_PATH)
    .extract({ left: 32, top: 33, width: 90, height: 90 })
    .resize(380, 380)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: '#008c75' // Teal-green background color detected from source
    }
  })
  .composite([{ input: croppedBookBuffer, gravity: 'center' }])
  .png()
  .toFile(path.join(ICONS_DIR, 'icon-512-maskable.png'));
  console.log('Created: icons/icon-512-maskable.png (maskable spec compliant)');

  console.log('All icons generated successfully!');
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
