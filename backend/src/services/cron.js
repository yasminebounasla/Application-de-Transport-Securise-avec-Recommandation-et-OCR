// Dans ton serveur Express, ajoute un cron job
import cron from 'node-cron';
import { exportLightFM } from './exportDataService.js';

// Exporter tous les lundis à 2h du matin
cron.schedule('0 2 * * 1', async () => {
  console.log('🔄 Export LightFM démarré...');
  await exportLightFM();
  console.log('✅ Export terminé');
});