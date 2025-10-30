/**
 * Content script - Injects chat widget into pages
 */

// Import context extractor statically - will be bundled by Vite
import { extractContext } from '../shared/context-extractor';

console.log('PagePilot: Content script loading...');

let widgetFrame: HTMLIFrameElement | null = null;
let isWidgetOpen = false;

// Register message listener immediately - this must be synchronous
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	console.log('PagePilot: Received message:', message.type);
	// Handle async responses
	const handleMessage = async () => {
		try {
			switch (message.type) {
				case 'TOGGLE_CHAT':
					await toggleChat();
					return { success: true };
				case 'OPEN_CHAT':
					await openChat();
					return { success: true };
				case 'CLOSE_CHAT':
					closeChat();
					return { success: true };
				default:
					return { error: 'Unknown message type' };
			}
		} catch (error) {
			console.error('Content script message handler error:', error);
			return {
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	};

	// Call handler and send response
	handleMessage()
		.then(sendResponse)
		.catch((error) => {
			console.error('Content script error:', error);
			sendResponse({ error: error.message || 'Unknown error' });
		});

	return true; // Keep channel open for async response
});

// Listen for messages from the widget iframe
window.addEventListener('message', async (event) => {
	// Verify message is from our extension
	if (event.data.type === 'CLOSE_CHAT_WIDGET') {
		closeChat();
		return;
	}

	// Handle context extraction requests from widget
	if (event.data.type === 'EXTRACT_CONTEXT') {
		try {
			// Use statically imported extractContext
			const context = extractContext(false);

			// Send context back to widget
			if (widgetFrame?.contentWindow) {
				widgetFrame.contentWindow.postMessage(
					{
						type: 'CONTEXT_EXTRACTED',
						context,
					},
					'*'
				);
			}
		} catch (error) {
			console.error('PagePilot: Failed to extract context:', error);
			if (widgetFrame?.contentWindow) {
				widgetFrame.contentWindow.postMessage(
					{
						type: 'CONTEXT_EXTRACTED',
						context: null,
						error:
							error instanceof Error
								? error.message
								: 'Failed to extract context',
					},
					'*'
				);
			}
		}
	}

	// Handle click element requests from widget
	if (event.data.type === 'CLICK_ELEMENT') {
		try {
			const { target, confirm } = event.data;
			if (!confirm) {
				// Request confirmation (already handled by widget)
				return;
			}

			// Actually click the element
			const result = clickElement(target);

			if (widgetFrame?.contentWindow) {
				widgetFrame.contentWindow.postMessage(
					{
						type: 'CLICK_RESULT',
						success: result.success,
						elementText: result.elementText,
						error: result.error,
					},
					'*'
				);
			}
		} catch (error) {
			console.error('PagePilot: Failed to click element:', error);
			if (widgetFrame?.contentWindow) {
				widgetFrame.contentWindow.postMessage(
					{
						type: 'CLICK_RESULT',
						success: false,
						error:
							error instanceof Error
								? error.message
								: 'Failed to click element',
					},
					'*'
				);
			}
		}
		return;
	}

	// Handle highlight element requests from widget
	if (event.data.type === 'HIGHLIGHT_ELEMENT') {
		try {
			const { target } = event.data as {
				target: { id?: string; name?: string; text?: string };
			};

			const element = findElementForTarget(target);
			if (!element) {
				if (widgetFrame?.contentWindow) {
					widgetFrame.contentWindow.postMessage(
						{
							type: 'HIGHLIGHT_RESULT',
							success: false,
							error: 'Element not found',
						},
						'*'
					);
				}
				return;
			}

			highlightElement(element);

			if (widgetFrame?.contentWindow) {
				widgetFrame.contentWindow.postMessage(
					{
						type: 'HIGHLIGHT_RESULT',
						success: true,
						elementText:
							element.textContent?.trim() ||
							(element as HTMLInputElement).value?.trim() ||
							'(element)',
					},
					'*'
				);
			}
		} catch (error) {
			console.error('PagePilot: Failed to highlight element:', error);
			if (widgetFrame?.contentWindow) {
				widgetFrame.contentWindow.postMessage(
					{
						type: 'HIGHLIGHT_RESULT',
						success: false,
						error:
							error instanceof Error
								? error.message
								: 'Failed to highlight element',
					},
					'*'
				);
			}
		}
		return;
	}

	// Handle form filling requests from widget
	if (event.data.type === 'FILL_FORM') {
		try {
			const { fields, confirm } = event.data;
			if (!confirm) {
				// Request confirmation
				if (widgetFrame?.contentWindow) {
					widgetFrame.contentWindow.postMessage(
						{
							type: 'FILL_FORM_CONFIRM',
							fields,
						},
						'*'
					);
				}
				return;
			}

			// Actually fill the form
			const result = fillFormFields(fields);

			if (widgetFrame?.contentWindow) {
				widgetFrame.contentWindow.postMessage(
					{
						type: 'FILL_FORM_RESULT',
						success: result.success,
						filled: result.filled,
						failed: result.failed,
					},
					'*'
				);
			}
		} catch (error) {
			console.error('PagePilot: Failed to fill form:', error);
			if (widgetFrame?.contentWindow) {
				widgetFrame.contentWindow.postMessage(
					{
						type: 'FILL_FORM_RESULT',
						success: false,
						error:
							error instanceof Error ? error.message : 'Failed to fill form',
					},
					'*'
				);
			}
		}
	}
});

/**
 * Toggle chat widget visibility
 */
async function toggleChat() {
	if (isWidgetOpen) {
		closeChat();
	} else {
		await openChat();
	}
}

/**
 * Open chat widget
 */
async function openChat() {
	if (isWidgetOpen && widgetFrame) {
		return; // Already open
	}

	try {
		// Get current tab ID
		const response = await new Promise<{ tab?: chrome.tabs.Tab }>((resolve) => {
			chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB' }, resolve);
		});

		const tabId = response?.tab?.id || 0;
		const widgetUrl = chrome.runtime.getURL(`chat-widget.html?tabId=${tabId}`);

		console.log('PagePilot: Opening chat widget at', widgetUrl);

		// Create iframe with side panel style (docked to right, like Chrome DevTools)
		widgetFrame = document.createElement('iframe');
		widgetFrame.id = 'pagepilot-widget';
		widgetFrame.src = widgetUrl;
		widgetFrame.allow = 'clipboard-read; clipboard-write';
		widgetFrame.style.cssText = `
			position: fixed !important;
			top: 0 !important;
			right: 0 !important;
			bottom: 0 !important;
			width: 420px !important;
			height: 100vh !important;
			z-index: 2147483647 !important;
			border: none !important;
			border-left: 1px solid #e5e7eb !important;
			border-radius: 0 !important;
			pointer-events: auto !important;
			background: white !important;
			box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1), -2px 0 4px -1px rgba(0, 0, 0, 0.06) !important;
			display: block !important;
			visibility: visible !important;
			opacity: 1 !important;
		`;

		// Add resize handle for the side panel
		const resizeHandle = document.createElement('div');
		resizeHandle.id = 'pagepilot-resize-handle';
		resizeHandle.style.cssText = `
			position: fixed !important;
			top: 0 !important;
			right: 420px !important;
			bottom: 0 !important;
			width: 4px !important;
			z-index: 2147483648 !important;
			cursor: col-resize !important;
			background: transparent !important;
			user-select: none !important;
		`;

		// Resize functionality
		let isResizing = false;
		const startResize = () => {
			isResizing = true;
			document.body.style.cursor = 'col-resize';
			document.body.style.userSelect = 'none';
		};

		const doResize = (e: MouseEvent) => {
			if (!isResizing || !widgetFrame || !resizeHandle) return;
			const newWidth = window.innerWidth - e.clientX;
			const minWidth = 300;
			const maxWidth = 800;

			if (newWidth >= minWidth && newWidth <= maxWidth) {
				widgetFrame.style.width = `${newWidth}px`;
				resizeHandle.style.right = `${newWidth}px`;
			}
		};

		const stopResize = () => {
			isResizing = false;
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		};

		resizeHandle.addEventListener('mousedown', startResize);
		document.addEventListener('mousemove', doResize);
		document.addEventListener('mouseup', stopResize);

		// Add error handler
		widgetFrame.onerror = (error) => {
			console.error('PagePilot: Iframe error:', error);
		};

		// Check if iframe loads successfully
		widgetFrame.onload = () => {
			console.log('PagePilot: Iframe loaded successfully');
			if (!widgetFrame) return;
			try {
				// Check if the iframe document is accessible
				const iframeDoc =
					widgetFrame.contentDocument || widgetFrame.contentWindow?.document;
				if (iframeDoc) {
					console.log('PagePilot: Iframe document accessible');
				}
			} catch (e) {
				console.log(
					'PagePilot: Cannot access iframe document (cross-origin, expected)'
				);
			}
		};

		// Ensure body is ready before appending
		await ensureBodyReady();

		// Append to body
		if (!document.body) {
			throw new Error('Document body not available');
		}

		document.body.appendChild(widgetFrame);
		document.body.appendChild(resizeHandle);
		isWidgetOpen = true;
		saveWidgetState(true);

		// Adjust page content to make room for side panel
		document.body.style.marginRight = '420px';

		console.log('PagePilot: Chat side panel opened');
	} catch (error) {
		console.error('PagePilot: Failed to open chat widget:', error);
	}
}

/**
 * Close chat widget
 */
function closeChat() {
	if (widgetFrame) {
		widgetFrame.remove();
		widgetFrame = null;
	}
	const resizeHandle = document.getElementById('pagepilot-resize-handle');
	if (resizeHandle) {
		resizeHandle.remove();
	}
	// Restore original body margin
	document.body.style.marginRight = '';
	isWidgetOpen = false;
	saveWidgetState(false);
}

/**
 * Save widget state to storage
 */
async function saveWidgetState(_open: boolean): Promise<void> {
	// Widget state is tracked locally in content script
	// Can be extended to persist via background if needed
	void _open; // Mark as intentionally unused
}

// Keyboard shortcut to toggle chat (Ctrl/Cmd + Shift + P)
document.addEventListener('keydown', (e) => {
	if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
		e.preventDefault();
		toggleChat();
	}
});

// Ensure body exists before trying to append anything
function ensureBodyReady(): Promise<void> {
	return new Promise((resolve) => {
		if (document.body) {
			resolve();
			return;
		}
		// Wait for body to be ready
		const observer = new MutationObserver(() => {
			if (document.body) {
				observer.disconnect();
				resolve();
			}
		});
		observer.observe(document.documentElement, { childList: true });

		// Fallback timeout
		setTimeout(() => {
			observer.disconnect();
			resolve();
		}, 1000);
	});
}

/**
 * Click an element on the page
 */
function clickElement(target: { id?: string; name?: string; text?: string }): {
	success: boolean;
	elementText?: string;
	error?: string;
} {
	try {
		let element: HTMLElement | null = null;

		// Try to find element by ID first
		if (target.id) {
			element = document.getElementById(target.id);
		}

		// Try by name if not found
		if (!element && target.name) {
			element = document.querySelector(
				`[name="${target.name}"]`
			) as HTMLElement | null;
			// Also try buttons and inputs with this name
			if (!element) {
				element = document.querySelector(
					`button[name="${target.name}"], input[name="${target.name}"]`
				) as HTMLElement | null;
			}
		}

		// Try by text content if not found
		if (!element && target.text) {
			// Find buttons, links, or clickable elements with matching text
			const allClickables = document.querySelectorAll(
				'button, a, input[type="button"], input[type="submit"], [role="button"]'
			);

			for (const clickable of allClickables) {
				const text = clickable.textContent?.trim();
				if (
					text &&
					(text.toLowerCase() === target.text.toLowerCase() ||
						text.toLowerCase().includes(target.text.toLowerCase()))
				) {
					element = clickable as HTMLElement;
					break;
				}
			}

			// Also try exact text match for more precision
			if (!element) {
				const exactMatch = Array.from(allClickables).find((elem) => {
					const text = elem.textContent?.trim();
					return text && text === target.text;
				});
				if (exactMatch) {
					element = exactMatch as HTMLElement;
				}
			}
		}

		if (!element) {
			return {
				success: false,
				error: `Could not find element with ${
					target.id ? `id="${target.id}"` : ''
				}${target.name ? `name="${target.name}"` : ''}${
					target.text ? `text="${target.text}"` : ''
				}`,
			};
		}

		// Check if element is visible and clickable
		const style = window.getComputedStyle(element);
		if (style.display === 'none' || style.visibility === 'hidden') {
			return {
				success: false,
				error: 'Element is not visible',
			};
		}

		const elementText =
			element.textContent?.trim() ||
			(element as HTMLInputElement).value?.trim() ||
			target.text ||
			target.id ||
			target.name ||
			'element';

		// Scroll element into view
		element.scrollIntoView({ behavior: 'smooth', block: 'center' });

		// Wait a bit for scroll, then click
		setTimeout(() => {
			// Create and dispatch click event
			const clickEvent = new MouseEvent('click', {
				bubbles: true,
				cancelable: true,
				view: window,
			});

			// Also trigger mousedown/mouseup for better compatibility
			element?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
			element?.dispatchEvent(clickEvent);
			element?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

			// For form buttons, also trigger submit if it's inside a form
			if (
				element.tagName === 'BUTTON' ||
				((element as HTMLInputElement).type === 'submit' &&
					element.tagName === 'INPUT')
			) {
				const form = element.closest('form');
				if (form) {
					// Don't actually submit - let the click handle it
					// But trigger a submit event for compatibility
					setTimeout(() => {
						const submitEvent = new Event('submit', {
							bubbles: true,
							cancelable: true,
						});
						form.dispatchEvent(submitEvent);
					}, 100);
				}
			}

			// For links, we might want to navigate, but let the click handle it
			if (element.tagName === 'A' && (element as HTMLAnchorElement).href) {
				// The click event should handle navigation
			}
		}, 200);

		return {
			success: true,
			elementText,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: 'Unknown error clicking element',
		};
	}
}

/**
 * Fill form fields on the page
 */
function fillFormFields(
	fields: Array<{ id?: string; name?: string; label?: string; value: string }>
): { success: boolean; filled: number; failed: number } {
	let filled = 0;
	let failed = 0;

	fields.forEach((field) => {
		try {
			let element:
				| HTMLInputElement
				| HTMLTextAreaElement
				| HTMLSelectElement
				| null = null;

			// Try to find element by ID first
			if (field.id) {
				element = document.getElementById(field.id) as
					| HTMLInputElement
					| HTMLTextAreaElement
					| HTMLSelectElement
					| null;
			}

			// Try by name if not found
			// For radio buttons, we need to handle groups specially
			if (!element && field.name) {
				// First check if there are radio buttons with this name (radio group)
				const radioGroup = document.querySelectorAll(
					`input[type="radio"][name="${field.name}"]`
				) as NodeListOf<HTMLInputElement>;

				if (radioGroup.length > 0) {
					// For radio buttons, find the one that matches the value
					// If value is 'true' or 'yes', select the first radio in the group
					// Otherwise, try to match by value or label text
					let selectedRadio: HTMLInputElement | null = null;

					if (field.value === 'true' || field.value === 'yes') {
						// Select the first radio (or first "Yes" radio if available)
						const yesRadio = Array.from(radioGroup).find(
							(r) =>
								r.value.toLowerCase() === 'yes' ||
								r.value.toLowerCase() === 'true' ||
								(r.labels &&
									r.labels.length > 0 &&
									r.labels[0]?.textContent?.toLowerCase().includes('yes'))
						);
						selectedRadio = yesRadio || radioGroup[0];
					} else {
						// Try to match by value or label
						selectedRadio =
							Array.from(radioGroup).find(
								(r) =>
									r.value.toLowerCase() === field.value.toLowerCase() ||
									(r.labels &&
										r.labels.length > 0 &&
										r.labels[0]?.textContent
											?.toLowerCase()
											.includes(field.value.toLowerCase()))
							) || null;

						// If still not found, select first radio
						if (!selectedRadio) {
							selectedRadio = radioGroup[0];
						}
					}

					element = selectedRadio;
				} else {
					// Not a radio group, try normal input
					element = document.querySelector(`[name="${field.name}"]`) as
						| HTMLInputElement
						| HTMLTextAreaElement
						| HTMLSelectElement
						| null;
				}
			}

			// Try by label text if not found
			if (!element && field.label) {
				const labels = Array.from(document.querySelectorAll('label'));
				const matchingLabels = labels.filter((label) =>
					label.textContent
						?.toLowerCase()
						.includes(field.label?.toLowerCase() || '')
				);

				// Look for radio buttons first (they're often in groups with similar labels)
				if (matchingLabels.length > 0) {
					for (const labelElement of matchingLabels) {
						const forAttr = labelElement.getAttribute('for');
						let candidate:
							| HTMLInputElement
							| HTMLTextAreaElement
							| HTMLSelectElement
							| null = null;

						if (forAttr) {
							candidate = document.getElementById(forAttr) as
								| HTMLInputElement
								| HTMLTextAreaElement
								| HTMLSelectElement
								| null;
						}

						// Also check if label wraps the input
						if (!candidate && labelElement.parentElement) {
							candidate = labelElement.parentElement.querySelector(
								'input, textarea, select'
							) as
								| HTMLInputElement
								| HTMLTextAreaElement
								| HTMLSelectElement
								| null;
						}

						// If we found a radio button, check if it's part of a group
						if (
							candidate instanceof HTMLInputElement &&
							candidate.type === 'radio'
						) {
							const radioName = candidate.name;
							if (radioName) {
								// We have a radio group - find the right one to select
								const radioGroup = document.querySelectorAll(
									`input[type="radio"][name="${radioName}"]`
								) as NodeListOf<HTMLInputElement>;

								if (radioGroup.length > 0) {
									// Match by the label text of this specific radio
									const matchingRadio = Array.from(radioGroup).find((r) => {
										// Check if this radio's labels match
										if (r.labels && r.labels.length > 0) {
											for (let i = 0; i < r.labels.length; i++) {
												if (
													r.labels[i]?.textContent
														?.toLowerCase()
														.includes(field.label?.toLowerCase() || '')
												) {
													return true;
												}
											}
										}
										// Or check if value matches
										return r.value.toLowerCase() === field.value.toLowerCase();
									});

									if (matchingRadio) {
										element = matchingRadio;
										break;
									}
								}
							}
						}

						if (candidate && !element) {
							element = candidate;
							// For radio buttons found by label, make sure we're selecting the right one
							if (
								element instanceof HTMLInputElement &&
								element.type === 'radio'
							) {
								// We already handled radio groups above, so this is fine
								break;
							}
						}
					}
				}
			}

			if (!element) {
				console.warn(`PagePilot: Could not find field:`, field);
				failed++;
				return;
			}

			// Fill the field based on its type
			if (element instanceof HTMLInputElement) {
				if (element.type === 'radio') {
					// For radio buttons, just check it (browser handles unchecking others)
					element.checked = true;
					element.dispatchEvent(new Event('change', { bubbles: true }));
					element.dispatchEvent(new Event('input', { bubbles: true }));
					filled++;
				} else if (element.type === 'checkbox') {
					// For checkboxes, check if we want to check or uncheck
					const shouldCheck =
						field.value === 'true' ||
						field.value === 'yes' ||
						field.value === '1' ||
						field.value.toLowerCase() === 'checked';
					element.checked = shouldCheck;
					element.dispatchEvent(new Event('change', { bubbles: true }));
					element.dispatchEvent(new Event('input', { bubbles: true }));
					filled++;
				} else if (element.type === 'number') {
					// For number inputs, validate and set numeric value
					const numValue = Number(field.value);
					if (!isNaN(numValue)) {
						element.value = field.value;
						element.dispatchEvent(new Event('input', { bubbles: true }));
						element.dispatchEvent(new Event('change', { bubbles: true }));
						filled++;
					} else {
						failed++;
					}
				} else if (element.type === 'date') {
					// For date inputs, format as YYYY-MM-DD
					element.value = field.value; // Should already be in correct format
					element.dispatchEvent(new Event('input', { bubbles: true }));
					element.dispatchEvent(new Event('change', { bubbles: true }));
					filled++;
				} else if (element.type === 'time') {
					// For time inputs, format as HH:MM or HH:MM:SS
					element.value = field.value; // Should already be in correct format
					element.dispatchEvent(new Event('input', { bubbles: true }));
					element.dispatchEvent(new Event('change', { bubbles: true }));
					filled++;
				} else if (element.type === 'datetime-local') {
					// For datetime-local inputs
					element.value = field.value;
					element.dispatchEvent(new Event('input', { bubbles: true }));
					element.dispatchEvent(new Event('change', { bubbles: true }));
					filled++;
				} else if (element.type === 'email') {
					// For email inputs
					element.value = field.value;
					element.dispatchEvent(new Event('input', { bubbles: true }));
					element.dispatchEvent(new Event('change', { bubbles: true }));
					filled++;
				} else if (element.type === 'url') {
					// For URL inputs
					element.value = field.value;
					element.dispatchEvent(new Event('input', { bubbles: true }));
					element.dispatchEvent(new Event('change', { bubbles: true }));
					filled++;
				} else if (element.type === 'tel') {
					// For telephone inputs
					element.value = field.value;
					element.dispatchEvent(new Event('input', { bubbles: true }));
					element.dispatchEvent(new Event('change', { bubbles: true }));
					filled++;
				} else if (element.type === 'color') {
					// For color inputs
					element.value = field.value;
					element.dispatchEvent(new Event('input', { bubbles: true }));
					element.dispatchEvent(new Event('change', { bubbles: true }));
					filled++;
				} else if (element.type === 'range') {
					// For range inputs
					const numValue = Number(field.value);
					if (!isNaN(numValue)) {
						element.value = field.value;
						element.dispatchEvent(new Event('input', { bubbles: true }));
						element.dispatchEvent(new Event('change', { bubbles: true }));
						filled++;
					} else {
						failed++;
					}
				} else {
					// For text, search, password, and other text-like inputs
					element.value = field.value;
					element.dispatchEvent(new Event('input', { bubbles: true }));
					element.dispatchEvent(new Event('change', { bubbles: true }));
					filled++;
				}
			} else if (element instanceof HTMLTextAreaElement) {
				element.value = field.value;
				element.dispatchEvent(new Event('input', { bubbles: true }));
				element.dispatchEvent(new Event('change', { bubbles: true }));
				filled++;
			} else if (element instanceof HTMLSelectElement) {
				// Try to find option by value or text
				const option = Array.from(element.options).find(
					(opt) =>
						opt.value === field.value ||
						opt.text.toLowerCase().includes(field.value.toLowerCase())
				);
				if (option) {
					element.value = option.value;
					element.dispatchEvent(new Event('change', { bubbles: true }));
					filled++;
				} else {
					failed++;
				}
			}
		} catch (error) {
			console.error(`PagePilot: Error filling field:`, field, error);
			failed++;
		}
	});

	return {
		success: filled > 0,
		filled,
		failed,
	};
}

/**
 * Find element helper using id, name, or visible text
 */
function findElementForTarget(target: { id?: string; name?: string; text?: string }): HTMLElement | null {
	let element: HTMLElement | null = null;

	if (target.id) {
		element = document.getElementById(target.id);
	}

	if (!element && target.name) {
		element = document.querySelector(
			`[name="${target.name}"]`
		) as HTMLElement | null;
		if (!element) {
			element = document.querySelector(
				`button[name="${target.name}"], input[name="${target.name}"]`
			) as HTMLElement | null;
		}
	}

	if (!element && target.text) {
		const lc = target.text.toLowerCase();

		// 1) Clickables by visible text
		if (!element) {
			const allClickables = document.querySelectorAll(
				'button, a, input[type="button"], input[type="submit"], [role="button"]'
			);
			for (const clickable of allClickables) {
				const text = clickable.textContent?.trim()?.toLowerCase();
				if (text && (text === lc || text.includes(lc))) {
					element = clickable as HTMLElement;
					break;
				}
			}
		}

		// 2) Label text → associated input/textarea/select
		if (!element) {
			const labels = Array.from(document.querySelectorAll('label'));
			for (const label of labels) {
				const ltext = label.textContent?.trim()?.toLowerCase() || '';
				if (ltext && (ltext === lc || ltext.includes(lc))) {
					const forId = label.getAttribute('for');
					if (forId) {
						const byFor = document.getElementById(forId) as HTMLElement | null;
						if (byFor) {
							element = byFor;
							break;
						}
					}
					// wrapped input
					const wrapped = label.querySelector('input, textarea, select') as HTMLElement | null;
					if (wrapped) {
						element = wrapped;
						break;
					}
				}
			}
		}

		// 3) Inputs by placeholder / aria-label
		if (!element) {
			const inputs = Array.from(document.querySelectorAll('input, textarea, select')) as HTMLElement[];
			for (const inp of inputs) {
				const placeholder = (inp as HTMLInputElement).placeholder?.toLowerCase?.() || '';
				const aria = inp.getAttribute('aria-label')?.toLowerCase() || '';
				if ((placeholder && (placeholder === lc || placeholder.includes(lc))) ||
					(aria && (aria === lc || aria.includes(lc)))) {
					element = inp;
					break;
				}
			}
		}

		// 4) Inputs by ancestor text content (form-group containers)
		if (!element) {
			const inputs = Array.from(document.querySelectorAll('input, textarea, select')) as HTMLElement[];
			const MAX_DEPTH = 4;
			for (const inp of inputs) {
				let current: HTMLElement | null = inp;
				let depth = 0;
				let matched = false;
				while (current && depth < MAX_DEPTH) {
					const text = current.textContent?.toLowerCase() || '';
					if (text && (text === lc || text.includes(lc))) {
						matched = true;
						break;
					}
					current = current.parentElement;
					depth++;
				}
				if (matched) {
					element = inp;
					break;
				}
			}
		}
	}

	return element;
}

/**
 * Scroll element into view and highlight briefly
 */
function highlightElement(element: HTMLElement) {
	try {
		element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		const prevOutline = element.style.outline;
		const prevBoxShadow = element.style.boxShadow;
		element.style.transition = element.style.transition
			? `${element.style.transition}, outline 0.2s ease, box-shadow 0.2s ease`
			: 'outline 0.2s ease, box-shadow 0.2s ease';
		element.style.outline = '3px solid #f59e0b';
		element.style.boxShadow = '0 0 0 4px rgba(245, 158, 11, 0.35)';
		setTimeout(() => {
			element.style.outline = prevOutline;
			element.style.boxShadow = prevBoxShadow;
		}, 3000);
	} catch (e) {
		console.warn('PagePilot: Failed to highlight element:', e);
	}
}

// ---- NAVIGATION & DOM CHANGE CONTEXT REFRESH ----
function notifyContextChange() {
	if (widgetFrame?.contentWindow) {
		widgetFrame.contentWindow.postMessage(
			{ type: 'CONTEXT_UPDATE_NEEDED' },
			'*'
		);
		console.log('PagePilot: Notified widget of context update');
	}
}

// Listen for navigation events
window.addEventListener('popstate', notifyContextChange);
window.addEventListener('hashchange', notifyContextChange);
window.addEventListener('pageshow', notifyContextChange);
window.addEventListener('DOMContentLoaded', notifyContextChange);

// Catch SPA navigations that use history.pushState/replaceState
const _originalPushState = history.pushState;
const _originalReplaceState = history.replaceState;
history.pushState = function (...args) {
	const result = _originalPushState.apply(this, args as unknown as [any, string, string | URL | null | undefined]);
	window.dispatchEvent(new Event('pushstate'));
	// Also notify directly to be safe
	notifyContextChange();
	return result;
};
history.replaceState = function (...args) {
	const result = _originalReplaceState.apply(this, args as unknown as [any, string, string | URL | null | undefined]);
	window.dispatchEvent(new Event('replacestate'));
	// Also notify directly to be safe
	notifyContextChange();
	return result;
};
window.addEventListener('pushstate', notifyContextChange);
window.addEventListener('replacestate', notifyContextChange);

let lastUrl = window.location.href;
let lastDomSignature = 0;
let domChangeTimer: number | null = null;

function getDomSignature(): number {
	try {
		// Use text length as a lightweight proxy for major DOM changes
		return (document.body?.innerText?.length || 0);
	} catch {
		return 0;
	}
}

// Initialize DOM signature when possible
if (document.body) {
	lastDomSignature = getDomSignature();
} else {
	window.addEventListener('DOMContentLoaded', () => {
		lastDomSignature = getDomSignature();
	});
}

const mutationObserver = new MutationObserver((_mutations) => {
	// If URL changed, always notify immediately
	if (window.location.href !== lastUrl) {
		lastUrl = window.location.href;
		notifyContextChange();
		// Reset signature on navigation
		lastDomSignature = getDomSignature();
		return;
	}

	// Debounce DOM change detection to avoid spamming
	if (domChangeTimer !== null) {
		window.clearTimeout(domChangeTimer);
	}
	// Wait a short moment for DOM to settle
	domChangeTimer = window.setTimeout(() => {
		const currentSig = getDomSignature();
		// Consider it a major change if the text length changed significantly
		const delta = Math.abs(currentSig - lastDomSignature);
		const THRESHOLD = 200; // characters difference considered significant
		if (delta >= THRESHOLD) {
			lastDomSignature = currentSig;
			notifyContextChange();
		}
		domChangeTimer = null;
	}, 500);
});
function observeForContextUpdates() {
	if (document.body) {
		mutationObserver.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: false,
		});
	}
}
if (document.readyState === 'complete' || document.body) {
	observeForContextUpdates();
} else {
	window.addEventListener('DOMContentLoaded', observeForContextUpdates);
}

// Signal that content script is ready
console.log('PagePilot: Content script loaded and ready');
