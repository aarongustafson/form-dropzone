import { test, expect } from '@playwright/test';
import { serveDemo } from './demo-fixture.js';

for (const timing of ['before', 'during']) {
	test(`reset ${timing} a drop preserves only genuinely newer outcome feedback`, async ({
		page,
	}) => {
		await serveDemo(page);
		await page.goto('http://code-demo.test/demo/index.html');
		const zone = page.locator('#english-announcements-zone');
		await zone.evaluate((element, when) => {
			const input = element.querySelector('input');
			if (when === 'before') input.form.reset();
			else
				input.addEventListener('input', () => input.form.reset(), {
					once: true,
				});
			const transfer = new DataTransfer();
			transfer.items.add(
				new File(['pdf'], 'latest.pdf', { type: 'application/pdf' }),
			);
			element.dispatchEvent(
				new DragEvent('drop', {
					bubbles: true,
					cancelable: true,
					dataTransfer: transfer,
				}),
			);
		}, timing);
		await page.evaluate(
			() => new Promise((resolve) => setTimeout(resolve, 0)),
		);
		await expect(
			page.locator(
				'[data-drop-for="english-announcements-zone"] [data-outcome="accepted"]',
			),
		).toHaveText(timing === 'before' ? 'latest.pdf' : 'None');
	});
}

test('separates page-wide instructions from the first example heading', async ({
	page,
}) => {
	await serveDemo(page, { tabs: true });
	await page.goto('http://code-demo.test/demo/index.html');
	await expect(
		page.getByRole('complementary', { name: 'Using these examples' }),
	).toBeVisible();
	expect(
		await page.evaluate(() => {
			const note = document.querySelector('main > aside.note');
			const heading = document.querySelector('#basic-picker > h2');
			return (
				heading.getBoundingClientRect().top -
					note.getBoundingClientRect().bottom >=
				parseFloat(getComputedStyle(document.documentElement).fontSize)
			);
		}),
	).toBe(true);
});

test('switches demo presentation without replacing the native picker or losing its files, and still resets', async ({
	page,
}) => {
	await serveDemo(page, { tabs: true });
	await page.goto('http://code-demo.test/demo/index.html');
	const toggle = page.getByRole('button', {
		name: 'Use tabs for examples',
		exact: true,
	});
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	const pair = page.locator('#shared-messages .code-demo-pair');
	await pair.getByRole('tab', { name: 'Live example', exact: true }).click();
	const input = pair.locator('#shared-references');
	const original = await input.elementHandle();
	const host = await pair
		.locator(':scope > tabbed-interface')
		.elementHandle();
	await input.setInputFiles({
		name: 'reference.svg',
		mimeType: 'image/svg+xml',
		buffer: Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="navy"/></svg>',
		),
	});
	await expect(pair.locator('.form-dropzone__preview')).toHaveCount(1);
	await toggle.focus();
	await page.keyboard.press('Space');
	await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	await expect(
		pair.locator(':scope > tabbed-interface[data-demo-tabs] > .demo'),
	).toBeVisible();
	expect(await host.evaluate((element) => element.isConnected)).toBe(true);
	await page.keyboard.press('Space');
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await expect(
		pair.getByRole('tab', { name: 'Live example', exact: true }),
	).toHaveAttribute('aria-selected', 'true');
	expect(
		await input.evaluate((element, saved) => element === saved, original),
	).toBe(true);
	expect(
		await input.evaluate((element) =>
			[...element.files].map((file) => file.name),
		),
	).toEqual(['reference.svg']);
	await expect(pair.locator('.form-dropzone__preview')).toHaveCount(1);
	await expect(toggle).toBeFocused();
	await pair.getByRole('button', { name: 'Clear both selections' }).click();
	await expect(pair.locator('.form-dropzone__preview')).toHaveCount(0);
	expect(await input.evaluate((element) => element.files.length)).toBe(0);
});
