# Quick Setup Guide

## Initial Setup

1. **Install dependencies:**
   ```bash
   yarn install
   ```

2. **Build the extension:**
   ```bash
   yarn build
   ```

3. **Load in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

## Create Icons

### Option 1: Automatic Generation (Recommended)

If you have `pagepilot-logo.png` at the project root:

1. **Install sharp (image processing library):**
   ```bash
   yarn add -D sharp
   ```

2. **Generate the three icon sizes:**
   ```bash
   yarn generate-icons
   ```

   This will create `icons/icon16.png`, `icons/icon48.png`, and `icons/icon128.png` from your logo. The build process will automatically copy these to `dist/icons/`.

### Option 2: Manual Creation

If you prefer to create icons manually:

1. Create an `icons/` folder at the project root
2. Resize your logo to create:
   - `icons/icon16.png` (16x16 pixels)
   - `icons/icon48.png` (48x48 pixels)
   - `icons/icon128.png` (128x128 pixels)

You can use any image editor (GIMP, Photoshop, or online tools like https://www.favicon-generator.org/).

**Note:** The extension will work without icons, but Chrome will show warnings. The icons are required for publishing to the Chrome Web Store.

## First Run

1. After loading, Chrome should open the options page automatically
2. (Optional) Enter API keys for OpenAI or Anthropic
3. Navigate to any webpage
4. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open the chat widget
5. Start chatting!

## Common Issues

### Build fails
```bash
# Clean and reinstall
rm -rf node_modules dist
yarn install
yarn build
```

### Extension not loading
- Check that `dist/manifest.json` exists
- Verify all JS files are in `dist/`
- Check Chrome's extension error console

### Chat widget not appearing
- Open DevTools (F12) and check Console for errors
- Verify content script is loaded (Sources tab → Content scripts)
- Try reloading the page

### API calls failing
- Verify API keys are correctly entered in Options
- Check network connectivity
- For Ollama, ensure service is running on localhost:11434

## Development Mode

```bash
# Watch for changes (auto-rebuild)
yarn dev

# Then reload extension in Chrome after each change:
# - Go to chrome://extensions/
# - Click reload icon on PagePilot extension
```

## Testing Different Models

1. **Free Model**: Works immediately, no setup needed
2. **OpenAI**: Get key from https://platform.openai.com/api-keys
3. **Anthropic**: Get key from https://console.anthropic.com
4. **Ollama**: 
   - Install from https://ollama.ai
   - Run `ollama serve` in terminal
   - Set endpoint in Options (default: http://localhost:11434)

