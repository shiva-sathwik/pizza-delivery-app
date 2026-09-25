const Order = require('../models/Order');
const { checkInventoryAndSendAlerts } = require('../utils/inventoryAlertCron');

/**
 * Admin Analytics Controller
 * Step 8: Sales aggregation, metrics, timelines, and test-alert dispatching
 */

/**
 * Computes calendar-aligned date boundaries for daily, weekly (Mon-Sun), and monthly periods.
 * @param {string} period - 'daily' | 'weekly' | 'monthly'
 * @returns {{ startDate: Date, endDate: Date }}
 */
const getDateRangeForPeriod = (period) => {
  const now = new Date();

  if (period === 'weekly') {
    // Current calendar week: Monday (00:00:00.000) through Sunday (23:59:59.999)
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - distanceToMonday);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }

  if (period === 'monthly') {
    // Current calendar month: 1st of month (00:00:00.000) through last day of month (23:59:59.999)
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { startDate, endDate };
  }

  // Default: 'daily' (start of today 00:00:00.000 through end of today 23:59:59.999)
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
};

/**
 * GET /api/admin/analytics?period=daily|weekly|monthly
 * Accessible only by authenticated administrators
 */
const getAdminAnalytics = async (req, res) => {
  try {
    const rawPeriod = (req.query.period || 'daily').toLowerCase();
    const period = ['daily', 'weekly', 'monthly'].includes(rawPeriod) ? rawPeriod : 'daily';

    const { startDate, endDate } = getDateRangeForPeriod(period);

    // Retrieve qualifying orders (only successfully paid orders count toward analytics)
    const orders = await Order.find({
      'payment.status': 'PAID',
      createdAt: { $gte: startDate, $lte: endDate }
    })
      .populate('user', 'name email')
      .sort({ createdAt: 1 });

    const totalOrders = orders.length;

    const totalRevenueRaw = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const totalRevenue = Math.round(totalRevenueRaw * 100) / 100;

    const pizzasSold = orders.reduce((sum, order) => {
      if (!Array.isArray(order.items)) return sum;
      return sum + order.items.reduce((iSum, item) => iSum + (item.quantity || 0), 0);
    }, 0);

    const averageOrderValue =
      totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0;

    // Aggregate pizza sales & popularity
    const pizzaCounts = {};
    for (const order of orders) {
      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          const name = item.name || 'Custom Pizza';
          if (!pizzaCounts[name]) {
            pizzaCounts[name] = { count: 0, revenue: 0 };
          }
          pizzaCounts[name].count += item.quantity || 0;
          pizzaCounts[name].revenue += item.subtotal || (item.unitPrice || 0) * (item.quantity || 0);
        }
      }
    }

    let mostOrderedPizza = null;
    let maxCount = 0;
    for (const [name, stats] of Object.entries(pizzaCounts)) {
      if (stats.count > maxCount) {
        maxCount = stats.count;
        mostOrderedPizza = { title: name, count: stats.count };
      }
    }

    const topPizzas = Object.entries(pizzaCounts)
      .map(([name, stats]) => ({
        title: name,
        count: stats.count,
        revenue: Math.round(stats.revenue * 100) / 100
      }))
      .sort((a, b) => b.count - a.count);

    // Identify Customer Favorite (customer with highest order count in period)
    const customerOrderCounts = {};
    for (const order of orders) {
      if (order.user) {
        const uId = order.user._id ? order.user._id.toString() : order.user.toString();
        if (!customerOrderCounts[uId]) {
          customerOrderCounts[uId] = {
            id: uId,
            name: order.user.name || 'Valued Customer',
            email: order.user.email || '',
            orderCount: 0
          };
        }
        customerOrderCounts[uId].orderCount += 1;
      }
    }

    let customerFavorite = null;
    let maxCustomerOrders = 0;
    for (const cust of Object.values(customerOrderCounts)) {
      if (cust.orderCount > maxCustomerOrders) {
        maxCustomerOrders = cust.orderCount;
        customerFavorite = {
          name: cust.name,
          email: cust.email,
          orderCount: cust.orderCount
        };
      }
    }

    // Daily Timeline for charts
    const timelineMap = {};
    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().slice(0, 10);
      if (!timelineMap[dateKey]) {
        timelineMap[dateKey] = { date: dateKey, orders: 0, revenue: 0 };
      }
      timelineMap[dateKey].orders += 1;
      timelineMap[dateKey].revenue += order.total || 0;
    }

    const timeline = Object.values(timelineMap)
      .map((t) => ({
        ...t,
        revenue: Math.round(t.revenue * 100) / 100
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return res.status(200).json({
      success: true,
      data: {
        period,
        startDate,
        endDate,
        totalOrders,
        totalRevenue,
        pizzasSold,
        averageOrderValue,
        mostOrderedPizza,
        customerFavorite,
        timeline,
        topPizzas
      }
    });
  } catch (error) {
    console.error('[AnalyticsController] getAdminAnalytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve analytics metrics',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/inventory/test-alert
 * Dispatches a manual test low-stock email.
 * Non-mutating test mode. Strictly unavailable in production.
 */
const testInventoryAlert = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Test alert endpoint is not available in production'
    });
  }

  try {
    const result = await checkInventoryAndSendAlerts({ isTestMode: true });
    return res.status(200).json({
      success: true,
      message: 'Test inventory alert processed successfully',
      data: result
    });
  } catch (error) {
    console.error('[AnalyticsController] testInventoryAlert error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to dispatch test alert'
    });
  }
};

module.exports = {
  getAdminAnalytics,
  testInventoryAlert,
  getDateRangeForPeriod
};
