import { exportLightFM } from "../services/exportDataService.js"  // script existant de génération des CSV
import { exec } from "child_process";
import path from "path";

//  Génération des CSV
async function generateDatasets() {
  try {
    console.log("🚀 Génération des datasets LightFM...");
    await exportLightFM(); // ça crée passengers.csv, drivers.csv, interactions.csv
    console.log(" CSV générés !");
  } catch (err) {
    console.error(" Erreur génération CSV:", err);
  }
}

//  Réentrainement du modèle LightFM
function retrainModel() {
  console.log("🚀 Démarrage du réentrainement du modèle LightFM...");
  
  // Chemin vers ton script Python qui entraîne LightFM
  const pythonScriptPath = path.join(process.cwd(), "../ml-service/service/retrain.py");

  exec(`python3 ${pythonScriptPath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Erreur lors du réentrainement: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Erreur Python: ${stderr}`);
      return;
    }
    console.log("Modèle LightFM réentrainé avec succès !");
    console.log(stdout);
  });
}

//  Fonction principale
async function main() {
  await generateDatasets();
  retrainModel();
}

main();
