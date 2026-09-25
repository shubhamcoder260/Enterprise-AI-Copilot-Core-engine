// ============================================================
// SQLITE SEMANTIC PROFILE FRAGMENT
// Sibling profile for SQLite databases (U3_institute, B1_community, etc.)
// ==========================================

import { deepFreeze } from '../../adapters/dialects/index.js';

export const SQLITE_PROFILE = deepFreeze({
  dialect: 'sqlite',
  temporalDefaults: {
    yearFunction: (col) => `strftime('%Y', "${col}")`,
    currentYear: '2024'
  },
  moduleVocab: {
    education: ['students', 'enrollments', 'courses', 'instructors', 'departments'],
    healthcare: ['patients', 'doctors', 'visits', 'diagnoses', 'prescriptions'],
    banking: ['accounts', 'loans', 'transactions', 'branches']
  },
  docstatusRequired: false,
  identifierQuoting: '"'
});
