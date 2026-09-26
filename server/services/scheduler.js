'use strict';

const cron = require('node-cron');
const db = require('../db');
const { syncNow } = require('./sync');

let scheduledTask = null;
let currentIntervalMinutes = null;

/**
 * (Re)starts the background poller based on the configured
 * sync_interval_minutes. Uses a cron expression of "every N minutes" so
 * changes to the interval take effect the next time this is called (e.g.
 * after the user updates Settings).
 */
function startScheduler(database = db) {
  const config = database.prepare('SELECT sync_interval_minutes FROM simplyprint_config WHERE id = 1').get();
  const minutes = Math.max(1, config?.sync_interval_minutes || 15);

  if (scheduledTask && currentIntervalMinutes === minutes) {
    return; // already running at the desired interval
  }

  if (scheduledTask) {
    scheduledTask.stop();
  }

  currentIntervalMinutes = minutes;
  scheduledTask = cron.schedule(`*/${minutes} * * * *`, () => {
    syncNow(database).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[simplyprint] scheduled sync failed:', err.message);
    });
  });

  return scheduledTask;
}

function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    currentIntervalMinutes = null;
  }
}

module.exports = { startScheduler, stopScheduler };
