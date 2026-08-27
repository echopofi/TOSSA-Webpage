const config = require('../config');

const PAYSTACK_BASE = 'https://api.paystack.co';

async function paystackRequest(path, method = 'GET', body = null) {
  const url = `${PAYSTACK_BASE}${path}`;
  const headers = {
    Authorization: `Bearer ${config.paystack.secretKey}`,
    'Content-Type': 'application/json',
  };

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(data.message || `Paystack API error: ${response.status}`);
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
