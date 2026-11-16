import { describe, expect, it } from 'vitest';
import { compareVersions, updateState } from './version';

describe('compareVersions', () => {
  it('orders by number, not by text', () => {
    // '0.10.0' > '0.9.0' is the whole reason this is not a string compare.
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '0.99.99')).toBeGreaterThan(0);
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0);
  });

  it('treats anything it cannot read as equal rather than guessing', () => {
    // Guessing "older" would lock a phone out on a typo in the dashboard.
    expect(compareVersions('v2-beta', '0.1.0')).toBe(0);
    expect(compareVersions('0.1.0', '')).toBe(0);
  });
});

describe('updateState', () => {
  const cfg = {
    latestVersion: '0.2.0',
    latestApkUrl: 'https://example.test/app.apk',
    minimumSupportedVersion: '0.1.0',
    note: null,
  };

  it('says nothing when the phone is current', () => {
    expect(updateState('0.2.0', cfg)).toEqual({ kind: 'current' });
  });

  it('offers an update when a newer one exists', () => {
    expect(updateState('0.1.0', cfg)).toEqual({
      kind: 'available',
      version: '0.2.0',
      url: 'https://example.test/app.apk',
      note: null,
    });
  });

  it('blocks a phone below the floor', () => {
    expect(updateState('0.0.9', cfg).kind).toBe('required');
  });

  it('offers no download it does not have', () => {
    const noUrl = { ...cfg, latestApkUrl: null };
    expect(updateState('0.1.0', noUrl)).toEqual({
      kind: 'available',
      version: '0.2.0',
      url: null,
      note: null,
    });
  });

  it('says nothing at all with no config — never blocks on not knowing', () => {
    // No signal, or the row has not been read yet. A phone that cannot
    // reach the server must still work; it is the one in the field.
    expect(updateState('0.1.0', null)).toEqual({ kind: 'current' });
  });

  it('does not nag a phone newer than the row', () => {
    // The founder's own handset, running the build he has not published.
    expect(updateState('0.3.0', cfg)).toEqual({ kind: 'current' });
  });
});
