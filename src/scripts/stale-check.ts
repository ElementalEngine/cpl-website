// The pages are built once a day. If the builds stop, the page still shows its old data, so
// each data block shows its "may be out of date" note once its "Updated" time is 48 hours old.
import { isOutOfDate } from '../lib/stale';

for (const block of document.querySelectorAll('[data-stale-check]')) {
  const updated = block.querySelector('time[data-updated]');
  const note = block.querySelector('[data-stale-note]');
  if (updated instanceof HTMLTimeElement && note instanceof HTMLElement && isOutOfDate(updated.dateTime, Date.now())) {
    note.hidden = false;
  }
}
