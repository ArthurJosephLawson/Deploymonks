#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');

const entry = path.join(__dirname, '..', 'dist', 'cli', 'index.js');

import(pathToFileURL(entry).href)
  .then((mod) => mod.main(process.argv.slice(2)))
  .catch((error) => {
    const message = error && error.message ? error.message : String(error);
    process.stderr.write(`deploymonk: failed to start: ${message}\n`);
    if (process.env.DEPLOYMONK_DEBUG === '1' && error && error.stack) {
      process.stderr.write(`${error.stack}\n`);
    }
    process.exitCode = 1;
  });
