import cron from 'node-cron';
import { main as retrainScheduler } from './retrainScheduler.js';

// Exécute le réentrainement tous les jours à minuit
cron.schedule('0 0 * * *', async () => {
  console.log('🔄 Lancement automatique du réentrainement LightFM...');
  await retrainScheduler();
});
