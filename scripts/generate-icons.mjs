import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgPath = join(root, 'public', 'favicon.svg')
const svgBuffer = readFileSync(svgPath)

async function generate(outputPath, size) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outputPath)
  console.log(`✓ ${outputPath} (${size}x${size})`)
}

// PWA icon
await generate(join(root, 'public', 'icon-192.png'), 192)

// iOS AppIcon (1024x1024)
await generate(join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png'), 1024)

// Android mipmap
const mipmap = {
  'mipmap-mdpi':    48,
  'mipmap-hdpi':    72,
  'mipmap-xhdpi':   96,
  'mipmap-xxhdpi':  144,
  'mipmap-xxxhdpi': 192,
}
const androidRes = join(root, 'android', 'app', 'src', 'main', 'res')
for (const [folder, size] of Object.entries(mipmap)) {
  await generate(join(androidRes, folder, 'ic_launcher.png'), size)
  await generate(join(androidRes, folder, 'ic_launcher_round.png'), size)
}

// Android adaptive icon foreground (transparent bg)
const fgSvgPath = join(root, 'public', 'icon-foreground.svg')
const fgSvgBuffer = readFileSync(fgSvgPath)
async function generateFg(outputPath, size) {
  await sharp(fgSvgBuffer)
    .resize(size, size)
    .png()
    .toFile(outputPath)
  console.log(`✓ ${outputPath} (${size}x${size})`)
}
for (const [folder, size] of Object.entries(mipmap)) {
  await generateFg(join(androidRes, folder, 'ic_launcher_foreground.png'), size)
}

console.log('\nAll icons generated!')
