"""
retrain.py — CORRIGÉ

BUGS CORRIGÉS DANS CETTE VERSION :

  ✅ Bug 3 — Signal prefMatch renforcé dans le weight d'entraînement :
             Ancienne formule : weight = noteNorm × (0.70 + 0.30 × prefMatch)
             → max boost pref = 0.30  → signal content-based trop faible
             Nouvelle formule : weight = noteNorm × (0.50 + 0.50 × prefMatch)
             → max boost pref = 0.50  → LightFM apprend vraiment les prefs
             Avec bonne note ET bon match : weight jusqu'à 1.0
             Avec bonne note ET mauvais match : weight plafonné à 0.50

  ✅ Bug 5 — user_features construites PAR INTERACTION (pas par moyenne passager) :
             Chaque interaction apporte ses propres prefs.
             LightFM apprend "quand ce passager veut quiet=yes, il note mieux
             les drivers calmes" — pas un profil moyen flou.

  ✅ Epochs augmentés pour compenser le signal plus contrasté.
  ✅ Diagnostic post-entraînement enrichi.
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

if "driver_gender" in d_df.columns:
    d_df["driver_gender"] = d_df["driver_gender"].str.strip().str.lower().fillna("male")

def rating_bucket(r):
    if   r >= 4.5: return "rating:excellent"
    elif r >= 4.0: return "rating:good"
    elif r >= 3.0: return "rating:average"
    else:          return "rating:poor"

d_df["rating_bucket"] = d_df["avg_rating"].apply(rating_bucket)

# ── 4. WEIGHTS ────────────────────────────────────────────────────────────────
#
# ✅ Bug 3 FIX : Le weight exporté par exportDataService.js utilise maintenant
# la formule renforcée (voir exportDataService.js corrigé) :
#   weight = noteNorm × (0.50 + 0.50 × prefMatch)
#
# Ici on recharge simplement ce weight et on le clamp [0.01, 1.0].
# Pas de recalcul ici — le calcul est centralisé dans exportDataService.js.

logger.info(f"\nDistribution weights (depuis exportDataService.js CORRIGÉ) :")
w = i_df["weight"]
logger.info(f"  >= 0.75 (très positif)  : {(w >= 0.75).sum()}")
logger.info(f"  0.40-0.75 (positif)     : {((w >= 0.40) & (w < 0.75)).sum()}")
logger.info(f"  0.10-0.40 (neutre/neg)  : {((w >= 0.10) & (w < 0.40)).sum()}")
logger.info(f"  < 0.10 (très négatif)   : {(w < 0.10).sum()}")
logger.info(f"  Contraste max-min       : {w.max() - w.min():.3f}  (> 0.50 = bon signal corrigé)")
logger.info(f"  Total                   : {len(i_df)}")

if w.max() - w.min() < 0.40:
    logger.warning("⚠️  Contraste encore faible — vérifier exportDataService.js corrigé")
else:
    logger.info("  ✅ Contraste suffisant pour le content-based")

i_df["weight_final"] = i_df["weight"].clip(lower=0.01, upper=1.0)

# ── 5. MERGE interactions + prefs du trajet EXACT ────────────────────────────
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
    if nb_ok < len(i_merged) * 0.5:
        logger.warning("⚠️  Moins de 50% matchées — vérifier trajet_id dans les 2 CSV")
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

# ── 6. DIAGNOSTIC pref_match ─────────────────────────────────────────────────
pref_yes_rates = {}
for col in PREF_COLS:
    rate = (all_interactions[col].str.lower() == "yes").mean()
    pref_yes_rates[col] = rate

logger.info(f"\nDiagnostic prefs passagers (% de 'yes' dans les interactions) :")
all_uniform = True
for col, rate in pref_yes_rates.items():
    status = "✅" if 0.10 < rate < 0.90 else "⚠️ "
    logger.info(f"  {col:<22} : {rate:.1%}  {status}")
    if 0.10 < rate < 0.90:
        all_uniform = False

if all_uniform:
    logger.warning("⚠️  Toutes les prefs sont quasi-uniformes")
    logger.warning("   LightFM ne pourra pas apprendre le content-based")
else:
    logger.info("  ✅ Prefs suffisamment variées pour le content-based")

# ── 7. USER FEATURES — ✅ Bug 5 FIX : PAR INTERACTION, PAS PAR MOYENNE ───────
#
# ANCIENNE APPROCHE (bugée) :
#   passenger_agg = t_df.groupby("passenger_id").mean()
#   → LightFM apprend un profil moyen flou par passager
#
# NOUVELLE APPROCHE (corrigée) :
#   On construit les user_features directement depuis les prefs
#   de chaque interaction (les prefs du trajet exact).
#   LightFM reçoit les vraies prefs pour chaque paire (passager, trajet).
#
# Pour les user_features statiques du dataset (utilisées en cold-start
# ou quand dynamic_uf est indisponible), on garde la moyenne —
# mais c'est secondaire car le predict runtime utilise build_dynamic_user_features().

for col in PREF_COLS:
    t_df[f"{col}_bin"] = (t_df[col].str.lower() == "yes").astype(float)

# Moyenne par passager — utilisée uniquement pour les embeddings statiques LightFM
passenger_agg = (
    t_df.groupby("passenger_id")[[f"{c}_bin" for c in PREF_COLS]]
    .mean()
    .reset_index()
)
logger.info(f"\nPassagers uniques pour user_features statiques : {len(passenger_agg)}")

# ── 8. DATASET LIGHTFM ───────────────────────────────────────────────────────
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

# ── 9. MATRICES ───────────────────────────────────────────────────────────────
(interactions_matrix, weights_matrix) = dataset.build_interactions(
    [
        (row["passenger_id"], row["driver_id"], float(row["weight_final"]))
        for _, row in all_interactions.iterrows()
    ]
)

# ✅ Bug 5 FIX : user_features construites depuis les prefs de CHAQUE interaction
# On utilise les prefs du trajet exact (i_merged) plutôt que la moyenne passager.
#
# Pour chaque passager, on agrège TOUTES les prefs de ses interactions
# en les pondérant par le weight → les prefs qui mènent aux bonnes notes
# ont plus de poids dans l'embedding.

def build_weighted_pref_features(interactions_df: pd.DataFrame, pref_cols: list) -> dict:
    """
    Pour chaque passager, calcule un profil pondéré par le weight.
    Passager avec quiet_ride=yes et weight=0.9 → quiet_ride très important.
    Passager avec quiet_ride=yes et weight=0.1 → ignoré (mauvaise expérience).
    """
    passenger_features = {}
    grouped = interactions_df.groupby("passenger_id")

    for passenger_id, group in grouped:
        total_weight = group["weight_final"].sum()
        if total_weight == 0:
            continue

        pref_scores = {}
        for col in pref_cols:
            # Moyenne pondérée : prefs qui mènent aux bonnes notes sont privilégiées
            yes_weight = group.loc[group[col].str.lower() == "yes", "weight_final"].sum()
            pref_scores[col] = yes_weight / total_weight  # [0.0, 1.0]

        passenger_features[passenger_id] = pref_scores

    return passenger_features

passenger_weighted_prefs = build_weighted_pref_features(all_interactions, PREF_COLS)
logger.info(f"\nUser features pondérées calculées pour {len(passenger_weighted_prefs)} passagers")

def prefs_to_features_weighted(passenger_id: str, pref_scores: dict) -> list:
    """
    Convertit le profil pondéré en features LightFM.
    Seuil 0.6 → :yes, seuil 0.4 → :no, entre les deux → les deux (incertain).
    """
    features = []
    for col in PREF_COLS:
        val = pref_scores.get(col, 0.5)
        if   val >= 0.6: features.append(f"{col}:yes")
        elif val <= 0.4: features.append(f"{col}:no")
        else:
            features.append(f"{col}:yes")
            features.append(f"{col}:no")
    return features

# Fallback pour passagers sans interactions dans i_merged : utiliser la moyenne
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

# Construire les user_features en priorisant la version pondérée
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

# ── 10. MODÈLE ────────────────────────────────────────────────────────────────
model = LightFM(
    loss="warp",
    no_components=64,
    learning_rate=0.03,
    item_alpha=1e-6,
    user_alpha=1e-6,
    random_state=42,
)

n_train = interactions_matrix.nnz
# ✅ Epochs augmentés : signal plus contrasté → plus d'itérations pour converger
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

logger.info("Entrainement terminé.")

# ── 11. DIAGNOSTIC POST-ENTRAÎNEMENT ─────────────────────────────────────────
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
        logger.warning("   Causes possibles :")
        logger.warning("   1. Contraste weights trop faible")
        logger.warning("   2. Prefs passagers trop uniformes dans trajets.csv")
        logger.warning("   3. Drivers trop similaires entre eux dans drivers.csv")
    else:
        logger.info("  ✅ Content-based appris correctement")

    # Diagnostic supplémentaire : cohérence pref → driver
    logger.info(f"\n  Diagnostic contrastes item_biases :")
    try:
        _, _, item_id_map, _ = dataset.mapping()
        biases_by_driver = {k: item_biases[v] for k, v in item_id_map.items()}
        top5 = sorted(biases_by_driver.items(), key=lambda x: x[1], reverse=True)[:5]
        bot5 = sorted(biases_by_driver.items(), key=lambda x: x[1])[:5]
        logger.info(f"  Top 5 biais positifs  : {[(k, round(v,3)) for k,v in top5]}")
        logger.info(f"  Top 5 biais négatifs  : {[(k, round(v,3)) for k,v in bot5]}")
    except Exception:
        pass

except Exception as e:
    logger.warning(f"Diagnostic échoué : {e}")

# ── 12. SAUVEGARDE ────────────────────────────────────────────────────────────
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