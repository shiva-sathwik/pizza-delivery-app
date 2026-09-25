const cron = require('node-cron');
const Inventory = require('../models/Inventory');
const { sendInventoryAlertEmail } = require('../services/email.service');

/**
 * Low-Stock Inventory Alert Cron Job & Monitoring Utility
 * Step 8: Production-grade scheduled checks and email notification dispatch
 */

let alertCronJob = null;
let shutdownListenersAttached = false;

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Evaluates current inventory stock against thresholds and dispatches consolidated alert emails.
 *
 * @param {Object} options
 * @param {boolean} [options.isTestMode=false] - If true, bypasses cooldown and does NOT update database alert state
 * @param {string} [options.recipient=null] - Optional recipient override
 * @returns {Promise<{ sent: boolean, count: number, items: Array, isTestMode: boolean }>}
 */
const checkInventoryAndSendAlerts = async ({ isTestMode = false, recipient = null } = {}) => {
  try {
    const allInventory = await Inventory.find({});

    let itemsToAlert = [];

    if (isTestMode) {
      // In test mode: find any actual low or out of stock items regardless of cooldown
      itemsToAlert = allInventory.filter((item) => {
        return item.quantity <= item.threshold;
      });

      // User Constraint: If no actual low-stock items exist in DB, create an IN-MEMORY ONLY demo object.
      // Do NOT create, insert, update, or persist it in the Inventory collection!
      if (itemsToAlert.length === 0) {
        itemsToAlert = [
          {
            item: 'Mozzarella (Demo Test)',
            category: 'cheese',
            quantity: 2,
            threshold: 5,
            status: 'Low Stock'
          }
        ];
      }

      // Send consolidated test alert email
      await sendInventoryAlertEmail({
        affectedItems: itemsToAlert,
        to: recipient,
        isTestMode: true
      });

      // In test mode, we do NOT modify real inventory data, lastAlertSentAt, or lastAlertStatus.
      return {
        sent: true,
        count: itemsToAlert.length,
        items: itemsToAlert,
        isTestMode: true
      };
    }

    // Normal Production/Automated Mode:
    // Apply spam prevention:
    // 1. Current status must be 'Low Stock' or 'Out of Stock'
    // 2. Alert if status changed since last alert, OR if 24 hours have elapsed since last alert.
    const now = new Date();

    for (const item of allInventory) {
      if (item.quantity <= item.threshold) {
        const currentStatus = item.quantity === 0 ? 'Out of Stock' : 'Low Stock';
        const statusChanged = item.lastAlertStatus !== currentStatus;
        const cooldownExpired =
          !item.lastAlertSentAt ||
          now.getTime() - new Date(item.lastAlertSentAt).getTime() >= TWENTY_FOUR_HOURS_MS;

        if (statusChanged || cooldownExpired) {
          itemsToAlert.push({
            doc: item,
            item: item.item,
            category: item.category,
            quantity: item.quantity,
            threshold: item.threshold,
            status: currentStatus
          });
        }
      } else if (item.lastAlertStatus && item.lastAlertStatus !== 'In Stock') {
        // Recovered back to In Stock: silently reset alert status without sending an email
        item.lastAlertStatus = 'In Stock';
        await item.save();
      }
    }

    if (itemsToAlert.length === 0) {
      return {
        sent: false,
        count: 0,
        items: [],
        isTestMode: false
      };
    }

    // Send single consolidated alert email
    await sendInventoryAlertEmail({
      affectedItems: itemsToAlert,
      to: recipient,
      isTestMode: false
    });

    // Update alert tracking timestamps in DB
    for (const entry of itemsToAlert) {
      if (entry.doc) {
        entry.doc.lastAlertSentAt = now;
        entry.doc.lastAlertStatus = entry.status;
        await entry.doc.save();
      }
    }

    return {
      sent: true,
      count: itemsToAlert.length,
      items: itemsToAlert,
      isTestMode: false
    };
  } catch (error) {
    console.error('[InventoryAlertCron] Error executing inventory check:', error);
    throw error;
  }
};

/**
 * Initializes and starts the process-local cron job.
 * Ensures clean singleton lifecycle and SIGINT/SIGTERM shutdown.
 */
const startInventoryAlertCron = () => {
  const isEnabled = process.env.ENABLE_INVENTORY_ALERT_CRON !== 'false';
  if (!isEnabled) {
    console.log('[InventoryAlertCron] Inventory alert cron is disabled by configuration.');
    return null;
  }

  // Stop existing cron job if running in this process
  if (alertCronJob) {
    alertCronJob.stop();
    alertCronJob = null;
  }

  const schedule = process.env.INVENTORY_ALERT_CRON_SCHEDULE || '0 */6 * * *';

  if (!cron.validate(schedule)) {
    console.error(`[InventoryAlertCron] Invalid cron schedule expression: "${schedule}". Using fallback: "0 */6 * * *"`);
  }

  const cronPattern = cron.validate(schedule) ? schedule : '0 */6 * * *';

  alertCronJob = cron.schedule(cronPattern, async () => {
    console.log('[InventoryAlertCron] Running scheduled inventory check...');
    try {
      const result = await checkInventoryAndSendAlerts({ isTestMode: false });
      if (result.sent) {
        console.log(`[InventoryAlertCron] Dispatched alert for ${result.count} inventory item(s).`);
      } else {
        console.log('[InventoryAlertCron] All inventory levels healthy. No alerts sent.');
      }
    } catch (err) {
      console.error('[InventoryAlertCron] Scheduled check failed:', err.message);
    }
  });

  console.log(`[InventoryAlertCron] Scheduled successfully with pattern: "${cronPattern}"`);

  // Attach process-local shutdown listeners once
  if (!shutdownListenersAttached) {
    const handleShutdown = () => {
      stopInventoryAlertCron();
    };
    process.once('SIGINT', handleShutdown);
    process.once('SIGTERM', handleShutdown);
    shutdownListenersAttached = true;
  }

  return alertCronJob;
};

/**
 * Stops the active cron job cleanly.
 */
const stopInventoryAlertCron = () => {
  if (alertCronJob) {
    alertCronJob.stop();
    alertCronJob = null;
    console.log('[InventoryAlertCron] Cron job stopped.');
  }
};

module.exports = {
  checkInventoryAndSendAlerts,
  startInventoryAlertCron,
  stopInventoryAlertCron
};
