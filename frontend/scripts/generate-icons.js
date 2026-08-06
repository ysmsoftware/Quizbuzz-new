// scripts/generate-icons.js
//
// Regenerates every favicon / PWA / OG image asset in `public/` from the
// two source brand assets:
//   - public/qbfavicon.png   — square app mark (rounded bg baked in), used
//                              for favicon.ico, apple-icon, and PWA icons.
//   - public/quizBuzz-logo.png — transparent wordmark, used for the OG/social
//                              share image.
//
// Run with: node scripts/generate-icons.js
// (requires the `sharp` and `png-to-ico` dev dependencies)

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
// png-to-ico ships as an ESM-interop CJS build; `.default` is the callable export.
const toIco = require('png-to-ico').default || require('png-to-ico');

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const ICONS_DIR = path.join(PUBLIC_DIR, 'icons');

const FAVICON_SOURCE = path.join(PUBLIC_DIR, 'qbfavicon.png');
const LOGO_SOURCE = path.join(PUBLIC_DIR, 'quizBuzz-logo.png');

const MASKABLE_BG = '#0d9488'; // matches the app's --primary teal
const OG_BG = '#f0fdfa';

async function generate() {
  for (const src of [FAVICON_SOURCE, LOGO_SOURCE]) {
    if (!fs.existsSync(src)) {
      console.error(`Missing source image: ${src}`);
      process.exit(1);
    }
  }

  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  console.log('Generating icons from public/qbfavicon.png and public/quizBuzz-logo.png...');

  await sharp(FAVICON_SOURCE).resize(32, 32).png().toFile(path.join(PUBLIC_DIR, 'icon.png'));
  console.log('Created: icon.png (32x32)');

  await sharp(FAVICON_SOURCE)
    .resize(180, 180)
    .flatten({ background: '#fafafa' })
    .png()
    .toFile(path.join(PUBLIC_DIR, 'apple-icon.png'));
  console.log('Created: apple-icon.png (180x180)');

  await sharp(FAVICON_SOURCE).resize(192, 192).png().toFile(path.join(ICONS_DIR, 'icon-192.png'));
  console.log('Created: icons/icon-192.png');

  await sharp(FAVICON_SOURCE).resize(512, 512).png().toFile(path.join(ICONS_DIR, 'icon-512.png'));
  console.log('Created: icons/icon-512.png');

  // Maskable icon needs the artwork padded into the safe zone (~center 80%)
  // on a solid background, since the OS applies its own mask/crop shape.
  const innerLogo = await sharp(FAVICON_SOURCE).resize(410, 410).toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: MASKABLE_BG } })
    .composite([{ input: innerLogo, gravity: 'center' }])
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-512-maskable.png'));
  console.log('Created: icons/icon-512-maskable.png (maskable spec compliant)');

  const [png16, png32, png48] = await Promise.all(
    [16, 32, 48].map((size) => sharp(FAVICON_SOURCE).resize(size, size).png().toBuffer())
  );
  const icoBuffer = await toIco([png16, png32, png48]);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);
  console.log('Created: favicon.ico (16/32/48 multi-res)');

  const logoForOg = await sharp(LOGO_SOURCE).resize({ width: 520 }).toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: OG_BG } })
    .composite([{ input: logoForOg, gravity: 'center' }])
    .png()
    .toFile(path.join(PUBLIC_DIR, 'og-image.png'));
  console.log('Created: og-image.png (1200x630 social share image)');

  console.log('All icons generated successfully!');
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
