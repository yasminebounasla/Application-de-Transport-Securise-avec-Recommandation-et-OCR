"""
recommender.py — CORRIGÉ v2

BUGS CORRIGÉS DANS CETTE VERSION :

  ✅ Bug 1 — Retrieval fusionné LightFM + Pref (déjà corrigé v1, conservé)

  ✅ Bug 2 + 6 — user_features dynamiques : REFONTE COMPLÈTE
                L'ancien build_dynamic_user_features() + predict(user_index=0)
                était silencieusement cassé :
                  - predict(0, ..., user_features=mat_1xF) utilise l'embedding
                    du passager N°0 dans le modèle, pas un vecteur neutre.
                  - Les features de la matrice 1×F sont additionnées à cet
                    embedding biaisé → score faussé.

                NOUVELLE APPROCHE — predict_with_dynamic_features() :
                  - Reconstruit manuellement l'embedding utilisateur
                    en sommant les feature embeddings du modèle entraîné
                    pour les prefs actives du trajet ACTUEL.
                  - Calcule le score = item_bias + dot(user_emb, item_emb)
                    exactement comme LightFM le ferait en interne.
                  - Aucun biais lié à un user_index particulier.

  ✅ Bug 7 — Poids DEFAULT rééquilibrés :
                Ancien : w_lfm=0.18, w_pref=0.62
                → pref_score calculé en dur masquait complètement LightFM
                → impossible de savoir si LightFM contribuait vraiment

                Nouveau : w_lfm=0.45, w_pref=0.35
                → LightFM est vraiment testé
                → pref_score reste présent mais ne domine plus
                → si LightFM est bien entraîné, ses scores correront avec pref
"""

import pickle
import numpy as np
import pandas as pd
import math
import json
import os
import threading
import logging
from lightfm import LightFM
from lightfm.data import Dataset
from typing import List, Dict, Optional, Tuple
from dotenv import load_dotenv
from scipy.optimize import minimize
from scipy.spatial import KDTree
import scipy.sparse as sp

logger = logging.getLogger(__name__)
load_dotenv()

BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR    = os.path.join(BASE_DIR, "..", "model_real")
WEIGHTS_PATH  = os.path.join(BASE_DIR, "..", "optimized_weights.json")
FEEDBACK_PATH = os.path.join(BASE_DIR, "..", "feedback_history.json")

FORCE_DEFAULT_WEIGHTS = False
RETRIEVAL_TOP_K       = 20
PREF_TOP_K            = 15


def reset_weights():
    global _optimized_weights, _scores_history
    _optimized_weights = None
    _scores_history    = []
    for path in [WEIGHTS_PATH, FEEDBACK_PATH]:
        if os.path.exists(path):
            os.remove(path)
            print(f"🗑️  Supprimé : {path}")
    print("✅ Reset complet — poids DEFAULT actifs")


# ── GÉO ───────────────────────────────────────────────────────────────────────
def haversine(lat1, lng1, lat2, lng2) -> float:
    R    = 6371
    dLat = math.radians(lat2 - lat1)
    dLng = math.radians(lng2 - lng1)
    a    = (math.sin(dLat / 2) ** 2 +
            math.cos(math.radians(lat1)) *
            math.cos(math.radians(lat2)) *
            math.sin(dLng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def score_distance(distance_km: float, hours_until_departure: float) -> float:
    if   hours_until_departure < 2:   reference_km = 15
    elif hours_until_departure < 24:  reference_km = 40
    elif hours_until_departure < 168: reference_km = 80
    else:                             reference_km = 200
    return math.exp(-distance_km / reference_km)


def work_hour_match(driver: Dict, departure_hour: int) -> float:
    if departure_hour >= 5  and departure_hour < 12  and driver.get("works_morning"):   return 1.0
    if departure_hour >= 12 and departure_hour < 18  and driver.get("works_afternoon"): return 1.0
    if departure_hour >= 18 and departure_hour < 22  and driver.get("works_evening"):   return 1.0
    if (departure_hour >= 22 or departure_hour < 5)  and driver.get("works_night"):     return 1.0
    return 0.2


def max_driver_distance(trajet_distance_km: float, hours_until_departure: float) -> float:
    if   trajet_distance_km < 30:  dist_based = 30
    elif trajet_distance_km < 100: dist_based = 60
    elif trajet_distance_km < 300: dist_based = 100
    else:                          dist_based = 150
    if   hours_until_departure < 1:  time_based = 15
    elif hours_until_departure < 3:  time_based = 30
    elif hours_until_departure < 24: time_based = 60
    else:                            time_based = dist_based
    return min(dist_based, time_based)


# ── PREF SCORE ────────────────────────────────────────────────────────────────
def calculate_match_score(driver: Dict, preferences: Dict) -> float:
    def b(val):
        if isinstance(val, bool): return "yes" if val else "no"
        if val is None: return "no"
        return str(val).strip().lower()

    checks = [
        ("female_driver_pref", "sexe",           "f",   "m",   2),
        ("smoking_ok",         "smoking_allowed", "yes", "no",  2),
        ("luggage_large",      "car_big",         "yes", "no",  2),
        ("pets_ok",            "pets_allowed",    "yes", "no",  2),
        ("quiet_ride",         "talkative",       "no",  "yes", 1),
        ("radio_ok",           "radio_on",        "yes", "no",  1),
    ]
    score, max_points = 0.0, 0.0
    for pref_key, driver_key, match_val, mismatch_val, points in checks:
        pref = b(preferences.get(pref_key, "no"))
        if pref not in ("yes", "no"):
            continue
        max_points += points
        driver_val = b(driver.get(driver_key))
        target = match_val if pref == "yes" else mismatch_val
        score += points if driver_val == target else -points

    if max_points == 0:
        return 0.5
    return (score + max_points) / (2 * max_points)


def count_active_prefs(preferences: Dict) -> int:
    pref_keys = [
        "female_driver_pref", "smoking_ok", "luggage_large",
        "pets_ok", "quiet_ride", "radio_ok"
    ]
    return sum(1 for k in pref_keys if str(preferences.get(k, "no")).lower() == "yes")


# ── KD-TREE ───────────────────────────────────────────────────────────────────
def build_spatial_index(drivers: List[Dict]) -> Tuple[Optional[KDTree], List[Dict], List[Dict]]:
    geo_drivers, no_geo_drivers, coords = [], [], []
    for driver in drivers:
        lat, lng = driver.get("latitude"), driver.get("longitude")
        if lat is not None and lng is not None:
            try:
                coords.append([float(lat), float(lng)])
                geo_drivers.append(driver)
            except (ValueError, TypeError):
                no_geo_drivers.append(driver)
        else:
            no_geo_drivers.append(driver)
    if not coords:
        return None, [], no_geo_drivers
    return KDTree(np.array(coords)), geo_drivers, no_geo_drivers


def spatial_filter(tree, geo_drivers, lat, lng, max_km):
    indices = tree.query_ball_point([lat, lng], max_km / 111.0)
    return [geo_drivers[i] for i in indices]


# ── COLD START ────────────────────────────────────────────────────────────────
def cold_start_by_preferences(
    drivers, preferences, departure_hour,
    hours_until_departure, start_lat, start_lng, max_km, top_n=5
):
    geo_available = start_lat is not None and start_lng is not None
    scored = []

    if geo_available:
        tree, geo_drivers, no_geo_drivers = build_spatial_index(drivers)
        candidates = spatial_filter(tree, geo_drivers, start_lat, start_lng, max_km) + no_geo_drivers if tree else drivers
    else:
        candidates = drivers

    nb_active_prefs = count_active_prefs(preferences)

    for driver in candidates:
        dist_km = None
        if geo_available and driver.get("latitude") and driver.get("longitude"):
            try:
                dist_km = haversine(driver["latitude"], driver["longitude"], start_lat, start_lng)
                driver["distance_km"] = round(dist_km, 1)
            except Exception:
                pass
        if dist_km is not None and dist_km > max_km:
            continue

        pref_score   = calculate_match_score(driver, preferences)
        dist_score   = score_distance(dist_km, hours_until_departure) if dist_km is not None else 0.5
        work_score   = work_hour_match(driver, departure_hour)
        rating_score = ((driver.get("avgRating") or 4.0) - 1) / 4

        final_score = (
            0.60 * pref_score + 0.20 * dist_score + 0.12 * work_score + 0.08 * rating_score
            if geo_available else
            0.70 * pref_score + 0.18 * work_score + 0.12 * rating_score
        )

        if nb_active_prefs > 0 and pref_score < 0.30:
            final_score *= 0.50

        driver["final_score"] = round(final_score, 4)
        driver["work_match"]  = work_score == 1.0
        driver["dist_score"]  = round(dist_score, 3) if dist_km is not None else None
        scored.append(driver)

    scored.sort(key=lambda d: d.get("final_score", 0), reverse=True)
    for d in scored:
        d.pop("final_score", None)
    print(f"✅ Cold-start: {len(scored)} drivers | Top {min(top_n, len(scored))} retournés")
    return scored[:top_n]


# ── NORMALISATION LIGHTFM — min-max ───────────────────────────────────────────
def normalize_lightfm_scores(raw_scores: np.ndarray) -> np.ndarray:
    s_min, s_max = raw_scores.min(), raw_scores.max()
    if s_max > s_min:
        return (raw_scores - s_min) / (s_max - s_min)
    return np.full_like(raw_scores, 0.5)


# ── POIDS ─────────────────────────────────────────────────────────────────────
WEIGHT_KEYS   = ["lightfm", "pref", "dist", "rating"]   # work retiré des poids — géré en pénalité dure
WEIGHT_BOUNDS = {
    "lightfm": (0.30, 0.55),
    "pref":    (0.20, 0.40),
    "dist":    (0.05, 0.20),
    "rating":  (0.02, 0.08),
}

# work n'est plus un poids souple (0.04 → ignoré par SLSQP).
# Il devient une pénalité DURE dans le ranking : driver qui ne travaille
# pas à l'heure du trajet reçoit un malus fixe de -0.15 sur le score final.
# C'est plus lisible et plus robuste que de compter sur w_work=0.04.
WORK_HOUR_PENALTY = 0.15   # soustrait du score final si work_score != 1.0

DEFAULT_WEIGHTS_GEO    = np.array([0.45, 0.38, 0.13, 0.04])
DEFAULT_WEIGHTS_NO_GEO = np.array([0.48, 0.44, 0.00, 0.08])

_scores_history: List[Dict]              = []
_optimized_weights: Optional[np.ndarray] = None
_feedback_lock = threading.Lock()

if not FORCE_DEFAULT_WEIGHTS:
    if os.path.exists(FEEDBACK_PATH):
        try:
            with open(FEEDBACK_PATH, "r") as f:
                raw_history = json.load(f)
            # ✅ Rejeter les anciens feedbacks qui ont "work" comme clé
            # (format 5-clés obsolète) — ils fausseraient le SLSQP
            valid = [e for e in raw_history if set(WEIGHT_KEYS).issubset(set(e.keys()))]
            invalid = len(raw_history) - len(valid)
            if invalid > 0:
                print(f"⚠️  {invalid} anciens feedbacks (format obsolète) ignorés")
                print(f"   → Supprimer {FEEDBACK_PATH} pour nettoyer complètement")
            _scores_history = valid
            print(f"✅ {len(_scores_history)} feedbacks valides rechargés")
        except Exception as e:
            print(f"[WARNING] Feedbacks: {e}")

    if os.path.exists(WEIGHTS_PATH):
        try:
            with open(WEIGHTS_PATH, "r") as f:
                loaded = json.load(f)
            loaded_arr = np.array(loaded)
            # ✅ Rejeter les poids de l'ancien format (5 valeurs au lieu de 4)
            if len(loaded_arr) != len(WEIGHT_KEYS):
                print(f"⚠️  Poids format obsolète ({len(loaded_arr)} valeurs) → DEFAULT utilisé")
                print(f"   → Supprimer {WEIGHTS_PATH} pour nettoyer complètement")
            elif loaded_arr.max() > 0.95:
                print(f"⚠️  Poids stuqués détectés {loaded_arr} → DEFAULT utilisé")
            else:
                _optimized_weights = loaded_arr
                print(f"✅ Poids rechargés: {_optimized_weights}")
        except Exception as e:
            print(f"[WARNING] Poids: {e}")
else:
    print("⚙️  FORCE_DEFAULT_WEIGHTS=True → poids DEFAULT actifs")


def _try_optimize_weights() -> Optional[np.ndarray]:
    if len(_scores_history) < 50:
        return None
    try:
        df = pd.DataFrame(_scores_history)
        X  = df[WEIGHT_KEYS].values
        y  = df["target"].values
        result = minimize(
            lambda w: np.mean((X @ w - y) ** 2),
            DEFAULT_WEIGHTS_GEO.copy(),
            jac=lambda w: 2 * X.T @ (X @ w - y) / len(y),
            method="SLSQP",
            bounds=[WEIGHT_BOUNDS[k] for k in WEIGHT_KEYS],
            constraints=[
                {"type": "eq",   "fun": lambda w: w.sum() - 1},
                {"type": "ineq", "fun": lambda w: w[0] - 0.30},  # lightfm >= 0.30
            ],
            options={"ftol": 1e-9, "maxiter": 1000},
        )
        if not result.success:
            print(f"[WARNING] Optimisation échouée: {result.message}")
            return None
        w_norm = result.x
        if w_norm.max() > 0.95:
            print(f"[WARNING] Poids optimisés stuqués {w_norm} → DEFAULT gardé")
            return None
        print(f"📊 Poids optimisés: {dict(zip(WEIGHT_KEYS, w_norm.round(3)))}")
        if not FORCE_DEFAULT_WEIGHTS:
            try:
                with open(WEIGHTS_PATH, "w") as f:
                    json.dump(w_norm.tolist(), f)
            except Exception as e:
                print(f"[WARNING] Sauvegarde poids: {e}")
        return w_norm
    except Exception as e:
        print(f"[WARNING] Régression: {e}")
        return None


def add_feedback_to_buffer(scores: Dict, real_rating: float) -> bool:
    global _optimized_weights
    target = max(0.0, min(1.0, (real_rating - 1) / 4))
    # ✅ Sauvegarder seulement les 4 clés du nouveau format (sans "work")
    entry  = {**{k: scores.get(k) or 0.0 for k in WEIGHT_KEYS}, "target": target}
    with _feedback_lock:
        _scores_history.append(entry)
        if not FORCE_DEFAULT_WEIGHTS:
            try:
                with open(FEEDBACK_PATH, "w") as f:
                    json.dump(_scores_history, f)
            except Exception as e:
                print(f"[WARNING] Sauvegarde feedback: {e}")
        print(f"✅ Feedback | note={real_rating} → target={target:.3f} | buffer={len(_scores_history)}/50")
        if len(_scores_history) >= 50:
            new_weights = _try_optimize_weights()
            if new_weights is not None and not FORCE_DEFAULT_WEIGHTS:
                _optimized_weights = new_weights
    return True


# ── RECOMMENDER CLASS ─────────────────────────────────────────────────────────
class Recommender:

    PREF_COLS = [
        "quiet_ride", "radio_ok", "smoking_ok",
        "pets_ok", "luggage_large", "female_driver_pref",
    ]

    def __init__(self):
        self.model         = self._load(os.path.join(MODELS_DIR, "lightfm_model_real.pkl"))
        self.dataset       = self._load(os.path.join(MODELS_DIR, "dataset_real.pkl"))
        self.item_features = self._load(os.path.join(MODELS_DIR, "item_features_real.pkl"))
        self.user_features = self._load(os.path.join(MODELS_DIR, "user_features_real.pkl"))
        self._refresh_mappings()
        try:
            self.drivers_df = pd.read_csv(os.path.join(MODELS_DIR, "drivers_processed.csv"))
            print(f"✅ {len(self.drivers_df)} drivers chargés")
        except Exception:
            self.drivers_df = None

    def _refresh_mappings(self):
        if self.dataset:
            user_id_map, user_feature_map, item_id_map, item_feature_map = self.dataset.mapping()
            self.user_id_map        = user_id_map
            self.user_feature_map   = user_feature_map   # nom → index dans les feature embeddings
            self.item_id_map        = item_id_map
            self.item_feature_map   = item_feature_map
            self.index_to_driver_id = {v: k for k, v in item_id_map.items()}
        else:
            self.user_id_map = self.item_id_map = {}
            self.user_feature_map = self.item_feature_map = {}
            self.index_to_driver_id = {}

    def _load(self, path: str):
        try:
            with open(path, "rb") as f:
                return pickle.load(f, encoding="bytes")
        except Exception:
            try:
                import joblib
                return joblib.load(path)
            except Exception as e:
                print(f"[LOAD] ❌ {path}: {e}")
                return None

    def reload(self):
        self.__init__()
        print("✅ Modèle rechargé")

    # ── ✅ Bug 2+6 FIX COMPLET — predict avec features dynamiques ─────────────
    def predict_with_dynamic_features(
        self,
        preferences: Dict,
        candidate_indices: List[int],
    ) -> Optional[np.ndarray]:
        """
        Calcule les scores LightFM en utilisant les prefs du trajet ACTUEL,
        sans dépendre d'un user_index particulier dans le modèle.

        Pourquoi l'ancienne approche (predict(user_index=0, user_features=mat))
        était cassée :
          - LightFM calcule : score = user_bias[idx] + item_bias[j]
                                      + (user_emb[idx] + sum(feat_emb)) · item_emb[j]
          - user_emb[0] = embedding du PREMIER passager dans le dataset
          - Ce passager a un profil particulier → le score est biaisé
          - On voulait user_emb = 0 (vecteur neutre) + sum(feat_emb pour prefs actives)

        Nouvelle approche :
          - user_emb = sum des feature_embeddings pour les prefs actives du trajet
          - score = item_bias[j] + dot(user_emb, item_emb[j])
          - Pas de user_bias (=0 car passager inconnu/neutre)
          - Résultat : score pur content-based, ancré dans les prefs du trajet actuel
        """
        if self.model is None or not candidate_indices:
            return None

        def b(val):
            if isinstance(val, bool): return "yes" if val else "no"
            if val is None: return "no"
            return str(val).strip().lower()

        # Récupérer la dimension des embeddings
        n_components = self.model.user_embeddings.shape[1]

        # Construire l'embedding utilisateur en sommant les feature embeddings
        # pour les prefs actives du trajet actuel.
        user_emb = np.zeros(n_components, dtype=np.float32)
        features_used = []

        for col in self.PREF_COLS:
            val       = b(preferences.get(col, "no"))
            feat_name = f"{col}:{val}"

            if feat_name in self.user_feature_map:
                feat_idx = self.user_feature_map[feat_name]
                # Les feature embeddings sont dans model.user_embeddings
                # Les n premiers indices = user identities, les suivants = features
                # user_feature_map donne les indices dans la matrice features
                # qui correspondent aux colonnes de user_embeddings
                if feat_idx < self.model.user_embeddings.shape[0]:
                    user_emb += self.model.user_embeddings[feat_idx]
                    features_used.append(feat_name)

        if not features_used:
            print(f"[WARNING] predict_dynamic: aucune feature trouvée dans user_feature_map")
            return None

        # Calculer les scores pour chaque driver candidat
        item_biases    = self.model.item_biases      # shape: (n_items,)
        item_embeddings = self.model.item_embeddings  # shape: (n_items, n_components)

        scores = np.array([
            float(item_biases[j]) + float(np.dot(user_emb, item_embeddings[j]))
            for j in candidate_indices
        ], dtype=np.float32)

        print(f"   ✅ predict_dynamic: {len(features_used)} features actives → scores calculés")
        return scores

    def retrieval_top_k(
        self,
        passenger_key: str,
        candidate_driver_ids: List[str],
        k: int,
        preferences: Dict = None,
    ) -> List[str]:
        """
        Étape 1 — LightFM score sur les candidats géo → top-k retenus.
        Utilise predict_with_dynamic_features() si preferences fourni,
        sinon fallback sur predict() avec le user_index classique.
        """
        if not self.model:
            return candidate_driver_ids

        candidate_indices = [
            self.item_id_map[did]
            for did in candidate_driver_ids
            if did in self.item_id_map
        ]
        if not candidate_indices:
            return candidate_driver_ids

        try:
            # ✅ Bug 2+6 fix : utiliser les features dynamiques en priorité
            if preferences is not None:
                raw_scores = self.predict_with_dynamic_features(preferences, candidate_indices)
                if raw_scores is None:
                    raise ValueError("predict_dynamic retourné None")
                print(f"   Retrieval: scores dynamiques (content-based)")
            elif passenger_key in self.user_id_map:
                user_index = self.user_id_map[passenger_key]
                raw_scores = self.model.predict(
                    user_index,
                    np.array(candidate_indices),
                    user_features=self.user_features,
                    item_features=self.item_features,
                )
                print(f"   Retrieval: scores collaboratifs (user_index={user_index})")
            else:
                return candidate_driver_ids

        except Exception as e:
            print(f"[WARNING] predict retrieval: {e}")
            return candidate_driver_ids

        top_k_positions  = np.argsort(raw_scores)[::-1][:k]
        top_k_driver_ids = [
            self.index_to_driver_id[candidate_indices[pos]]
            for pos in top_k_positions
            if candidate_indices[pos] in self.index_to_driver_id
        ]
        print(f"   Retrieval LightFM: {len(candidate_indices)} → top {len(top_k_driver_ids)} candidats")
        return top_k_driver_ids


recommender = Recommender()


# ── POINT D'ENTRÉE PRINCIPAL ──────────────────────────────────────────────────
async def get_recommendations(
    passenger_id: str,
    preferences: Dict = None,
    trajet: Dict = None,
    drivers: List[Dict] = None,
    interaction_counts: Dict = None,
    top_n: int = 5,
) -> List[Dict]:

    preferences        = preferences        or {}
    trajet             = trajet             or {}
    all_drivers        = drivers            or []
    interaction_counts = interaction_counts or {}

    start_lat     = trajet.get("startLat")
    start_lng     = trajet.get("startLng")
    geo_available = start_lat is not None and start_lng is not None

    trajet_distance_km    = float(trajet.get("distanceKm") or 50.0)
    heure_depart_str      = trajet.get("heureDepart", "12:00")
    departure_hour        = int(heure_depart_str.split(":")[0]) if heure_depart_str else 12
    hours_until_departure = 168.0

    if trajet.get("dateDepart"):
        try:
            from datetime import datetime, timezone
            date_depart = datetime.fromisoformat(trajet["dateDepart"].replace("Z", "+00:00"))
            hours_until_departure = max(
                0.0,
                (date_depart - datetime.now(timezone.utc)).total_seconds() / 3600,
            )
        except Exception:
            pass

    max_km          = max_driver_distance(trajet_distance_km, hours_until_departure)
    nb_active_prefs = count_active_prefs(preferences)

    if not all_drivers:
        return []

    passenger_key = f"P{str(passenger_id).lstrip('P')}"

    # ── Cold start ────────────────────────────────────────────────────────────
    if passenger_key not in recommender.user_id_map:
        print("   Mode: cold-start")
        return cold_start_by_preferences(
            all_drivers, preferences, departure_hour,
            hours_until_departure, start_lat, start_lng, max_km, top_n,
        )

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 1 — RETRIEVAL (LightFM + Pref)
    # ══════════════════════════════════════════════════════════════════════════
    if geo_available:
        tree, geo_drivers, no_geo_drivers = build_spatial_index(all_drivers)
        if tree is not None:
            geo_candidates = spatial_filter(tree, geo_drivers, start_lat, start_lng, max_km)
            geo_candidates = [
                d for d in geo_candidates
                if haversine(d["latitude"], d["longitude"], start_lat, start_lng) <= max_km
            ]
            all_candidates = geo_candidates + no_geo_drivers
        else:
            all_candidates = all_drivers
    else:
        all_candidates = all_drivers

    print(f"   Géo-filtre: {len(all_drivers)} → {len(all_candidates)} candidats (rayon {max_km} km)")

    candidate_driver_ids = [f"D{d['id']}" for d in all_candidates]

    # ✅ Bug 2+6 fix : passer les prefs pour le predict dynamique
    top_k_lfm_ids = set(recommender.retrieval_top_k(
        passenger_key,
        candidate_driver_ids,
        k=RETRIEVAL_TOP_K,
        preferences=preferences,  # ← les prefs du trajet actuel
    ))

    # ✅ Bug 1 fix : top-K par pref_score pur (garanti de n'éliminer aucun bon match)
    if nb_active_prefs > 0:
        pref_scored = sorted(
            all_candidates,
            key=lambda d: calculate_match_score(d, preferences),
            reverse=True,
        )
        top_k_pref_ids = {f"D{d['id']}" for d in pref_scored[:PREF_TOP_K]}
        print(f"   Pref top-{PREF_TOP_K} ajoutés aux candidats retrieval")
    else:
        top_k_pref_ids = set()

    merged_ids           = top_k_lfm_ids | top_k_pref_ids
    retrieval_candidates = [d for d in all_candidates if f"D{d['id']}" in merged_ids]

    if not retrieval_candidates:
        retrieval_candidates = all_candidates
        print("   [FALLBACK] Retrieval vide → tous les candidats géo")

    print(f"   Retrieval final: {len(retrieval_candidates)} candidats "
          f"(LightFM: {len(top_k_lfm_ids)}, Pref: {len(top_k_pref_ids)}, "
          f"Union: {len(merged_ids)})")

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 2 — RANKING FIN
    # ══════════════════════════════════════════════════════════════════════════
    global _optimized_weights
    if FORCE_DEFAULT_WEIGHTS or _optimized_weights is None:
        w = DEFAULT_WEIGHTS_GEO if geo_available else DEFAULT_WEIGHTS_NO_GEO
        weight_source = "DEFAULT (FORCE)" if FORCE_DEFAULT_WEIGHTS else "DEFAULT"
    else:
        w = _optimized_weights
        weight_source = "SLSQP optimisé"

    w_lfm, w_pref, w_dist, w_rating = w

    # Scores LightFM dynamiques pour le ranking final
    candidate_indices_ret = [
        recommender.item_id_map[f"D{d['id']}"]
        for d in retrieval_candidates
        if f"D{d['id']}" in recommender.item_id_map
    ]

    lightfm_scores_map = {}
    if candidate_indices_ret and recommender.model:
        try:
            # ✅ Bug 2+6 fix : predict dynamique pour le ranking aussi
            raw = recommender.predict_with_dynamic_features(preferences, candidate_indices_ret)

            if raw is None:
                raise ValueError("predict_dynamic retourné None pour ranking")

            norm = normalize_lightfm_scores(raw)
            lightfm_scores_map = {
                recommender.index_to_driver_id[candidate_indices_ret[i]]: float(norm[i])
                for i in range(len(candidate_indices_ret))
                if candidate_indices_ret[i] in recommender.index_to_driver_id
            }
        except Exception as e:
            print(f"[WARNING] predict ranking: {e} → fallback scores collaboratifs")
            # Fallback : predict classique avec user_index
            try:
                user_index = recommender.user_id_map[passenger_key]
                raw = recommender.model.predict(
                    user_index,
                    np.array(candidate_indices_ret),
                    user_features=recommender.user_features,
                    item_features=recommender.item_features,
                )
                norm = normalize_lightfm_scores(raw)
                lightfm_scores_map = {
                    recommender.index_to_driver_id[candidate_indices_ret[i]]: float(norm[i])
                    for i in range(len(candidate_indices_ret))
                    if candidate_indices_ret[i] in recommender.index_to_driver_id
                }
            except Exception as e2:
                print(f"[WARNING] fallback predict aussi échoué: {e2}")

    scored_drivers = []
    for driver in retrieval_candidates:
        driver_id = f"D{driver['id']}"
        dist_km   = None

        if geo_available and driver.get("latitude") and driver.get("longitude"):
            try:
                dist_km = haversine(driver["latitude"], driver["longitude"], start_lat, start_lng)
                driver["distance_km"] = round(dist_km, 1)
            except Exception:
                pass

        dist_score    = score_distance(dist_km, hours_until_departure) if dist_km is not None else 0.5
        lightfm_score = lightfm_scores_map.get(driver_id, 0.5)
        pref_score    = calculate_match_score(driver, preferences)
        work_score    = work_hour_match(driver, departure_hour)
        rating_score  = ((driver.get("avgRating") or 4.0) - 1) / 4

        final_score = (
            w_lfm    * lightfm_score +
            w_pref   * pref_score    +
            w_dist   * dist_score    +
            w_rating * rating_score
        )

        # ── Pénalité horaire DURE ─────────────────────────────────────────────
        # work_score != 1.0 = driver ne travaille pas à cette heure
        # On soustrait un malus fixe — plus robuste que w_work=0.04
        # qui était trop faible pour compenser un bon pref_score
        if work_score < 1.0:
            final_score -= WORK_HOUR_PENALTY

        # ── Pénalités pref ────────────────────────────────────────────────────
        if nb_active_prefs >= 3 and pref_score < 0.25:
            final_score *= 0.40
        elif nb_active_prefs >= 2 and pref_score < 0.30:
            final_score *= 0.50
        elif nb_active_prefs >= 1 and pref_score < 0.20:
            final_score *= 0.60

        # ── Pénalité diversité ────────────────────────────────────────────────
        nb = interaction_counts.get(str(driver["id"]), 0)
        if   nb >= 5: final_score *= 0.80
        elif nb >= 3: final_score *= 0.90

        driver["final_score"] = round(max(0.0, final_score), 4)
        driver["work_match"]  = work_score == 1.0
        driver["dist_score"]  = round(dist_score, 3) if dist_km is not None else None
        driver["_scores"]     = {
            "lightfm": round(lightfm_score, 3),
            "pref":    round(pref_score, 3),
            "dist":    round(dist_score, 3),
            "work_ok": work_score == 1.0,   # booléen — pénalité dure si False
            "rating":  round(rating_score, 3),
        }
        scored_drivers.append(driver)

    print(f"\n📊 Poids [{weight_source}]: lfm={w_lfm:.2f} pref={w_pref:.2f} dist={w_dist:.2f} rating={w_rating:.2f} | work_penalty={WORK_HOUR_PENALTY}")
    print(f"   Prefs actives du passager : {nb_active_prefs}")
    print("─" * 60)
    for d in sorted(scored_drivers, key=lambda x: x.get("final_score", 0), reverse=True)[:top_n]:
        s = d["_scores"]
        work_flag = "✅" if s["work_ok"] else f"❌ -{WORK_HOUR_PENALTY}"
        print(f"   Driver {d['id']} | lfm={s['lightfm']:.3f} pref={s['pref']:.3f} "
              f"dist={s['dist']:.3f} work={work_flag} → {d['final_score']:.4f}")
    print("─" * 60 + "\n")

    scored_drivers.sort(key=lambda d: d.get("final_score", 0), reverse=True)
    for driver in scored_drivers:
        driver.pop("final_score", None)

    print(f"✅ {len(scored_drivers)} drivers rankés | Top {min(top_n, len(scored_drivers))} retournés")
    return scored_drivers[:top_n]