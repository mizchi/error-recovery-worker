#!/bin/bash

# required on mac: brew install gsed
gsed -i "s/exports.quickSort = function/exports.quickSort = ()=>{};function nop/" node_modules/source-map-js/lib/quick-sort.js
echo 'patch node_modules/source-map-js/lib/quick-sort.js'
pnpm wrangler deploy --dry-run --minify --outdir dist src/worker.ts
wrangler r2 object put scm-bucket/worker.js.map --file=dist/worker.js.map
