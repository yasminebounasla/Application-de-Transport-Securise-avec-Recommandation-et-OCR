// test.slsqp.js — ENVOIE LES FEEDBACKS À FASTAPI POUR TESTER SLSQP
//
// Lance APRÈS seed.mlscores.js
// Envoie les scores + notes réelles à POST /feedback jusqu'à déclencher SLSQP

import { prisma } from "../config/prisma.js";
import axios from "axios";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

async function testSlsqp() {
  console.log("\n🚀 Test optimisation SLSQP\n");

  try {
    const trajets = await prisma.trajet.findMany({
      where: {
        status:   "COMPLETED",
        mlScores: { not: null },
        evaluation: { isNot: null },
      },
      include: { evaluation: true },
      take: 100,
    });

    console.log(`✅ ${trajets.length} trajets avec mlScores trouvés\n`);

    let sent    = 0;
    let failed  = 0;

    for (const trajet of trajets) {
      try {
        await axios.post(
          `${ML_SERVICE_URL}/feedback`,
          {
            rating: trajet.evaluation.rating,
            scores: trajet.mlScores,
          },
          { timeout: 5000 },
        );
        sent++;
        if (sent % 10 === 0) {
          console.log(`   ${sent}/${trajets.length} feedbacks envoyés...`);
        }
      } catch (err) {
        failed++;
        if (failed <= 3) {
          console.warn(`⚠️  Feedback échoué trajet ${trajet.id}: ${err.message}`);
        }
      }
    }

    console.log(`\n✅ ${sent} feedbacks envoyés`);
    if (failed > 0) console.log(`⚠️  ${failed} échecs`);

    if (sent >= 50) {
      console.log("\n✅ Seuil 50 atteint — SLSQP devrait s'être déclenché");
      console.log("   Vérifie optimized_weights.json dans le service Reco");
    } else {
      console.log(`\n⚠️  Seulement ${sent} feedbacks — seuil 50 non atteint`);
      console.log("   Lance seed.trajets.js pour créer plus de trajets");
    }

  } catch (error) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testSlsqp();