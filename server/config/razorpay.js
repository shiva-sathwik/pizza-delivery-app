const crypto = require('crypto');
const Razorpay = require('razorpay');

const getKeyId = () => process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key_id';
const getKeySecret = () => process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret_never_commit_real_secret';

const KEY_ID = getKeyId();
const KEY_SECRET = getKeySecret();

let razorpayInstance = null;
try {
  razorpayInstance = new Razorpay({
    key_id: KEY_ID,
    key_secret: KEY_SECRET
  });
} catch (err) {
  console.warn('[RazorpayConfig] Razorpay SDK initialization note:', err.message);
}

const isPlaceholderKey = () => {
  const kid = getKeyId();
  const ksec = getKeySecret();
  return (
    !kid ||
    kid.includes('placeholder') ||
    !ksec ||
    ksec.includes('placeholder')
  );
};

/**
 * Create Razorpay Order
 * @param {{ amount: number, currency?: string, receipt: string }} param0
 */
const createRazorpayOrder = async ({ amount, currency = 'INR', receipt }) => {
  // If in non-production with placeholder keys, return a safe simulated test order
  if (process.env.NODE_ENV !== 'production' && isPlaceholderKey()) {
    console.log('[RazorpayConfig] (Dev/Test Mode) Generating simulated Razorpay order');
    return {
      id: `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      amount,
      currency,
      receipt,
      status: 'created',
      isSimulated: true
    };
  }

  // Live or Valid Test Mode Razorpay API call
  try {
    const order = await razorpayInstance.orders.create({
      amount: Math.round(amount),
      currency,
      receipt
    });
    return order;
  } catch (error) {
    // If running in development and Razorpay credentials fail auth, provide safe test order
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[RazorpayConfig] Razorpay API call failed in dev mode, falling back to simulated test order:', error.message);
      return {
        id: `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        amount,
        currency,
        receipt,
        status: 'created',
        isSimulated: true
      };
    }
    throw error;
  }
};

/**
 * Verify Razorpay Payment Signature Server-Side using HMAC-SHA256
 * @param {{ razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string }} param0
 * @returns {boolean}
 */
const verifyRazorpaySignature = ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature
}) => {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return false;
  }

  const secret = getKeySecret();
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  try {
    const bufGenerated = Buffer.from(generatedSignature, 'utf-8');
    const bufReceived = Buffer.from(razorpay_signature, 'utf-8');

    if (bufGenerated.length !== bufReceived.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufGenerated, bufReceived);
  } catch {
    return false;
  }
};

/**
 * Issue or record a Razorpay refund when post-capture inventory depletion occurs
 * @param {{ paymentId: string, amount: number, notes?: object }} param0
 */
const issueRazorpayRefund = async ({ paymentId, amount, notes = {} }) => {
  if (process.env.NODE_ENV !== 'production' && isPlaceholderKey()) {
    console.log(`[RazorpayConfig] (Dev/Test Mode) Simulated refund issued for payment ${paymentId} (₹${amount / 100})`);
    return {
      id: `rfnd_test_${Date.now()}`,
      payment_id: paymentId,
      amount,
      status: 'processed',
      notes
    };
  }

  try {
    const refund = await razorpayInstance.payments.refund(paymentId, {
      amount: Math.round(amount),
      notes
    });
    return refund;
  } catch (error) {
    console.error(`[RazorpayConfig] Error executing refund for ${paymentId}:`, error.message);
    return {
      id: `rfnd_pending_${Date.now()}`,
      payment_id: paymentId,
      amount,
      status: 'pending_manual_review',
      error: error.message
    };
  }
};

/**
 * Generate Authentic HMAC Test Signature (Strictly Development / Testing Only)
 */
const generateTestSignature = ({ razorpay_order_id, razorpay_payment_id }) => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Test signature generation is forbidden in production');
  }
  const secret = getKeySecret();
  return crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
};

module.exports = {
  KEY_ID,
  KEY_SECRET,
  getKeyId,
  getKeySecret,
  isPlaceholderKey,
  createRazorpayOrder,
  verifyRazorpaySignature,
  issueRazorpayRefund,
  generateTestSignature
};

