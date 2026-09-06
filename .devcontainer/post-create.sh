#!/usr/bin/env bash
set -euo pipefail

source "$NVM_DIR/nvm.sh"
nvm install
nvm alias default "$(cat .nvmrc)"

corepack enable
corepack prepare "$(jq -r '.packageManager' package.json)" --activate

yarn install
