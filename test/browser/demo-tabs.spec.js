import { test, expect } from '@playwright/test';
import { serveDemo } from './demo-fixture.js';

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
	await expect(pair.locator(':scope > .demo')).toBeVisible();
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
