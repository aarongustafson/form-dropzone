import { FormDropzoneElement } from './form-dropzone.js';

export function defineFormDropzone(tagName = 'form-dropzone') {
	const hasWindow = typeof window !== 'undefined';
	const registry = hasWindow ? window.customElements : undefined;

	if (!registry || typeof registry.define !== 'function') {
		return false;
	}

	if (!registry.get(tagName)) {
		registry.define(tagName, FormDropzoneElement);
	}

	return true;
}

defineFormDropzone();
