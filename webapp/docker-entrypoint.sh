#!/bin/sh
set -eu

fail() {
  printf '%s\n' "[VBAI CONFIG ERROR] $*" >&2
  exit 1
}

required_vars="
APP_ENV
PORT
API_BASE_URL
GIT_SHA
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_AUTH_HOST
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
"

for variable_name in $required_vars; do
  eval "variable_value=\${$variable_name:-}"
  [ -n "$variable_value" ] || fail "Missing required environment variable: $variable_name"
done

case "$APP_ENV" in
  staging|production) ;;
  *) fail "APP_ENV must be staging or production." ;;
esac

case "$PORT" in
  *[!0-9]*|'') fail "PORT must contain digits only." ;;
esac

case "$API_BASE_URL" in
  https://*) ;;
  *) fail "API_BASE_URL must be an HTTPS URL." ;;
esac
case "$API_BASE_URL" in
  *';'*|*' '*|*'$'*|*'`'*) fail "API_BASE_URL contains forbidden characters." ;;
esac

printf '%s' "$GIT_SHA" | grep -Eq '^[0-9a-f]{40}$' ||
  fail "GIT_SHA must be an exact lowercase 40-character commit SHA."

case "$FIREBASE_API_KEY" in
  *[!A-Za-z0-9_-]*|'') fail "FIREBASE_API_KEY contains invalid characters." ;;
esac

for host_value in "$FIREBASE_AUTH_DOMAIN" "$FIREBASE_AUTH_HOST" "$FIREBASE_STORAGE_BUCKET"; do
  case "$host_value" in
    *[!A-Za-z0-9.-]*|'') fail "Firebase host value contains invalid characters." ;;
  esac
done

case "$FIREBASE_PROJECT_ID" in
  *[!a-z0-9-]*|'') fail "FIREBASE_PROJECT_ID contains invalid characters." ;;
esac
case "$FIREBASE_MESSAGING_SENDER_ID" in
  *[!0-9]*|'') fail "FIREBASE_MESSAGING_SENDER_ID must contain digits only." ;;
esac
case "$FIREBASE_APP_ID" in
  *[!A-Za-z0-9:]*|'') fail "FIREBASE_APP_ID contains invalid characters." ;;
esac

if [ "$APP_ENV" = "staging" ]; then
  [ "$FIREBASE_PROJECT_ID" = "vbai-staging-7a17c2af" ] || fail "Staging Firebase project mismatch."
  [ "$FIREBASE_AUTH_DOMAIN" = "vbai-staging-7a17c2af.firebaseapp.com" ] || fail "Staging Firebase auth domain mismatch."
  [ "$FIREBASE_AUTH_HOST" = "vbai-staging-7a17c2af.firebaseapp.com" ] || fail "Staging Firebase auth proxy host mismatch."
  [ "$FIREBASE_STORAGE_BUCKET" = "vbai-staging-7a17c2af.firebasestorage.app" ] || fail "Staging Firebase storage bucket mismatch."
  [ "$FIREBASE_MESSAGING_SENDER_ID" = "684023952241" ] || fail "Staging Firebase sender ID mismatch."
  case "$FIREBASE_APP_ID" in 1:684023952241:*) ;; *) fail "Staging Firebase app ID mismatch." ;; esac
fi

if [ "$APP_ENV" = "production" ]; then
  [ "$FIREBASE_PROJECT_ID" = "gen-lang-client-0462350485" ] || fail "Production Firebase project mismatch."
  [ "$FIREBASE_AUTH_DOMAIN" = "gen-lang-client-0462350485.firebaseapp.com" ] || fail "Production Firebase auth domain mismatch."
  [ "$FIREBASE_AUTH_HOST" = "gen-lang-client-0462350485.firebaseapp.com" ] || fail "Production Firebase auth proxy host mismatch."
  [ "$FIREBASE_STORAGE_BUCKET" = "gen-lang-client-0462350485.firebasestorage.app" ] || fail "Production Firebase storage bucket mismatch."
  [ "$FIREBASE_MESSAGING_SENDER_ID" = "419728335518" ] || fail "Production Firebase sender ID mismatch."
  case "$FIREBASE_APP_ID" in 1:419728335518:*) ;; *) fail "Production Firebase app ID mismatch." ;; esac
fi

umask 022
envsubst \
  '${APP_ENV} ${FIREBASE_API_KEY} ${FIREBASE_AUTH_DOMAIN} ${FIREBASE_PROJECT_ID} ${FIREBASE_STORAGE_BUCKET} ${FIREBASE_MESSAGING_SENDER_ID} ${FIREBASE_APP_ID}' \
  < /etc/vbai/runtime-config.template.js \
  > /usr/share/nginx/html/runtime-config.js

envsubst '${PORT} ${API_BASE_URL} ${FIREBASE_AUTH_HOST}' \
  < /etc/nginx/conf.d/config.template \
  > /etc/nginx/conf.d/default.conf

grep -Fq "\"gitSha\": \"$GIT_SHA\"" /usr/share/nginx/html/build-info.json ||
  fail "Built artifact SHA does not match runtime GIT_SHA."
grep -Fq '"product": "VBAI Legal Pro V2"' /usr/share/nginx/html/build-info.json ||
  fail "Built artifact product identity is invalid."

if [ "$APP_ENV" = "staging" ]; then
  grep -Fq 'APP_ENV: "staging"' /usr/share/nginx/html/runtime-config.js || fail "Generated runtime config is not staging."
  grep -Fq 'FIREBASE_PROJECT_ID: "vbai-staging-7a17c2af"' /usr/share/nginx/html/runtime-config.js || fail "Generated runtime config has the wrong staging project."
  ! grep -Fq 'gen-lang-client-0462350485' /usr/share/nginx/html/runtime-config.js || fail "Generated staging config contains production project data."
fi

printf '%s\n' "[VBAI] Runtime configuration validated: ${APP_ENV}/${FIREBASE_PROJECT_ID}/${GIT_SHA}"
exec nginx -g 'daemon off;'
