// netlify/functions/api.js
const serverless = require('serverless-http');
const { app, ready } = require('../../backend/app');

let handler;

exports.handler = async (event, context) => {
  await ready; // ensure DB is initialized once per cold start
  if (!handler) {
    handler = serverless(app);
  }
  return handler(event, context);
};