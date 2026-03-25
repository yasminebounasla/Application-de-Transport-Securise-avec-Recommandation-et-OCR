// cron.js dans Express
import cron from 'node-cron'
import { exec } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Chemins absolus — indépendants du working directory au moment du lancement
const ML_SERVICE_DIR = path.resolve(__dirname, '../../../ml-service')
const RETRAIN_SCRIPT = path.join(ML_SERVICE_DIR, 'service', 'retrain.py')
const PYTHON_PATH    = path.join(ML_SERVICE_DIR, 'venv', 'Scripts', 'python.exe')
const RETRAIN_CWD    = path.join(ML_SERVICE_DIR, 'service')

// Toutes les semaines lundi à 3h du matin
// '0 3 * * 1' = lundi 3h | '* * * * *' = chaque minute (pour tester)
cron.schedule('0 3 * * 1', () => {
  console.log('🔄 Réentraînement automatique du modèle LightFM...')

  exec(
    `"${PYTHON_PATH}" "${RETRAIN_SCRIPT}"`,
    { cwd: RETRAIN_CWD },
    (err, stdout, stderr) => {
      if (err) {
        console.error('❌ Erreur retrain:', err.message)
        if (stderr) console.error('stderr:', stderr)
      } else {
        console.log('✅ Modèle réentraîné avec succès')
        if (stdout) console.log(stdout)
      }
    }
  )
})