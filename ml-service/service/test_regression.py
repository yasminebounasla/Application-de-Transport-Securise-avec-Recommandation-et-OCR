# test_regression.py
import asyncio
import random
from recommender import get_recommendations, add_feedback_to_buffer, _scores_history, _optimized_weights

async def test():
    print("=" * 60)
    print("ÉTAPE 1 — Une vraie recommandation pour générer les logs")
    print("=" * 60)

    result = await get_recommendations(
        passenger_id="36",
        preferences={
            "quiet_ride": "yes",
            "smoking_ok": "no",
        },
        trajet={
            "rideId": 9999,
            "startLat": 36.7538,
            "startLng": 3.0588,
            "distanceKm": 30,
            "heureDepart": "08:00",
            "dateDepart": "2026-04-01T08:00:00Z",
        },
        top_n=5
    )

    driver_ids = [d["id"] for d in result]
    print(f"\n✅ Drivers retournés : {driver_ids}")

    print("\n" + "=" * 60)
    print("ÉTAPE 2 — Simuler 50 feedbacks pour déclencher la régression")
    print("=" * 60)

    for i in range(50):
        driver_id = random.choice(driver_ids) if driver_ids else 1
        rating = round(random.uniform(2.5, 5.0), 1)   # notes réalistes
        success = add_feedback_to_buffer(
            ride_id=str(9999 + i),
            driver_id=f"D{driver_id}",
            real_rating=rating
        )
        if not success:
            # Si le log n'existe pas pour cet ID, on injecte directement
            from recommender import _scores_history
            _scores_history.append({
                'lightfm': random.uniform(0.3, 0.9),
                'pref':    random.uniform(0.2, 0.8),
                'dist':    random.uniform(0.3, 0.9),
                'work':    random.choice([0.2, 1.0]),
                'rating':  random.uniform(0.5, 1.0),
                'target':  (rating - 1) / 4,
            })

    print(f"\n✅ Buffer : {len(_scores_history)} observations")

    print("\n" + "=" * 60)
    print("ÉTAPE 3 — Résultat de la régression")
    print("=" * 60)

    from recommender import _try_optimize_weights
    weights = _try_optimize_weights()

    if weights is not None:
        labels = ["LightFM", "Pref", "Dist", "Work", "Rating"]
        print("\nPoids appris vs poids hardcodés :")
        hardcoded = [0.60, 0.15, 0.10, 0.10, 0.05]
        for label, w, h in zip(labels, weights, hardcoded):
            bar = "█" * int(w * 40)
            print(f"  {label:8s} : {w:.3f}  {bar}  (hardcodé: {h:.2f})")
        print(f"\n  Somme des poids : {weights.sum():.4f} (doit être ≈ 1.0)")
    else:
        print("❌ Régression non déclenchée — buffer insuffisant")

asyncio.run(test())