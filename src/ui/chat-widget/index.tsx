/**
 * Chat widget entry point
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWidget } from './ChatWidget';
import '../styles.css';

// Get tab ID from URL or use a default
const urlParams = new URLSearchParams(window.location.search);
const tabId = parseInt(urlParams.get('tabId') || '0', 10);

const container = document.getElementById('root');
if (!container) {
	throw new Error('Root container not found');
}

const root = createRoot(container);
root.render(
	<React.StrictMode>
		<ChatWidget
			onClose={() => {
				// Close the widget by sending message to parent window (content script)
				if (window.parent) {
					window.parent.postMessage({ type: 'CLOSE_CHAT_WIDGET' }, '*');
				} else {
					// Fallback: try regular window.postMessage
					window.postMessage({ type: 'CLOSE_CHAT_WIDGET' }, '*');
				}
			}}
			tabId={tabId}
		/>
	</React.StrictMode>
);
