import pandas as pd
import random

NUM_PASSENGERS = 250
NUM_DRIVERS = 90
INTERACTIONS_PER_PASSENGER = 60  # → ~15 000 interactions

yes_no = ["yes", "no"]
times_of_day = ["morning", "afternoon", "evening", "night"]

# -------------------------
# GENERATE PASSENGERS
# -------------------------
passengers = []

for i in range(NUM_PASSENGERS):
    passengers.append({
        "passenger_id": f"P{i}",
        "quiet_ride": random.choice(yes_no),
        "radio_ok": random.choice(yes_no),
        "smoking_ok": random.choice(yes_no),
        "pets_ok": random.choice(yes_no),
        "luggage_large": random.choice(yes_no),
        "female_driver_pref": random.choice(yes_no)
    })

passengers_df = pd.DataFrame(passengers)
passengers_df.to_csv("passengers.csv", index=False)

# -------------------------
# GENERATE DRIVERS
# -------------------------
drivers = []

for i in range(NUM_DRIVERS):
    drivers.append({
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
    })

drivers_df = pd.DataFrame(drivers)
drivers_df.to_csv("drivers.csv", index=False)

# -------------------------
# GENERATE INTERACTIONS
# -------------------------
interactions = []

for p in passengers:
    sampled_drivers = random.sample(drivers, INTERACTIONS_PER_PASSENGER)

    for d in sampled_drivers:
        trip_time = random.choice(times_of_day)
        score = 0

        # Quiet ride
        if p["quiet_ride"] == "yes" and d["talkative"] == "no":
            score += 2
        if p["quiet_ride"] == "yes" and d["talkative"] == "yes":
            score -= 2

        # Radio
        if p["radio_ok"] == "no" and d["radio_on"] == "yes":
            score -= 2

        # Smoking
        if p["smoking_ok"] == "no" and d["smoking_allowed"] == "yes":
            score -= 3

        # Pets
        if p["pets_ok"] == "no" and d["pets_allowed"] == "yes":
            score -= 2

        # Luggage
        if p["luggage_large"] == "yes" and d["car_big"] == "yes":
            score += 2
        if p["luggage_large"] == "yes" and d["car_big"] == "no":
            score -= 2

        # Female driver preference
        if p["female_driver_pref"] == "yes" and d["driver_gender"] == "female":
            score += 2

        # High rating bonus
        if d["rating"] > 4.7:
            score += 2

        # Availability penalty
        if trip_time == "morning" and d["works_morning"] == "no":
            score -= 5
        if trip_time == "afternoon" and d["works_afternoon"] == "no":
            score -= 5
        if trip_time == "evening" and d["works_evening"] == "no":
            score -= 5
        if trip_time == "night" and d["works_night"] == "no":
            score -= 5

        interaction = 1 if score >= 2 else 0

        interactions.append({
            "passenger_id": p["passenger_id"],
            "driver_id": d["driver_id"],
            "time_of_trip": trip_time,
            "interaction": interaction
        })

interactions_df = pd.DataFrame(interactions)
interactions_df.to_csv("interactions.csv", index=False)

print("✅ Dataset generated successfully!")
print(f"Passengers: {len(passengers_df)}")
print(f"Drivers: {len(drivers_df)}")
print(f"Interactions: {len(interactions_df)}")
