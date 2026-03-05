// cron.js dans Express
import cron from 'node-cron'
import { exportLightFM } from '../services/exportDataService.js'
import { exec } from 'child_process'

// Toutes les semaines lundi 3h
cron.schedule('* * * * *', async () => {
  console.log('Réentraînement automatique...')
  
  // 1. Export CSV
  await exportLightFM()
  
  // 2. Lancer retrain.py
  exec('python ml-service/service/retrain.py', (err, stdout) => {
    if (err) console.error('❌ Erreur train:', err)
    else console.log('✅ Modèle réentraîné:', stdout)
  })
})