import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const source = await readFile(
	new URL('../../form-dropzone.js', import.meta.url),
	'utf8',
);
const demoCSS = await readFile(
	new URL('../../demo/styles.css', import.meta.url),
	'utf8',
);
const demoSource = await readFile(
	new URL('../../demo/index.html', import.meta.url),
	'utf8',
);
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
		const context = document.createElement('canvas').getContext('2d');
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
	await expect(page.locator('.form-dropzone--enhanced')).toHaveCount(7);
	const componentCSS = source.match(/style.textContent = `([\s\S]*?)`;/)[1];
	const inlineCSS = demoSource.match(/<style>([\s\S]*?)<\/style>/)[1];
	for (const [index, palette] of palettes.entries()) {
		const style = await page.addStyleTag({
			content: substitute(demoCSS + inlineCSS, palette),
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
			for (const element of await page.locator(selector).all())
				expect(
					(await measurements(element)).text,
					`palette ${index}: ${selector}`,
				).toBeGreaterThanOrEqual(4.5);
		}
		for (const host of await page.locator('form-dropzone').all()) {
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
		}
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
		await expect(page.locator('.form-dropzone--enhanced')).toHaveCount(7);
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
		await expect(page.locator('.form-dropzone--enhanced')).toHaveCount(7);
		await page.locator('header a').focus();
		// macOS WebKit needs Option+Tab when full keyboard navigation is off.
		await page.keyboard.press(
			browserName === 'webkit' && process.platform === 'darwin'
				? 'Alt+Tab'
				: 'Tab',
		);
		const input = page.locator('#basic-file');
		await expect(input).toBeFocused();
		await expect(input).toHaveAccessibleName('Choose a file');
		await expect(input).toHaveCSS('outline-style', 'auto');
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
		await host.locator('input').focus();
		await expect(host.locator('input')).toHaveCSS('outline-style', 'auto');
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
				const code = await pair.locator('pre').boundingBox();
				const live = await pair.locator('.demo').boundingBox();
				if (width === 1400)
					expect(code.x + code.width).toBeLessThanOrEqual(live.x + 1);
				else
					expect(code.y + code.height).toBeLessThanOrEqual(
						live.y + 1,
					);
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
