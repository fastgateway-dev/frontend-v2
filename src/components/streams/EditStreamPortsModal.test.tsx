import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditStreamPortsModal } from './EditStreamPortsModal';
import type { Stream, StreamEntrypoint } from '@/types';

jest.mock('@/lib/api', () => ({ streamsApi: { update: jest.fn() } }));
import { streamsApi } from '@/lib/api';

const OWNER = { kind: 'stream' as const, streamId: 's1', streamName: 'pg' };
const stream = {
  id: 's1',
  projectId: 'p1',
  name: 'pg',
  ports: [
    { transport: 'TCP', port: 5432 },
    { transport: 'TCP', port: 5433 },
    { transport: 'UDP', port: 53 },
  ],
} as Stream;
const entrypoint = {
  mode: 'dedicated',
  portRange: { min: 1, max: 9000 },
  reserved: [],
  sharedWith: { streams: [], domains: [] },
  ports: [
    { transport: 'TCP', port: 5432, owner: { ...OWNER, routeId: 'r1', routeName: 'pg', status: 'active' } },
    { transport: 'TCP', port: 5433, owner: { ...OWNER, routeId: 'r2', routeName: 'cache', status: 'pending_create', pending: true } },
    { transport: 'UDP', port: 53, owner: OWNER },
    { transport: 'TCP', port: 7000, owner: { kind: 'stream', streamId: 's2', streamName: 'other' } },
  ],
} as unknown as StreamEntrypoint;

const setup = (over: Partial<React.ComponentProps<typeof EditStreamPortsModal>> = {}) => {
  const onClose = jest.fn();
  const onSaved = jest.fn();
  render(
    <EditStreamPortsModal
      projectId="p1"
      stream={stream}
      entrypoint={entrypoint}
      open
      onClose={onClose}
      onSaved={onSaved}
      {...over}
    />
  );
  return { onClose, onSaved };
};

beforeEach(() => (streamsApi.update as jest.Mock).mockReset());

test('starts from the stream claims; route-held claims are locked with the route named', () => {
  setup();
  expect(screen.getAllByTestId('port-claim-chip')).toHaveLength(3);
  const removePg = screen.getByRole('button', { name: 'Remove 5432/TCP' });
  expect(removePg).toBeDisabled();
  expect(removePg).toHaveAttribute('title', 'Used by route pg');
  const removeCache = screen.getByRole('button', { name: 'Remove 5433/TCP' });
  expect(removeCache).toBeDisabled();
  expect(removeCache).toHaveAttribute('title', 'Used by route cache (pending change)');
  expect(screen.getByRole('button', { name: 'Remove 53/UDP' })).toBeEnabled();
});

test("a claim held by a deployed version (pending_deploy) is locked like any route claim", () => {
  const ep = {
    ...entrypoint,
    ports: [{ transport: 'TCP', port: 5432, owner: { ...OWNER, routeId: 'r1', routeName: 'old', status: 'pending_deploy', pending: false } }],
  } as unknown as StreamEntrypoint;
  setup({ entrypoint: ep, stream: { ...stream, ports: [{ transport: 'TCP', port: 5432 }] } });
  expect(screen.getByRole('button', { name: 'Remove 5432/TCP' })).toHaveAttribute('title', 'Used by route old');
});

test('Save PATCHes the full claim set and reports the saved stream', async () => {
  const saved = { ...stream, ports: [{ transport: 'TCP', port: 5432 }, { transport: 'TCP', port: 5433 }, { transport: 'TCP', port: 6000 }] };
  (streamsApi.update as jest.Mock).mockResolvedValue(saved);
  const { onSaved } = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Remove 53/UDP' }));
  await userEvent.type(screen.getByLabelText('Port'), '6000');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(streamsApi.update).toHaveBeenCalledWith('p1', 's1', {
      ports: [
        { transport: 'TCP', port: 5432 },
        { transport: 'TCP', port: 5433 },
        { transport: 'TCP', port: 6000 },
      ],
    })
  );
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
});

test('a 409 shows under the picker and keeps the modal open', async () => {
  (streamsApi.update as jest.Mock).mockRejectedValue({ response: { status: 409, data: { error: 'port 7000/TCP is used by another stream' } } });
  const { onClose, onSaved } = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('port 7000/TCP is used by another stream')).toBeInTheDocument();
  expect(onSaved).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('Save is disabled with zero claims', async () => {
  setup({ stream: { ...stream, ports: [{ transport: 'UDP', port: 53 }] } });
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: 'Remove 53/UDP' }));
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test("the stream's own claims do not count as taken, other streams' do", async () => {
  setup();
  await userEvent.click(screen.getByRole('button', { name: 'Remove 53/UDP' }));
  await userEvent.click(screen.getByLabelText('UDP'));
  await userEvent.type(screen.getByLabelText('Port'), '53');
  expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  await userEvent.click(screen.getByLabelText('TCP'));
  await userEvent.clear(screen.getByLabelText('Port'));
  await userEvent.type(screen.getByLabelText('Port'), '7000');
  expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
});

test('Cancel closes without saving, and nothing renders while closed', async () => {
  const { onClose } = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();
  expect(streamsApi.update).not.toHaveBeenCalled();
});

test('renders nothing when closed', () => {
  setup({ open: false });
  expect(screen.queryByText('Edit ports')).not.toBeInTheDocument();
});
