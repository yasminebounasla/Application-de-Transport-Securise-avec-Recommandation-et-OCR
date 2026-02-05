import pandas as pd
import numpy as np
import pickle
from lightfm import LightFM
from lightfm.data import Dataset
from lightfm.evaluation import auc_score

# --- 1. CHARGEMENT DES DONNÉES ---
p_df = pd.read_csv("../lightfm_data/passengers.csv")
d_df = pd.read_csv("../lightfm_data/drivers.csv")
i_df = pd.read_csv("../lightfm_data/interactions.csv")

print(d_df)


# --- 2. REMPLACEMENT DES NAN PAR 'no' ---
yes_no_cols = [
    "quiet_ride", "radio_ok", "smoking_ok", "pets_ok",
    "luggage_large", "female_driver_pref",
    "talkative", "radio_on", "smoking_allowed", "pets_allowed",
    "car_big", "works_morning", "works_afternoon", "works_evening", "works_night"
]

for col in yes_no_cols:
    if col in p_df.columns:
        p_df[col] = p_df[col].fillna("no")
    if col in d_df.columns:
        d_df[col] = d_df[col].fillna("no")
        
        

# --- CONFIGURATION DU DATASET ---
dataset = Dataset()

user_features_list = [
    "quiet_ride:yes", "quiet_ride:no",
    "radio_ok:yes", "radio_ok:no",
    "smoking_ok:yes", "smoking_ok:no",
    "pets_ok:yes", "pets_ok:no",
    "luggage_large:yes", "luggage_large:no",
    "female_driver_pref:yes", "female_driver_pref:no"
]

item_features_list = [
    "talkative:yes", "talkative:no",
    "radio_on:yes", "radio_on:no",
    "smoking_allowed:yes", "smoking_allowed:no",
    "pets_allowed:yes", "pets_allowed:no",
    "car_big:yes", "car_big:no",
    "driver_gender:male", "driver_gender:female",
    "works_morning:yes", "works_morning:no",
    "works_afternoon:yes", "works_afternoon:no",
    "works_evening:yes", "works_evening:no",
    "works_night:yes", "works_night:no"
]

dataset.fit(
    users=p_df["passenger_id"].unique(),
    items=d_df["driver_id"].unique(),
    user_features=user_features_list,
    item_features=item_features_list
)


# 3. Construction des Matrices avec FILTRE
good_interactions = i_df[i_df['weight'] > 0.6]

(interactions, weights) = dataset.build_interactions(
    [(row["passenger_id"], row["driver_id"], row["weight"])
     for _, row in good_interactions.iterrows()]
)

user_features = dataset.build_user_features(
    [(row["passenger_id"],
      [f"quiet_ride:{row['quiet_ride']}",
       f"radio_ok:{row['radio_ok']}",
       f"smoking_ok:{row['smoking_ok']}",
       f"pets_ok:{row['pets_ok']}",
       f"luggage_large:{row['luggage_large']}",
       f"female_driver_pref:{row['female_driver_pref']}"])
     for _, row in p_df.iterrows()]
)

item_features = dataset.build_item_features(
    [(row["driver_id"],
        [f"talkative:{row['talkative']}",
        f"radio_on:{row['radio_on']}",
        f"smoking_allowed:{row['smoking_allowed']}",
        f"pets_allowed:{row['pets_allowed']}",
        f"car_big:{row['car_big']}",
        f"driver_gender:{row['driver_gender']}",
        f"works_morning:{row['works_morning']}",
        f"works_afternoon:{row['works_afternoon']}",
        f"works_evening:{row['works_evening']}",
        f"works_night:{row['works_night']}"])
     for _, row in d_df.iterrows()]
)


model = LightFM(
    loss='warp',
    no_components=50,
    learning_rate=0.03,
    random_state=42
)

print("Démarrage de l'entraînement...")
for epoch in range(1, 41):
    model.fit_partial(interactions, sample_weight=weights, user_features=user_features, item_features=item_features, epochs=1)
    if epoch % 10 == 0:
        current_auc = auc_score(model, interactions, user_features=user_features, item_features=item_features).mean()
        print(f"Époque {epoch} | AUC: {current_auc:.4f}")
        
        
# --- SAUVEGARDE CORRECTE ---
import pickle

with open("../model_real/lightfm_model_real.pkl", "wb") as f:
    pickle.dump(model, f)

with open("../model_real/dataset_real.pkl", "wb") as f:
    pickle.dump(dataset, f)

with open("../model_real/user_features_real.pkl", "wb") as f:  
    pickle.dump(user_features, f)

with open("../model_real/item_features_real.pkl", "wb") as f:  
    pickle.dump(item_features, f)


print("✅ Tout sauvegardé correctement!")