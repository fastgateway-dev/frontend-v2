import { render, screen, fireEvent } from '@testing-library/react';
import { SidePanel } from './SidePanel';

test('closes on backdrop click', () => {
  const onClose = jest.fn();
  render(<SidePanel open onClose={onClose} title="Test"><div>content</div></SidePanel>);
  fireEvent.click(screen.getByTestId('sidepanel-backdrop'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('closes on ESC', () => {
  const onClose = jest.fn();
  render(<SidePanel open onClose={onClose} title="Test"><div>content</div></SidePanel>);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});

test('closes on close button click', () => {
  const onClose = jest.fn();
  render(<SidePanel open onClose={onClose} title="Test"><div>content</div></SidePanel>);
  fireEvent.click(screen.getByLabelText('Close panel'));
  expect(onClose).toHaveBeenCalled();
});

test('does not render content when closed', () => {
  render(<SidePanel open={false} onClose={() => {}} title="X"><div>secret</div></SidePanel>);
  expect(screen.queryByText('secret')).toBeNull();
});
