const config = require('../config');

const PAYSTACK_BASE = 'https://api.paystack.co';
// Abort a hung upstream call instead of holding the request (and a client)
// hostage. On timeout the payment controller rolls the pending row back.
const PAYSTACK_TIMEOUT_MS = 15000;

async function paystackRequest(path, method = 'GET', body = null) {
  if (!config.paystack.secretKey) {
    const err = new Error('PAYSTACK_SECRET_KEY is not configured');
    err.code = 'PAYSTACK_CONFIG_MISSING';
    throw err;
  }

  const url = `${PAYSTACK_BASE}${path}`;
  const headers = {
    Authorization: `Bearer ${config.paystack.secretKey}`,
    'Content-Type': 'application/json',
  };

  const options = { method, headers, signal: AbortSignal.timeout(PAYSTACK_TIMEOUT_MS) };
  if (body) {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (networkError) {
    const err = new Error(
      networkError.name === 'TimeoutError'
        ? `Paystack request timed out after ${PAYSTACK_TIMEOUT_MS}ms`
        : `Paystack request failed: ${networkError.message}`
    );
    err.code = networkError.name === 'TimeoutError' ? 'PAYSTACK_TIMEOUT' : 'PAYSTACK_NETWORK';
    throw err;
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON body — surfaced as a Paystack API error below.
  }

  if (!response.ok || !data || !data.status) {
    const err = new Error(data && data.message ? data.message : `Paystack API error: ${response.status}`);
    err.status = response.status;
    err.code = 'PAYSTACK_API_ERROR';
    throw err;
  }
  return data;
}

async function initializeTransaction({ email, amount, reference, metadata = {} }) {
  return paystackRequest('/transaction/initialize', 'POST', {
    email,
    amount, // in kobo
    reference,
    metadata,
    currency: 'NGN',
  });
}

async function verifyTransaction(reference) {
  return paystackRequest(`/transaction/verify/${reference}`);
}

module.exports = { initializeTransaction, verifyTransaction, paystackRequest };