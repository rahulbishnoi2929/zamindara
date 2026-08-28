/**
 * @zamindara/scheduling
 *
 * A captain's day, laid out in time.
 *
 * A combine serves eight fields back to back, so a captain has a queue rather
 * than one job at a time — and the farmer's real question is never "is a
 * machine coming" but "when does it reach me". This package answers that.
 */
export {
  buildSchedule,
  DEFAULT_HOURS,
  findInSchedule,
  SETUP_MINUTES,
  suggestOrder,
  travelMinutes,
  workMinutes,
  type QueueJob,
  type ScheduledJob,
  type WorkingHours,
} from './queue.js';
