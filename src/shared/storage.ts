/**
 * Storage utilities for Chrome extension storage API
 */

import { ApiKeys, UserPreferences, ChatMessage, ExtensionState } from './types';
import { STORAGE_KEYS, DEFAULT_MODEL } from './constants';

/**
 * Get API keys from storage
 */
export async function getApiKeys(): Promise<ApiKeys> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.API_KEYS);
	return (result[STORAGE_KEYS.API_KEYS] as ApiKeys) || {};
}

/**
 * Save API keys to storage
 */
export async function saveApiKeys(keys: Partial<ApiKeys>): Promise<void> {
	const current = await getApiKeys();
	await chrome.storage.local.set({
		[STORAGE_KEYS.API_KEYS]: { ...current, ...keys },
	});
}

/**
 * Get user preferences from storage
 */
export async function getPreferences(): Promise<UserPreferences> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.PREFERENCES);
	const defaults: UserPreferences = {
		defaultModel: DEFAULT_MODEL,
		privacyMode: true,
		autoContextExtraction: true,
		theme: 'auto',
	};
	return {
		...defaults,
		...((result[STORAGE_KEYS.PREFERENCES] as UserPreferences) || {}),
	};
}

/**
 * Save user preferences to storage
 */
export async function savePreferences(
	prefs: Partial<UserPreferences>
): Promise<void> {
	const current = await getPreferences();
	await chrome.storage.local.set({
		[STORAGE_KEYS.PREFERENCES]: { ...current, ...prefs },
	});
}

/**
 * Get chat history for current tab
 */
export async function getChatHistory(tabId: number): Promise<ChatMessage[]> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.CHAT_HISTORY);
	const history =
		(result[STORAGE_KEYS.CHAT_HISTORY] as Record<number, ChatMessage[]>) || {};
	return history[tabId] || [];
}

/**
 * Save chat history for current tab
 */
export async function saveChatHistory(
	tabId: number,
	messages: ChatMessage[]
): Promise<void> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.CHAT_HISTORY);
	const history =
		(result[STORAGE_KEYS.CHAT_HISTORY] as Record<number, ChatMessage[]>) || {};
	history[tabId] = messages;
	await chrome.storage.local.set({
		[STORAGE_KEYS.CHAT_HISTORY]: history,
	});
}

/**
 * Get extension state
 */
export async function getExtensionState(
	tabId: number
): Promise<ExtensionState | null> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.EXTENSION_STATE);
	const states =
		(result[STORAGE_KEYS.EXTENSION_STATE] as Record<number, ExtensionState>) ||
		{};
	return states[tabId] || null;
}

/**
 * Save extension state
 */
export async function saveExtensionState(
	tabId: number,
	state: Partial<ExtensionState>
): Promise<void> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.EXTENSION_STATE);
	const states =
		(result[STORAGE_KEYS.EXTENSION_STATE] as Record<number, ExtensionState>) ||
		{};
	const current = states[tabId] || {
		isOpen: false,
		position: { x: 100, y: 100 }, // Default position
		isDragging: false,
		currentModel: DEFAULT_MODEL,
	};
	states[tabId] = { ...current, ...state };
	await chrome.storage.local.set({
		[STORAGE_KEYS.EXTENSION_STATE]: states,
	});
}
