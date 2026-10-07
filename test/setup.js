import { beforeAll } from 'vitest';
import { FormDropzoneElement } from '../form-dropzone.js';

// Define the custom element before tests run
beforeAll(() => {
	if (!customElements.get('form-dropzone')) {
		customElements.define('form-dropzone', FormDropzoneElement);
	}

	// Make the class available globally for testing static methods
	globalThis.FormDropzoneElement = FormDropzoneElement;
});
