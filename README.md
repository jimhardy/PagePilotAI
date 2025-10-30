# PagePilot - AI Copilot for the Web

A Chrome extension that brings an AI copilot directly into any webpage. Chat with AI about page content, automate form filling, and get intelligent assistance while browsing.

## Features

- 🤖 **Multi-Model Support**: Connect to OpenAI (ChatGPT), Anthropic (Claude), HuggingFace, Ollama (local), or use the free model
- 💬 **Floating Chat Widget**: Draggable chat interface that appears directly on any webpage
- 🔍 **Context-Aware**: Automatically extracts page content, headings, forms, and selected text
- 🔒 **Privacy-First**: Local storage of API keys, privacy mode, and transparency banners
- 🎨 **Modern UI**: Built with React, TypeScript, and TailwindCSS - clean and minimal design
- ⚡ **Manifest V3**: Latest Chrome extension standards for security and performance

## Architecture

### Folder Structure

```
PagePilotAI/
├── src/
│   ├── background/           # Service worker (API calls, message passing)
│   │   └── index.ts
│   ├── content/              # Content script (injects widget into pages)
│   │   ├── index.ts
│   │   └── content.css
│   ├── options/              # Options page (API key management)
│   │   ├── OptionsPage.tsx
│   │   ├── index.tsx
│   │   └── index.html
│   ├── shared/               # Shared utilities and types
│   │   ├── types.ts          # TypeScript interfaces
│   │   ├── constants.ts      # Constants and configs
│   │   ├── storage.ts        # Chrome storage utilities
│   │   ├── context-extractor.ts  # DOM scanning agent
│   │   ├── safety.ts         # Security utilities
│   │   ├── model-connector.ts    # Base connector interface
│   │   └── models/           # AI provider connectors
│   │       ├── index.ts
│   │       ├── openai.ts
│   │       ├── anthropic.ts
│   │       ├── huggingface.ts
│   │       ├── ollama.ts
│   │       └── free.ts
│   └── ui/                   # React UI components
│       ├── chat-widget/      # Main chat interface
│       │   ├── ChatWidget.tsx
│       │   ├── index.tsx
│       │   └── index.html
│       └── styles.css        # TailwindCSS styles
├── manifest.json             # Chrome extension manifest
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

### Component Overview

#### Background Service Worker (`src/background/index.ts`)
- Handles all API calls to AI providers
- Manages message passing between content script and UI
- Stores chat history per tab
- Validates API keys and manages model availability

#### Content Script (`src/content/index.ts`)
- Injects chat widget iframe into web pages
- Listens for keyboard shortcuts (Ctrl+Shift+P)
- Communicates with background worker
- Handles widget lifecycle (open/close)

#### Chat Widget (`src/ui/chat-widget/`)
- React component with drag-and-drop functionality
- Model switching dropdown
- Message history display
- Context extraction and privacy banners
- Real-time chat with streaming support (ready for expansion)

#### Options Page (`src/options/`)
- API key management interface
- Preference configuration
- Model endpoint configuration for local services

#### Model Connectors (`src/shared/models/`)
- Modular design - each provider is a separate connector
- Implements common `IModelConnector` interface
- Handles API-specific request/response formats
- Error handling and availability checking

#### Context Extractor (`src/shared/context-extractor.ts`)
- Scans DOM for visible text, headings, forms
- Filters out hidden elements and scripts
- Formats context for AI prompts
- Respects privacy settings

#### Safety Utilities (`src/shared/safety.ts`)
- Sanitizes AI responses to prevent XSS
- Detects dangerous code patterns
- Requires confirmation for actions
- Never executes code without user approval

## Setup Instructions

### Prerequisites

- Node.js 18+ and yarn
- Chrome or Chromium browser

### Installation

1. **Clone and install dependencies:**
   ```bash
   yarn install
   ```

2. **Build the extension:**
   ```bash
   yarn build
   ```
   This creates a `dist/` folder with all compiled files.

3. **Load extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `dist/` folder

4. **Configure API keys (optional):**
   - Click the extension icon or go to Options
   - Enter your API keys for OpenAI, Anthropic, etc.
   - Configure local endpoints for Ollama if desired

### Development

```bash
# Watch mode for development
yarn dev

# Type checking
yarn typecheck

# Build for production
yarn build

# Create extension package
yarn package
```

### Icons

The extension expects icons at:
- `icons/icon16.png`
- `icons/icon48.png`
- `icons/icon128.png`

Create these or use placeholder icons. The extension will work without them, but Chrome may show warnings.

## Usage

### Opening the Chat

1. **Keyboard shortcut:** Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) on any webpage
2. **Extension action:** Click the extension icon and select "Open Chat"
3. **Programmatically:** The content script can be triggered programmatically

### Using the Chat

- **Ask questions** about the page content
- **Request summaries** of sections or the entire page
- **Get help with forms** - the AI can understand form fields and help fill them
- **Switch models** using the dropdown in the chat header
- **Drag the widget** by clicking and dragging the header

### Privacy Features

- **Privacy Mode:** When enabled, shows a banner when sending data to external services
- **Local Processing:** Use Ollama or the free model for local-only processing
- **Transparent:** Always shows which model you're using and where data is sent

## API Providers

### OpenAI (ChatGPT)
- Requires API key from [platform.openai.com](https://platform.openai.com/api-keys)
- Uses `gpt-3.5-turbo` model
- Pay-per-use pricing

### Anthropic (Claude)
- Requires API key from [console.anthropic.com](https://console.anthropic.com)
- Uses `claude-3-haiku-20240307` model
- Pay-per-use pricing

### HuggingFace
- Free tier available (may have rate limits)
- Uses DialoGPT-medium by default
- Can configure custom endpoints

### Ollama (Local)
- Requires local Ollama installation
- Default endpoint: `http://localhost:11434`
- 100% private - no data leaves your machine
- Get started at [ollama.ai](https://ollama.ai)

### Free Model
- Always available, no configuration needed
- Basic responses for testing
- No external API calls

## Permissions Explained

- **activeTab**: Access to the current tab's content
- **scripting**: Inject content scripts into pages
- **storage**: Store API keys and preferences locally
- **host_permissions**: Required for API calls to external services

## Security & Privacy

### Data Handling
- API keys stored locally in Chrome's storage (never synced)
- Chat history stored per-tab locally
- Context extraction happens in content script (client-side)
- External API calls only when explicitly requested

### Safety Features
- All AI responses are sanitized to prevent XSS
- Dangerous code patterns are detected and blocked
- Never executes JavaScript from AI responses
- User confirmation required for any page modifications
- Privacy banner shows when data is sent externally

## Troubleshooting

### Extension Not Loading
- Ensure you're using Chrome/Chromium (not Firefox)
- Check that all files built successfully in `dist/`
- Verify manifest.json is in `dist/` folder
- Check Chrome's extension error console

### API Calls Failing
- Verify API keys are correctly entered
- Check network connectivity
- For Ollama, ensure service is running locally
- Check browser console for detailed error messages

### Chat Widget Not Appearing
- Check that content script is injected (DevTools → Sources)
- Verify keyboard shortcut isn't blocked by page
- Try reloading the page
- Check for JavaScript errors in console

### Build Errors
- Ensure Node.js version is 18+
- Delete `node_modules` and `dist`, then `yarn install`
- Check TypeScript version compatibility
- Review `vite.config.ts` for build configuration

## Future Roadmap

### Short-term
- [ ] Voice input support
- [ ] Better error handling and retry logic
- [ ] Export/import chat history
- [ ] Multi-language support
- [ ] Theme customization

### Medium-term
- [ ] Browser memory (remember context across pages)
- [ ] Plugin API for custom actions
- [ ] Form autofill with templates
- [ ] Screenshot and image analysis
- [ ] Better streaming responses

### Long-term
- [ ] Firefox/Edge support
- [ ] Collaborative features (shared contexts)
- [ ] Advanced context agents (summarization chains)
- [ ] Custom model fine-tuning integration
- [ ] Browser automation integration

## Contributing

This is a scaffold project ready for expansion. Areas for contribution:

1. **Model Connectors**: Add support for more AI providers
2. **Context Agents**: Improve context extraction and summarization
3. **UI/UX**: Enhance the chat interface and user experience
4. **Privacy**: Additional privacy features and controls
5. **Documentation**: More examples and guides

## License

MIT License - feel free to use, modify, and distribute.

## Acknowledgments

- Built with React, TypeScript, TailwindCSS
- Uses Manifest V3 for Chrome extensions
- Inspired by Notion AI and Cursor's copilot interface

---

**Note**: This is a development scaffold. Some features like icon generation, advanced error handling, and streaming are ready for expansion. The codebase is modular and well-commented for easy extension.
