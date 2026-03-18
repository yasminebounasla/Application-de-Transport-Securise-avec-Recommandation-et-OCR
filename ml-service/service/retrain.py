"""
retrain.py — CORRIGÉ
User = Passenger (pas Trajet)
Un passager accumule plusieurs interactions → LightFM apprend son profil réel.
Les features du trajet (quiet_ride, heure, distance) sont agrégées par passager
automatiquement par LightFM via build_user_features.
"""

import pandas as pd
import numpy as np
import pickle
import os
from lightfm import LightFM
from lightfm.data import Dataset
from lightfm.evaluation import auc_score, precision_at_k
from lightfm.cross_validation import random_train_test_split

# ── CHEMINS ──────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR   = os.path.join(BASE_DIR, "lightfm_data")
MODELS_DIR = os.path.join(BASE_DIR, "model_real")

# ── 1. CHARGEMENT DES DONNÉES ────────────────────────────────────────────────
t_df = pd.read_csv(os.path.join(DATA_DIR, "trajets.csv"))
d_df = pd.read_csv(os.path.join(DATA_DIR, "drivers.csv"))
i_df = pd.read_csv(os.path.join(DATA_DIR, "interactions.csv"))

print(f"📊 Trajets     : {len(t_df)}")
print(f"📊 Drivers     : {len(d_df)}")
print(f"📊 Interactions: {len(i_df)}")


# ── 2. NETTOYAGE ──────────────────────────────────────────────────────────────
yes_no_cols = [
    "quiet_ride","radio_ok","smoking_ok","pets_ok","luggage_large","female_driver_pref",
    "talkative","radio_on","smoking_allowed","pets_allowed","car_big",
    "works_morning","works_afternoon","works_evening","works_night"
]
for col in yes_no_cols:
    if col in t_df.columns: t_df[col] = t_df[col].fillna("no")
    if col in d_df.columns: d_df[col] = d_df[col].fillna("no")

t_df["distance_km"]     = pd.to_numeric(t_df["distance_km"],     errors="coerce").fillna(50.0)
t_df["score_distance"]  = pd.to_numeric(t_df["score_distance"],  errors="coerce").fillna(0.5)
t_df["work_hour_match"] = pd.to_numeric(t_df["work_hour_match"], errors="coerce").fillna(0)
d_df["avg_rating"]      = pd.to_numeric(d_df["avg_rating"],      errors="coerce").fillna(4.0)
i_df["weight"]          = pd.to_numeric(i_df["weight"],          errors="coerce").fillna(0.0)

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

# ── 3. FILTRE ─────────────────────────────────────────────────────────────────
good_interactions = i_df[i_df["weight"] > 0.6]
annulations = (i_df["weight"] - 0.10).abs() < 0.001

w = good_interactions["weight"]
print(f"\n📊 Distribution weights après filtre :")
print(f"   ≥ 0.75 (notes 4–5)    : {(w >= 0.75).sum()}")
print(f"   0.50–0.75 (notes 3–4) : {((w >= 0.50) & (w < 0.75)).sum()}")
print(f"   Annulations exclues   : {annulations.sum()}")
print(f"   Total utilisées       : {len(good_interactions)}")

# ── 4. DATASET ────────────────────────────────────────────────────────────────
dataset = Dataset()

user_features_list = [
    "quiet_ride:yes","quiet_ride:no","radio_ok:yes","radio_ok:no",
    "smoking_ok:yes","smoking_ok:no","pets_ok:yes","pets_ok:no",
    "luggage_large:yes","luggage_large:no","female_driver_pref:yes","female_driver_pref:no",
    "dist:very_close","dist:close","dist:medium","dist:far","dist:very_far",
    "work_hour_match:1","work_hour_match:0",
]
item_features_list = [
    "talkative:yes","talkative:no","radio_on:yes","radio_on:no",
    "smoking_allowed:yes","smoking_allowed:no","pets_allowed:yes","pets_allowed:no",
    "car_big:yes","car_big:no","driver_gender:male","driver_gender:female",
    "works_morning:yes","works_morning:no","works_afternoon:yes","works_afternoon:no",
    "works_evening:yes","works_evening:no","works_night:yes","works_night:no",
    "rating:excellent","rating:good","rating:average","rating:poor",
]

# CHANGEMENT : users = passagers uniques (plus trajets uniques)
dataset.fit(
    users=t_df["passenger_id"].unique(),   # ← P1, P2, P3... (plus T1, T2, T3...)
    items=d_df["driver_id"].unique(),
    user_features=user_features_list,
    item_features=item_features_list,
)

# ── 5. MATRICES ───────────────────────────────────────────────────────────────
#  CHANGEMENT : interactions indexées par passenger_id
(interactions, weights_matrix) = dataset.build_interactions(
    [(row["passenger_id"], row["driver_id"], float(row["weight"]))
     for _, row in good_interactions.iterrows()]
)

# ✅ user_features : une ligne par trajet, groupées par passenger_id
# LightFM fait automatiquement la moyenne des features pour un même passager
# → capture ses préférences "moyennes" tout en gardant la variabilité dans le predict
user_features = dataset.build_user_features(
    [(row["passenger_id"], [                  # ← passenger_id ici aussi
        f"quiet_ride:{row['quiet_ride']}",
        f"radio_ok:{row['radio_ok']}",
        f"smoking_ok:{row['smoking_ok']}",
        f"pets_ok:{row['pets_ok']}",
        f"luggage_large:{row['luggage_large']}",
        f"female_driver_pref:{row['female_driver_pref']}",
        row["distance_bucket"],
        f"work_hour_match:{int(row['work_hour_match'])}",
    ]) for _, row in t_df.iterrows()]
)

item_features = dataset.build_item_features(
    [(row["driver_id"], [
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
    ]) for _, row in d_df.iterrows()]
)

print(f"\n✅ Matrices construites — {interactions.nnz} interactions")

# ── 6. TRAIN/TEST SPLIT ───────────────────────────────────────────────────────
train_interactions, test_interactions = random_train_test_split(
    interactions, test_percentage=0.2, random_state=42
)
print(f"📊 Train : {train_interactions.nnz} | Test : {test_interactions.nnz}")

# ── 7. BASELINE ───────────────────────────────────────────────────────────────
print("\n🔁 Baseline...")
baseline = LightFM(loss="warp", no_components=1, random_state=42)
baseline.fit(train_interactions, item_features=item_features, epochs=10, num_threads=4)
baseline_auc = auc_score(
    baseline, test_interactions,
    train_interactions=train_interactions,
    item_features=item_features, num_threads=4,
).mean()
baseline_p5 = precision_at_k(
    baseline, test_interactions,
    train_interactions=train_interactions,
    item_features=item_features, k=5, num_threads=4,
).mean()
print(f"   Baseline AUC: {baseline_auc:.4f} | P@5: {baseline_p5:.4f}")

# ── 8. MODÈLE ────────────────────────────────────────────────────────────────
model = LightFM(
    loss="warp",
    no_components=64,
    learning_rate=0.03,
    item_alpha=1e-6,
    user_alpha=1e-6,
    random_state=42,
)

n_train = train_interactions.nnz
if   n_train < 500:   epochs = 60
elif n_train < 2000:  epochs = 120
elif n_train < 5000:  epochs = 200
elif n_train < 10000: epochs = 230
else:                 epochs = 250

print(f"\n📊 {n_train} interactions train → {epochs} epochs\n")

best_auc = 0.0; best_epoch = 0

for epoch in range(1, epochs + 1):
    model.fit_partial(
        train_interactions,
        user_features=user_features,
        item_features=item_features,
        epochs=1, num_threads=4,
    )
    if epoch % 10 == 0:
        test_auc = auc_score(
            model, test_interactions,
            train_interactions=train_interactions,
            user_features=user_features,
            item_features=item_features,
            num_threads=4,
        ).mean()
        marker = ""
        if test_auc > best_auc:
            best_auc = test_auc; best_epoch = epoch; marker = " ← meilleur"
        print(f"   Époque {epoch:3d} | AUC test: {test_auc:.4f}{marker}")

# ── 9. ÉVALUATION FINALE ──────────────────────────────────────────────────────
final_auc = auc_score(
    model, test_interactions,
    train_interactions=train_interactions,
    user_features=user_features,
    item_features=item_features, num_threads=4,
).mean()
final_p5 = precision_at_k(
    model, test_interactions,
    train_interactions=train_interactions,
    user_features=user_features,
    item_features=item_features, k=5, num_threads=4,
).mean()

print(f"\n{'='*45}")
print(f"  RÉSULTATS FINAUX")
print(f"{'='*45}")
print(f"  Baseline     — AUC: {baseline_auc:.4f} | P@5: {baseline_p5:.4f}")
print(f"  Notre modèle — AUC: {final_auc:.4f} | P@5: {final_p5:.4f}")
print(f"  Gain AUC        : +{(final_auc - baseline_auc):.4f}")
print(f"  Gain Precision@5: +{(final_p5  - baseline_p5):.4f}")
print(f"  Meilleur epoch  : {best_epoch} (AUC: {best_auc:.4f})")
print(f"{'='*45}")


# ── 10. SAUVEGARDE ────────────────────────────────────────────────────────────
os.makedirs(MODELS_DIR, exist_ok=True)

with open(os.path.join(MODELS_DIR, "lightfm_model_real.pkl"),    "wb") as f: pickle.dump(model,        f)
with open(os.path.join(MODELS_DIR, "dataset_real.pkl"),          "wb") as f: pickle.dump(dataset,      f)
with open(os.path.join(MODELS_DIR, "user_features_real.pkl"),    "wb") as f: pickle.dump(user_features, f)
with open(os.path.join(MODELS_DIR, "item_features_real.pkl"),    "wb") as f: pickle.dump(item_features, f)

t_df.to_csv(os.path.join(MODELS_DIR, "trajets_processed.csv"), index=False)
d_df.to_csv(os.path.join(MODELS_DIR, "drivers_processed.csv"), index=False)

print("\n✅ Modèle et données sauvegardés !")



