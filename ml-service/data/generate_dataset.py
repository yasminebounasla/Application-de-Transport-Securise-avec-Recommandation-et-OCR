import pandas as pd
import random
from sklearn.preprocessing import MinMaxScaler

NUM_PASSENGERS = 250
NUM_DRIVERS = 90
INTERACTIONS_PER_PASSENGER = 40 

yes_no = ["yes", "no"]
times_of_day = ["morning", "afternoon", "evening", "night"]

# --- GENERATE PASSENGERS ---
passengers = [{
    "passenger_id": f"P{i}",
    "quiet_ride": random.choice(yes_no),
    "radio_ok": random.choice(yes_no),
    "smoking_ok": random.choice(yes_no),
    "pets_ok": random.choice(yes_no),
    "luggage_large": random.choice(yes_no),
    "female_driver_pref": random.choice(yes_no)
} for i in range(NUM_PASSENGERS)]

# --- GENERATE DRIVERS ---
drivers = [{
    "driver_id": f"D{i}",
    "talkative": random.choice(yes_no),
    "radio_on": random.choice(yes_no),
    "smoking_allowed": random.choice(yes_no),
    "pets_allowed": random.choice(yes_no),
    "car_big": random.choice(yes_no),
    "driver_gender": random.choice(["male", "female"]),
    "rating": round(random.uniform(3.5, 5.0), 1),
    "works_morning": random.choice(yes_no),
    "works_afternoon": random.choice(yes_no),
    "works_evening": random.choice(yes_no),
    "works_night": random.choice(yes_no)
} for i in range(NUM_DRIVERS)]

# --- GENERATE INTERACTIONS ---
interactions = []
for p in passengers:
    sampled_drivers = random.sample(drivers, INTERACTIONS_PER_PASSENGER)
    for d in sampled_drivers:
        score = 0
        if p["quiet_ride"] == "yes" and d["talkative"] == "no": score += 3
        if p["radio_ok"] == "no" and d["radio_on"] == "yes": score -= 2
        if p["luggage_large"] == "yes" and d["car_big"] == "no": score -= 4
        if p["female_driver_pref"] == "yes" and d["driver_gender"] == "female": score += 3
        
        score += random.uniform(-1.5, 1.5) 
        interactions.append({
            "passenger_id": p["passenger_id"],
            "driver_id": d["driver_id"],
            "weight": score
        })

interactions_df = pd.DataFrame(interactions)
scaler = MinMaxScaler()
interactions_df["weight"] = scaler.fit_transform(interactions_df[["weight"]])

# Sauvegarde physique
pd.DataFrame(passengers).to_csv("passengers.csv", index=False)
pd.DataFrame(drivers).to_csv("drivers.csv", index=False)
interactions_df.to_csv("interactions.csv", index=False)
print("Datasets générés : passengers.csv, drivers.csv, interactions.csv")