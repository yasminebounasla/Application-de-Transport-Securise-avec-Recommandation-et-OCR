"""
retrain.py
✅ CORRIGÉ :
  - Colonne distance_bucket lue depuis trajets.csv (ajoutée par exportLightFM.js corrigé)
  - Import logging propre (plus de double import)
  - score_distance cohérent avec le reste du pipeline (pas utilisé ici directement,
    mais les valeurs dans trajets.csv sont maintenant issues de exp(-km/ref))
  - Évaluation dans notebook séparé (train complet ici, éval dans .ipynb)
"""

import pandas as pd
import numpy as np
import pickle
import os
import logging
import joblib
from lightfm import LightFM
from lightfm.data import Dataset

logging.basicConfig(level=logging.INFO, format="%(levelname)s — %(message)s")
logger = logging.getLogger(__name__)

# ── 1. CHEMINS ────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR   = os.path.join(BASE_DIR, "lightfm_data")
MODELS_DIR = os.path.join(BASE_DIR, "model_real")

# ── 2. CHARGEMENT ─────────────────────────────────────────────────────────────
t_df = pd.read_csv(os.path.join(DATA_DIR, "trajets.csv"))
d_df = pd.read_csv(os.path.join(DATA_DIR, "drivers.csv"))
i_df = pd.read_csv(os.path.join(DATA_DIR, "interactions.csv"))

logger.info(f"Trajets     : {len(t_df)}")
logger.info(f"Drivers     : {len(d_df)}")
logger.info(f"Interactions: {len(i_df)}")

# ── 3. NETTOYAGE ──────────────────────────────────────────────────────────────
yes_no_cols = [
    "quiet_ride", "radio_ok", "smoking_ok", "pets_ok",
    "luggage_large", "female_driver_pref",
    "talkative", "radio_on", "smoking_allowed", "pets_allowed", "car_big",
    "works_morning", "works_afternoon", "works_evening", "works_night",
]
for col in yes_no_cols:
    if col in t_df.columns: t_df[col] = t_df[col].fillna("no")
    if col in d_df.columns: d_df[col] = d_df[col].fillna("no")

t_df["distance_km"]     = pd.to_numeric(t_df["distance_km"],     errors="coerce").fillna(50.0)
t_df["score_distance"]  = pd.to_numeric(t_df["score_distance"],  errors="coerce").fillna(0.5)
t_df["work_hour_match"] = pd.to_numeric(t_df["work_hour_match"], errors="coerce").fillna(0)
d_df["avg_rating"]      = pd.to_numeric(d_df["avg_rating"],      errors="coerce").fillna(4.0)
i_df["weight"]          = pd.to_numeric(i_df["weight"],          errors="coerce").fillna(0.0)

# ── Buckets ───────────────────────────────────────────────────────────────────
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

# ✅ distance_bucket : lire depuis le CSV si présent (exporté par exportLightFM.js)
# Sinon le recalculer depuis distance_km (rétro-compatibilité)
if "distance_bucket" not in t_df.columns:
    logger.warning("Colonne distance_bucket absente — recalculée depuis distance_km")
    t_df["distance_bucket"] = t_df["distance_km"].apply(distance_bucket)
else:
    # Valider / compléter les valeurs manquantes
    t_df["distance_bucket"] = t_df["distance_bucket"].fillna(
        t_df["distance_km"].apply(distance_bucket)
    )

d_df["rating_bucket"] = d_df["avg_rating"].apply(rating_bucket)

# ── 4. FILTRE INTERACTIONS ────────────────────────────────────────────────────
good_interactions = i_df[i_df["weight"] > 0.6]
annulations       = (i_df["weight"] - 0.10).abs() < 0.001

w = good_interactions["weight"]
logger.info(f"\nDistribution weights après filtre :")
logger.info(f"  ≥ 0.75 (notes 4–5)    : {(w >= 0.75).sum()}")
logger.info(f"  0.50–0.75 (notes 3–4) : {((w >= 0.50) & (w < 0.75)).sum()}")
logger.info(f"  Annulations exclues   : {annulations.sum()}")
logger.info(f"  Total utilisées       : {len(good_interactions)}")

# ── 5. DATASET LIGHTFM ───────────────────────────────────────────────────────
dataset = Dataset()

user_features_list = [
    "quiet_ride:yes",         "quiet_ride:no",
    "radio_ok:yes",           "radio_ok:no",
    "smoking_ok:yes",         "smoking_ok:no",
    "pets_ok:yes",            "pets_ok:no",
    "luggage_large:yes",      "luggage_large:no",
    "female_driver_pref:yes", "female_driver_pref:no",
    "dist:very_close", "dist:close", "dist:medium", "dist:far", "dist:very_far",
    "work_hour_match:1",      "work_hour_match:0",
]
item_features_list = [
    "talkative:yes",         "talkative:no",
    "radio_on:yes",          "radio_on:no",
    "smoking_allowed:yes",   "smoking_allowed:no",
    "pets_allowed:yes",      "pets_allowed:no",
    "car_big:yes",           "car_big:no",
    "driver_gender:male",    "driver_gender:female",
    "works_morning:yes",     "works_morning:no",
    "works_afternoon:yes",   "works_afternoon:no",
    "works_evening:yes",     "works_evening:no",
    "works_night:yes",       "works_night:no",
    "rating:excellent",      "rating:good",
    "rating:average",        "rating:poor",
]

# ✅ Users = passagers uniques (P1, P2, …)
dataset.fit(
    users=t_df["passenger_id"].unique(),
    items=d_df["driver_id"].unique(),
    user_features=user_features_list,
    item_features=item_features_list,
)

# ── 6. MATRICES ───────────────────────────────────────────────────────────────
(interactions, weights_matrix) = dataset.build_interactions(
    [
        (row["passenger_id"], row["driver_id"], float(row["weight"]))
        for _, row in good_interactions.iterrows()
    ]
)

# user_features : une ligne par trajet, groupées par passenger_id
# LightFM agrège automatiquement → encode les préférences moyennes du passager
user_features = dataset.build_user_features(
    [
        (
            row["passenger_id"],
            [
                f"quiet_ride:{row['quiet_ride']}",
                f"radio_ok:{row['radio_ok']}",
                f"smoking_ok:{row['smoking_ok']}",
                f"pets_ok:{row['pets_ok']}",
                f"luggage_large:{row['luggage_large']}",
                f"female_driver_pref:{row['female_driver_pref']}",
                row["distance_bucket"],                    # ✅ colonne unifiée
                f"work_hour_match:{int(row['work_hour_match'])}",
            ],
        )
        for _, row in t_df.iterrows()
    ]
)

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

logger.info(f"\nMatrices construites — {interactions.nnz} interactions")

# ── 7. MODÈLE ─────────────────────────────────────────────────────────────────
model = LightFM(
    loss="warp",
    no_components=64,
    learning_rate=0.03,
    item_alpha=1e-6,
    user_alpha=1e-6,
    random_state=42,
)

n_train = interactions.nnz
if   n_train < 500:   epochs = 60
elif n_train < 2000:  epochs = 120
elif n_train < 5000:  epochs = 200
elif n_train < 10000: epochs = 230
else:                 epochs = 250

logger.info(f"{n_train} interactions → {epochs} epochs\n")

# Entraînement complet (évaluation dans le notebook séparé)
model.fit(
    interactions,
    user_features=user_features,
    item_features=item_features,
    epochs=epochs,
    num_threads=4,
    verbose=False,
)

logger.info("Entraînement terminé.")

# ── 8. SAUVEGARDE ─────────────────────────────────────────────────────────────
model.random_state = None  # évite les problèmes de sérialisation

os.makedirs(MODELS_DIR, exist_ok=True)

joblib.dump(model,         os.path.join(MODELS_DIR, "lightfm_model_real.pkl"))
joblib.dump(dataset,       os.path.join(MODELS_DIR, "dataset_real.pkl"))
joblib.dump(user_features, os.path.join(MODELS_DIR, "user_features_real.pkl"))
joblib.dump(item_features, os.path.join(MODELS_DIR, "item_features_real.pkl"))
t_df.to_csv(os.path.join(MODELS_DIR, "trajets_processed.csv"), index=False)
d_df.to_csv(os.path.join(MODELS_DIR, "drivers_processed.csv"), index=False)

logger.info(f"\n✅ Modèle et données sauvegardés dans {MODELS_DIR}")
logger.info(f"   lightfm_model_real.pkl")
logger.info(f"   dataset_real.pkl")
logger.info(f"   user_features_real.pkl")
logger.info(f"   item_features_real.pkl")
logger.info(f"   trajets_processed.csv + drivers_processed.csv")

import httpx
httpx.post("http://localhost:8000/reload-model")