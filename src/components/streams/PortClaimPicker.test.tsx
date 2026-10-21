import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortClaimPicker } from './PortClaimPicker';
import type { EntrypointPort, PortRange, ReservedPort, TransportPort } from '@/types';

type Props = Partial<React.ComponentProps<typeof PortClaimPicker>>;

function Harness({ initial = [], onChange, ...rest }: Props & { initial?: TransportPort[] }) {
  const [value, setValue] = useState<TransportPort[]>(initial);
  return (
    <PortClaimPicker
      range={null}
      reserved={[]}
      taken={[]}
      {...rest}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const RANGE: PortRange = { min: 1000, max: 2000 };
const RESERVED: ReservedPort[] = [{ transport: 'TCP', port: 1500, reason: 'template_listener' }];
const TAKEN: EntrypointPort[] = [
  { transport: 'TCP', port: 1100, owner: { kind: 'stream', streamId: 's2', streamName: 'cache' } },
];

const portInput = () => screen.getByLabelText('Port');
const addButton = () => screen.getByRole('button', { name: 'Add' });

describe('PortClaimPicker', () => {
  it('adds a claim via the transport toggle, number input and Add', async () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('UDP'));
    await userEvent.type(portInput(), '53');
    await userEvent.click(addButton());
    expect(onChange).toHaveBeenLastCalledWith([{ transport: 'UDP', port: 53 }]);
    expect(screen.getByText('53/UDP')).toBeInTheDocument();
    expect(portInput()).toHaveValue('');
  });

  it('adds on Enter and defaults to TCP', async () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.type(portInput(), '5432{Enter}');
    expect(onChange).toHaveBeenLastCalledWith([{ transport: 'TCP', port: 5432 }]);
    expect(screen.getByText('5432/TCP')).toBeInTheDocument();
  });

  it('keeps chips sorted with comparePorts', async () => {
    const onChange = jest.fn();
    render(<Harness initial={[{ transport: 'UDP', port: 53 }, { transport: 'TCP', port: 9000 }]} onChange={onChange} />);
    await userEvent.type(portInput(), '80{Enter}');
    expect(onChange).toHaveBeenLastCalledWith([
      { transport: 'UDP', port: 53 },
      { transport: 'TCP', port: 80 },
      { transport: 'TCP', port: 9000 },
    ]);
    const chips = screen.getAllByTestId('port-claim-chip').map((c) => c.textContent);
    expect(chips).toEqual(['53/UDP', '80/TCP', '9000/TCP']);
  });

  it('rejects a duplicate claim but allows the other transport', async () => {
    render(<Harness initial={[{ transport: 'TCP', port: 5432 }]} />);
    await userEvent.type(portInput(), '5432');
    expect(screen.getByText('5432/TCP is already claimed')).toBeInTheDocument();
    expect(addButton()).toBeDisabled();
    await userEvent.click(screen.getByLabelText('UDP'));
    expect(screen.queryByText(/already claimed/)).not.toBeInTheDocument();
    expect(addButton()).toBeEnabled();
  });

  it.each([
    ['0', 'Port must be between 1 and 65535'],
    ['70000', 'Port must be between 1 and 65535'],
    ['abc', 'Port must be between 1 and 65535'],
    ['1500', '1500/TCP is reserved'],
    ['19000', '19000/TCP is reserved'],
    ['999', 'Must be within 1000–2000'],
    ['1100', '1100/TCP is used by Stream cache'],
  ])('shows the claim problem for %s and disables Add', async (typed, message) => {
    render(<Harness range={RANGE} reserved={RESERVED} taken={TAKEN} />);
    await userEvent.type(portInput(), typed);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(addButton()).toBeDisabled();
    await userEvent.type(portInput(), '{Enter}');
    expect(screen.queryAllByTestId('port-claim-chip')).toHaveLength(0);
  });

  it('removes a chip', async () => {
    const onChange = jest.fn();
    render(<Harness initial={[{ transport: 'TCP', port: 80 }, { transport: 'TCP', port: 443 }]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove 80/TCP' }));
    expect(onChange).toHaveBeenLastCalledWith([{ transport: 'TCP', port: 443 }]);
    expect(screen.queryByText('80/TCP')).not.toBeInTheDocument();
  });

  it('locks a chip a route still uses and shows the reason', async () => {
    const onChange = jest.fn();
    render(
      <Harness
        initial={[{ transport: 'TCP', port: 5432 }, { transport: 'TCP', port: 6379 }]}
        lockedPorts={[{ port: { transport: 'TCP', port: 5432 }, reason: 'Used by route postgres' }]}
        onChange={onChange}
      />
    );
    const remove = screen.getByRole('button', { name: 'Remove 5432/TCP' });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAttribute('title', 'Used by route postgres');
    expect(screen.getAllByTestId('port-claim-chip')[0]).toHaveAttribute('title', 'Used by route postgres');
    // Also exposed beyond hover: visually hidden text the button is described by.
    expect(remove).toHaveAccessibleDescription('Used by route postgres');
    const hidden = screen.getByText('Used by route postgres');
    expect(hidden).toHaveClass('sr-only');
    expect(remove.getAttribute('aria-describedby')).toBe(hidden.id);
    expect(screen.getAllByTestId('port-claim-chip')[0]).toContainElement(hidden);
    expect(screen.getByRole('button', { name: 'Remove 6379/TCP' })).not.toHaveAttribute('aria-describedby');
    await userEvent.click(remove);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Remove 6379/TCP' })).toBeEnabled();
  });

  it('shows the range with the free count', () => {
    render(
      <Harness
        range={RANGE}
        reserved={RESERVED}
        taken={TAKEN}
        initial={[{ transport: 'TCP', port: 1200 }]}
      />
    );
    // 1001 ports - reserved 1500 - taken 1100 - claimed 1200 = 998
    expect(screen.getByText('Port range 1000–2000 · 998 of 1001 free')).toBeInTheDocument();
  });

  it('does not count the stream\'s own taken rows against the free count', () => {
    const own: EntrypointPort[] = [
      { transport: 'TCP', port: 1200, owner: { kind: 'stream', streamId: 's1', streamName: 'mine' } },
    ];
    render(<Harness range={RANGE} taken={own} selfStreamId="s1" initial={[]} />);
    expect(screen.getByText('Port range 1000–2000 · 1001 of 1001 free')).toBeInTheDocument();
  });

  it('omits the range line without a range', () => {
    render(<Harness />);
    expect(screen.queryByText(/Port range/)).not.toBeInTheDocument();
  });

  it('renders the error under the picker', () => {
    render(<Harness error="Claim at least one port" />);
    expect(screen.getByText('Claim at least one port')).toBeInTheDocument();
  });

  it('disables everything when disabled', () => {
    render(<Harness disabled initial={[{ transport: 'TCP', port: 80 }]} />);
    expect(portInput()).toBeDisabled();
    expect(addButton()).toBeDisabled();
    expect(screen.getByLabelText('UDP')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove 80/TCP' })).toBeDisabled();
  });
});
