import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import {
	copyFileSync,
	mkdirSync,
	existsSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from 'fs';
import { Plugin } from 'vite';

// Plugin to rebuild content.js as IIFE bundle
const contentScriptIIFE = (): Plugin => {
	return {
		name: 'content-script-iife',
		async writeBundle() {
			// Rebuild content.js with esbuild as IIFE
			const esbuild = await import('esbuild');
			const contentPath = resolve(__dirname, 'dist/content.js');

			if (existsSync(contentPath)) {
				console.log('🔄 Rebuilding content.js as IIFE...');
				try {
					await esbuild.build({
						entryPoints: [resolve(__dirname, 'src/content/index.ts')],
						bundle: true,
						format: 'iife',
						globalName: 'PagePilotContent',
						outfile: contentPath,
						platform: 'browser',
						target: 'es2020',
						minify: true,
						sourcemap: false,
						external: ['chrome'],
						define: {
							'process.env.NODE_ENV': '"production"',
						},
					});
					console.log('✅ Content script rebuilt as IIFE');
				} catch (error: any) {
					console.error('❌ Failed to rebuild content.js:', error);
					throw error;
				}
			}
		},
	};
};

export default defineConfig({
	base: './', // Use relative paths for Chrome extension
	plugins: [
		react(),
		// Copy manifest.json to dist
		{
			name: 'copy-manifest',
			writeBundle() {
				if (!existsSync('dist')) mkdirSync('dist', { recursive: true });
				copyFileSync('manifest.json', 'dist/manifest.json');

				// Copy icons from icons/ to dist/icons/
				if (existsSync('icons')) {
					if (!existsSync('dist/icons')) {
						mkdirSync('dist/icons', { recursive: true });
					}

					const iconFiles = readdirSync('icons').filter(
						(file) =>
							file.endsWith('.png') &&
							(file.startsWith('icon') || file.match(/^\d+\.png$/))
					);

					iconFiles.forEach((file) => {
						copyFileSync(`icons/${file}`, `dist/icons/${file}`);
					});

					console.log(`✅ Copied ${iconFiles.length} icon(s) to dist/icons/`);
				} else if (!existsSync('dist/icons')) {
					mkdirSync('dist/icons', { recursive: true });
				}

				// Copy content.css to dist/
				if (existsSync('src/content/content.css')) {
					copyFileSync('src/content/content.css', 'dist/content.css');
					console.log('✅ Copied content.css to dist/');
				}

				// Copy and fix HTML files to correct locations with relative paths
				if (existsSync('dist/src/options/index.html')) {
					let optionsHtml = readFileSync(
						'dist/src/options/index.html',
						'utf-8'
					);
					// Fix paths: remove ../.. and use relative paths from dist root
					optionsHtml = optionsHtml
						.replace(/href="\.\.\/\.\.\//g, 'href="./')
						.replace(/src="\.\.\/\.\.\//g, 'src="./');
					writeFileSync('dist/options.html', optionsHtml);
					console.log('✅ Created options.html with correct paths');
				}
				if (existsSync('dist/src/ui/chat-widget/index.html')) {
					let chatHtml = readFileSync(
						'dist/src/ui/chat-widget/index.html',
						'utf-8'
					);
					// Fix paths: remove ../../../ and use relative paths from dist root
					chatHtml = chatHtml
						.replace(/href="\.\.\/\.\.\/\.\.\//g, 'href="./')
						.replace(/src="\.\.\/\.\.\/\.\.\//g, 'src="./');
					writeFileSync('dist/chat-widget.html', chatHtml);
					console.log('✅ Created chat-widget.html with correct paths');
				}
			},
		},
		// Rebuild content.js as IIFE after initial build
		contentScriptIIFE(),
	],
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		rollupOptions: {
			input: {
				background: resolve(__dirname, 'src/background/index.ts'),
				content: resolve(__dirname, 'src/content/index.ts'),
				options: resolve(__dirname, 'src/options/index.html'),
				'chat-widget': resolve(__dirname, 'src/ui/chat-widget/index.html'),
			},
			output: {
				entryFileNames: '[name].js',
				chunkFileNames: 'chunks/[name]-[hash].js',
				assetFileNames: (assetInfo) => {
					// Preserve HTML files in root
					if (assetInfo.name?.endsWith('.html')) {
						return '[name][extname]';
					}
					// Preserve CSS files
					if (assetInfo.name?.endsWith('.css')) {
						return '[name][extname]';
					}
					return 'assets/[name]-[hash][extname]';
				},
				format: 'es',
			},
		},
		sourcemap: false, // Disable in production for smaller size
		minify: 'terser',
		// Increase chunk size limit for service worker
		chunkSizeWarningLimit: 1000,
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, './src'),
		},
	},
});
