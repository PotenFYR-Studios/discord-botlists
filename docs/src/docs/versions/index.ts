// Archived doc versions. Frozen at release time by scripts/snapshot-docs.mjs.
// Each file exports a full DocVersion with version, label and sections.
import type { DocVersion } from '../content';
import { v1_0_0_SECTIONS } from './v1_0_0.js';

export const ARCHIVED_VERSIONS: DocVersion[] = [
  { version: '1.0.0', label: 'v1.0.0', sections: v1_0_0_SECTIONS },
];
