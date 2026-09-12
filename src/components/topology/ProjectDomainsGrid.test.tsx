// ProjectDomainsGrid.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectDomainsGrid } from './ProjectDomainsGrid';

test('renders one card per domain with counts and click drills in', () => {
  const onSelect = jest.fn();
  render(<ProjectDomainsGrid domains={[
    { id: 'd1', name: 'd1', hostname: 'h1', securityMode: 'general', templateName: 'tpl', gatewayStatus: 'deployed',
      counts: { routes: 2, clientsAttached: 0, routesWithIpAllowlist: 1, routesWithMtls: 0 } },
  ]} onSelectDomain={onSelect} />);
  expect(screen.getByText('d1')).toBeInTheDocument();
  expect(screen.getByText(/2 routes/)).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('domain-card-d1'));
  expect(onSelect).toHaveBeenCalledWith('d1');
});
