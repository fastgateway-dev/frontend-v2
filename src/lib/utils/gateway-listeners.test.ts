import type { TemplateListener } from '@/types';
import {
  RESERVED_PORTS,
  canSubmitTemplate,
  domainNeedsTLSSecret,
  groupListeners,
  hostnameListeners,
  listenerPortConflict,
  streamListener,
} from './gateway-listeners';

const http: TemplateListener = { name: 'http', protocol: 'HTTP', port: 80 };
const https: TemplateListener = { name: 'https', protocol: 'HTTPS', port: 443, tlsMode: 'Terminate' };
const tls: TemplateListener = { name: 'tls', protocol: 'TLS', port: 8443, tlsMode: 'Passthrough' };
const tcp: TemplateListener = { name: 'tcp', protocol: 'TCP', portRangeMin: 9000, portRangeMax: 9100 };
const udp: TemplateListener = { name: 'udp', protocol: 'UDP', portRangeMin: 9200, portRangeMax: 9300 };

describe('RESERVED_PORTS', () => {
  test('lists the backend reserved ports', () => {
    expect(RESERVED_PORTS).toEqual([19000, 19001, 60000]);
  });
});

describe('hostnameListeners', () => {
  test('keeps HTTP/HTTPS/TLS and drops TCP/UDP', () => {
    expect(hostnameListeners([http, https, tls, tcp, udp])).toEqual([http, https, tls]);
  });
});

describe('streamListener', () => {
  test('returns the TCP listener', () => {
    expect(streamListener([http, tcp])).toBe(tcp);
  });
  test('returns the UDP listener', () => {
    expect(streamListener([http, udp])).toBe(udp);
  });
  test('returns null when there is none', () => {
    expect(streamListener([http, https])).toBeNull();
  });
});

describe('groupListeners', () => {
  test('splits http (HTTP+HTTPS) / tls / stream', () => {
    expect(groupListeners([http, https, tls, tcp])).toEqual({ http: [http, https], tls: [tls], stream: tcp });
  });
  test('empty input', () => {
    expect(groupListeners([])).toEqual({ http: [], tls: [], stream: null });
  });
});

describe('listenerPortConflict', () => {
  test('no conflict for a normal set', () => {
    expect(listenerPortConflict([http, https, tcp])).toBeNull();
  });
  test('a fixed port inside the TCP range is allowed (R10 agreement with backend)', () => {
    const inRange: TemplateListener = { name: 'https', protocol: 'HTTPS', port: 9050, tlsMode: 'Terminate' };
    expect(listenerPortConflict([inRange, tcp])).toBeNull();
  });
  test('two listeners on 443', () => {
    const dup: TemplateListener = { name: 'tls', protocol: 'TLS', port: 443 };
    expect(listenerPortConflict([https, dup])).toMatch(/443/);
  });
  test('reserved port', () => {
    expect(listenerPortConflict([{ name: 'x', protocol: 'HTTP', port: 19000 }])).toMatch(/reserved/i);
  });
  test('range with min > max', () => {
    expect(listenerPortConflict([{ ...tcp, portRangeMin: 9100, portRangeMax: 9000 }])).toMatch(/range/i);
  });
  test('range out of 1-65535', () => {
    expect(listenerPortConflict([{ ...tcp, portRangeMin: 0, portRangeMax: 70000 }])).toMatch(/range/i);
  });
  test('two range listeners', () => {
    expect(listenerPortConflict([tcp, udp])).toMatch(/one.*range|range.*one/i);
  });
});

describe('canSubmitTemplate', () => {
  test('empty is false', () => {
    expect(canSubmitTemplate([])).toBe(false);
  });
  test('single HTTP is true', () => {
    expect(canSubmitTemplate([http])).toBe(true);
  });
  test('port conflict is false', () => {
    expect(canSubmitTemplate([http, { name: 'other', protocol: 'HTTP', port: 80 }])).toBe(false);
  });
  test('duplicate name is false', () => {
    expect(canSubmitTemplate([http, { name: 'http', protocol: 'HTTPS', port: 443 }])).toBe(false);
  });
  test('empty name is false', () => {
    expect(canSubmitTemplate([{ name: '  ', protocol: 'HTTP', port: 80 }])).toBe(false);
  });
});

describe('domainNeedsTLSSecret', () => {
  test('bound HTTPS Terminate needs a secret', () => {
    expect(domainNeedsTLSSecret(['https'], [https])).toBe(true);
  });
  test('bound HTTPS Passthrough does not', () => {
    expect(domainNeedsTLSSecret(['https'], [{ ...https, tlsMode: 'Passthrough' }])).toBe(false);
  });
  test('bound HTTP does not', () => {
    expect(domainNeedsTLSSecret(['http'], [http])).toBe(false);
  });
  test('unbound HTTPS listener is ignored', () => {
    expect(domainNeedsTLSSecret(['http'], [http, https])).toBe(false);
  });
});
