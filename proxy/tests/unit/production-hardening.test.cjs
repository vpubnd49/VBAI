'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const authSource = fs.readFileSync(path.join(__dirname, '..', '..', 'services', 'auth.service.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');

assert.match(authSource, /process\.env\.JWT_SECRET\s*\|\|\s*''/, 'JWT secret has no fallback value');
assert.match(authSource, /JWT_SECRET is required in production/, 'JWT secret fails closed in production');
assert.match(serverSource, /ALLOWED_ORIGINS is required in production/, 'CORS fails closed without production origins');
assert.match(serverSource, /const ALLOWED_ORIGINS/, 'CORS allowlist is explicit');
assert.match(serverSource, /Wildcard ALLOWED_ORIGINS is not permitted in production/, 'CORS rejects wildcard in production');
assert.match(serverSource, /some\(value => \['production', 'prod'\]/, 'CORS detects production from either environment variable');

console.log('PASS: production secret and CORS hardening');
