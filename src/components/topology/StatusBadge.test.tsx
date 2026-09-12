import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

test('renders deployed label and green dot', () => {
  const { container } = render(<StatusBadge status="deployed" />);
  expect(screen.getByText('Deployed')).toBeInTheDocument();
  expect(container.querySelector('.bg-green-500')).toBeTruthy();
});

test('renders failed label', () => {
  render(<StatusBadge status="failed" />);
  expect(screen.getByText('Failed')).toBeInTheDocument();
});
