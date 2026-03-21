# test_recommender.py
import asyncio
from recommender import get_recommendations

async def test():
    result = await get_recommendations(
        passenger_id="36",
        preferences={
            "quiet_ride": "yes",
            "radio_ok": "no",
            "smoking_ok": "no",
            "pets_ok": "no",
            "luggage_large": "no",
            "female_driver_pref": "no"
        },
        trajet={
            "startLat": 36.7538,
            "startLng": 3.0588,
            "distanceKm": 30,
            "heureDepart": "08:00",
            "dateDepart": "2026-04-01T08:00:00Z"
        },
        top_n=5
    )
    print(f"\n🏆 Top {len(result)} drivers recommandés:")
    for i, d in enumerate(result, 1):
        print(f"  {i}. {d.get('prenom')} {d.get('nom')} — dist: {d.get('distance_km')}km")

asyncio.run(test())