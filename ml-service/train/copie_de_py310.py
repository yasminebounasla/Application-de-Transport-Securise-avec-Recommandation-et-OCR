

import pandas as pd
import numpy as np
import pickle
from lightfm import LightFM
from lightfm.data import Dataset
from lightfm.evaluation import auc_score

# --- 1. CHARGEMENT DES DONNÉES ---
p_df = pd.read_csv("passengers.csv")
d_df = pd.read_csv("drivers.csv")
i_df = pd.read_csv("interactions.csv")

print(i_df.head())

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

# 5. Sauvegarde
with open("model_final.pkl", "wb") as f:
    pickle.dump({"model": model, "dataset": dataset, "u_feats": user_features, "i_feats": item_features}, f)

import pickle, numpy as np, pandas as pd

# 1. Chargement du pack complet et des données
with open("model_final.pkl", "rb") as f:
    d = pickle.load(f)
p_df, d_df = pd.read_csv("passengers.csv"), pd.read_csv("drivers.csv")

# 2. On affiche les préférences de P0 (Les 5 features principales)
p0_prefs = p_df.iloc[0][['quiet_ride', 'radio_ok', 'pets_ok', 'luggage_large', 'female_driver_pref']]
print(f" PRÉFÉRENCES DE P0 :\n{p0_prefs.to_dict()}\n")

# 3. Prédiction des scores
scores = d["model"].predict(0, np.arange(len(d_df)), user_features=d["u_feats"], item_features=d["i_feats"])

# 4. Affichage des 5 meilleurs chauffeurs
top_5_idx = np.argsort(-scores)[:5]
top_drivers = d_df.iloc[top_5_idx][['driver_id', 'talkative', 'radio_on', 'pets_allowed', 'car_big', 'driver_gender']]

print(" TOP 5 CHAUFFEURS TROUVÉS :")
print(top_drivers.to_string(index=False))