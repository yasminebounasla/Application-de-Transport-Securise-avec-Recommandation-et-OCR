"""
recommender.py — HYBRIDE LIGHTFM (content-based + collaboratif)

LOGIQUE PRÉFÉRENCES :
  Pas de filtre dur — LightFM + scoring souple gèrent tout.
  Un driver qui viole une pref reçoit un pref_score bas → rank bas naturellement.
  oui  → driver idéalement DOIT avoir la feature   (pref_score élevé si présent)
  non  → driver idéalement NE DOIT PAS avoir la feature (pref_score élevé si absent)
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
    print("Reset complet — poids DEFAULT actifs")


# ── GEO ───────────────────────────────────────────────────────────────────────
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
    return 0.0


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


# ── PREF SCORE (scoring souple) ───────────────────────────────────────────────
def _b(val) -> str:
    """Normalise n'importe quelle valeur en 'yes' ou 'no'."""
    if isinstance(val, bool):
        return "yes" if val else "no"
    if val is None:
        return "no"
    return str(val).strip().lower()


def _pref(val) -> Optional[str]:
    """
    Retourne 'yes', 'no', ou None si la préférence n'est pas spécifiée.
    None = passager indifférent -> aucun impact sur le score.
    """
    if val is None:
        return None
    s = str(val).strip().lower()
    if s in ("yes", "oui", "true", "1"):
        return "yes"
    if s in ("no", "non", "false", "0"):
        return "no"
    return None


# Table des règles :
# (pref_key, driver_key_or_special, want_driver_yes_when_pref_yes, points)
#   want_driver_yes_when_pref_yes=True  : pref=oui -> on veut driver_field=yes
#   want_driver_yes_when_pref_yes=False : pref=oui -> on veut driver_field=no
#     ex: quiet_ride=oui -> talkative doit être no (driver calme)
PREF_RULES = [
    ("female_driver_pref", "_female",         True,  3.0),
    ("smoking_ok",         "smoking_allowed", True,  2.0),
    ("luggage_large",      "car_big",         True,  2.0),
    ("pets_ok",            "pets_allowed",    True,  2.0),
    ("quiet_ride",         "talkative",       False, 1.5),
    ("radio_ok",           "radio_on",        True,  1.0),
]


def _driver_field(driver: Dict, key: str) -> str:
    if key == "_female":
        return "yes" if str(driver.get("sexe", "")).strip().lower() == "f" else "no"
    return _b(driver.get(key))


def calculate_match_score(driver: Dict, preferences: Dict) -> float:
    """
    Score [0, 1].
    Pref spécifiée et respectée  -> +points
    Pref spécifiée et violée     -> -points * 0.5 (pénalité modérée, pas d'élimination)
    Pref absente (None)          -> ignorée
    """
    score      = 0.0
    max_points = 0.0

    for pref_key, driver_key, want_yes_when_pref_yes, points in PREF_RULES:
        pref_val = _pref(preferences.get(pref_key))
        if pref_val is None:
            continue

        max_points += points
        driver_val  = _driver_field(driver, driver_key)

        if pref_val == "yes":
            wanted = "yes" if want_yes_when_pref_yes else "no"
        else:
            wanted = "no" if want_yes_when_pref_yes else "yes"

        if driver_val == wanted:
            score += points
        else:
            score -= points * 0.5

    if max_points == 0:
        return 0.5

    normalized = (score + max_points) / (2 * max_points)
    return max(0.0, min(1.0, normalized))


def count_active_prefs(preferences: Dict) -> int:
    return sum(
        1 for pref_key, _, _, _ in PREF_RULES
        if _pref(preferences.get(pref_key)) is not None
    )


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
        candidates = (
            spatial_filter(tree, geo_drivers, start_lat, start_lng, max_km) + no_geo_drivers
            if tree else drivers
        )
    else:
        candidates = drivers

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
            0.55 * pref_score + 0.25 * dist_score + 0.12 * work_score + 0.08 * rating_score
            if geo_available else
            0.70 * pref_score + 0.18 * work_score + 0.12 * rating_score
        )

        if pref_score < 0.30:
            final_score *= 0.20
        elif pref_score < 0.50:
            final_score *= 0.55

        driver["final_score"] = round(final_score, 4)
        driver["work_match"]  = work_score == 1.0
        driver["dist_score"]  = round(dist_score, 3) if dist_km is not None else None
        scored.append(driver)

    scored.sort(key=lambda d: d.get("final_score", 0), reverse=True)
    for d in scored:
        d.pop("final_score", None)
    print(f"Cold-start: {len(scored)} drivers scorés | Top {min(top_n, len(scored))} retournés")
    return scored[:top_n]


# ── NORMALISATION LIGHTFM ─────────────────────────────────────────────────────
def normalize_lightfm_scores(raw_scores: np.ndarray) -> np.ndarray:
    s_min, s_max = raw_scores.min(), raw_scores.max()
    if s_max > s_min:
        return (raw_scores - s_min) / (s_max - s_min)
    return np.full_like(raw_scores, 0.5)


# ── POIDS ─────────────────────────────────────────────────────────────────────
WEIGHT_KEYS   = ["lightfm", "pref", "dist", "rating"]
WEIGHT_BOUNDS = {
    "lightfm": (0.20, 0.50),
    "pref":    (0.30, 0.55),
    "dist":    (0.05, 0.20),
    "rating":  (0.02, 0.08),
}

WORK_HOUR_PENALTY = 0.15

DEFAULT_WEIGHTS_GEO    = np.array([0.35, 0.45, 0.15, 0.05])
DEFAULT_WEIGHTS_NO_GEO = np.array([0.40, 0.50, 0.00, 0.10])

_scores_history: List[Dict]              = []
_optimized_weights: Optional[np.ndarray] = None
_feedback_lock = threading.Lock()

if not FORCE_DEFAULT_WEIGHTS:
    if os.path.exists(FEEDBACK_PATH):
        try:
            with open(FEEDBACK_PATH, "r") as f:
                raw_history = json.load(f)
            valid = [e for e in raw_history if set(WEIGHT_KEYS).issubset(set(e.keys()))]
            _scores_history = valid
            print(f"{len(_scores_history)} feedbacks valides rechargés")
        except Exception as e:
            print(f"[WARNING] Feedbacks: {e}")

    if os.path.exists(WEIGHTS_PATH):
        try:
            with open(WEIGHTS_PATH, "r") as f:
                loaded = json.load(f)
            loaded_arr = np.array(loaded)
            if len(loaded_arr) == len(WEIGHT_KEYS) and loaded_arr.max() <= 0.95:
                _optimized_weights = loaded_arr
                print(f"Poids rechargés: {_optimized_weights}")
            else:
                print("Poids invalides -> DEFAULT utilisé")
        except Exception as e:
            print(f"[WARNING] Poids: {e}")
else:
    print("FORCE_DEFAULT_WEIGHTS=True -> poids DEFAULT actifs")


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
                {"type": "ineq", "fun": lambda w: w[1] - 0.30},
            ],
            options={"ftol": 1e-9, "maxiter": 1000},
        )
        if not result.success or result.x.max() > 0.95:
            return None
        w_norm = result.x
        print(f"Poids optimisés: {dict(zip(WEIGHT_KEYS, w_norm.round(3)))}")
        if not FORCE_DEFAULT_WEIGHTS:
            with open(WEIGHTS_PATH, "w") as f:
                json.dump(w_norm.tolist(), f)
        return w_norm
    except Exception as e:
        print(f"[WARNING] Optimisation: {e}")
        return None


def add_feedback_to_buffer(scores: Dict, real_rating: float) -> bool:
    global _optimized_weights
    target = max(0.0, min(1.0, (real_rating - 1) / 4))
    entry  = {**{k: scores.get(k) or 0.0 for k in WEIGHT_KEYS}, "target": target}
    with _feedback_lock:
        _scores_history.append(entry)
        if not FORCE_DEFAULT_WEIGHTS:
            try:
                with open(FEEDBACK_PATH, "w") as f:
                    json.dump(_scores_history, f)
            except Exception as e:
                print(f"[WARNING] Sauvegarde feedback: {e}")
        print(f"Feedback | note={real_rating} -> target={target:.3f} | buffer={len(_scores_history)}/50")
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
            print(f"{len(self.drivers_df)} drivers chargés")
        except Exception:
            self.drivers_df = None

    def _refresh_mappings(self):
        if self.dataset:
            user_id_map, user_feature_map, item_id_map, item_feature_map = self.dataset.mapping()
            self.user_id_map        = user_id_map
            self.user_feature_map   = user_feature_map
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
                print(f"[LOAD] {path}: {e}")
                return None

    def reload(self):
        self.__init__()
        print("Modèle rechargé")

    def predict_with_dynamic_features(
        self,
        preferences: Dict,
        candidate_indices: List[int],
    ) -> Optional[np.ndarray]:
        """
        Injecte les features passager dynamiquement dans l'espace LightFM.
        col:yes si pref=oui, col:no si pref=non.
        Normalise par nb features pour éviter l'effet amplitude.
        """
        if self.model is None or not candidate_indices:
            return None

        n_components  = self.model.user_embeddings.shape[1]
        user_emb      = np.zeros(n_components, dtype=np.float32)
        features_used = []

        for col in self.PREF_COLS:
            pref_val = _pref(preferences.get(col))
            if pref_val is None:
                continue
            feat_name = f"{col}:{pref_val}"

            if feat_name in self.user_feature_map:
                feat_idx = self.user_feature_map[feat_name]
                if feat_idx < self.model.user_embeddings.shape[0]:
                    user_emb += self.model.user_embeddings[feat_idx]
                    features_used.append(feat_name)

        if not features_used:
            print("   predict_dynamic: aucune feature trouvée dans user_feature_map")
            return None

        user_emb /= len(features_used)

        scores = np.array([
            float(self.model.item_biases[j]) + float(np.dot(user_emb, self.model.item_embeddings[j]))
            for j in candidate_indices
        ], dtype=np.float32)

        print(f"   predict_dynamic: {len(features_used)} features -> scores calculés")
        return scores

    def retrieval_top_k(
        self,
        passenger_key: str,
        candidate_driver_ids: List[str],
        k: int,
        preferences: Dict = None,
    ) -> List[str]:
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
            raw_scores = None

            # Priorité 1 : content-based dynamique
            if preferences is not None:
                raw_scores = self.predict_with_dynamic_features(preferences, candidate_indices)
                if raw_scores is not None:
                    print("   Retrieval: content-based dynamique")

            # Priorité 2 : collaboratif classique
            if raw_scores is None and passenger_key in self.user_id_map:
                user_index = self.user_id_map[passenger_key]
                raw_scores = self.model.predict(
                    user_index,
                    np.array(candidate_indices),
                    user_features=self.user_features,
                    item_features=self.item_features,
                )
                print("   Retrieval: collaboratif")

            if raw_scores is None:
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
        print(f"   Retrieval LightFM: {len(candidate_indices)} -> top {len(top_k_driver_ids)}")
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
        print(f"   Mode: cold-start (passager {passenger_key} inconnu du modèle)")
        return cold_start_by_preferences(
            all_drivers, preferences, departure_hour,
            hours_until_departure, start_lat, start_lng, max_km, top_n,
        )

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 1 — FILTRAGE GÉO
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

    print(f"   Geo-filtre: {len(all_drivers)} -> {len(all_candidates)} candidats (rayon {max_km} km)")

    if not all_candidates:
        print("   [WARN] Aucun candidat géo — fallback tous les drivers")
        all_candidates = all_drivers

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 2 — RETRIEVAL LIGHTFM (content-based + collaboratif)
    # ══════════════════════════════════════════════════════════════════════════
    candidate_driver_ids = [f"D{d['id']}" for d in all_candidates]

    top_k_lfm_ids = set(recommender.retrieval_top_k(
        passenger_key,
        candidate_driver_ids,
        k=RETRIEVAL_TOP_K,
        preferences=preferences,
    ))

    # Union LightFM + top pref_score pour garantir les meilleurs matchs de prefs
    if nb_active_prefs > 0:
        pref_scored = sorted(
            all_candidates,
            key=lambda d: calculate_match_score(d, preferences),
            reverse=True,
        )
        top_k_pref_ids = {f"D{d['id']}" for d in pref_scored[:PREF_TOP_K]}
        print(f"   Pref top-{PREF_TOP_K} ajoutés au pool")
    else:
        top_k_pref_ids = set()

    merged_ids           = top_k_lfm_ids | top_k_pref_ids
    retrieval_candidates = [d for d in all_candidates if f"D{d['id']}" in merged_ids]

    if not retrieval_candidates:
        retrieval_candidates = all_candidates
        print("   [FALLBACK] Retrieval vide -> tous les candidats géo")

    print(f"   Retrieval final: {len(retrieval_candidates)} candidats")

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 3 — RANKING FIN (score hybride pondéré)
    # ══════════════════════════════════════════════════════════════════════════
    global _optimized_weights
    if FORCE_DEFAULT_WEIGHTS or _optimized_weights is None:
        w = DEFAULT_WEIGHTS_GEO if geo_available else DEFAULT_WEIGHTS_NO_GEO
        weight_source = "DEFAULT"
    else:
        w = _optimized_weights
        weight_source = "SLSQP optimisé"

    w_lfm, w_pref, w_dist, w_rating = w

    candidate_indices_ret = [
        recommender.item_id_map[f"D{d['id']}"]
        for d in retrieval_candidates
        if f"D{d['id']}" in recommender.item_id_map
    ]

    lightfm_scores_map = {}
    if candidate_indices_ret and recommender.model:
        try:
            raw = recommender.predict_with_dynamic_features(preferences, candidate_indices_ret)
            if raw is None:
                raise ValueError("predict_dynamic retourne None")
            norm = normalize_lightfm_scores(raw)
            lightfm_scores_map = {
                recommender.index_to_driver_id[candidate_indices_ret[i]]: float(norm[i])
                for i in range(len(candidate_indices_ret))
                if candidate_indices_ret[i] in recommender.index_to_driver_id
            }
            print("   Ranking: content-based dynamique")
        except Exception as e:
            print(f"   Ranking: content-based échoué ({e}) -> fallback collaboratif")
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
                print("   Ranking: collaboratif")
            except Exception as e2:
                print(f"[WARNING] Fallback ranking échoué: {e2}")

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

        # Score hybride pondéré — cœur du système
        final_score = (
            w_lfm    * lightfm_score +
            w_pref   * pref_score    +
            w_dist   * dist_score    +
            w_rating * rating_score
        )

        # Pénalité horaire
        if work_score < 1.0:
            final_score -= WORK_HOUR_PENALTY

        # Pénalités pref souples — ranking bas, pas d'élimination
        if pref_score < 0.30:
            final_score *= 0.20
        elif pref_score < 0.50:
            final_score *= 0.55
        elif pref_score < 0.70:
            final_score *= 0.80

        # Pénalité diversité
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
            "work_ok": work_score == 1.0,
            "rating":  round(rating_score, 3),
        }
        scored_drivers.append(driver)

    print(f"\nPoids [{weight_source}]: lfm={w_lfm:.2f} pref={w_pref:.2f} dist={w_dist:.2f} rating={w_rating:.2f}")
    print(f"   Prefs actives: {nb_active_prefs}")
    print("-" * 60)
    for d in sorted(scored_drivers, key=lambda x: x.get("final_score", 0), reverse=True)[:top_n]:
        s = d["_scores"]
        work_flag = "OK" if s["work_ok"] else f"NON -{WORK_HOUR_PENALTY}"
        print(f"   Driver {d['id']} | lfm={s['lightfm']:.3f} pref={s['pref']:.3f} "
              f"dist={s['dist']:.3f} work={work_flag} -> {d['final_score']:.4f}")
    print("-" * 60 + "\n")

    scored_drivers.sort(key=lambda d: d.get("final_score", 0), reverse=True)
    for driver in scored_drivers:
        driver.pop("final_score", None)

    print(f"{len(scored_drivers)} drivers rankés | Top {min(top_n, len(scored_drivers))} retournés")
    return scored_drivers[:top_n]