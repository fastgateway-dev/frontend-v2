import { comparePair, toggleVersionSelection } from './version-selection';

test('toggleVersionSelection keeps at most two, newest pick wins', () => {
  expect(toggleVersionSelection([], 3)).toEqual([3]);
  expect(toggleVersionSelection([3], 1)).toEqual([3, 1]);
  expect(toggleVersionSelection([3, 1], 2)).toEqual([1, 2]);
  expect(toggleVersionSelection([3, 1], 3)).toEqual([1]);
});

test('comparePair orders older -> newer and needs exactly two', () => {
  expect(comparePair([3, 1])).toEqual([1, 3]);
  expect(comparePair([1, 3])).toEqual([1, 3]);
  expect(comparePair([1])).toBeNull();
  expect(comparePair([])).toBeNull();
});
