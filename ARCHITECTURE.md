# PagePilot Architecture

## System Overview

PagePilot is a Chrome Extension built with Manifest V3 that injects an AI chat widget into web pages. The architecture follows a modular design with clear separation of concerns.

## Core Components

### 1. Background Service Worker
**Location:** `src/background/index.ts`

The service worker is the central message hub and API gateway:

- **Message Handling**: Routes messages between content script, UI, and options page
- **API Orchestration**: Manages calls to AI providers via model connectors
- **State Management**: Persists chat history per tab in Chrome storage
- **Model Management**: Validates API keys and determines available models

**Key Responsibilities:**
- `handleSendMessage()`: Processes chat messages and routes to appropriate AI provider
- `getAvailableModels()`: Checks which models are available based on configured API keys
- Chat history persistence per tab

### 2. Content Script
**Location:** `src/content/index.ts`

The content script runs in the page context and injects the chat widget:

- **Widget Injection**: Creates and manages the chat widget iframe
- **Keyboard Shortcuts**: Listens for `Ctrl+Shift+P` to toggle chat
- **Message Relay**: Communicates between page and extension context
- **Lifecycle Management**: Handles widget open/close states

**Communication Flow:**
```
Page → Content Script → Background Worker → AI Provider
     ←                ←                    ←
```

### 3. Chat Widget UI
**Location:** `src/ui/chat-widget/`

React-based floating chat interface:

- **React Component**: Main `ChatWidget` component with hooks
- **Drag & Drop**: Mouse event handling for widget positioning
- **Message Display**: Scrollable message history with styling
- **Model Switching**: Dropdown to select AI provider
- **Privacy Banners**: Visual indicators for external data transmission

**Features:**
- Auto-scroll to latest message
- Loading states and error handling
- Context extraction and display
- Keyboard shortcuts (Enter to send)

### 4. Model Connectors
**Location:** `src/shared/models/`

Modular AI provider implementations:

- **Base Interface**: `IModelConnector` defines common contract
- **Provider Implementations**: 
  - OpenAI (GPT-3.5-turbo)
  - Anthropic (Claude 3 Haiku)
  - HuggingFace (DialoGPT)
  - Ollama (Local LLaMA)
  - Free (Mock/placeholder)

**Pattern:**
Each connector:
1. Extends `BaseModelConnector`
2. Implements `sendMessage(request)` → `Promise<ApiResponse>`
3. Handles provider-specific API formats
4. Validates API keys via `isAvailable()`

### 5. Context Extraction
**Location:** `src/shared/context-extractor.ts`

DOM analysis agent:

- **Text Extraction**: TreeWalker for visible text (excludes scripts/styles)
- **Heading Hierarchy**: Extracts h1-h6 with levels
- **Form Detection**: Finds inputs, textareas, selects with labels
- **Selection Capture**: Gets user-selected text
- **Formatting**: Converts to structured format for AI prompts

**Privacy Considerations:**
- Only extracts visible content
- Filters hidden elements
- Respects user privacy settings
- Can be disabled per-user

### 6. Storage Layer
**Location:** `src/shared/storage.ts`

Chrome storage abstraction:

- **API Keys**: Encrypted local storage (never synced)
- **Preferences**: User settings (model defaults, privacy mode)
- **Chat History**: Per-tab conversation history
- **Extension State**: Widget position, open/closed state

**Storage Keys:**
- `pagepilot_api_keys`: Sensitive API credentials
- `pagepilot_preferences`: User preferences
- `pagepilot_chat_history`: Tab-specific chat logs
- `pagepilot_extension_state`: UI state per tab

### 7. Safety & Security
**Location:** `src/shared/safety.ts`

Security utilities:

- **Sanitization**: XSS prevention via content sanitization
- **Dangerous Code Detection**: Pattern matching for malicious content
- **Command Extraction**: Safe parsing of actionable commands
- **Confirmation Requirements**: User approval for any actions

**Safety Guarantees:**
- Never executes code from AI responses
- Sanitizes all displayed content
- Requires explicit user confirmation for actions
- Filters dangerous patterns (scripts, eval, etc.)

## Data Flow

### Chat Message Flow

```
1. User types message in ChatWidget
   ↓
2. ChatWidget sends to Background via chrome.runtime.sendMessage
   ↓
3. Background loads chat history from storage
   ↓
4. Background extracts/attaches context (if enabled)
   ↓
5. Background creates appropriate ModelConnector
   ↓
6. ModelConnector makes HTTP request to AI provider
   ↓
7. AI provider returns response
   ↓
8. Background sanitizes response via safety utilities
   ↓
9. Background saves to chat history
   ↓
10. Background sends response back to ChatWidget
   ↓
11. ChatWidget displays message and updates UI
```

### Context Extraction Flow

```
1. ChatWidget mounts or user requests context
   ↓
2. Content script has access to page DOM
   ↓
3. Context extractor scans page:
   - TreeWalker for visible text
   - Query selectors for headings
   - Form field detection
   - Selection reading
   ↓
4. Context formatted into structured object
   ↓
5. Context passed to AI as system message
   ↓
6. AI uses context to answer questions
```

## Build Process

### Vite Configuration

1. **Input Files**:
   - `background/index.ts` → `background.js`
   - `content/index.ts` → `content.js`
   - `options/index.html` → `options.html` (with bundled JS/CSS)
   - `chat-widget/index.html` → `chat-widget.html` (with bundled JS/CSS)

2. **Output Structure**:
   ```
   dist/
   ├── manifest.json (copied)
   ├── background.js
   ├── content.js
   ├── options.html
   ├── chat-widget.html
   ├── chunks/ (code-split chunks)
   └── assets/ (CSS, images, etc.)
   ```

3. **Path Aliases**:
   - `@/` → `src/` for cleaner imports

## Extension Permissions

### Required Permissions
- **activeTab**: Read current tab content
- **scripting**: Inject content scripts
- **storage**: Store API keys and preferences

### Host Permissions
- `http://*/*` and `https://*/*`: For API calls to AI providers

### Web Accessible Resources
- `chat-widget.html`: Injected into pages via iframe

## Security Model

### API Key Storage
- Stored in `chrome.storage.local` (never synced to cloud)
- Encrypted by Chrome's storage system
- Never transmitted except to intended API endpoints

### Content Safety
- All AI responses sanitized before display
- Dangerous code patterns blocked
- No direct script execution
- User confirmation required for actions

### Privacy
- Context extraction is opt-in/opt-out
- Privacy banner shows external data transmission
- Local models (Ollama) don't send data externally
- Chat history stored locally per-tab

## Extension Points

### Adding New AI Providers

1. Create new connector in `src/shared/models/`:
   ```typescript
   export class NewProviderConnector extends BaseModelConnector {
     provider: ModelProvider = 'newprovider';
     async sendMessage(request: ApiRequest): Promise<ApiResponse> {
       // Implement provider-specific API call
     }
   }
   ```

2. Register in `src/shared/models/index.ts`:
   ```typescript
   case 'newprovider':
     return new NewProviderConnector(apiKeys.newprovider);
   ```

3. Add to `MODEL_CONFIGS` in `constants.ts`

### Adding New Features

- **UI Components**: Add to `src/ui/` and import in widget
- **Background Tasks**: Add message handlers in `background/index.ts`
- **Context Extraction**: Extend `context-extractor.ts` with new extractors
- **Storage**: Add new storage functions in `storage.ts`

## Testing Strategy

### Manual Testing Checklist
- [ ] Extension loads without errors
- [ ] Chat widget opens/closes properly
- [ ] Dragging works smoothly
- [ ] Messages send and receive correctly
- [ ] Model switching works
- [ ] Context extraction captures page content
- [ ] API keys save and load correctly
- [ ] Privacy banner shows for external models
- [ ] Keyboard shortcuts work
- [ ] Multiple tabs maintain separate chat history

### Future: Automated Testing
- Unit tests for model connectors
- Integration tests for message flow
- E2E tests with Playwright
- Safety test suite for dangerous code detection

## Performance Considerations

- **Lazy Loading**: Model connectors created on-demand
- **Code Splitting**: Vite splits chunks for optimal loading
- **Context Limiting**: Text extraction limited to 5000 words
- **Storage Optimization**: Per-tab history prevents bloat
- **Memoization**: React hooks for expensive computations

## Known Limitations

1. **Content Script Isolation**: Can't directly access page JS context (by design)
2. **API Rate Limits**: No built-in rate limiting (handled by providers)
3. **Streaming**: Currently waits for full response (can be enhanced)
4. **Error Recovery**: Basic retry logic (can be improved)
5. **Icon Assets**: Placeholder icons needed (see README)

