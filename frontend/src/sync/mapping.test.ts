import { describe, expect, it } from 'vitest';
import type { Job } from '../jobs';
import type { Profile } from '../profile';
import type { SavedField } from '../storage';
import {
  captainMachinesToWire,
  captainRatesToWire,
  fieldFromWire,
  fieldToWire,
  fromIso,
  geoJsonToPolygon,
  isUuid,
  jobEditsToWire,
  jobFromWire,
  jobToWire,
  keepJustPushed,
  localProfileIsNewer,
  mergeById,
  pointToGeoJson,
  polygonToGeoJson,
  profileFromWire,
  profileToWire,
  toIso,
  uuid,
} from './mapping';

/**
 * The wire format is where money and area cross between the phone and the
 * database. These tests are the reason that crossing can be trusted: an
 * unclosed ring, a swapped coordinate order, a timestamp in the wrong unit
 * each produce a plausible-looking row that charges the wrong amount.
 */

const CORNERS = [
  { lat: 30.4028, lng: 74.0286 },
  { lat: 30.4028, lng: 74.0296 },
  { lat: 30.4035, lng: 74.0296 },
  { lat: 30.4035, lng: 74.0286 },
];

function field(overrides: Partial<SavedField> = {}): SavedField {
  return {
    id: '9b2f8a10-1111-4c1c-8e2a-0d6a9c3f7a01',
    name: 'Nehar wala khet',
    polygon: CORNERS,
    areaSqm: 4601.2,
    capturedAt: 1729437100000,
    method: 'drawn',
    meanAccuracyM: 4.2,
    synced: false,
    ...overrides,
  };
}

function job(overrides: Partial<Job> = {}): Job {
  return {
    captainId: null,
    myRating: null,
    id: '7c1d9e20-2222-4b3b-9f4c-1a2b3c4d5e01',
    fieldId: '9b2f8a10-1111-4c1c-8e2a-0d6a9c3f7a01',
    fieldName: 'Nehar wala khet',
    village: 'Roshan Wala',
    serviceCode: 'wheat_harvest',
    areaSqm: 4601.2,
    status: 'searching',
    isImmediate: false,
    scheduledDate: '2026-10-25',
    window: 'morning',
    quotedRate: 1100,
    quotedUnit: 'per_killa',
    quotedSubtotal: 1251.7,
    travelCharge: 0,
    quotedTotal: 1251.7,
    captainName: null,
    distanceKm: null,
    offeredCount: null,
    finalAmount: null,
    paymentMode: null,
    notes: '',
    createdAt: 1729437200000,
    acceptedAt: null,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('uuid', () => {
  it('mints version 4, variant 1 ids', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(isUuid(uuid())).toBe(true);
    }
  });

  it('does not mint the same id twice in any realistic run', () => {
    const seen = new Set(Array.from({ length: 500 }, () => uuid()));
    expect(seen.size).toBe(500);
  });

  it('rejects the old Date.now ids', () => {
    expect(isUuid(String(Date.now()))).toBe(false);
    expect(isUuid('')).toBe(false);
  });
});

describe('timestamps', () => {
  it('crosses the wire as ISO and comes back to the exact millisecond', () => {
    const ms = 1729437100123;
    expect(fromIso(toIso(ms))).toBe(ms);
  });

  it('maps absent to absent, not to zero', () => {
    // A job with no completed_at is not a job completed at the epoch.
    expect(fromIso(null)).toBeNull();
    expect(fromIso(undefined)).toBeNull();
    expect(fromIso('')).toBeNull();
  });
});

describe('polygonToGeoJson', () => {
  it('closes the ring and writes coordinates as [lng, lat]', () => {
    const g = polygonToGeoJson(CORNERS)!;
    expect(g.type).toBe('Polygon');
    const ring = g.coordinates[0]!;
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual([74.0286, 30.4028]);
    expect(ring[4]).toEqual(ring[0]);
  });

  it('does not close a ring twice', () => {
    const closed = [...CORNERS, CORNERS[0]!];
    expect(polygonToGeoJson(closed)!.coordinates[0]).toHaveLength(5);
  });

  it('refuses fewer than three corners', () => {
    expect(polygonToGeoJson(CORNERS.slice(0, 2))).toBeNull();
    expect(polygonToGeoJson([])).toBeNull();
  });

  it('survives the round trip back to corners', () => {
    const back = geoJsonToPolygon(polygonToGeoJson(CORNERS)!)!;
    expect(back).toEqual(CORNERS);
  });
});

describe('fieldToWire', () => {
  it('carries no acreage — the server derives area from the boundary', () => {
    const wire = fieldToWire(field())!;
    expect('area_sqm' in wire).toBe(false);
    expect('centroid' in wire).toBe(false);
    expect('owner_id' in wire).toBe(false);
  });

  it('marks the boundary confirmed: the farmer attested on the capture screen', () => {
    expect(fieldToWire(field())!.confirmed_by_owner).toBe(true);
  });

  it('maps the capture method, not the area method', () => {
    expect(fieldToWire(field({ method: 'drawn' }))!.capture_method).toBe('drawn');
    expect(fieldToWire(field({ method: 'rectangle-fit' }))!.capture_method).toBe('walked');
    expect(fieldToWire(field({ method: 'grid-snapped' }))!.capture_method).toBe('walked');
  });

  it('keeps a uuid id, drops a pre-uuid one for the server to assign', () => {
    expect(fieldToWire(field())!.id).toBe('9b2f8a10-1111-4c1c-8e2a-0d6a9c3f7a01');
    const legacy = fieldToWire(field({ id: '1729437100000' }))!;
    expect('id' in legacy).toBe(false);
  });

  it('refuses a field with no polygon to send', () => {
    expect(fieldToWire(field({ polygon: CORNERS.slice(0, 2) }))).toBeNull();
  });
});

describe('fieldFromWire', () => {
  it('adopts the server area and lands synced', () => {
    const saved = fieldFromWire({
      id: '9b2f8a10-1111-4c1c-8e2a-0d6a9c3f7a01',
      name: 'Nehar wala khet',
      boundary: polygonToGeoJson(CORNERS)!,
      area_sqm: 4603.9,
      capture_method: 'drawn',
      gps_accuracy_m: 4.2,
      created_at: toIso(1729437100000),
    })!;
    expect(saved.areaSqm).toBe(4603.9);
    expect(saved.synced).toBe(true);
    expect(saved.polygon).toEqual(CORNERS);
  });
});

describe('jobToWire', () => {
  const SERVICE = 'e5a0b1c2-3333-4d4d-8a5b-2b3c4d5e6f01';

  it('snapshots the area and posts as searching', () => {
    const wire = jobToWire(job(), SERVICE)!;
    expect(wire.area_sqm).toBe(4601.2);
    expect(wire.status).toBe('searching');
    expect(wire.created_at).toBe(toIso(1729437200000));
    expect(wire.scheduled_date).toBe('2026-10-25');
  });

  it('refuses a job whose field has not synced yet', () => {
    expect(jobToWire(job({ fieldId: '1729437100000' }), SERVICE)).toBeNull();
  });
});

describe('jobFromWire', () => {
  const base = {
    id: '7c1d9e20-2222-4b3b-9f4c-1a2b3c4d5e01',
    field_id: '9b2f8a10-1111-4c1c-8e2a-0d6a9c3f7a01',
    captain_id: null,
    service_id: 'e5a0b1c2-3333-4d4d-8a5b-2b3c4d5e6f01',
    area_sqm: 4601.2,
    is_immediate: false,
    scheduled_date: '2026-10-25',
    scheduled_window: 'morning' as const,
    quoted_rate: 1100,
    quoted_unit: 'per_killa' as const,
    quoted_subtotal: 1251.7,
    travel_charge: 0,
    quoted_total: 1251.7,
    final_amount: null,
    payment_mode: null,
    notes: null,
    created_at: toIso(1729437200000),
    accepted_at: null,
    started_at: null,
    completed_at: null,
  };

  it('maps every column, timestamps back to epoch milliseconds', () => {
    const j = jobFromWire(
      { ...base, status: 'accepted', accepted_at: toIso(1729437300000) },
      'wheat_harvest',
      'Nehar wala khet',
      'Roshan Wala',
      'Jaspal',
      2.5,
      3,
      4,
    )!;
    expect(j.offeredCount).toBe(3);
    expect(j.myRating).toBe(4);
    expect(j.captainId).toBeNull();
    expect(j.status).toBe('accepted');
    expect(j.createdAt).toBe(1729437200000);
    expect(j.acceptedAt).toBe(1729437300000);
    expect(j.captainName).toBe('Jaspal');
    expect(j.distanceKm).toBe(2.5);
  });

  it('drops statuses the phone has no honest representation of', () => {
    expect(jobFromWire({ ...base, status: 'draft' }, 'wheat_harvest', '', '', null, null, null, null)).toBeNull();
    expect(jobFromWire({ ...base, status: 'expired' }, 'wheat_harvest', '', '', null, null, null, null)).toBeNull();
  });

  it('drops a service this build cannot name', () => {
    expect(jobFromWire({ ...base, status: 'searching' }, null, '', '', null, null, null, null)).toBeNull();
  });
});

describe('jobEditsToWire', () => {
  it('carries what completion records: the amount, how it was paid, the rate', () => {
    const done = job({
      status: 'completed',
      completedAt: 1729440000000,
      finalAmount: 1250,
      paymentMode: 'cash',
      quotedRate: 1100,
    });
    const wire = jobEditsToWire(done);
    expect(wire.status).toBe('completed');
    expect(wire.completed_at).toBe(toIso(1729440000000));
    expect(wire.final_amount).toBe(1250);
    expect(wire.payment_mode).toBe('cash');
    expect(wire.quoted_rate).toBe(1100);
  });
});

describe('profileToWire', () => {
  const profile: Profile = {
    id: '3f8c1d2e-4444-45e5-9a6f-0f1e2d3c4b5a',
    phone: '919876500001',
    fullName: 'Gurmeet',
    village: 'Roshan Wala',
    role: 'both',
    language: 'pa',
    displayChain: 'killa',
    machines: [],
    rates: [],
    serviceRadiusKm: 15,
    isOnline: false,
    baseLocation: null,
    currentLocation: null,
    onboardedAt: 1729437100000,
    updatedAt: 1729437100000,
  };

  it('maps the columns, empty village to null', () => {
    const wire = profileToWire({ ...profile, village: ' ' })!;
    expect(wire.village).toBeNull();
    expect(wire.role).toBe('both');
    expect(wire.language).toBe('pa');
  });

  it('refuses to push before the profile is real', () => {
    expect(profileToWire({ ...profile, phone: null })).toBeNull();
    expect(profileToWire({ ...profile, fullName: ' ' })).toBeNull();
    // A local-only id means the session has not been attached yet.
    expect(profileToWire({ ...profile, id: '1729437100000' })).toBeNull();
  });

  it('restores onto a local profile without losing machinery', () => {
    const withMachines = { ...profile, isOnline: true };
    const back = profileFromWire(
      {
        id: profile.id,
        phone: '919876500001',
        full_name: 'Gurmeet',
        role: 'captain' as const,
        village: null,
        language: 'pa',
        display_chain: 'killa' as const,
        updated_at: toIso(1729437100000),
      },
      withMachines,
    );
    expect(back.role).toBe('captain');
    expect(back.village).toBe('');
    expect(back.isOnline).toBe(true);
  });
});

describe('captain machinery to wire', () => {
  it('maps codes through the server catalogue and skips unknown ones', () => {
    const rows = captainMachinesToWire(
      [
        {
          id: 'm1',
          machineCode: 'combine',
          ownership: 'arrangeable',
          leadTimeHours: 24,
          withOperatorOnly: false,
        },
        {
          id: 'm2',
          machineCode: 'from_the_future',
          ownership: 'owned',
          leadTimeHours: 0,
          withOperatorOnly: true,
        },
      ],
      (code) => (code === 'combine' ? 'aaaa-bbbb' : undefined),
    );
    expect(rows).toEqual([
      {
        machine_type_id: 'aaaa-bbbb',
        ownership: 'arrangeable',
        lead_time_hours: 24,
        with_operator_only: false,
        make: null,
      },
    ]);
  });

  it('keeps a null rate negotiable rather than zero', () => {
    const rows = captainRatesToWire(
      [
        { serviceCode: 'wheat_harvest', rate: null, unit: 'per_killa' },
        { serviceCode: 'rotavator_work', rate: 900, unit: 'per_killa' },
      ],
      (code) => `id-${code}`,
    );
    expect(rows[0]!.rate).toBeNull();
    expect(rows[1]!.rate).toBe(900);
  });
});

describe('mergeById', () => {
  it('server rows replace, local-only rows survive, remote-only rows arrive', () => {
    const local = [
      { id: 'a', v: 'local-old' },
      { id: 'b', v: 'local-only' },
    ];
    const remote = [
      { id: 'a', v: 'server-new' },
      { id: 'c', v: 'remote-only' },
    ];
    expect(mergeById(local, remote)).toEqual([
      { id: 'a', v: 'server-new' },
      { id: 'b', v: 'local-only' },
      { id: 'c', v: 'remote-only' },
    ]);
  });
});

describe('pointToGeoJson', () => {
  it('writes [lng, lat]', () => {
    expect(pointToGeoJson({ lat: 30.4, lng: 74.02 })).toEqual({
      type: 'Point',
      coordinates: [74.02, 30.4],
    });
  });
});

describe('who wins a profile merge', () => {
  const t = (iso: string) => Date.parse(iso);

  it('keeps the local edit when it is newer', () => {
    expect(
      localProfileIsNewer(t('2026-10-31T10:00:00Z'), '2026-10-31T09:00:00Z'),
    ).toBe(true);
  });

  it('takes the server row when it is newer', () => {
    expect(
      localProfileIsNewer(t('2026-10-31T09:00:00Z'), '2026-10-31T10:00:00Z'),
    ).toBe(false);
  });

  it('gives a tie to the server', () => {
    // Otherwise two phones push the same row at each other forever.
    const same = '2026-10-31T10:00:00Z';
    expect(localProfileIsNewer(t(same), same)).toBe(false);
  });

  it('keeps the local edit when the server row has no usable timestamp', () => {
    // Discarding edits the farmer definitely made, in favour of a row we
    // cannot date, is the worse of the two mistakes.
    for (const bad of [null, undefined, '', 'not a date']) {
      expect(localProfileIsNewer(t('2026-10-31T10:00:00Z'), bad)).toBe(true);
    }
  });

  it('lets a wrong device clock win, which is the known ceiling', () => {
    // Documented rather than fixed: a phone set a year ahead wins every
    // merge until it is corrected. Fine for a name and a rate card.
    expect(
      localProfileIsNewer(t('2027-10-31T00:00:00Z'), '2026-10-31T00:00:00Z'),
    ).toBe(true);
  });
});

describe('keeping what was just pushed', () => {
  const local = [
    { id: 'a', status: 'accepted' },
    { id: 'b', status: 'searching' },
  ];

  it('keeps the local row for an id we just pushed', () => {
    // The pull ran before the push, so the remote copy is stale. Without
    // this the captain watches his accepted job flip back to searching.
    const merged = [
      { id: 'a', status: 'searching' },
      { id: 'b', status: 'searching' },
    ];
    const out = keepJustPushed(merged, local, new Set(['a']));
    expect(out.find((j) => j.id === 'a')?.status).toBe('accepted');
  });

  it('takes the remote row for anything not pushed', () => {
    const merged = [
      { id: 'a', status: 'accepted' },
      { id: 'b', status: 'completed' },
    ];
    const out = keepJustPushed(merged, local, new Set(['a']));
    expect(out.find((j) => j.id === 'b')?.status).toBe('completed');
  });

  it('leaves a pushed id alone when there is no local copy of it', () => {
    const merged = [{ id: 'z', status: 'searching' }];
    expect(keepJustPushed(merged, local, new Set(['z']))).toEqual(merged);
  });

  it('changes nothing when nothing was pushed', () => {
    const merged = [{ id: 'a', status: 'searching' }];
    expect(keepJustPushed(merged, local, new Set())).toEqual(merged);
  });

  it('never drops or duplicates a row', () => {
    const merged = [
      { id: 'a', status: 'x' },
      { id: 'b', status: 'y' },
      { id: 'c', status: 'z' },
    ];
    const out = keepJustPushed(merged, local, new Set(['a', 'b']));
    expect(out).toHaveLength(3);
    expect(out.map((j) => j.id)).toEqual(['a', 'b', 'c']);
  });
});
