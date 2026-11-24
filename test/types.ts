import type {
	FormDropzoneElement,
	FormDropzoneDropEvent,
	FormDropzoneLabels,
} from '@aarongustafson/form-dropzone';

const zone = document.createElement('form-dropzone');
const labels: FormDropzoneLabels = {
	'received-message': { one: 'One: {files}', other: '{count}: {files}' },
};
const config = document.createElement('script');
config.textContent = JSON.stringify(labels);
const refreshed: boolean = zone.refresh();
const enhanced: boolean = zone.enhanced;
const onDrop = function (
	this: FormDropzoneElement,
	event: FormDropzoneDropEvent,
) {
	const accepted: readonly File[] = event.detail.accepted;
	const input: HTMLInputElement = event.detail.input;
	console.log(this.enhanced, accepted, input);
};
zone.addEventListener('form-dropzone:drop', onDrop);
zone.removeEventListener('form-dropzone:drop', onDrop, { capture: false });
zone.addEventListener('click', (event) => {
	const click: MouseEvent = event;
	console.log(click.clientX);
});
zone.removeEventListener('keydown', (event) => {
	const keydown: KeyboardEvent = event;
	console.log(keydown.key);
});
zone.removeEventListener('application:event', { handleEvent: console.log });
// @ts-expect-error Enhancement state is read-only.
zone.enhanced = false;
console.log(refreshed, enhanced);
