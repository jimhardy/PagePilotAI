/**
 * Background service worker for PagePilot
 * Handles API calls, message passing, and extension state
 */

import { createConnector } from '../shared/models';
import {
	getApiKeys,
	getPreferences,
	saveChatHistory,
	getChatHistory,
} from '../shared/storage';
import {
	ApiRequest,
	ApiResponse,
	ChatMessage,
	ModelProvider,
	ContextData,
} from '../shared/types';

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	handleMessage(message, sender)
		.then(sendResponse)
		.catch((error) => {
			console.error('Background error:', error);
			console.error('Error stack:', error.stack);
			sendResponse({
				error: error.message || String(error),
				stack: error.stack,
			});
		});
	return true; // Keep channel open for async response
});

async function handleMessage(
	message: any,
	sender: chrome.runtime.MessageSender
): Promise<any> {
	switch (message.type) {
		case 'GET_CURRENT_TAB':
			const tabs = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});
			return { tab: tabs[0] || null };

		case 'GET_AVAILABLE_MODELS':
			return await getAvailableModels();

		default:
			// These require a tab ID from sender
			const tabId = sender.tab?.id;
			if (!tabId) {
				throw new Error('No tab ID available');
			}

			switch (message.type) {
				case 'SEND_MESSAGE':
					return await handleSendMessage(message.payload, tabId);

				case 'GET_CHAT_HISTORY':
					return { history: await getChatHistory(tabId) };

				case 'CLEAR_CHAT_HISTORY':
					await saveChatHistory(tabId, []);
					return { success: true };

				default:
					throw new Error(`Unknown message type: ${message.type}`);
			}
	}
}

/**
 * Handle sending a message to the AI
 */
async function handleSendMessage(
	payload: {
		message: string;
		model: ModelProvider;
		context?: ContextData;
		includeContext: boolean;
	},
	tabId: number
): Promise<ApiResponse> {
	const { message, model, context, includeContext } = payload;

	// Get API keys and preferences
	const apiKeys = await getApiKeys();
	const preferences = await getPreferences();

	// Create connector
	const connector = createConnector(model, apiKeys, {
		ollamaEndpoint: preferences.ollamaEndpoint,
		huggingfaceEndpoint: preferences.huggingfaceEndpoint,
	});

	// Check if connector is available
	if (!connector.isAvailable(apiKeys[model as keyof typeof apiKeys])) {
		throw new Error(
			`${model} is not available. Please configure API key in options.`
		);
	}

	// Get chat history
	const history = await getChatHistory(tabId);

	// Build message list for API (includes system context message)
	const apiMessages: ChatMessage[] = [...history];

	// Add context as system message if provided (only for API, not saved to history)
	if (includeContext && context) {
		const contextPrompt = formatContext(context);
		apiMessages.push({
			id: `context-${Date.now()}`,
			role: 'system',
			content: `You are helping the user interact with a web page. Here's the page context:\n\n${contextPrompt}\n\n═══════════════════════════════════════════════════════════════\nCRITICAL: YOU CAN DIRECTLY INTERACT WITH THE PAGE!\n═══════════════════════════════════════════════════════════════\n\nYou can FILL FORMS and CLICK BUTTONS directly on the page! Use the special action format below.\n\n═══════════════════════════════════════════════════════════════\nACTION 1: FILL FORMS\n═══════════════════════════════════════════════════════════════\n\nWhen users ask you to "fill", "populate", "enter data", or "complete" forms, use:\n\n<!--PAGEPILOT_ACTION:FILL_FORM:[{"id":"field-id","value":"data"},{"name":"field-name","value":"data"},{"label":"Field Label","value":"data"}]-->\n\nFORM FILLING RULES:\n1. Each field object needs ONE identifier: "id" (best), "name" (good), or "label" (acceptable)\n2. Always include a "value" for each field\n3. Use the EXACT field labels/names from the form fields list above\n4. For yes/no questions: use "Yes" or "No" as values\n5. For radio buttons: use "true" or "yes" to select them\n6. For checkboxes: use "true" to check, "false" to uncheck\n7. YOU MUST INCLUDE ALL FORM FIELDS from the list above - do not skip any fields!\n8. For date fields: use format "YYYY-MM-DD" (e.g., "2024-01-15")\n9. For time fields: use format "HH:MM" or "HH:MM:SS" (e.g., "14:30")\n10. For number fields: use numeric strings (e.g., "123", "45.67")\n\n═══════════════════════════════════════════════════════════════\nACTION 2: CLICK BUTTONS/ELEMENTS\n═══════════════════════════════════════════════════════════════\n\nWhen users ask you to "click", "press", "submit", or interact with buttons/links, use:\n\n<!--PAGEPILOT_ACTION:CLICK:{"id":"button-id"}-->\n<!--PAGEPILOT_ACTION:CLICK:{"name":"button-name"}-->\n<!--PAGEPILOT_ACTION:CLICK:{"text":"Button Text"}-->\n\nCLICK RULES:\n1. Use ONE identifier: "id" (best), "name" (good), or "text" (acceptable - must match exactly)\n2. Use the EXACT text/name/id from the clickable elements list above\n3. You can chain multiple actions: fill form then click button!\n\n═══════════════════════════════════════════════════════════════\nEXAMPLE - FILL FORM AND CLICK BUTTON:\n═══════════════════════════════════════════════════════════════\n\nUser: "Fill this form with KYC data and click Save and Continue"\n\nYour response:\n"I'll fill the form with the requested data and then click the Save and Continue button.\n\nForm data:\n- Field 1: Value 1\n- Field 2: Value 2\n[...]\n\n<!--PAGEPILOT_ACTION:FILL_FORM:[{"label":"Field 1","value":"Value 1"},{"label":"Field 2","value":"Value 2"},...]-->\n<!--PAGEPILOT_ACTION:CLICK:{"text":"Save and Continue"}-->"\n\n═══════════════════════════════════════════════════════════════\n\nGENERAL CAPABILITIES:\n✓ Fill forms directly (use FILL_FORM action)\n✓ Click buttons/links directly (use CLICK action)\n✓ Chain actions (fill form + click button in one response)\n✓ Answer questions about page content\n✓ Explain page sections\n\nNEVER say you cannot interact with the page - you CAN fill forms and click buttons through the action system!`,
			timestamp: Date.now(),
		});
	}

	// Add user message
	const userMessage: ChatMessage = {
		id: `user-${Date.now()}`,
		role: 'user',
		content: message,
		timestamp: Date.now(),
	};
	apiMessages.push(userMessage);

	// Also add user message to history (but not the system context message)
	const historyMessages = [...history, userMessage];

	// Send to AI
	const request: ApiRequest = {
		messages: apiMessages,
		model,
		context,
	};

	try {
		const response = await connector.sendMessage(request);

		// Save assistant response to history (without system context message)
		const assistantMessage: ChatMessage = {
			id: `assistant-${Date.now()}`,
			role: 'assistant',
			content: response.content,
			timestamp: Date.now(),
			metadata: {
				model,
				tokensUsed: response.tokensUsed,
			},
		};

		historyMessages.push(assistantMessage);
		await saveChatHistory(tabId, historyMessages);

		return response;
	} catch (error) {
		console.error('API Error:', error);
		throw error;
	}
}

/**
 * Format context data for prompt
 */
function formatContext(context: ContextData): string {
	let text = `Page: ${context.title}\nURL: ${context.url}\n\n`;

	if (context.headings.length > 0) {
		text += 'Headings:\n';
		context.headings.forEach((h) => {
			text += `${'  '.repeat(h.level - 1)}${h.text}\n`;
		});
		text += '\n';
	}

	if (context.selectedText) {
		text += `Selected: ${context.selectedText}\n\n`;
	}

	if (context.formFields && context.formFields.length > 0) {
		text += 'Form fields available to fill:\n';
		context.formFields.forEach((f, index) => {
			const fieldInfo = [];
			if (f.id) fieldInfo.push(`id="${f.id}"`);
			if (f.name) fieldInfo.push(`name="${f.name}"`);
			if (f.label) fieldInfo.push(`label="${f.label}"`);
			if (f.type) fieldInfo.push(`type=${f.type}`);
			if (f.placeholder) fieldInfo.push(`placeholder="${f.placeholder}"`);

			text += `${index + 1}. ${
				f.label || f.placeholder || f.name || 'Unlabeled field'
			} (${fieldInfo.join(', ')})\n`;
		});
		text +=
			'\nTo fill these fields, include them in the PAGEPILOT_ACTION marker using id, name, or label to identify each field.\n\n';
	}

	if (context.clickableElements && context.clickableElements.length > 0) {
		text += 'Clickable elements (buttons, links) available to click:\n';
		context.clickableElements.forEach((elem, index) => {
			const elemInfo = [];
			if (elem.id) elemInfo.push(`id="${elem.id}"`);
			if (elem.name) elemInfo.push(`name="${elem.name}"`);
			if (elem.text) elemInfo.push(`text="${elem.text}"`);
			if (elem.type) elemInfo.push(`type="${elem.type}"`);
			if (elem.href) elemInfo.push(`href="${elem.href}"`);

			text += `${index + 1}. ${
				elem.text || elem.id || elem.name || 'Unlabeled element'
			} (${elem.tagName}${
				elemInfo.length > 0 ? `: ${elemInfo.join(', ')}` : ''
			})\n`;
		});
		text +=
			'\nTo click these elements, use the CLICK action marker with id, name, or text to identify the element.\n\n';
	}

	return text;
}

/**
 * Get available models
 */
async function getAvailableModels() {
	try {
		// Import directly to avoid dynamic import issues
		const modelsModule = await import('../shared/models/index.js');
		const models = await modelsModule.getAvailableModels();
		console.log('Background: Available models:', models);
		return { models };
	} catch (error: any) {
		console.error('Background: Error getting available models:', error);
		console.error('Error stack:', error?.stack);
		throw error;
	}
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
	if (!tab.id) return;

	// Try to send message, with retry logic
	let retries = 3;
	let lastError: any = null;

	for (let i = 0; i < retries; i++) {
		try {
			// Send message to content script to toggle chat
			await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_CHAT' });
			return; // Success!
		} catch (error) {
			lastError = error;
			console.log(
				`Attempt ${i + 1} failed, content script may not be ready:`,
				error
			);

			// Try to inject content script if it's not loaded
			try {
				console.log('Attempting to inject content script...');
				await chrome.scripting.executeScript({
					target: { tabId: tab.id },
					files: ['content.js'],
				});

				console.log('Content script injected, waiting for initialization...');
				// Give the script time to initialize its message listener
				// Increased wait time to ensure listener is registered
				await new Promise((resolve) => setTimeout(resolve, 500));

				// Try sending message again after injection
				console.log('Sending TOGGLE_CHAT message to injected script...');
				await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_CHAT' });
				console.log('Message sent successfully!');
				return; // Success after injection!
			} catch (injectError: any) {
				// If injection fails with permission error, the page might not allow scripting
				if (
					injectError?.message?.includes('Cannot access') ||
					injectError?.message?.includes('chrome://')
				) {
					console.error('Cannot inject script on this page:', tab.url);
					return;
				}

				// Otherwise, wait and retry
				if (i < retries - 1) {
					await new Promise((resolve) => setTimeout(resolve, 300));
				}
			}
		}
	}

	console.error('Failed to toggle chat after retries:', lastError);
});

// Extension installation/setup
chrome.runtime.onInstalled.addListener((details) => {
	if (details.reason === 'install') {
		// Open options page on first install
		chrome.runtime.openOptionsPage();
	}
});
