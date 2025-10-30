/**
 * Script to generate Chrome extension icons from source logo
 * Requires sharp: yarn add -D sharp
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateIcons() {
	try {
		// Try to use sharp if available
		const sharp = (await import('sharp')).default;
		const sourceLogo = path.resolve(__dirname, '../pagepilot-logo.png');
		const iconsDir = path.resolve(__dirname, '../icons');

		// Check if source logo exists
		if (!fs.existsSync(sourceLogo)) {
			console.error('❌ Source logo not found at:', sourceLogo);
			console.log('Please ensure pagepilot-logo.png exists at project root');
			process.exit(1);
		}

		// Create icons directory
		if (!fs.existsSync(iconsDir)) {
			fs.mkdirSync(iconsDir, { recursive: true });
		}

		const sizes = [16, 48, 128];

		console.log('🎨 Generating icons from pagepilot-logo.png...');

		for (const size of sizes) {
			const outputPath = path.join(iconsDir, `icon${size}.png`);
			await sharp(sourceLogo)
				.resize(size, size, {
					fit: 'contain',
					background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparent background
				})
				.png()
				.toFile(outputPath);

			console.log(`✅ Created icon${size}.png (${size}x${size})`);
		}

		console.log('\n✨ Icons generated successfully!');
		console.log('📁 Icons are in the icons/ folder and will be copied to dist/icons/ on build');
	} catch (error) {
		if (error.code === 'MODULE_NOT_FOUND') {
			console.error('❌ sharp module not found');
			console.log('\n📦 Install sharp first:');
			console.log('   yarn add -D sharp\n');
			console.log('   or\n');
			console.log('   npm install -D sharp\n');
			console.log('Then run this script again: yarn generate-icons');
		} else {
			console.error('❌ Error generating icons:', error.message);
		}
		process.exit(1);
	}
}

generateIcons();

