import { render, screen, fireEvent } from '@testing-library/react';
import { NewRouteModal } from './NewRouteModal';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockReset();
});

test('renders both option cards when open', () => {
  render(<NewRouteModal isOpen onClose={() => {}} projectId="p1" domainId="d1" />);
  expect(screen.getByText('Create manually')).toBeInTheDocument();
  expect(screen.getByText('Create with AI')).toBeInTheDocument();
});

test('does not render anything when closed', () => {
  render(<NewRouteModal isOpen={false} onClose={() => {}} projectId="p1" domainId="d1" />);
  expect(screen.queryByText('Create manually')).toBeNull();
});

test('clicking Create manually navigates to manual create URL and closes', () => {
  const onClose = jest.fn();
  render(<NewRouteModal isOpen onClose={onClose} projectId="p1" domainId="d1" />);
  fireEvent.click(screen.getByTestId('new-route-card-manual'));
  expect(push).toHaveBeenCalledWith('/projects/p1/domains/d1/routes/create');
  expect(onClose).toHaveBeenCalled();
});

test('clicking Create with AI navigates to NL create URL and closes', () => {
  const onClose = jest.fn();
  render(<NewRouteModal isOpen onClose={onClose} projectId="p1" domainId="d1" />);
  fireEvent.click(screen.getByTestId('new-route-card-nl'));
  expect(push).toHaveBeenCalledWith('/projects/p1/domains/d1/routes/create?mode=nl');
  expect(onClose).toHaveBeenCalled();
});
