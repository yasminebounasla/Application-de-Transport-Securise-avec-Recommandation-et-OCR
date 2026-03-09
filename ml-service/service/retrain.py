import pandas as pd
import numpy as np
import pickle
from lightfm import LightFM
from lightfm.data import Dataset
from lightfm.evaluation import auc_score

# ── 1. CHARGEMENT DES DONNÉES ────────────────────────────────────────────────

t_df = pd.read_csv("../lightfm_data/trajets.csv")
d_df = pd.read_csv("../light_fm_data/drivers.csv")
i_df = pd.read_csv("../lightfm_data/interactions.csv")

print(f"📊 Trajets    : {len(t_df)}")
print(f"📊 Drivers    : {len(d_df)}")
print(f"📊 Interactions: {len(i_df)}")

# ── 2. NETTOYAGE DES NAN ─────────────────────────────────────────────────────
yes_no_cols = [
    "quiet_ride", "radio_ok", "smoking_ok", "pets_ok",
    "luggage_large", "female_driver_pref",
    "talkative", "radio_on", "smoking_allowed", "pets_allowed",
    "car_big", "works_morning", "works_afternoon", "works_evening", "works_night"
]
for col in yes_no_cols:
    if col in t_df.columns:
        t_df[col] = t_df[col].fillna("no")
    if col in d_df.columns:
        d_df[col] = d_df[col].fillna("no")

# Nettoyer les colonnes numériques
# Remplacer N/A par des valeurs neutres
t_df["distance_km"]     = pd.to_numeric(t_df["distance_km"],     errors="coerce").fillna(50.0)
t_df["score_distance"]  = pd.to_numeric(t_df["score_distance"],  errors="coerce").fillna(0.5)
t_df["work_hour_match"] = pd.to_numeric(t_df["work_hour_match"], errors="coerce").fillna(0)
d_df["avg_rating"]      = pd.to_numeric(d_df["avg_rating"],      errors="coerce").fillna(4.0)

# Discrétiser distance en catégories pour LightFM
# LightFM travaille avec des features catégorielles, pas continues
def distance_bucket(km):
    if   km < 10:  return "dist:very_close"
    elif km < 30:  return "dist:close"
    elif km < 80:  return "dist:medium"
    elif km < 200: return "dist:far"
    else:          return "dist:very_far"

def rating_bucket(r):
    if   r >= 4.5: return "rating:excellent"
    elif r >= 4.0: return "rating:good"
    elif r >= 3.0: return "rating:average"
    else:          return "rating:poor"

t_df["distance_bucket"] = t_df["distance_km"].apply(distance_bucket)
d_df["rating_bucket"]   = d_df["avg_rating"].apply(rating_bucket)

print("\n📊 Distribution distance_bucket :")
print(t_df["distance_bucket"].value_counts())

# ── 3. CONFIGURATION DU DATASET ──────────────────────────────────────────────
dataset = Dataset()

# users = trajet_id 

user_features_list = [
    # Préférences trajet
    "quiet_ride:yes",          "quiet_ride:no",
    "radio_ok:yes",            "radio_ok:no",
    "smoking_ok:yes",          "smoking_ok:no",
    "pets_ok:yes",             "pets_ok:no",
    "luggage_large:yes",       "luggage_large:no",
    "female_driver_pref:yes",  "female_driver_pref:no",
    # distance discrétisée
    "dist:very_close",
    "dist:close",
    "dist:medium",
    "dist:far",
    "dist:very_far",
    # heure de travail
    "work_hour_match:1",
    "work_hour_match:0",
]

item_features_list = [
    # Features driver existantes
    "talkative:yes",           "talkative:no",
    "radio_on:yes",            "radio_on:no",
    "smoking_allowed:yes",     "smoking_allowed:no",
    "pets_allowed:yes",        "pets_allowed:no",
    "car_big:yes",             "car_big:no",
    "driver_gender:male",      "driver_gender:female",
    "works_morning:yes",       "works_morning:no",
    "works_afternoon:yes",     "works_afternoon:no",
    "works_evening:yes",       "works_evening:no",
    "works_night:yes",         "works_night:no",
    # rating discrétisé
    "rating:excellent",
    "rating:good",
    "rating:average",
    "rating:poor",
]

dataset.fit(
    users=t_df["trajet_id"].unique(),      
    items=d_df["driver_id"].unique(),
    user_features=user_features_list,
    item_features=item_features_list
)

# ── 4. CONSTRUCTION DES MATRICES ─────────────────────────────────────────────
# filtre 0.3 au lieu de 0.8 (garder plus de données)
# car : weight > 0.8 = trop restrictif, on perd 70% des interactions

good_interactions = i_df[i_df["weight"] > 0.3]
print(f"\n📊 Interactions utilisées (weight > 0.3) : {len(good_interactions)}/{len(i_df)}")

(interactions, weights) = dataset.build_interactions(
    [
        (row["trajet_id"], row["driver_id"], row["weight"])   
        for _, row in good_interactions.iterrows()
    ]
)

# user features depuis t_df (trajets) avec nouvelles features
user_features = dataset.build_user_features(
    [
        (
            row["trajet_id"],
            [
                f"quiet_ride:{row['quiet_ride']}",
                f"radio_ok:{row['radio_ok']}",
                f"smoking_ok:{row['smoking_ok']}",
                f"pets_ok:{row['pets_ok']}",
                f"luggage_large:{row['luggage_large']}",
                f"female_driver_pref:{row['female_driver_pref']}",
                row["distance_bucket"],                        # 
                f"work_hour_match:{int(row['work_hour_match'])}",  # 
            ],
        )
        for _, row in t_df.iterrows()
    ]
)

# rating_bucket dans item features
item_features = dataset.build_item_features(
    [
        (
            row["driver_id"],
            [
                f"talkative:{row['talkative']}",
                f"radio_on:{row['radio_on']}",
                f"smoking_allowed:{row['smoking_allowed']}",
                f"pets_allowed:{row['pets_allowed']}",
                f"car_big:{row['car_big']}",
                f"driver_gender:{row['driver_gender']}",
                f"works_morning:{row['works_morning']}",
                f"works_afternoon:{row['works_afternoon']}",
                f"works_evening:{row['works_evening']}",
                f"works_night:{row['works_night']}",
                row["rating_bucket"],                       
            ],
        )
        for _, row in d_df.iterrows()
    ]
)

# ── 5. ENTRAÎNEMENT ───────────────────────────────────────────────────────────
model = LightFM(
    loss="warp",
    no_components=50,
    learning_rate=0.03,
    random_state=42
)

#gestion des epochs
n_interactions = len(good_interactions)

if   n_interactions < 100:    epochs = 10   # peu de data → peu d'epochs
elif n_interactions < 500:    epochs = 60
elif n_interactions < 2000:   epochs = 120
elif n_interactions < 5000:   epochs = 200
elif n_interactions < 10000:  epochs = 230
else:                         epochs = 250   # beaucoup de data → plus d'epochs

print(f"📊 {n_interactions} interactions → {epochs} epochs")

print("\n Démarrage de l'entraînement...")
for epoch in range(1, epochs + 1):
    model.fit_partial(
        interactions,
        sample_weight=weights,
        user_features=user_features,
        item_features=item_features,
        epochs=1
    )
    if epoch % 10 == 0:
        current_auc = auc_score(
            model, interactions,
            user_features=user_features,
            item_features=item_features
        ).mean()
        print(f"   Époque {epoch:2d} | AUC: {current_auc:.4f}")

# ── 6. SAUVEGARDE ────────────────────────────────────────────────────────────
import os

with open("../model_real/lightfm_model_real.pkl", "wb") as f:
    pickle.dump(model, f)
with open("../model_real/dataset_real.pkl", "wb") as f:
    pickle.dump(dataset, f)
with open("../model_real/user_features_real.pkl", "wb") as f:
    pickle.dump(user_features, f)
with open("../model_real/item_features_real.pkl", "wb") as f:
    pickle.dump(item_features, f)

# sauvegarder aussi les DataFrames pour les utiliser dans FastAPI
t_df.to_csv("../model_real/trajets_processed.csv", index=False)
d_df.to_csv("../model_real/drivers_processed.csv", index=False)

print("\n✅ Tout sauvegardé dans ../model_real/")
print(f"   - lightfm_model_real.pkl")
print(f"   - dataset_real.pkl")
print(f"   - user_features_real.pkl")
print(f"   - item_features_real.pkl")
print(f"   - trajets_processed.csv")
print(f"   - drivers_processed.csv")