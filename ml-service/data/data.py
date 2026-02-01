import pandas as pd
import random
from sklearn.preprocessing import MinMaxScaler

NUM_PASSENGERS = 800 
NUM_DRIVERS = 150
INTERACTIONS_PER_PASSENGER = 40

# --- PASSENGERS ---
passengers = [{
    "passenger_id": f"P{i}",
    "quiet_ride": random.choice(["yes", "no"]),
    "female_driver_pref": random.choice(["yes", "no"]),
    "radio_ok": random.choice(["yes", "no"]),
    "pets_ok": random.choice(["yes", "no"]),
    "luggage_large": random.choice(["yes", "no"])
} for i in range(NUM_PASSENGERS)]

# --- DRIVERS ---
drivers = [{
    "driver_id": f"D{i}",
    "talkative": random.choice(["yes", "no"]),
    "driver_gender": random.choice(["male", "female"]),
    "radio_on": random.choice(["yes", "no"]),
    "pets_allowed": random.choice(["yes", "no"]),
    "car_big": random.choice(["yes", "no"])
} for i in range(NUM_DRIVERS)]

# --- INTERACTIONS ---
interactions = []
for p in passengers:
    for d in random.sample(drivers, INTERACTIONS_PER_PASSENGER):
        score = 50
        # Logique cumulative
        if p["quiet_ride"] == "yes" and d["talkative"] == "no": score += 20
        if p["female_driver_pref"] == "yes" and d["driver_gender"] == "female": score += 20
        if p["radio_ok"] == "no" and d["radio_on"] == "yes": score -= 15
        if p["pets_ok"] == "yes" and d["pets_allowed"] == "yes": score += 15
        if p["luggage_large"] == "yes" and d["car_big"] == "yes": score += 15
        
        score += random.randint(-5, 5)
        interactions.append({"passenger_id": p["passenger_id"], "driver_id": d["driver_id"], "weight": score})

pd.DataFrame(passengers).to_csv("passengers.csv", index=False)
pd.DataFrame(drivers).to_csv("drivers.csv", index=False)
df_int = pd.DataFrame(interactions)
df_int["weight"] = MinMaxScaler().fit_transform(df_int[["weight"]])
df_int.to_csv("interactions.csv", index=False)
print("Dataset complet généré !")