import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { expectNativeFocus, readDemoStyles } from './demo-fixture.js';

test.beforeEach(async ({ page }) => {
	await page.route(
		'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/**',
		(route) => route.abort(),
	);
	await page.route(
		'https://cdn.jsdelivr.net/npm/@aarongustafson/tabbed-interface@3.0.4/**',
		(route) => route.abort(),
	);
});

const source = await readFile(
	new URL('../../form-dropzone.js', import.meta.url),
	'utf8',
);
const demoCSS = await readDemoStyles();
const definitionSource = await readFile(
	new URL('../../define.js', import.meta.url),
	'utf8',
);
const tokens = [
	'Canvas',
	'CanvasText',
	'ButtonFace',
	'ButtonText',
	'Field',
	'FieldText',
];
// The study's 62 observations reduce to these 19 token palettes.
// Substitution checks authored CSS, not actual forced-color repainting.
const palettes = [
	['#ffffff', '#000000', '#efefef', '#000000', '#ffffff', '#000000'],
	['#121212', '#ffffff', '#6b6b6b', '#ffffff', '#3b3b3b', '#ffffff'],
	['#ffffff', '#000000', '#e9e9ed', '#000000', '#ffffff', '#000000'],
	['#1c1b22', '#fbfbfe', '#2b2a33', '#fbfbfe', '#2b2a33', '#fbfbfe'],
	['#ffffff', '#000000', '#c0c0c0', '#000000d8', '#ffffff', '#000000d8'],
	['#1e1e1e', '#ffffff', '#ffffff3f', '#ffffffd8', '#ffffff3f', '#ffffffd8'],
	['#ffffff', '#000000', '#f0f0f0', '#000000', '#ffffff', '#000000'],
	['#202020', '#ffffff', '#202020', '#ffffff', '#202020', '#ffffff'],
	['#fffaef', '#3d3d3d', '#fffaef', '#202020', '#fffaef', '#3d3d3d'],
	['#2d3236', '#ffffff', '#2d3236', '#b6f6f0', '#2d3236', '#ffffff'],
	['#000000', '#ffffff', '#000000', '#ffee32', '#000000', '#ffffff'],
	['#000000', '#ffffff', '#000000', '#ffee32', '#000000', '#ffee32'],
	['#2d3236', '#ffffff', '#2d3236', '#b6f6f0', '#2d3236', '#b6f6f0'],
	['#fffaef', '#3d3d3d', '#fffaef', '#202020', '#fffaef', '#202020'],
	['#ffffff', '#000000', '#c0c0c0', '#000000', '#ffffff', '#000000'],
	['#000000', '#ffffff', '#c0c0c0', '#000000', '#ffffff', '#000000'],
	['#ffffff', '#000000', '#ffffff', '#000000d8', '#ffffff', '#000000d8'],
	['#282828', '#ffffff', '#202020', '#ffffff', '#202020', '#ffffff'],
	['#202020', '#ffffff', '#00000000', '#ffffff', '#00000000', '#ffffff'],
];

function substitute(css, palette) {
	const colors = Object.fromEntries(
		tokens.map((token, index) => [token, palette[index]]),
	);
	return css.replace(
		/\b(CanvasText|Canvas|ButtonFace|ButtonText|FieldText|Field)\b/g,
		(token) => colors[token],
	);
}

async function measurements(locator, pseudo = null) {
	return locator.evaluate((element, pseudo) => {
		const canvas = document.createElement('canvas');
		canvas.width = 1;
		canvas.height = 1;
		const context = canvas.getContext('2d', { willReadFrequently: true });
		if (!context) throw new Error('Canvas measurement unavailable.');
		const pixel = () => [...context.getImageData(0, 0, 1, 1).data];
		const paint = (color) => {
			context.fillStyle = color;
			context.fillRect(0, 0, 1, 1);
			return pixel();
		};
		const background = (node) => {
			context.clearRect(0, 0, 1, 1);
			const ancestors = [];
			for (; node; node = node.parentElement) ancestors.unshift(node);
			for (const ancestor of ancestors) {
				const style = getComputedStyle(ancestor);
				paint(style.backgroundColor);
				if (style.backgroundImage !== 'none') {
					const wash = style.backgroundImage.match(
						/^linear-gradient\((.+), \1\)$/,
					);
					if (!wash)
						throw new Error(
							`Unsupported background: ${style.backgroundImage}`,
						);
					paint(wash[1]);
				}
			}
			if (pixel()[3] !== 255)
				throw new Error('Expected opaque measurement surface.');
			return pixel();
		};
		const luminance = (rgb) =>
			rgb.slice(0, 3).reduce((sum, channel, index) => {
				const value = channel / 255;
				return (
					sum +
					(value <= 0.04045
						? value / 12.92
						: ((value + 0.055) / 1.055) ** 2.4) *
						[0.2126, 0.7152, 0.0722][index]
				);
			}, 0);
		const ratio = (a, b) => {
			const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
			return (values[0] + 0.05) / (values[1] + 0.05);
		};
		const style = getComputedStyle(element, pseudo);
		let fill = background(element);
		if (pseudo) fill = paint(style.backgroundColor);
		const foreground = paint(style.color);
		const surround = background(pseudo ? element : element.parentElement);
		const border = paint(style.borderTopColor);
		const paintsBorder =
			parseFloat(style.borderTopWidth) > 0 &&
			!['none', 'hidden'].includes(style.borderTopStyle);
		return {
			text: ratio(foreground, fill),
			boundary: Math.max(
				ratio(fill, surround),
				paintsBorder ? ratio(border, surround) : 1,
			),
		};
	}, pseudo);
}

async function drag(
	host,
	type,
	files = [{ name: 'report.pdf', type: 'application/pdf' }],
) {
	await host.evaluate(
		(element, { type, files }) => {
			const dataTransfer = new DataTransfer();
			for (const file of files)
				dataTransfer.items.add(
					new File(['sample'], file.name, { type: file.type }),
				);
			element.dispatchEvent(
				new DragEvent(type, {
					bubbles: true,
					cancelable: true,
					dataTransfer,
				}),
			);
		},
		{ type, files },
	);
}

for (const demo of ['index.html', 'esm.html', 'unpkg.html']) {
	test(`${demo}: every example has its own fragment destination`, async ({
		page,
	}) => {
		await page.goto(`/demo/${demo}`);
		const ids = await page
			.locator('[id]')
			.evaluateAll((elements) => elements.map((element) => element.id));
		expect(new Set(ids).size).toBe(ids.length);
		const examples = page.locator('.demo-section');
		expect(await examples.count()).toBeGreaterThan(0);
		for (const example of await examples.all()) {
			const id = await example.getAttribute('id');
			expect(id).toMatch(/^[a-z][a-z0-9]+(?:-[a-z0-9]+)+$/);
			await page.evaluate((id) => {
				location.hash = id;
			}, id);
			await expect(example).toBeInViewport();
			await expect(example.locator('h2, h3').first()).toBeVisible();
			await expect(example.locator('.code-demo-pair')).toHaveCount(1);
		}
	});
}

test('form reset synchronizes previews and cancels stale drop announcements without changing focus', async ({
	page,
}) => {
	await page.goto('/test/browser/fixture.html');
	await page.evaluate(() => {
		document.body.innerHTML = `<form id="reset-form"><form-dropzone preview-images>
			<label for="reset-file">Choose an image</label>
			<input id="reset-file" name="image" type="file" accept="image/*">
		</form-dropzone><button type="reset">Reset</button></form>`;
	});
	const zone = page.locator('form-dropzone');
	await drag(zone, 'drop', [{ name: 'photo.png', type: 'image/png' }]);
	await expect(zone.locator('.form-dropzone__preview')).toHaveCount(1);
	await expect(zone.getByRole('status')).toContainText('photo.png');
	const reset = page.getByRole('button', { name: 'Reset', exact: true });
	await reset.focus();
	await page.keyboard.press('Space');
	await expect
		.poll(() =>
			zone.locator('input').evaluate((input) => input.files.length),
		)
		.toBe(0);
	await expect(zone.locator('.form-dropzone__preview')).toHaveCount(0);
	await expect(zone.getByRole('status')).toBeEmpty();
	await expect(reset).toBeFocused();
});

test('a pending reset does not erase newer drop feedback', async ({ page }) => {
	await page.goto('/test/browser/fixture.html');
	const zone = page.locator('form-dropzone');
	await zone.evaluate((element) => {
		element.querySelector('input').form.reset();
		const transfer = new DataTransfer();
		transfer.items.add(
			new File(['pdf'], 'new.pdf', { type: 'application/pdf' }),
		);
		element.dispatchEvent(
			new DragEvent('drop', {
				bubbles: true,
				cancelable: true,
				dataTransfer: transfer,
			}),
		);
	});
	await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
	await expect(zone.getByRole('status')).toHaveText('Ready: new.pdf.');
});

test('shared French plural text refreshes without losing native selection, previews, or focus', async ({
	page,
}) => {
	await page.goto('/test/browser/fixture.html');
	const zone = page.locator('form-dropzone');
	await zone.evaluate((element) => {
		const config = document.createElement('script');
		config.type = 'application/json';
		config.dataset.formDropzoneConfig = '';
		config.textContent = JSON.stringify({
			'received-message': {
				one: 'Un fichier : {files}.',
				other: '{count} fichiers : {files}.',
			},
		});
		document.body.lang = 'fr';
		document.body.append(config);
		element.removeAttribute('received-message');
		element.querySelector('input').accept = 'image/*';
		element.querySelector('input').multiple = true;
		element.previewImages = true;
		element.refresh();
	});
	const name = '<img>{count}-$&.png';
	await drag(zone, 'drop', [{ name, type: 'image/png' }]);
	await expect(zone.getByRole('status')).toHaveText(`Un fichier : ${name}.`);
	await expect(zone.locator('.form-dropzone__status img')).toHaveCount(0);
	const input = zone.locator('input');
	const original = await input.elementHandle();
	const previewURL = await zone
		.locator('.form-dropzone__preview-image')
		.getAttribute('src');
	await input.focus();
	expect(
		await zone.evaluate((element) => {
			document.querySelector('[data-form-dropzone-config]').textContent =
				JSON.stringify({
					'drop-label': 'Déposez des images',
					'received-message': {
						one: 'Ajout : {files}.',
						other: '{count} ajouts : {files}.',
					},
				});
			return element.refresh();
		}),
	).toBe(true);
	await expect(input).toBeFocused();
	expect(
		await input.evaluate((node, saved) => node === saved, original),
	).toBe(true);
	expect(await input.evaluate((node) => node.files[0].name)).toBe(name);
	await expect(zone.locator('.form-dropzone__preview-image')).toHaveAttribute(
		'src',
		previewURL,
	);
	await expect(zone.locator('.form-dropzone__prompt')).toHaveText(
		'Déposez des images',
	);
	await drag(zone, 'drop', [
		{ name: 'un.png', type: 'image/png' },
		{ name: 'deux.png', type: 'image/png' },
	]);
	await expect(zone.getByRole('status')).toHaveText(
		'2 ajouts : un.png, deux.png.',
	);
});

test('visible outcome feedback includes all-rejected drops while keeping the selected file', async ({
	page,
}) => {
	await page.goto('/demo/index.html');
	const zone = page.locator('#english-announcements-zone');
	const feedback = page.locator(
		'[data-drop-for="english-announcements-zone"]',
	);
	await drag(zone, 'drop', [
		{ name: 'first.pdf', type: 'application/pdf' },
		{ name: 'no.txt', type: 'text/plain' },
		{ name: 'extra.pdf', type: 'application/pdf' },
	]);
	await expect(feedback.locator('[data-outcome="accepted"]')).toHaveText(
		'first.pdf',
	);
	await expect(feedback.locator('[data-outcome="rejectedType"]')).toHaveText(
		'no.txt',
	);
	await expect(
		feedback.locator('[data-outcome="rejectedMultiple"]'),
	).toHaveText('extra.pdf');
	await drag(zone, 'drop', [{ name: 'another.txt', type: 'text/plain' }]);
	await expect(feedback.locator('[data-outcome="accepted"]')).toHaveText(
		'None',
	);
	await expect(feedback.locator('[data-outcome="rejectedType"]')).toHaveText(
		'another.txt',
	);
	expect(
		await zone
			.locator('input')
			.evaluate((input) => [...input.files].map((file) => file.name)),
	).toEqual(['first.pdf']);
});

test('shared demo defaults select singular/plural forms and allow one-instance overrides', async ({
	page,
}) => {
	await page.goto('/demo/index.html');
	const reports = page.locator('#shared-reports').locator('..');
	const references = page.locator('#shared-references').locator('..');
	await drag(reports, 'drop', [{ name: 'one.pdf', type: 'application/pdf' }]);
	await expect(reports.getByRole('status')).toHaveText(
		'Received one file: one.pdf.',
	);
	await drag(reports, 'drop', [
		{ name: 'one.pdf', type: 'application/pdf' },
		{ name: 'two.pdf', type: 'application/pdf' },
	]);
	await expect(reports.getByRole('status')).toHaveText(
		'Received 2 files: one.pdf, two.pdf.',
	);
	await drag(references, 'drop', [
		{ name: 'reference.png', type: 'image/png' },
	]);
	await expect(references.getByRole('status')).toHaveText(
		'Reference images: reference.png.',
	);
	await page.getByRole('button', { name: 'Clear both selections' }).click();
	await expect(references.locator('.form-dropzone__preview')).toHaveCount(0);
	await expect(reports.getByRole('status')).toBeEmpty();
	await expect(page.locator('[data-log-for="shared-reports"]')).toContainText(
		'No files',
	);
});

test('French selection feedback stays translated after selection and clearing', async ({
	page,
}) => {
	await page.goto('/demo/index.html');
	const input = page.locator('#french-pdf');
	const log = page.locator('[data-log-for="french-pdf"]');
	const name = '<img src=x onerror=alert(1)>.pdf';
	await input.setInputFiles({
		name,
		mimeType: 'application/pdf',
		buffer: Buffer.from('sample'),
	});
	await expect(log).toHaveText(`Sélection : ${name}`);
	await expect(log.locator('img')).toHaveCount(0);
	await input.setInputFiles([]);
	await expect(log).toHaveText('Sélection : Aucun fichier');
});

test('canceled resets keep selected previews and drop feedback', async ({
	page,
}) => {
	await page.goto('/test/browser/fixture.html');
	const zone = page.locator('form-dropzone');
	await zone.evaluate((element) => {
		element.previewImages = true;
		element.querySelector('input').accept = 'image/*';
	});
	await drag(zone, 'drop', [{ name: 'keep.png', type: 'image/png' }]);
	await zone.evaluate((element) => {
		element
			.querySelector('input')
			.form.addEventListener('reset', (event) => event.preventDefault(), {
				once: true,
			});
		element.querySelector('input').form.reset();
	});
	await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
	await expect(zone.locator('.form-dropzone__preview')).toHaveCount(1);
	await expect(zone.getByRole('status')).toContainText('keep.png');
});

test('tracks the native input current external form owner when resetting', async ({
	page,
}) => {
	await page.goto('/test/browser/fixture.html');
	await page.evaluate(() => {
		document.body.innerHTML = `<form id="first"></form><form id="second"></form>
				<form-dropzone preview-images><label for="external">Choose an image</label>
				<input id="external" type="file" accept="image/*" form="first"></form-dropzone>`;
	});
	const zone = page.locator('form-dropzone');
	await drag(zone, 'drop', [{ name: 'external.png', type: 'image/png' }]);
	await zone
		.locator('input')
		.evaluate((input) => input.setAttribute('form', 'second'));
	await page.locator('#first').evaluate((form) => form.reset());
	await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
	await expect(zone.locator('.form-dropzone__preview')).toHaveCount(1);
	await page.locator('#second').evaluate((form) => form.reset());
	await expect(zone.locator('.form-dropzone__preview')).toHaveCount(0);
	await expect(zone.getByRole('status')).toBeEmpty();
});

test('French code and live drop outcomes use the same configuration', async ({
	page,
}) => {
	await page.goto('/demo/index.html');
	const example = page.locator('#french-drop-messages');
	const host = example.locator('form-dropzone');
	await expect(host).toHaveClass(/form-dropzone--enhanced/);
	const code = await example.locator('pre code').textContent();
	for (const attribute of [
		'drop-label',
		'separator-label',
		'received-message',
		'rejected-type-message',
		'rejected-multiple-message',
	]) {
		expect(code).toContain(
			`${attribute}="${await host.getAttribute(attribute)}"`,
		);
	}
	await host.locator('input').focus();
	await page.evaluate(() => {
		window.selectionEvents = [];
		for (const type of ['input', 'change']) {
			document
				.querySelector('#french-pdf')
				.closest('form')
				.addEventListener(type, (event) =>
					window.selectionEvents.push(event.type),
				);
		}
	});
	await drag(host, 'drop', [
		{ name: 'premier.pdf', type: 'application/pdf' },
		{ name: 'second.pdf', type: 'application/pdf' },
		{ name: 'notes.txt', type: 'text/plain' },
	]);
	await expect(host.getByRole('status')).toHaveText(
		'Fichier reçu : premier.pdf. Type refusé : notes.txt. Un seul fichier est autorisé. Refusé : second.pdf.',
	);
	await expect(example.locator('.selection-log')).toHaveText(
		'Sélection : premier.pdf',
	);
	await expect(host.locator('input')).toBeFocused();
	expect(await page.evaluate(() => window.selectionEvents)).toEqual([
		'input',
		'change',
	]);
	await drag(host, 'drop', [{ name: 'audio.mp3', type: 'audio/mpeg' }]);
	await expect(host.getByRole('status')).toHaveText(
		'Type refusé : audio.mp3.',
	);
	await expect(example.locator('.selection-log')).toHaveText(
		'Sélection : premier.pdf',
	);
	expect(await page.evaluate(() => window.selectionEvents)).toEqual([
		'input',
		'change',
	]);
});

for (const [name, background, color] of [
	['light host', '#777', '#000'],
	['dark host', '#767676', '#fff'],
]) {
	test(`${name}: drag preserves a passing authored color pair`, async ({
		page,
	}) => {
		await page.goto('/test/browser/fixture.html');
		await page.locator('body').evaluate(
			(body, colors) => {
				body.style.background = colors.background;
				body.style.color = colors.color;
			},
			{ background, color },
		);
		const host = page.locator('form-dropzone');
		await expect(host).toHaveClass(/form-dropzone--enhanced/);
		const before = await measurements(host);
		expect(before.text).toBeGreaterThanOrEqual(4.5);
		await expect(host).toHaveCSS('border-top-style', 'dashed');
		await drag(host, 'dragenter');
		expect((await measurements(host)).text).toBeGreaterThanOrEqual(4.5);
		await expect(host).toHaveCSS('border-top-style', 'solid');
		await expect(host).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
		await drag(host, 'dragleave');
		await expect(host).toHaveCSS('border-top-style', 'dashed');
	});
}

test('all 19 palettes keep demo text, drag boundaries and file buttons readable', async ({
	page,
}) => {
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto('/demo/index.html');
	await expect(page.locator('.form-dropzone--enhanced')).toHaveCount(9);
	const componentCSS = source.match(/style.textContent = `([\s\S]*?)`;/)[1];
	for (const [index, palette] of palettes.entries()) {
		const style = await page.addStyleTag({
			content: substitute(demoCSS, palette),
		});
		await page.locator('#form-dropzone-styles').evaluate(
			(style, css) => {
				style.textContent = css;
			},
			substitute(componentCSS, palette),
		);
		for (const selector of [
			'.demo-section > p',
			'.selection-log',
			'footer',
			'.api-reference',
			'pre code',
		]) {
			await Promise.all(
				(await page.locator(selector).all()).map(async (element) => {
					expect(
						(await measurements(element)).text,
						`palette ${index}: ${selector}`,
					).toBeGreaterThanOrEqual(4.5);
				}),
			);
		}
		await Promise.all(
			(await page.locator('form-dropzone').all()).map(async (host) => {
				for (const state of ['dragleave', 'dragenter']) {
					await drag(host, state);
					const measured = await measurements(host);
					expect(
						measured.text,
						`palette ${index}: ${state} text`,
					).toBeGreaterThanOrEqual(4.5);
					expect(
						measured.boundary,
						`palette ${index}: ${state} border`,
					).toBeGreaterThanOrEqual(3);
					expect(
						(await measurements(host.locator('input'))).text,
						`palette ${index}: file name`,
					).toBeGreaterThanOrEqual(4.5);
					if (
						await host.evaluate((element) =>
							element.classList.contains('custom-dropzone'),
						)
					)
						expect(
							(
								await measurements(
									host.locator('input'),
									'::file-selector-button',
								)
							).text,
							`palette ${index}: branded picker`,
						).toBeGreaterThanOrEqual(4.5);
				}
			}),
		);
		await style.evaluate((element) => element.remove());
	}
});

for (const scheme of ['light', 'dark']) {
	test(`${scheme}: native control pair contrast`, async ({
		page,
		browserName,
	}) => {
		test.fail(
			browserName === 'webkit' &&
				process.platform === 'linux' &&
				scheme === 'dark',
			'Bundled Ubuntu WebKit has a known low-contrast native dark ButtonText/ButtonFace pair.',
		);
		await page.emulateMedia({ colorScheme: scheme });
		await page.goto('/test/browser/fixture.html');
		const probe = await page.locator('body').evaluateHandle((body) => {
			const span = document.createElement('span');
			span.style.cssText = 'background:ButtonFace;color:ButtonText';
			span.textContent = 'Native control pair';
			body.append(span);
			return span;
		});
		expect((await measurements(probe)).text).toBeGreaterThanOrEqual(4.5);
		await probe.evaluate((element) => element.remove());
	});

	test(`${scheme}: actual demo text retains readable pairs`, async ({
		page,
		browserName,
	}) => {
		await page.emulateMedia({ colorScheme: scheme });
		await page.goto('/demo/index.html');
		await expect(page.locator('.form-dropzone--enhanced')).toHaveCount(9);
		const pair = await page.evaluate(() => {
			const probe = document.createElement('span');
			probe.style.cssText = 'background:ButtonFace;color:ButtonText';
			document.body.append(probe);
			const style = getComputedStyle(probe);
			const result = {
				color: style.color,
				background: style.backgroundColor,
			};
			probe.remove();
			return result;
		});
		for (const element of await page
			.locator(
				'.demo-section > p, .selection-log, footer, .api-reference, pre code, form-dropzone, form-dropzone input',
			)
			.all()) {
			const actual = await element.evaluate((node) => {
				const color = getComputedStyle(node).color;
				let background = getComputedStyle(node).backgroundColor;
				while (background === 'rgba(0, 0, 0, 0)') {
					node = node.parentElement;
					if (!node) throw new Error('Missing opaque demo surface.');
					background = getComputedStyle(node).backgroundColor;
				}
				return { color, background };
			});
			// Only the exact native pair is covered by the separate expected-failure test.
			const knownNativeFailure =
				browserName === 'webkit' &&
				process.platform === 'linux' &&
				scheme === 'dark' &&
				actual.color === pair.color &&
				actual.background === pair.background;
			if (!knownNativeFailure)
				expect(
					(await measurements(element)).text,
				).toBeGreaterThanOrEqual(4.5);
		}
	});

	test(`${scheme}: file input retains native keyboard focus`, async ({
		page,
		browserName,
	}) => {
		await page.emulateMedia({ colorScheme: scheme });
		await page.goto('/demo/index.html');
		await expect(page.locator('.form-dropzone--enhanced')).toHaveCount(9);
		await page.locator('.code-demo-pair pre').first().focus();
		// macOS WebKit needs Option+Tab when full keyboard navigation is off.
		await page.keyboard.press(
			browserName === 'webkit' && process.platform === 'darwin'
				? 'Alt+Tab'
				: 'Tab',
		);
		const input = page.locator('#basic-file');
		await expect(input).toBeFocused();
		await expect(input).toHaveAccessibleName('Choose a file');
		await expectNativeFocus(input);
		await expect(page.locator('form-dropzone').first()).not.toHaveAttribute(
			'tabindex',
		);
	});
}

test('forced colors keep native focus and dashed-to-solid drag state without opt-outs', async ({
	page,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		'Only Chromium supports forced-color emulation.',
	);
	await page.emulateMedia({ forcedColors: 'active' });
	await page.goto('/demo/index.html');
	for (const host of await page.locator('form-dropzone').all()) {
		await expect(host).toHaveClass(/form-dropzone--enhanced/);
		await expect(host).toHaveCSS('forced-color-adjust', 'auto');
		await expect(host).toHaveCSS('border-top-style', 'dashed');
		await expectNativeFocus(host.locator('input'));
		await drag(host, 'dragenter');
		await expect(host).toHaveCSS('border-top-style', 'solid');
		expect((await measurements(host)).text).toBeGreaterThanOrEqual(4.5);
		await drag(host, 'dragleave');
		await expect(host).toHaveCSS('border-top-style', 'dashed');
	}
});

test('increased contrast retains full-strength supporting text', async ({
	page,
}) => {
	await page.emulateMedia({ contrast: 'more' });
	await page.goto('/demo/index.html');
	const color = await page
		.locator('body')
		.evaluate((body) => getComputedStyle(body).color);
	await expect(page.locator('footer')).toHaveCSS('color', color);
});

test('native image selection keeps preview names readable and revokes URLs on cleanup', async ({
	page,
}) => {
	await page.goto('/demo/index.html');
	const host = page.locator('form-dropzone.custom-dropzone');
	await expect(host).toHaveClass(/form-dropzone--enhanced/);
	await page.evaluate(() => {
		const revoke = URL.revokeObjectURL.bind(URL);
		window.revokedPreviewUrls = [];
		URL.revokeObjectURL = (url) => {
			window.revokedPreviewUrls.push(url);
			revoke(url);
		};
	});
	await host.locator('input').setInputFiles({
		name: 'profile.png',
		mimeType: 'image/png',
		buffer: Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0yYAAAAASUVORK5CYII=',
			'base64',
		),
	});
	await expect(host.locator('.form-dropzone__preview-name')).toHaveText(
		'profile.png',
	);
	await expect
		.poll(() => host.locator('img').evaluate((image) => image.naturalWidth))
		.toBe(1);
	expect(
		(await measurements(host.locator('.form-dropzone__preview-name'))).text,
	).toBeGreaterThanOrEqual(4.5);
	const url = await host.locator('img').getAttribute('src');
	await host.evaluate((element) => {
		element.previewImages = false;
	});
	await expect(host.locator('img')).toHaveCount(0);
	expect(await page.evaluate(() => window.revokedPreviewUrls)).toEqual([url]);
	expect(
		await host.locator('input').evaluate((input) => input.files[0].name),
	).toBe('profile.png');
	await host.evaluate((element) => {
		element.previewImages = true;
	});
	const enabledURL = await host.locator('img').getAttribute('src');
	await host.locator('input').setInputFiles({
		name: '<svg onload=alert(1)>.png',
		mimeType: 'image/png',
		buffer: Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0yYAAAAASUVORK5CYII=',
			'base64',
		),
	});
	const replacementURL = await host.locator('img').getAttribute('src');
	expect(replacementURL).not.toBe(enabledURL);
	await expect(host.locator('.form-dropzone__preview-name')).toHaveText(
		'<svg onload=alert(1)>.png',
	);
	await expect(host.locator('svg')).toHaveCount(0);
	expect(await page.evaluate(() => window.revokedPreviewUrls)).toEqual([
		url,
		enabledURL,
	]);
	await host.evaluate((element) => {
		element.remove();
	});
	expect(await page.evaluate(() => window.revokedPreviewUrls)).toEqual([
		url,
		enabledURL,
		replacementURL,
	]);
});

test('drops retain native form data, localized status, rejection recovery and cleanup', async ({
	page,
}) => {
	await page.goto('/test/browser/fixture.html');
	const host = page.locator('form-dropzone');
	await expect(host).toHaveClass(/form-dropzone--enhanced/);
	await host.locator('input').focus();
	await drag(host, 'drop', [
		{ name: 'report.pdf', type: 'application/pdf' },
		{ name: 'second.pdf', type: 'application/pdf' },
		{ name: 'unsafe.txt', type: 'text/plain' },
	]);
	await expect(host.getByRole('status')).toHaveText(
		'Ready: report.pdf. Not accepted: unsafe.txt. Too many: second.pdf.',
	);
	await expect(host.locator('input')).toBeFocused();
	expect(
		await page
			.locator('form')
			.evaluate((form) => new FormData(form).get('attachments').name),
	).toBe('report.pdf');
	await drag(host, 'drop', [
		{ name: '<img onerror=alert(1)>.txt', type: 'text/plain' },
	]);
	await expect(host.getByRole('status')).toContainText(
		'Not accepted: <img onerror=alert(1)>.txt.',
	);
	await expect(host.locator('img')).toHaveCount(0);
	expect(
		await host.locator('input').evaluate((input) => input.files[0].name),
	).toBe('report.pdf');
	await drag(host, 'drop');
	await expect(host.getByRole('status')).toHaveText('Ready: report.pdf.');
	expect(
		await host.evaluate((element) => {
			const input = element.querySelector('input');
			element.remove();
			document.querySelector('form').prepend(element);
			return {
				sameInput: element.querySelector('input') === input,
				file: input.files[0].name,
				prompts: element.querySelectorAll('.form-dropzone__prompt')
					.length,
			};
		}),
	).toEqual({ sameInput: true, file: 'report.pdf', prompts: 1 });
});

for (const demo of ['index.html', 'esm.html', 'unpkg.html']) {
	test(`${demo}: code/live pairs and native fallback reflow`, async ({
		page,
	}) => {
		await page.route('https://esm.sh/**', (route) =>
			route.fulfill({ contentType: 'text/javascript', body: source }),
		);
		await page.route('https://unpkg.com/**', (route) =>
			route.fulfill({
				contentType: 'text/javascript',
				body: definitionSource.replace(
					"'./form-dropzone.js'",
					"'http://127.0.0.1:4178/form-dropzone.js'",
				),
			}),
		);
		await page.goto(`/demo/${demo}`);
		await expect(page.locator('form-dropzone').first()).toHaveClass(
			/form-dropzone--enhanced/,
		);
		for (const width of [1400, 320]) {
			await page.setViewportSize({ width, height: 900 });
			const pairs = page.locator('.code-demo-pair');
			expect(await pairs.count()).toBeGreaterThan(0);
			for (const pair of await pairs.all()) {
				await expect
					.poll(() =>
						pair.evaluate((element) => {
							const code = element
								.querySelector(':scope > micro-lighter')
								.getBoundingClientRect();
							const live = element
								.querySelector(':scope > .demo')
								.getBoundingClientRect();
							return innerWidth === 1400
								? code.right <= live.left + 1
								: code.bottom <= live.top + 1;
						}),
					)
					.toBe(true);
			}
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
			).toBe(true);
		}
	});

	for (const failure of [
		'no JavaScript',
		'module failure',
		'unsupported APIs',
	]) {
		test(`${demo}: ${failure} retains the labeled native picker`, async ({
			browser,
		}) => {
			const context = await browser.newContext({
				javaScriptEnabled: failure !== 'no JavaScript',
				colorScheme: 'dark',
				viewport: { width: 320, height: 900 },
			});
			await context.route(
				'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/**',
				(route) => route.abort(),
			);
			await context.route(
				'https://cdn.jsdelivr.net/npm/@aarongustafson/tabbed-interface@3.0.4/**',
				(route) => route.abort(),
			);
			const page = await context.newPage();
			try {
				if (failure === 'module failure')
					await page.route(
						/define\.js|form-dropzone\.js|https:\/\/esm\.sh\/|https:\/\/unpkg\.com\//,
						(route) => route.abort(),
					);
				if (failure === 'unsupported APIs') {
					await page.addInitScript(() => {
						window.DataTransfer = undefined;
					});
					await page.route('https://esm.sh/**', (route) =>
						route.fulfill({
							contentType: 'text/javascript',
							body: source,
						}),
					);
					await page.route('https://unpkg.com/**', (route) =>
						route.fulfill({
							contentType: 'text/javascript',
							body: definitionSource.replace(
								"'./form-dropzone.js'",
								"'http://127.0.0.1:4178/form-dropzone.js'",
							),
						}),
					);
				}
				await page.goto(`/demo/${demo}`);
				if (failure !== 'no JavaScript')
					await expect(
						page.locator('#microlighter-status'),
					).toContainText('MicroLighter could not load.');
				await expect(
					page.locator('.form-dropzone__prompt'),
				).toHaveCount(0);
				for (const input of await page
					.locator('input[type=file]')
					.all()) {
					await expect(input).toBeVisible();
					await expect(input).toHaveAccessibleName(/Choose|Choisir/);
					await input.setInputFiles({
						name: 'report.pdf',
						mimeType: 'application/pdf',
						buffer: Buffer.from('PDF'),
					});
					expect(
						await input.evaluate((node) => node.files[0].name),
					).toBe('report.pdf');
				}
				const custom = page.locator('.custom-dropzone');
				if (await custom.count())
					expect(
						(await measurements(custom)).text,
					).toBeGreaterThanOrEqual(4.5);
				expect(
					await page.evaluate(
						() =>
							document.documentElement.scrollWidth <= innerWidth,
					),
				).toBe(true);
			} finally {
				await context.close();
			}
		});
	}
}
