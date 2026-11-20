import { formatAreaShort } from '@zamindara/units';
import { describe, expect, it } from 'vitest';
import { areaFromKillaKanal, founderJobFromWire, shareText, type FounderJob } from './founder';

const job: FounderJob = {
  id: 'j1',
  status: 'searching',
  serviceCode: 'wheat_harvest',
  areaSqm: 2 * 4046.8564224 + 505.857,
  isImmediate: false,
  scheduledDate: '2027-04-12',
  window: 'morning',
  farmerName: 'Gurmeet Singh',
  farmerPhone: '919876543210',
  village: 'Arniwala',
  captainName: null,
  finalAmount: null,
};

describe('shareText — the WhatsApp message to a captain', () => {
  it('is Punjabi by default: work, area in local units, village, time, phone', () => {
    const text = shareText(job, 'pa');
    expect(text).toContain('ਕਣਕ'); // wheat, in Gurmukhi
    // The same words the app shows everywhere else.
    expect(text).toContain(formatAreaShort(job.areaSqm, { locale: 'pa' }));
    expect(text).toContain('Arniwala');
    expect(text).toContain('2027-04-12');
    expect(text).toContain('98765 43210');
    // Never square metres, never decimals of a killa.
    expect(text).not.toMatch(/m²|sq|\d\.\d/);
  });

  it('a job for now says so instead of a date', () => {
    expect(shareText({ ...job, isImmediate: true, scheduledDate: null }, 'pa')).toContain('ਹੁਣੇ');
  });

  it('follows the reader when asked for another language', () => {
    expect(shareText(job, 'en')).toContain('Wheat');
  });
});

describe('areaFromKillaKanal — what the founder types from a phone call', () => {
  it('2 killa 3 kanal', () => {
    expect(areaFromKillaKanal('2', '3')).toBeCloseTo(2 * 4046.8564224 + 3 * 505.857, 0);
  });
  it('blank kanal is zero, blank everything is nothing', () => {
    expect(areaFromKillaKanal('1', '')).toBeCloseTo(4046.86, 1);
    expect(areaFromKillaKanal('', '')).toBeNull();
    expect(areaFromKillaKanal('abc', '1')).toBeNull();
  });
});

describe('founderJobFromWire', () => {
  it('reads the joined row', () => {
    expect(
      founderJobFromWire(
        {
          id: 'j1',
          status: 'accepted',
          service_id: 's1',
          area_sqm: 4046.86,
          is_immediate: true,
          scheduled_date: null,
          scheduled_window: 'any',
          final_amount: null,
          farmer: { full_name: 'Gurmeet', phone: '919876543210', village: 'Arniwala' },
          captain: { profile: { full_name: 'Jaspal' } },
        },
        (id) => (id === 's1' ? 'wheat_harvest' : null),
      ),
    ).toMatchObject({ serviceCode: 'wheat_harvest', farmerName: 'Gurmeet', captainName: 'Jaspal', village: 'Arniwala' });
  });
});
