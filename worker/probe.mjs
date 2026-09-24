import * as clubs from './src/jobs/clubs.js';
clubs.REGIONS.splice(0, clubs.REGIONS.length, 'GB-ENG');
const state = { startedAt: Date.now(), summary: {} };
await clubs.runClubs(state);
console.log('summary', JSON.stringify(state.summary), 'in', Math.round((Date.now() - state.startedAt) / 1000), 's');
