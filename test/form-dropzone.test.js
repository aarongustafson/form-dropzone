import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormDropzoneElement } from '../form-dropzone.js';

const createDropzone = ({
	attributes = '',
	inputAttributes = '',
	label = 'Choose files',
} = {}) => {
	const element = document.createElement('form-dropzone');
	element.innerHTML = `
		<label for="attachments">${label}</label>
		<input id="attachments" name="attachments" type="file" ${inputAttributes}>
	`;

	if (attributes) {
		const wrapper = document.createElement('div');
		wrapper.innerHTML = `<form-dropzone ${attributes}></form-dropzone>`;
		for (const attribute of wrapper.firstElementChild.attributes) {
			element.setAttribute(attribute.name, attribute.value);
		}
	}

	document.body.appendChild(element);
	return element;
};

const createTransfer = (files) => {
	const transfer = new DataTransfer();
	for (const file of files) {
		transfer.items.add(file);
	}
	return transfer;
};

const dispatchDrag = (element, type, transfer = new DataTransfer()) => {
	const event = new DragEvent(type, {
		bubbles: true,
		cancelable: true,
	});
	Object.defineProperty(event, 'dataTransfer', { value: transfer });
	element.dispatchEvent(event);
	return event;
};

describe('FormDropzoneElement', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		document.body.innerHTML = '';
	});

	it('is defined without creating a shadow root', () => {
		const element = new FormDropzoneElement();

		expect(customElements.get('form-dropzone')).toBe(FormDropzoneElement);
		expect(element).toBeInstanceOf(HTMLElement);
		expect(element.shadowRoot).toBeNull();
	});

	it('enhances an associated label and file input in Light DOM', () => {
		const element = createDropzone();

		expect(element.classList.contains('form-dropzone--enhanced')).toBe(
			true,
		);
		expect(
			element.querySelector('.form-dropzone__prompt').textContent,
		).toBe('Drop file(s) here');
		expect(
			element.querySelector('.form-dropzone__separator').textContent,
		).toBe('or');
		const status = element.querySelector('.form-dropzone__status');
		expect(status.getAttribute('role')).toBe('status');
		expect(status.getAttribute('aria-live')).toBe('polite');
		expect(status.getAttribute('aria-atomic')).toBe('true');
		expect(element.querySelector('label').textContent).toBe('Choose files');
		expect(element.querySelector('input[type="file"]')).toBeTruthy();
	});

	it('does not mutate markup when drag and drop is unsupported', () => {
		vi.stubGlobal('DataTransfer', undefined);
		const element = document.createElement('form-dropzone');
		element.innerHTML = `
			<label for="attachments">Choose files</label>
			<input id="attachments" type="file">
		`;
		const originalMarkup = element.innerHTML;

		document.body.appendChild(element);

		expect(element.innerHTML).toBe(originalMarkup);
		expect(element.classList.contains('form-dropzone--enhanced')).toBe(
			false,
		);
	});

	it.each([
		['a missing input', '<label for="attachments">Choose files</label>'],
		[
			'a missing label',
			'<input id="attachments" name="attachments" type="file">',
		],
		[
			'an unassociated label',
			'<label for="other">Choose files</label><input id="attachments" type="file">',
		],
	])('leaves %s unchanged and reports the authoring error', (_, markup) => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const element = document.createElement('form-dropzone');
		element.innerHTML = markup;

		document.body.appendChild(element);

		expect(element.innerHTML).toBe(markup);
		expect(element.classList.contains('form-dropzone--enhanced')).toBe(
			false,
		);
		expect(warn).toHaveBeenCalledOnce();
	});

	it('supports a label that wraps the file input', () => {
		const element = document.createElement('form-dropzone');
		element.innerHTML = `
			<label>
				Choose files
				<input name="attachments" type="file">
			</label>
		`;

		document.body.appendChild(element);

		expect(element.classList.contains('form-dropzone--enhanced')).toBe(
			true,
		);
	});

	it('does not duplicate generated content when reconnected', () => {
		const element = createDropzone();

		element.remove();
		document.body.appendChild(element);

		expect(element.querySelectorAll('.form-dropzone__prompt')).toHaveLength(
			1,
		);
		expect(
			element.querySelectorAll('.form-dropzone__separator'),
		).toHaveLength(1);
		expect(element.querySelectorAll('.form-dropzone__status')).toHaveLength(
			1,
		);
	});

	describe('localized text properties', () => {
		it.each([
			['dropLabel', 'drop-label', 'Drop file(s) here'],
			['separatorLabel', 'separator-label', 'or'],
			['receivedMessage', 'received-message', 'Received: {files}.'],
			[
				'rejectedTypeMessage',
				'rejected-type-message',
				'Rejected because the file type is not accepted: {files}.',
			],
			[
				'rejectedMultipleMessage',
				'rejected-multiple-message',
				'Rejected because only one file is allowed: {files}.',
			],
		])(
			'exposes %s with a default and reflects it through %s',
			(property, attribute, defaultValue) => {
				const element = new FormDropzoneElement();

				expect(element[property]).toBe(defaultValue);
				element[property] = 'Localized {count}: {files}';
				expect(element.getAttribute(attribute)).toBe(
					'Localized {count}: {files}',
				);
				element[property] = null;
				expect(element.hasAttribute(attribute)).toBe(false);
				expect(element[property]).toBe(defaultValue);
			},
		);

		it('updates generated prompt text when attributes change', () => {
			const element = createDropzone();

			element.dropLabel = 'Déposez les fichiers ici';
			element.separatorLabel = 'ou';

			expect(
				element.querySelector('.form-dropzone__prompt').textContent,
			).toBe('Déposez les fichiers ici');
			expect(
				element.querySelector('.form-dropzone__separator').textContent,
			).toBe('ou');
		});
	});

	describe('picker and drag interactions', () => {
		it('opens the picker from a drop-zone surface click only', () => {
			const element = createDropzone();
			const input = element.querySelector('input');
			const click = vi.spyOn(input, 'click').mockImplementation(() => {});

			element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			expect(click).toHaveBeenCalledOnce();

			element
				.querySelector('label')
				.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			input.dispatchEvent(new MouseEvent('click', { bubbles: true }));

			expect(click).toHaveBeenCalledOnce();
		});

		it('keeps drag-active state until nested drag targets have left', () => {
			const element = createDropzone();
			const child = element.querySelector('.form-dropzone__prompt');
			const transfer = createTransfer([
				new File(['hello'], 'hello.txt', { type: 'text/plain' }),
			]);

			dispatchDrag(element, 'dragenter', transfer);
			dispatchDrag(child, 'dragenter', transfer);
			expect(
				element.classList.contains('form-dropzone--drag-active'),
			).toBe(true);

			dispatchDrag(child, 'dragleave', transfer);
			expect(
				element.classList.contains('form-dropzone--drag-active'),
			).toBe(true);

			dispatchDrag(element, 'dragleave', transfer);
			expect(
				element.classList.contains('form-dropzone--drag-active'),
			).toBe(false);
		});

		it('prevents dragover only when files are present', () => {
			const element = createDropzone();
			const files = createTransfer([
				new File(['hello'], 'hello.txt', { type: 'text/plain' }),
			]);
			const text = new DataTransfer();
			text.setData('text/plain', 'hello');

			expect(
				dispatchDrag(element, 'dragover', files).defaultPrevented,
			).toBe(true);
			expect(
				dispatchDrag(element, 'dragover', text).defaultPrevented,
			).toBe(false);
		});
	});

	describe('dropped file routing', () => {
		it('matches extensions and exact or wildcard MIME types', () => {
			const element = createDropzone({
				inputAttributes: 'accept=".png, image/jpeg, text/*" multiple',
			});
			const input = element.querySelector('input');
			const files = [
				new File(['png'], 'DIAGRAM.PNG', {
					type: 'application/octet-stream',
				}),
				new File(['jpg'], 'photo.jpg', { type: 'image/jpeg' }),
				new File(['text'], 'notes.md', { type: 'text/markdown' }),
				new File(['pdf'], 'document.pdf', {
					type: 'application/pdf',
				}),
			];

			dispatchDrag(element, 'drop', createTransfer(files));

			expect(Array.from(input.files, (file) => file.name)).toEqual([
				'DIAGRAM.PNG',
				'photo.jpg',
				'notes.md',
			]);
		});

		it('accepts all file types when accept is absent', () => {
			const element = createDropzone({ inputAttributes: 'multiple' });
			const input = element.querySelector('input');
			const files = [
				new File(['one'], 'one.bin'),
				new File(['two'], 'two.pdf', { type: 'application/pdf' }),
			];

			dispatchDrag(element, 'drop', createTransfer(files));

			expect(Array.from(input.files, (file) => file.name)).toEqual([
				'one.bin',
				'two.pdf',
			]);
		});

		it('uses the first acceptable file when multiple is absent', () => {
			const element = createDropzone({
				inputAttributes: 'accept="image/*"',
			});
			const input = element.querySelector('input');
			const files = [
				new File(['bad'], 'notes.txt', { type: 'text/plain' }),
				new File(['first'], 'first.png', { type: 'image/png' }),
				new File(['second'], 'second.jpg', { type: 'image/jpeg' }),
			];

			dispatchDrag(element, 'drop', createTransfer(files));

			expect(Array.from(input.files, (file) => file.name)).toEqual([
				'first.png',
			]);
		});

		it('preserves the current selection when every dropped file is rejected', () => {
			const element = createDropzone({
				inputAttributes: 'accept="image/*"',
			});
			const input = element.querySelector('input');
			input.files = createTransfer([
				new File(['existing'], 'existing.png', {
					type: 'image/png',
				}),
			]).files;

			dispatchDrag(
				element,
				'drop',
				createTransfer([
					new File(['bad'], 'notes.txt', { type: 'text/plain' }),
				]),
			);

			expect(Array.from(input.files, (file) => file.name)).toEqual([
				'existing.png',
			]);
		});

		it('dispatches bubbling input and change events after assignment', () => {
			const element = createDropzone();
			const input = element.querySelector('input');
			const inputEvent = vi.fn();
			const changeEvent = vi.fn();
			element.addEventListener('input', inputEvent);
			element.addEventListener('change', changeEvent);

			dispatchDrag(
				element,
				'drop',
				createTransfer([
					new File(['hello'], 'hello.txt', { type: 'text/plain' }),
				]),
			);

			expect(inputEvent).toHaveBeenCalledOnce();
			expect(inputEvent.mock.calls[0][0].target).toBe(input);
			expect(changeEvent).toHaveBeenCalledOnce();
			expect(changeEvent.mock.calls[0][0].target).toBe(input);
		});
	});

	describe('accessible announcements', () => {
		it('announces accepted and rejected files from a mixed drop', async () => {
			const element = createDropzone({
				inputAttributes: 'accept="image/*"',
			});
			const files = [
				new File(['bad'], 'notes.txt', { type: 'text/plain' }),
				new File(['first'], 'first.png', { type: 'image/png' }),
				new File(['second'], 'second.jpg', { type: 'image/jpeg' }),
			];

			dispatchDrag(element, 'drop', createTransfer(files));
			await Promise.resolve();

			expect(
				element.querySelector('.form-dropzone__status').textContent,
			).toBe(
				'Received: first.png. Rejected because the file type is not accepted: notes.txt. Rejected because only one file is allowed: second.jpg.',
			);
		});

		it('announces a drop when every file is rejected', async () => {
			const element = createDropzone({
				inputAttributes: 'accept=".png" multiple',
			});

			dispatchDrag(
				element,
				'drop',
				createTransfer([
					new File(['pdf'], 'document.pdf', {
						type: 'application/pdf',
					}),
				]),
			);
			await Promise.resolve();

			expect(
				element.querySelector('.form-dropzone__status').textContent,
			).toBe(
				'Rejected because the file type is not accepted: document.pdf.',
			);
		});

		it('uses current localized templates and replaces all tokens', async () => {
			const element = createDropzone({
				attributes:
					'received-message="Accepted {count}: {files} ({count} total)"',
				inputAttributes: 'multiple',
			});
			element.receivedMessage =
				'Added {files}; count {count}; files {files}.';

			dispatchDrag(
				element,
				'drop',
				createTransfer([
					new File(['one'], 'one.txt', { type: 'text/plain' }),
					new File(['two'], 'two.txt', { type: 'text/plain' }),
				]),
			);
			await Promise.resolve();

			expect(
				element.querySelector('.form-dropzone__status').textContent,
			).toBe('Added one.txt, two.txt; count 2; files one.txt, two.txt.');
		});
	});

	describe('image previews', () => {
		let createObjectURL;
		let revokeObjectURL;

		beforeEach(() => {
			createObjectURL = vi
				.spyOn(URL, 'createObjectURL')
				.mockImplementation((file) => `blob:${file.name}`);
			revokeObjectURL = vi
				.spyOn(URL, 'revokeObjectURL')
				.mockImplementation(() => {});
		});

		it('does not create a preview container unless opted in', () => {
			const element = createDropzone();

			expect(
				element.querySelector('.form-dropzone__previews'),
			).toBeNull();
		});

		it('previews only images selected with the native picker', () => {
			const element = createDropzone({
				attributes: 'preview-images',
				inputAttributes: 'multiple',
			});
			const input = element.querySelector('input');
			input.files = createTransfer([
				new File(['image'], 'photo.png', { type: 'image/png' }),
				new File(['text'], 'notes.txt', { type: 'text/plain' }),
			]).files;

			input.dispatchEvent(new Event('change', { bubbles: true }));

			const preview = element.querySelector('.form-dropzone__preview');
			expect(
				element.querySelector('.form-dropzone__previews').tagName,
			).toBe('UL');
			expect(
				element.querySelectorAll('.form-dropzone__preview'),
			).toHaveLength(1);
			expect(
				preview.querySelector('.form-dropzone__preview-image'),
			).toMatchObject({
				alt: '',
				src: 'blob:photo.png',
			});
			expect(
				preview.querySelector('.form-dropzone__preview-name')
					.textContent,
			).toBe('photo.png');
		});

		it('synchronizes previews after a drop', () => {
			const element = createDropzone({
				attributes: 'preview-images',
				inputAttributes: 'accept="image/*" multiple',
			});

			dispatchDrag(
				element,
				'drop',
				createTransfer([
					new File(['one'], 'one.png', { type: 'image/png' }),
					new File(['two'], 'two.jpg', { type: 'image/jpeg' }),
				]),
			);

			expect(
				Array.from(
					element.querySelectorAll('.form-dropzone__preview-name'),
					(node) => node.textContent,
				),
			).toEqual(['one.png', 'two.jpg']);
		});

		it('renders an existing selection when previews are enabled later', () => {
			const element = createDropzone({ inputAttributes: 'multiple' });
			const input = element.querySelector('input');
			input.files = createTransfer([
				new File(['image'], 'later.png', { type: 'image/png' }),
			]).files;

			element.previewImages = true;

			expect(
				element.querySelector('.form-dropzone__preview-name')
					.textContent,
			).toBe('later.png');
		});

		it('revokes old URLs when previews are replaced or disabled', () => {
			const element = createDropzone({
				attributes: 'preview-images',
				inputAttributes: 'multiple',
			});
			const input = element.querySelector('input');
			input.files = createTransfer([
				new File(['one'], 'one.png', { type: 'image/png' }),
			]).files;
			input.dispatchEvent(new Event('change', { bubbles: true }));

			input.files = createTransfer([
				new File(['two'], 'two.png', { type: 'image/png' }),
			]).files;
			input.dispatchEvent(new Event('change', { bubbles: true }));

			expect(revokeObjectURL).toHaveBeenCalledWith('blob:one.png');
			element.previewImages = false;
			expect(revokeObjectURL).toHaveBeenCalledWith('blob:two.png');
			expect(
				element.querySelector('.form-dropzone__previews'),
			).toBeNull();
		});

		it('revokes preview URLs when disconnected', () => {
			const element = createDropzone({
				attributes: 'preview-images',
			});
			const input = element.querySelector('input');
			input.files = createTransfer([
				new File(['image'], 'cleanup.png', { type: 'image/png' }),
			]).files;
			input.dispatchEvent(new Event('change', { bubbles: true }));

			element.remove();

			expect(createObjectURL).toHaveBeenCalledWith(input.files[0]);
			expect(revokeObjectURL).toHaveBeenCalledWith('blob:cleanup.png');
		});
	});
});
