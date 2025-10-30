# Icon Setup

The extension needs three icon sizes for Chrome. You can use placeholder icons or create custom ones.

## Quick Placeholder Icons

The simplest approach is to create a simple colored square or use an image editing tool.

### Option 1: Use Online Tools
1. Go to https://www.favicon-generator.org/ or similar
2. Upload an image or create one
3. Download the generated icons
4. Place them in `dist/icons/` after building:
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`

### Option 2: Create Simple Placeholders

Using any image editor (GIMP, Photoshop, or even online tools):

1. Create a 128x128px image with:
   - Background: #0ea5e9 (primary color)
   - Text/Icon: White "PP" or a chat bubble icon
   - Save as PNG with transparency

2. Resize to:
   - 128x128 → `icon128.png`
   - 48x48 → `icon48.png`
   - 16x16 → `icon16.png`

3. Place all three in `dist/icons/` directory

### Option 3: Use SVG Converter

Create a single SVG and convert to PNG sizes:
- Use https://cloudconvert.com/svg-to-png
- Set dimensions for each size
- Download and rename appropriately

## Icon Specifications

- **Format**: PNG (with transparency)
- **Sizes**: 16x16, 48x48, 128x128 pixels
- **Style**: Should work well on both light and dark backgrounds
- **Content**: Recommended: Chat bubble, AI/robot icon, or "PP" text

## Testing Icons

After adding icons:
1. Rebuild: `npm run build`
2. Reload extension in Chrome
3. Icons should appear in:
   - Extension management page
   - Browser toolbar (if action button used)
   - Extension menu

## Note

The extension will work without icons, but Chrome will show warnings. Icons are recommended for a polished experience.

