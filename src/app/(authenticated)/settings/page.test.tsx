import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPage from './page';

jest.mock('./GeneralSettingsTab', () => ({
  GeneralSettingsTab: () => <div>general-tab-content</div>,
}));
jest.mock('./AISettingsTab', () => ({
  AISettingsTab: () => <div>ai-tab-content</div>,
}));

test('renders General and AI tabs, General active by default', () => {
  render(<SettingsPage />);
  expect(screen.getByRole('tab', { name: 'General' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'AI' })).toBeInTheDocument();
  expect(screen.getByText('general-tab-content')).toBeInTheDocument();
  expect(screen.queryByText('ai-tab-content')).toBeNull();
});

test('clicking the AI tab shows the AI content', () => {
  render(<SettingsPage />);
  fireEvent.click(screen.getByRole('tab', { name: 'AI' }));
  expect(screen.getByText('ai-tab-content')).toBeInTheDocument();
  expect(screen.queryByText('general-tab-content')).toBeNull();
});
