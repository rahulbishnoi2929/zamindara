import {
  accuracyBand,
  distanceM,
  processWalk,
  type GpsPoint,
  type WalkResult,
} from '@zamindara/geo';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clearActiveWalk, loadActiveWalk, saveActiveWalk } from './storage';

export type WalkPhase = 'idle' | 'acquiring' | 'ready' | 'walking' | 'paused' | 'done';

export interface BoundaryWalk {
  phase: WalkPhase;
  points: GpsPoint[];
  current: GpsPoint | null;
  band: 'good' | 'fair' | 'poor';
  distanceWalkedM: number;
  /** Recomputed periodically while walking, so the area is live. */
  preview: WalkResult | null;
  /** True once he is back near where he started and has walked far enough. */
  nearStart: boolean;
  permissionDenied: boolean;
  recoveredWalk: boolean;

  requestPermission: () => Promise<void>;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => WalkResult | null;
  discard: () => Promise<void>;
}

/** Recompute the live preview every N accepted points, not every point. */
const PREVIEW_EVERY = 5;

/** He must have walked at least this far before "finish" makes sense. */
const MIN_PERIMETER_M = 40;

/** Close enough to the starting corner to offer finishing. */
const CLOSE_LOOP_M = 12;

/**
 * Owns the GPS subscription and the walk in progress.
 *
 * Deliberately holds no geometry logic of its own — every decision about
 * filtering, smoothing and area comes from @zamindara/geo, which is tested
 * against fields of known size. This hook's job is the device: permissions,
 * the location stream, persistence, and the state machine.
 */
export function useBoundaryWalk(): BoundaryWalk {
  const [phase, setPhase] = useState<WalkPhase>('idle');
  const [points, setPoints] = useState<GpsPoint[]>([]);
  const [current, setCurrent] = useState<GpsPoint | null>(null);
  const [preview, setPreview] = useState<WalkResult | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [recoveredWalk, setRecoveredWalk] = useState(false);

  const subscription = useRef<Location.LocationSubscription | null>(null);
  const phaseRef = useRef<WalkPhase>('idle');
  const startedAt = useRef<number>(Date.now());

  phaseRef.current = phase;

  // Recover a walk interrupted by a crash or a dead battery.
  useEffect(() => {
    void (async () => {
      const saved = await loadActiveWalk();
      if (saved !== null && saved.points.length > 0) {
        setPoints(saved.points);
        startedAt.current = saved.startedAt;
        setRecoveredWalk(true);
        setPhase('paused');
      }
    })();
  }, []);

  const requestPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);
    setPhase((p) => (p === 'idle' ? 'acquiring' : p));
  }, []);

  // The location stream. Runs from 'acquiring' onwards so the accuracy dot is
  // live *before* he starts — he must never begin a walk on a red signal.
  useEffect(() => {
    if (phase === 'idle' || phase === 'done') return;
    if (subscription.current !== null) return;

    let cancelled = false;

    void (async () => {
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (location) => {
          const point: GpsPoint = {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            accuracy: location.coords.accuracy ?? 99,
            timestamp: location.timestamp,
            ...(location.coords.speed !== null ? { speed: location.coords.speed } : {}),
          };

          setCurrent(point);

          if (phaseRef.current === 'acquiring' && point.accuracy <= 10) {
            setPhase('ready');
          }

          if (phaseRef.current !== 'walking') return;

          setPoints((prev) => {
            const next = [...prev, point];
            // Checkpoint every point. Cheap, and it is the difference between
            // losing a walk and not.
            void saveActiveWalk({ startedAt: startedAt.current, points: next });
            if (next.length % PREVIEW_EVERY === 0) {
              setPreview(processWalk(next));
            }
            return next;
          });
        },
      );

      if (cancelled) {
        sub.remove();
        return;
      }
      subscription.current = sub;
    })();

    return () => {
      cancelled = true;
      subscription.current?.remove();
      subscription.current = null;
    };
  }, [phase]);

  const start = useCallback(() => {
    startedAt.current = Date.now();
    setPoints([]);
    setPreview(null);
    setRecoveredWalk(false);
    setPhase('walking');
  }, []);

  const pause = useCallback(() => setPhase('paused'), []);
  const resume = useCallback(() => setPhase('walking'), []);

  const finish = useCallback((): WalkResult | null => {
    if (points.length < 4) return null;
    const result = processWalk(points);
    setPreview(result);
    setPhase('done');
    return result;
  }, [points]);

  const discard = useCallback(async () => {
    setPoints([]);
    setPreview(null);
    setRecoveredWalk(false);
    setPhase('idle');
    await clearActiveWalk();
  }, []);

  // Distance actually covered, for the "420 m walked" readout. Uses the raw
  // track rather than the filtered one so the number matches his legs.
  let distanceWalkedM = 0;
  for (let i = 1; i < points.length; i += 1) {
    distanceWalkedM += distanceM(points[i - 1]!, points[i]!);
  }

  const first = points[0];
  const nearStart =
    first !== undefined &&
    current !== null &&
    distanceWalkedM > MIN_PERIMETER_M &&
    distanceM(first, current) < CLOSE_LOOP_M;

  return {
    phase,
    points,
    current,
    band: current === null ? 'poor' : accuracyBand(current.accuracy),
    distanceWalkedM,
    preview,
    nearStart,
    permissionDenied,
    recoveredWalk,
    requestPermission,
    start,
    pause,
    resume,
    finish,
    discard,
  };
}
