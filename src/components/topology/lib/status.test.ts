import { aggregateStatus, statusToVisual } from './status';

test('empty returns draft', () => {
  expect(aggregateStatus([])).toBe('draft');
});

test('single deployed', () => {
  expect(aggregateStatus(['deployed'])).toBe('deployed');
});

test('pending beats deployed', () => {
  expect(aggregateStatus(['deployed', 'pending'])).toBe('pending');
});

test('draft beats deployed', () => {
  expect(aggregateStatus(['deployed', 'draft'])).toBe('draft');
});

test('pending beats draft (spec ordering)', () => {
  expect(aggregateStatus(['draft', 'pending'])).toBe('pending');
});

test('pending beats draft and deployed', () => {
  expect(aggregateStatus(['deployed', 'pending', 'draft'])).toBe('pending');
});

test('failed beats everything', () => {
  expect(aggregateStatus(['deployed', 'pending', 'draft', 'failed'])).toBe('failed');
});

test('statusToVisual returns dotClass and label', () => {
  const v = statusToVisual('deployed');
  expect(v.label).toBe('Deployed');
  expect(v.dotClass).toMatch(/green/);
});

test('statusToVisual covers all four states', () => {
  expect(statusToVisual('pending').label).toBe('Pending');
  expect(statusToVisual('failed').label).toBe('Failed');
  expect(statusToVisual('draft').label).toBe('Draft');
});
