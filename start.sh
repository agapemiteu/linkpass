#!/bin/sh
# With R2 credentials: restore the last copy of the database, then run the app while streaming changes.
# Without them: run the app on local storage only.
set -e
if [ -n "$LITESTREAM_ACCESS_KEY_ID" ] && [ -n "$R2_ACCOUNT_ID" ]; then
  litestream restore -config /app/litestream.yml -if-db-not-exists -if-replica-exists /data/linkpass.db
  exec litestream replicate -config /app/litestream.yml -exec "node server.js"
fi
exec node server.js
