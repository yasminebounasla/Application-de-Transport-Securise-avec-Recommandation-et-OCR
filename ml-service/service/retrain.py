"""
retrain.py — EXCLUSION STRICTE DES PRÉFÉRENCES

CHANGEMENTS PAR RAPPORT À LA VERSION PRÉCÉDENTE :

  ✅ Les interactions avec weight=0.0 (violation stricte) sont incluses
     dans la matrice WARP comme signal négatif pur — LightFM les interprète
     comme "ce driver ne doit jamais être recommandé à ce passager".

  ✅ build_weighted_pref_features — pondéré par weight :
     weight=0.0 → interaction ignorée dans le profil passager
     → un profil n'est pas pollué par les trajets où les prefs étaient violées.

  ✅ Diagnostic post-entraînement : vérifie que les violations strictes
     ont bien créé du contraste dans les embeddings.
"""

import pandas as pd
import numpy as np
import os
import logging
import joblib
import urllib.request
from lightfm import LightFM
from lightfm.data import Dataset

logging.basicConfig(level=logging.INFO, format="%(levelname)s — %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR   = os.path.join(BASE_DIR, "lightfm_data")
MODELS_DIR = os.path.join(BASE_DIR, "model_real")


# ── 1. CHARGEMENT ─────────────────────────────────────────────────────────────
t_df = pd.read_csv(os.path.join(DATA_DIR, "trajets.csv"))
d_df = pd.read_csv(os.path.join(DATA_DIR, "drivers.csv"))
i_df = pd.read_csv(os.path.join(DATA_DIR, "interactions.csv"))

logger.info(f"Trajets     : {len(t_df)}")
logger.info(f"Drivers     : {len(d_df)}")
logger.info(f"Interactions: {len(i_df)}")

if len(i_df) < 1000:
    logger.info("⚠️ Moins de 1000 interactions — entraînement ignoré")
    logger.info("   Le système utilise le cold start jusqu'au seuil minimum")
    exit(0)

# ── 2. NETTOYAGE ──────────────────────────────────────────────────────────────
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

if "driver_gender" in d_df.columns:
    d_df["driver_gender"] = d_df["driver_gender"].str.strip().str.lower().fillna("male")

def rating_bucket(r):
    if   r >= 4.5: return "rating:excellent"
    elif r >= 4.0: return "rating:good"
    elif r >= 3.0: return "rating:average"
    else:          return "rating:poor"

d_df["rating_bucket"] = d_df["avg_rating"].apply(rating_bucket)

# ── 3. DIAGNOSTIC WEIGHTS ─────────────────────────────────────────────────────
logger.info(f"\nDistribution weights (exclusion stricte) :")
w = i_df["weight"]
nb_zero = (w == 0.0).sum()
logger.info(f"  0.0 (violation stricte)  : {nb_zero}  ({100*nb_zero/len(w):.1f}%)")
logger.info(f"  0.01–0.30 (négatif)      : {((w > 0.00) & (w < 0.30)).sum()}")
logger.info(f"  0.30–0.60 (neutre)       : {((w >= 0.30) & (w < 0.60)).sum()}")
logger.info(f"  >= 0.60 (positif)        : {(w >= 0.60).sum()}")
logger.info(f"  Contraste max-min        : {w.max() - w.min():.3f}  (> 0.50 = bon signal)")

if nb_zero < len(w) * 0.05:
    logger.warning("⚠️  Peu de violations strictes (< 5%) — les prefs sont peut-être trop permissives dans le seed")
elif nb_zero > len(w) * 0.70:
    logger.warning("⚠️  Trop de violations (> 70%) — les drivers et passagers ne matchent presque jamais")
else:
    logger.info(f"  ✅ {nb_zero/len(w)*100:.0f}% de violations strictes — contraste suffisant")

# ✅ Les interactions à weight=0.0 sont gardées dans la matrice WARP.
# LightFM interprète weight=0 comme "pas d'intérêt" dans WARP — c'est exactement
# le signal qu'on veut pour les violations strictes.
# On ne les supprime PAS : leur présence avec weight=0 aide le modèle à apprendre
# "ce type de driver n'est pas apprécié par ce passager".
i_df["weight_final"] = i_df["weight"].clip(lower=0.0, upper=1.0)

# ── 4. MERGE interactions + prefs du trajet ───────────────────────────────────
PREF_COLS = [
    "quiet_ride", "radio_ok", "smoking_ok",
    "pets_ok", "luggage_large", "female_driver_pref",
]

if "trajet_id" in i_df.columns and "trajet_id" in t_df.columns:
    logger.info("\n✅ trajet_id trouvé → merge exact trajet par trajet")
    i_merged = i_df.merge(
        t_df[["trajet_id", "passenger_id"] + PREF_COLS],
        on=["trajet_id", "passenger_id"],
        how="left",
    )
    nb_ok = i_merged[PREF_COLS[0]].notna().sum()
    logger.info(f"   {nb_ok}/{len(i_merged)} interactions matchées avec leurs prefs")
else:
    logger.warning("⚠️  trajet_id absent → fallback sur le dernier trajet par passager")
    last_trajet = t_df.sort_values("trajet_id").drop_duplicates("passenger_id", keep="last")
    i_merged = i_df.merge(
        last_trajet[["passenger_id"] + PREF_COLS],
        on="passenger_id",
        how="left",
    )

for col in PREF_COLS:
    i_merged[col] = i_merged[col].fillna("no")

all_interactions = i_merged.copy()

# ── 5. USER FEATURES ─────────────────────────────────────────────────────────
for col in PREF_COLS:
    t_df[f"{col}_bin"] = (t_df[col].str.lower() == "yes").astype(float)

passenger_agg = (
    t_df.groupby("passenger_id")[[f"{c}_bin" for c in PREF_COLS]]
    .mean()
    .reset_index()
)
logger.info(f"\nPassagers uniques : {len(passenger_agg)}")

# ── 6. DATASET LIGHTFM ───────────────────────────────────────────────────────
dataset = Dataset()

user_features_list = []
for col in PREF_COLS:
    user_features_list += [f"{col}:yes", f"{col}:no"]

item_features_list = [
    "talkative:yes",       "talkative:no",
    "radio_on:yes",        "radio_on:no",
    "smoking_allowed:yes", "smoking_allowed:no",
    "pets_allowed:yes",    "pets_allowed:no",
    "car_big:yes",         "car_big:no",
    "driver_gender:male",  "driver_gender:female",
    "works_morning:yes",   "works_morning:no",
    "works_afternoon:yes", "works_afternoon:no",
    "works_evening:yes",   "works_evening:no",
    "works_night:yes",     "works_night:no",
    "rating:excellent",    "rating:good",
    "rating:average",      "rating:poor",
]

dataset.fit(
    users=t_df["passenger_id"].unique(),
    items=d_df["driver_id"].unique(),
    user_features=user_features_list,
    item_features=item_features_list,
)

# ── 7. MATRICES ───────────────────────────────────────────────────────────────
(interactions_matrix, weights_matrix) = dataset.build_interactions(
    [
        (row["passenger_id"], row["driver_id"], float(row["weight_final"]))
        for _, row in all_interactions.iterrows()
    ]
)

# ── 8. USER FEATURES pondérées par weight ────────────────────────────────────
# ✅ On exclut les interactions avec weight=0.0 du calcul du profil passager.
# Un trajet où une pref a été violée ne doit pas influencer le profil LightFM.

def build_weighted_pref_features(interactions_df: pd.DataFrame, pref_cols: list) -> dict:
    passenger_features = {}
    grouped = interactions_df.groupby("passenger_id")

    for passenger_id, group in grouped:
        # ✅ Exclure les interactions à weight=0.0 (violations strictes)
        valid_group = group[group["weight_final"] > 0.0]
        if valid_group.empty:
            continue

        total_weight = valid_group["weight_final"].sum()
        if total_weight == 0:
            continue

        pref_scores = {}
        for col in pref_cols:
            yes_weight = valid_group.loc[valid_group[col].str.lower() == "yes", "weight_final"].sum()
            pref_scores[col] = yes_weight / total_weight

        passenger_features[passenger_id] = pref_scores

    return passenger_features

passenger_weighted_prefs = build_weighted_pref_features(all_interactions, PREF_COLS)
logger.info(f"\nUser features pondérées calculées pour {len(passenger_weighted_prefs)} passagers")
logger.info(f"(interactions à weight=0.0 exclues du profil)")

def prefs_to_features_weighted(passenger_id: str, pref_scores: dict) -> list:
    features = []
    for col in PREF_COLS:
        val = pref_scores.get(col, 0.5)
        if   val >= 0.6: features.append(f"{col}:yes")
        elif val <= 0.4: features.append(f"{col}:no")
        else:
            features.append(f"{col}:yes")
            features.append(f"{col}:no")
    return features

def prefs_to_features_avg(row):
    features = []
    for col in PREF_COLS:
        val = float(row[f"{col}_bin"])
        if   val >= 0.6: features.append(f"{col}:yes")
        elif val <= 0.4: features.append(f"{col}:no")
        else:
            features.append(f"{col}:yes")
            features.append(f"{col}:no")
    return features

user_feature_rows = []
for _, row in passenger_agg.iterrows():
    pid = row["passenger_id"]
    if pid in passenger_weighted_prefs:
        feats = prefs_to_features_weighted(pid, passenger_weighted_prefs[pid])
    else:
        feats = prefs_to_features_avg(row)
    user_feature_rows.append((pid, feats))

user_features = dataset.build_user_features(user_feature_rows)

item_features = dataset.build_item_features(
    [
        (
            row["driver_id"],
            [
                f"talkative:{str(row['talkative']).lower()}",
                f"radio_on:{str(row['radio_on']).lower()}",
                f"smoking_allowed:{str(row['smoking_allowed']).lower()}",
                f"pets_allowed:{str(row['pets_allowed']).lower()}",
                f"car_big:{str(row['car_big']).lower()}",
                f"driver_gender:{str(row['driver_gender']).lower()}",
                f"works_morning:{str(row['works_morning']).lower()}",
                f"works_afternoon:{str(row['works_afternoon']).lower()}",
                f"works_evening:{str(row['works_evening']).lower()}",
                f"works_night:{str(row['works_night']).lower()}",
                row["rating_bucket"],
            ],
        )
        for _, row in d_df.iterrows()
    ]
)

logger.info(f"\nMatrices construites — {interactions_matrix.nnz} interactions")
logger.info(f"  dont {(i_df['weight_final'] == 0.0).sum()} à weight=0.0 (signal négatif strict)")

# ── 9. MODÈLE ────────────────────────────────────────────────────────────────
model = LightFM(
    loss="warp",
    no_components=64,
    learning_rate=0.03,
    item_alpha=1e-6,
    user_alpha=1e-6,
    random_state=42,
)

n_train = interactions_matrix.nnz
if   n_train < 500:   epochs = 150
elif n_train < 2000:  epochs = 200
elif n_train < 5000:  epochs = 350
else:                 epochs = 400

logger.info(f"{n_train} interactions → {epochs} epochs\n")

model.fit(
    interactions_matrix,
    user_features=user_features,
    item_features=item_features,
    sample_weight=weights_matrix,
    epochs=epochs,
    num_threads=4,
    verbose=False,
)

logger.info("Entraînement terminé.")

# ── 10. DIAGNOSTIC POST-ENTRAÎNEMENT ─────────────────────────────────────────
try:
    item_biases = model.item_biases
    item_emb    = model.item_embeddings
    user_emb    = model.user_embeddings

    logger.info(f"\nDiagnostic embeddings :")
    logger.info(f"  item_biases std     : {item_biases.std():.4f}  (> 0.10 = collab ok)")
    logger.info(f"  item_embeddings std : {item_emb.std():.4f}   (> 0.05 = content-based ok)")
    logger.info(f"  user_embeddings std : {user_emb.std():.4f}   (> 0.05 = prefs bien encodées)")

    if item_emb.std() < 0.02:
        logger.warning("⚠️  item_embeddings uniformes → content-based pas appris")
    else:
        logger.info("  ✅ Content-based appris correctement")

    # Vérifie que les embeddings pour :yes et :no sont bien opposés
    logger.info(f"\n  Diagnostic cohérence yes/no :")
    _, _, _, user_feature_map = dataset.mapping()
    for col in PREF_COLS[:3]:
        yes_feat = f"{col}:yes"
        no_feat  = f"{col}:no"
        if yes_feat in user_feature_map and no_feat in user_feature_map:
            yes_emb = user_emb[user_feature_map[yes_feat]]
            no_emb  = user_emb[user_feature_map[no_feat]]
            cosine  = np.dot(yes_emb, no_emb) / (np.linalg.norm(yes_emb) * np.linalg.norm(no_emb) + 1e-8)
            status  = "✅ opposés" if cosine < -0.1 else ("⚠️  neutres" if cosine < 0.3 else "❌ similaires")
            logger.info(f"  {col}: cosine(yes, no) = {cosine:.3f}  {status}")

    logger.info(f"\n  Top 5 biais drivers :")
    _, _, item_id_map, _ = dataset.mapping()
    biases_by_driver = {k: item_biases[v] for k, v in item_id_map.items()}
    top5 = sorted(biases_by_driver.items(), key=lambda x: x[1], reverse=True)[:5]
    bot5 = sorted(biases_by_driver.items(), key=lambda x: x[1])[:5]
    logger.info(f"  Positifs : {[(k, round(v,3)) for k,v in top5]}")
    logger.info(f"  Négatifs : {[(k, round(v,3)) for k,v in bot5]}")

except Exception as e:
    logger.warning(f"Diagnostic échoué : {e}")

# ── 11. SAUVEGARDE ────────────────────────────────────────────────────────────
model.random_state = None
os.makedirs(MODELS_DIR, exist_ok=True)

joblib.dump(model,         os.path.join(MODELS_DIR, "lightfm_model_real.pkl"))
joblib.dump(dataset,       os.path.join(MODELS_DIR, "dataset_real.pkl"))
joblib.dump(user_features, os.path.join(MODELS_DIR, "user_features_real.pkl"))
joblib.dump(item_features, os.path.join(MODELS_DIR, "item_features_real.pkl"))
t_df.to_csv(os.path.join(MODELS_DIR, "trajets_processed.csv"), index=False)
d_df.to_csv(os.path.join(MODELS_DIR, "drivers_processed.csv"), index=False)
passenger_agg.to_csv(os.path.join(MODELS_DIR, "passenger_agg.csv"), index=False)

logger.info(f"\n✅ Modèle sauvegardé dans {MODELS_DIR}")

try:
    urllib.request.urlopen("http://localhost:8000/reload-model", data=b"")
    logger.info("✅ Reload signal envoyé")
except Exception as e:
    logger.warning(f"Reload signal échoué (non bloquant): {e}")
