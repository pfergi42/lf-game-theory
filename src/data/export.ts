import { writeFileSync } from 'fs';
import { DataStore } from './store.js';

export function exportToCSV(store: DataStore, experimentId: string, outputPath: string): void {
  const csv = store.exportDecisionsCSV(experimentId);
  if (!csv) {
    console.log('No data to export');
    return;
  }
  writeFileSync(outputPath, csv, 'utf-8');
  console.log(`Exported decisions to ${outputPath}`);
}

export function exportToJSON(store: DataStore, experimentId: string, outputPath: string): void {
  const sessions = store.getSessionsByExperiment(experimentId, 'completed');
  const data = sessions.map(session => {
    const decisions = store.getDecisions(session.id);
    const payments = store.getPayments(session.id);
    return { session, decisions, payments };
  });
  writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Exported ${sessions.length} sessions to ${outputPath}`);
}
