// seed.mlscores.js — SEED POUR TESTER L'OPTIMISATION SLSQP
//
// Ce seed ne crée PAS de nouveaux trajets/passagers/drivers.
// Il remplit uniquement mlScores sur les trajets COMPLETED existants
// qui ont une évaluation mais pas encore de mlScores.
//
// But : avoir 50+ entrées dans le buffer feedback pour déclencher SLSQP.

import { prisma } from "../config/prisma.js";
import { PrismaClient, Prisma } from "@prisma/client";

const randomFloat = (min, max) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(3));

function generateRealisticScores(rating) {
  // On génère des scores cohérents avec la note réelle
  // Une bonne note → scores élevés, une mauvaise note → scores bas
  const isGood = rating >= 4;

  return {
    lightfm: isGood ? randomFloat(0.55, 0.95) : randomFloat(0.10, 0.45),
    pref:    isGood ? randomFloat(0.60, 1.00) : randomFloat(0.05, 0.40),
    dist:    randomFloat(0.30, 0.90), // distance moins corrélée à la note
    rating:  isGood ? randomFloat(0.55, 0.95) : randomFloat(0.10, 0.50),
  };
}

async function seedMlScores() {
  console.log("\n🚀 Seed mlScores — pour tester l'optimisation SLSQP\n");
try {
  const trajets = await prisma.trajet.findMany({
    where: {
        status: "COMPLETED",
    },
    include: { evaluation: true },
    take: 200,
    });

    const trajetsWithEval = trajets.filter(
    (t) => t.evaluation !== null && t.mlScores === null
    );

    console.log(`✅ ${trajetsWithEval.length} trajets éligibles trouvés\n`);

    if (trajetsWithEval.length === 0) {
    console.log("⚠️  Aucun trajet éligible");
    return;
    }

    for (const trajet of trajetsWithEval) {
    const rating = trajet.evaluation.rating;
    const scores = generateRealisticScores(rating);

    await prisma.trajet.update({
        where: { id: trajet.id },
        data:  { mlScores: scores },
    });
    }

    console.log(`✅ ${updated} trajets mis à jour avec mlScores`);

    // ── Résumé ────────────────────────────────────────────────────────────
    console.log("\n📊 Résumé des scores générés :");
    console.log("   Les scores sont corrélés avec les notes réelles :");
    console.log("   Note 4-5 → scores élevés (0.55-0.95)");
    console.log("   Note 1-2 → scores bas   (0.05-0.45)");
    console.log(`\n💡 Lance maintenant POST /feedback avec ces trajets`);
    console.log(`   Dès 50 feedbacks dans le buffer → SLSQP se déclenche\n`);

    // ── Vérification buffer actuel ────────────────────────────────────────
    console.log("📋 Pour tester :");
    console.log("   1. Lance ce seed");
    console.log("   2. Appelle POST /feedback pour chaque trajet mis à jour");
    console.log("   3. Vérifie optimized_weights.json après 50 appels\n");

  } catch (error) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await prisma.$disconnect();
  }

}
seedMlScores();