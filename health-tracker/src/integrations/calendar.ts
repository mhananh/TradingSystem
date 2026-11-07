// Adds events to the phone calendar via the system "new event" screen (syncs to Google Calendar when
// a Google account is on the phone). No Google login inside this app. Web build downloads an .ics file.
import { combineDateTime } from '../lib/date';

export interface CalendarEventInput {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMin: number;
  description?: string;
  location?: string;
  weeklyCount?: number; // repeat weekly N times
}

export async function addToCalendar(ev: CalendarEventInput): Promise<'created' | 'cancelled' | 'downloaded'> {
  const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar');
  const start = combineDateTime(ev.date, ev.time).getTime();
  const end = start + ev.durationMin * 60_000;
  const r = await CapacitorCalendar.createEventWithPrompt({
    title: ev.title,
    startDate: start,
    endDate: end,
    description: ev.description,
    location: ev.location,
    alerts: [-30],
    icsFileName: 'jejak-sehat-acara.ics',
    autoDownloadIcsFile: true,
    recurrence: ev.weeklyCount ? { frequency: 'weekly', interval: 1, count: ev.weeklyCount } : undefined,
  });
  if (r.ics) return 'downloaded';
  return r.id ? 'created' : 'cancelled';
}
