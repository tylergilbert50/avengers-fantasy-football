/**
 * League time.
 *
 * Dates the league runs on — a draft at 7:30, a deadline at 11:00, a poll that
 * shuts at noon — are wall-clock times in one place, not instants. They have to
 * mean the same moment for a manager in Nashville and one in Denver, which is
 * what these convert between.
 *
 * Pure, and no library: `Intl` already knows every zone and its DST history.
 */

/** The league is in Nashville. */
export const LEAGUE_TIMEZONE = 'America/Chicago'

/** Sunday-based, matching `Date.prototype.getDay`. */
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** The wall clock in `timeZone`, whatever the server's own clock is set to. */
export function zonedParts(date, timeZone = LEAGUE_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)

  const read = (type) => parts.find((part) => part.type === type)?.value

  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    hour: Number(read('hour')),
    minute: Number(read('minute')),
    second: Number(read('second')),
    weekday: WEEKDAYS[read('weekday')],
  }
}

/** How far ahead of UTC the zone is at this instant, in ms. */
function offsetMs(date, timeZone) {
  const parts = zonedParts(date, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - date.getTime()
}

/**
 * A wall clock in `timeZone` back to the instant it names.
 *
 * Two passes because the offset depends on the answer: the first guess is made
 * with the offset in force at the wrong moment, the second with the offset at
 * (very nearly) the right one. Everything the league schedules is hours away
 * from a US DST change, which happens at 02:00 on a Sunday, so this lands
 * exactly.
 */
export function fromZoned({ year, month, day, hour = 0, minute = 0 }, timeZone = LEAGUE_TIMEZONE) {
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  const first = wall - offsetMs(new Date(wall), timeZone)
  return new Date(wall - offsetMs(new Date(first), timeZone))
}

/** "2026-08-29" + "19:30" -> the instant that is, in league time. */
export function leagueMoment(date, time = '00:00', timeZone = LEAGUE_TIMEZONE) {
  const [year, month, day] = String(date).split('-').map(Number)
  const [hour, minute] = String(time).split(':').map(Number)
  return fromZoned({ year, month, day, hour, minute }, timeZone)
}

/** The zone as it writes itself today — "CDT" in September, "CST" in December. */
export function timezoneLabel(date = new Date(), timeZone = LEAGUE_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(date)
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
}
