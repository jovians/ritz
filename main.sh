#!/bin/bash
NPM_BIN_DIR=$(which npm)
NPM_DIR=${NPM_BIN_DIR::${#NPM_BIN_DIR}-8}
NODE_MOULES_DIR="$NPM_DIR/lib/node_modules"

# Node modules path
PACKAGE_DIR="$NODE_MOULES_DIR/ritz2"
export NODE_OPTIONS=--max_old_space_size=262144

known_commands="transform:revert:recompile"
if [[ ":$known_commands:" = *:$1:* ]]; then
  node --enable-source-maps --max-old-space-size=262144 "$PACKAGE_DIR/main.js" "$@"
else
  set -- "run" "$@"
  node --enable-source-maps --max-old-space-size=262144 "$PACKAGE_DIR/main.js" "$@"
fi
