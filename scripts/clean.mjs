#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import path from 'node:path';

import fs from 'fs-extra';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = [path.join(root, 'dist'), path.join(root, 'coverage')];

for (const target of targets) {
  if (await fs.pathExists(target)) {
    await fs.remove(target);
    console.log(`removed ${path.relative(root, target)}`);
  }
}
