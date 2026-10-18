#!/usr/bin/env node
// marks dist/cjs as CommonJS (the package root is "type": "module").
import { writeFileSync } from 'node:fs';
writeFileSync(new URL('../dist/cjs/package.json', import.meta.url), '{"type":"commonjs"}\n');
