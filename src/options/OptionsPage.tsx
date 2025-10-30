/**
 * Options page for API key management and preferences
 */

import React, { useState, useEffect } from 'react';
import { ApiKeys, UserPreferences, ModelProvider } from '@/shared/types';
import {
	saveApiKeys,
	getApiKeys,
	savePreferences,
	getPreferences,
} from '@/shared/storage';
import { MODEL_CONFIGS } from '@/shared/constants';

export const OptionsPage: React.FC = () => {
	const [apiKeys, setApiKeys] = useState<ApiKeys>({});
	const [preferences, setPreferences] = useState<UserPreferences>({
		defaultModel: 'free',
		privacyMode: true,
		autoContextExtraction: true,
		theme: 'auto',
	});
	const [saved, setSaved] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});

	useEffect(() => {
		loadSettings();
	}, []);

	const loadSettings = async () => {
		const keys = await getApiKeys();
		const prefs = await getPreferences();
		setApiKeys(keys);
		setPreferences(prefs);
	};

	const handleApiKeyChange = (provider: keyof ApiKeys, value: string) => {
		setApiKeys((prev) => ({ ...prev, [provider]: value }));
		setErrors((prev) => ({ ...prev, [provider]: '' }));
	};

	const handlePreferenceChange = <K extends keyof UserPreferences>(
		key: K,
		value: UserPreferences[K]
	) => {
		setPreferences((prev) => ({ ...prev, [key]: value }));
	};

	const handleSave = async () => {
		setErrors({});
		const newErrors: Record<string, string> = {};

		// Validate API keys if provided
		if (apiKeys.openai && apiKeys.openai.length < 10) {
			newErrors.openai = 'OpenAI API key appears to be invalid';
		}
		if (apiKeys.anthropic && apiKeys.anthropic.length < 10) {
			newErrors.anthropic = 'Anthropic API key appears to be invalid';
		}

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			return;
		}

		try {
			await saveApiKeys(apiKeys);
			await savePreferences(preferences);
			setSaved(true);
			setTimeout(() => setSaved(false), 3000);
		} catch (error) {
			console.error('Failed to save settings:', error);
			alert('Failed to save settings. Please try again.');
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
			<div className="max-w-4xl mx-auto">
				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
					<h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
						PagePilot Settings
					</h1>
					<p className="text-gray-600 dark:text-gray-400 mb-6">
						Configure your AI providers and preferences
					</p>

					{/* Success Message */}
					{saved && (
						<div className="mb-4 p-3 bg-green-100 dark:bg-green-900/20 border border-green-400 text-green-700 dark:text-green-400 rounded">
							Settings saved successfully!
						</div>
					)}

					{/* API Keys Section */}
					<section className="mb-8">
						<h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
							API Keys
						</h2>
						<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
							Enter your API keys to enable AI providers. Keys are stored
							locally in your browser.
						</p>

						<div className="space-y-4">
							{/* OpenAI */}
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									OpenAI API Key (for ChatGPT)
								</label>
								<input
									type="password"
									value={apiKeys.openai || ''}
									onChange={(e) => handleApiKeyChange('openai', e.target.value)}
									placeholder="sk-..."
									className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white ${
										errors.openai
											? 'border-red-500'
											: 'border-gray-300 dark:border-gray-600'
									}`}
								/>
								{errors.openai && (
									<p className="text-sm text-red-600 dark:text-red-400 mt-1">
										{errors.openai}
									</p>
								)}
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
									Get your key at{' '}
									<a
										href="https://platform.openai.com/api-keys"
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary-600 dark:text-primary-400 hover:underline"
									>
										platform.openai.com
									</a>
								</p>
							</div>

							{/* Anthropic */}
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Anthropic API Key (for Claude)
								</label>
								<input
									type="password"
									value={apiKeys.anthropic || ''}
									onChange={(e) =>
										handleApiKeyChange('anthropic', e.target.value)
									}
									placeholder="sk-ant-..."
									className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white ${
										errors.anthropic
											? 'border-red-500'
											: 'border-gray-300 dark:border-gray-600'
									}`}
								/>
								{errors.anthropic && (
									<p className="text-sm text-red-600 dark:text-red-400 mt-1">
										{errors.anthropic}
									</p>
								)}
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
									Get your key at{' '}
									<a
										href="https://console.anthropic.com"
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary-600 dark:text-primary-400 hover:underline"
									>
										console.anthropic.com
									</a>
								</p>
							</div>
						</div>
					</section>

					{/* Local Models Section */}
					<section className="mb-8">
						<h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
							Local Models
						</h2>
						<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
							Configure local AI models for privacy.
						</p>

						<div className="space-y-4">
							{/* Ollama */}
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Ollama Endpoint
								</label>
								<input
									type="text"
									value={preferences.ollamaEndpoint || 'http://localhost:11434'}
									onChange={(e) =>
										handlePreferenceChange('ollamaEndpoint', e.target.value)
									}
									placeholder="http://localhost:11434"
									className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
								/>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
									Install Ollama from{' '}
									<a
										href="https://ollama.ai"
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary-600 dark:text-primary-400 hover:underline"
									>
										ollama.ai
									</a>
								</p>
							</div>

							{/* HuggingFace */}
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									HuggingFace Endpoint (optional)
								</label>
								<input
									type="text"
									value={preferences.huggingfaceEndpoint || ''}
									onChange={(e) =>
										handlePreferenceChange(
											'huggingfaceEndpoint',
											e.target.value
										)
									}
									placeholder="https://api-inference.huggingface.co/models/..."
									className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
								/>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
									Leave empty to use default free endpoint
								</p>
							</div>
						</div>
					</section>

					{/* Preferences Section */}
					<section className="mb-8">
						<h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
							Preferences
						</h2>

						<div className="space-y-4">
							{/* Default Model */}
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Default Model
								</label>
								<select
									value={preferences.defaultModel}
									onChange={(e) =>
										handlePreferenceChange(
											'defaultModel',
											e.target.value as ModelProvider
										)
									}
									className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
								>
									{Object.entries(MODEL_CONFIGS).map(([key, config]) => (
										<option key={key} value={key}>
											{config.name}
										</option>
									))}
								</select>
							</div>

							{/* Privacy Mode */}
							<div className="flex items-center justify-between">
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
										Privacy Mode
									</label>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										Require approval before sending page data externally
									</p>
								</div>
								<input
									type="checkbox"
									checked={preferences.privacyMode}
									onChange={(e) =>
										handlePreferenceChange('privacyMode', e.target.checked)
									}
									className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
								/>
							</div>

							{/* Auto Context Extraction */}
							<div className="flex items-center justify-between">
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
										Auto Context Extraction
									</label>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										Automatically extract page context when opening chat
									</p>
								</div>
								<input
									type="checkbox"
									checked={preferences.autoContextExtraction}
									onChange={(e) =>
										handlePreferenceChange(
											'autoContextExtraction',
											e.target.checked
										)
									}
									className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
								/>
							</div>

							{/* Theme */}
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Theme
								</label>
								<select
									value={preferences.theme}
									onChange={(e) =>
										handlePreferenceChange(
											'theme',
											e.target.value as 'light' | 'dark' | 'auto'
										)
									}
									className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
								>
									<option value="auto">Auto (system)</option>
									<option value="light">Light</option>
									<option value="dark">Dark</option>
								</select>
							</div>
						</div>
					</section>

					{/* Save Button */}
					<div className="flex justify-end gap-4">
						<button
							onClick={handleSave}
							className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
						>
							Save Settings
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
