import { shouldRenderNLWizard } from './mode';

test('returns true when mode=nl', () => {
  expect(shouldRenderNLWizard('nl')).toBe(true);
});

test('returns false when mode is null', () => {
  expect(shouldRenderNLWizard(null)).toBe(false);
});

test('returns false when mode is anything else', () => {
  expect(shouldRenderNLWizard('manual')).toBe(false);
  expect(shouldRenderNLWizard('')).toBe(false);
  expect(shouldRenderNLWizard('NL')).toBe(false);
});
