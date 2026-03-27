"""
recommender.py
✅ CORRIGÉ :
  - feedback_buffer (variable morte) supprimé
  - Race condition : _try_optimize_weights() appelé DANS le lock
  - score_distance unifié : exp(-km/ref) — même formule que exportLightFM.js
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
from typing import List, Dict, Optional
from dotenv import load_dotenv
from scipy.optimize import minimize

logger = logging.getLogger(__name__)
load_dotenv()

BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR    = os.path.join(BASE_DIR, "..", "model_real")
WEIGHTS_PATH  = os.path.join(BASE_DIR, "..", "optimized_weights.json")
FEEDBACK_PATH = os.path.join(BASE_DIR, "..", "feedback_history.json")


# ── HAVERSINE ─────────────────────────────────────────────────────────────────
def haversine(lat1, lng1, lat2, lng2) -> float:
    R    = 6371
    dLat = math.radians(lat2 - lat1)
    dLng = math.radians(lng2 - lng1)
    a    = (math.sin(dLat / 2) ** 2 +
            math.cos(math.radians(lat1)) *
            math.cos(math.radians(lat2)) *
            math.sin(dLng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ✅ UNIFIÉ : exp(-km/ref) — même formule que exportLightFM.js
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


def distance_bucket(km: float) -> str:
    if   km < 10:  return "dist:very_close"
    elif km < 30:  return "dist:close"
    elif km < 80:  return "dist:medium"
    elif km < 200: return "dist:far"
    else:          return "dist:very_far"


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


def calculate_match_score(driver: Dict, preferences: Dict) -> float:
    def b(val):
        if isinstance(val, bool): return "yes" if val else "no"
        if val is None: return "no"
        return str(val).lower()

    score = 0.0
    max_points = 0.0

    checks = [
        ("female_driver_pref", "sexe",            ("F", "M"),                          2),
        ("smoking_ok",         "smoking_allowed",  ("yes", "no"),                       2),
        ("luggage_large",      "car_big",          ("yes", "no"),                       2),
        ("pets_ok",            "pets_allowed",     ("yes", "no"),                       2),
        ("quiet_ride",         "talkative",        ("no",  "yes"),                      1),
        ("radio_ok",           "radio_on",         ("yes", "no"),                       1),
    ]

    for pref_key, driver_key, (match_val, mismatch_val), points in checks:
        pref = preferences.get(pref_key)
        if pref not in ("yes", "no"):
            continue
        max_points += points
        driver_val = driver.get(driver_key) if driver_key == "sexe" else b(driver.get(driver_key))
        target = match_val if pref == "yes" else mismatch_val
        score += points if driver_val == target else -points

    if max_points == 0:
        return 0.5
    return (score + max_points) / (2 * max_points)


# ── COLD START ────────────────────────────────────────────────────────────────
def cold_start_by_preferences(
    drivers, preferences, departure_hour,
    hours_until_departure, start_lat, start_lng, max_km, top_n=5
):
    geo_available = start_lat is not None and start_lng is not None
    scored = []

    for driver in drivers:
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
            0.50 * pref_score + 0.25 * dist_score + 0.15 * work_score + 0.10 * rating_score
            if geo_available else
            0.60 * pref_score + 0.25 * work_score + 0.15 * rating_score
        )

        driver["final_score"] = round(final_score, 4)
        driver["work_match"]  = work_score == 1.0
        driver["dist_score"]  = round(dist_score, 3) if dist_km is not None else None
        scored.append(driver)

    scored.sort(key=lambda d: d.get("final_score", 0), reverse=True)
    for d in scored:
        d.pop("final_score", None)

    print(f"✅ Cold-start: {len(scored)} drivers filtrés | Top {min(top_n, len(scored))} retournés")
    return scored[:top_n]


# ── OPTIMISATION POIDS ────────────────────────────────────────────────────────
WEIGHT_KEYS   = ["lightfm", "pref", "dist", "work", "rating"]
WEIGHT_BOUNDS = {
    "lightfm": (0.30, 0.50), 
    "pref":    (0.20, 0.40), 
    "dist":    (0.05, 0.30),
    "work":    (0.08, 0.15),
    "rating":  (0.02, 0.10),
}
DEFAULT_WEIGHTS_GEO    = np.array([0.40, 0.35, 0.10, 0.10, 0.05])
DEFAULT_WEIGHTS_NO_GEO = np.array([0.40, 0.40, 0.00, 0.13, 0.07])

# ── État global ───────────────────────────────────────────────────────────────
_scores_history: List[Dict]      = []
_optimized_weights: Optional[np.ndarray] = None
_feedback_lock = threading.Lock()

# Chargement au démarrage — historique feedbacks
if os.path.exists(FEEDBACK_PATH):
    try:
        with open(FEEDBACK_PATH, "r") as f:
            _scores_history = json.load(f)
        print(f"✅ {len(_scores_history)} feedbacks rechargés depuis feedback_history.json")
    except Exception as e:
        print(f"[WARNING] Chargement feedbacks échoué: {e}")

# Chargement au démarrage — poids optimisés
if os.path.exists(WEIGHTS_PATH):
    try:
        with open(WEIGHTS_PATH, "r") as f:
            _optimized_weights = np.array(json.load(f))
        print(f"✅ Poids rechargés depuis optimized_weights.json: {_optimized_weights}")
    except Exception as e:
        print(f"[WARNING] Chargement poids échoué: {e}")


def _try_optimize_weights() -> Optional[np.ndarray]:
    """
    Optimisation SLSQP des poids de combinaison.
    ⚠️  Appelé UNIQUEMENT depuis l'intérieur du _feedback_lock.
    """
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
            constraints={"type": "eq", "fun": lambda w: w.sum() - 1},
            options={"ftol": 1e-9, "maxiter": 1000},
        )

        if not result.success:
            print(f"[WARNING] Optimisation échouée: {result.message}")
            return None

        w_norm = result.x
        print(f"📊 Poids optimisés ({len(_scores_history)} obs): "
              f"{dict(zip(WEIGHT_KEYS, w_norm.round(3)))}")

        try:
            with open(WEIGHTS_PATH, "w") as f:
                json.dump(w_norm.tolist(), f)
            print(f"✅ Poids sauvegardés → {WEIGHTS_PATH}")
        except Exception as e:
            print(f"[WARNING] Sauvegarde poids échouée: {e}")

        return w_norm

    except Exception as e:
        print(f"[WARNING] Régression échouée: {e}")
        return None


# ── FEEDBACK ──────────────────────────────────────────────────────────────────
def add_feedback_to_buffer(scores: Dict, real_rating: float) -> bool:
    """
    Reçoit les 5 scores + note réelle.
    Persiste l'historique dans feedback_history.json.
    ✅ L'optimisation SLSQP est déclenchée DANS le lock pour éviter
       les appels concurrents quand le buffer atteint 50.
    """
    global _optimized_weights

    target = max(0.0, min(1.0, (real_rating - 1) / 4))
    entry  = {**{k: scores.get(k) or 0.0 for k in WEIGHT_KEYS}, "target": target}

    with _feedback_lock:
        _scores_history.append(entry)

        # Sauvegarde immédiate sur disque (survit aux restarts)
        try:
            with open(FEEDBACK_PATH, "w") as f:
                json.dump(_scores_history, f)
        except Exception as e:
            print(f"[WARNING] Sauvegarde feedback échouée: {e}")

        print(f"✅ Feedback | note={real_rating} → target={target:.3f} "
              f"| buffer={len(_scores_history)}/50")

        # ✅ CORRIGÉ : optimisation DANS le lock → pas de double-déclenchement
        if len(_scores_history) >= 50:
            new_weights = _try_optimize_weights()
            if new_weights is not None:
                _optimized_weights = new_weights
                print(f"🎯 Poids mis à jour après {len(_scores_history)} feedbacks")

    return True


# ── RECOMMENDER CLASS ─────────────────────────────────────────────────────────
class Recommender:
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
            user_id_map, user_feature_map, item_id_map, _ = self.dataset.mapping()
            self.user_id_map        = user_id_map
            self.user_feature_map   = user_feature_map
            self.item_id_map        = item_id_map
            self.index_to_driver_id = {v: k for k, v in item_id_map.items()}
        else:
            self.user_id_map = self.user_feature_map = self.item_id_map = {}
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
        self.model         = self._load(os.path.join(MODELS_DIR, "lightfm_model_real.pkl"))
        self.dataset       = self._load(os.path.join(MODELS_DIR, "dataset_real.pkl"))
        self.item_features = self._load(os.path.join(MODELS_DIR, "item_features_real.pkl"))
        self.user_features = self._load(os.path.join(MODELS_DIR, "user_features_real.pkl"))
        self._refresh_mappings()
        print("✅ Modèle rechargé en mémoire")

    def predict_for_passenger(self, passenger_key: str) -> Dict[str, float]:
        if not self.model:
            return {}

        all_driver_indices = np.array(list(self.index_to_driver_id.keys()))
        user_index         = self.user_id_map[passenger_key]

        try:
            raw_scores = self.model.predict(
                user_index, all_driver_indices,
                user_features=self.user_features,
                item_features=self.item_features,
            )
        except Exception:
            try:
                raw_scores = self.model.predict(
                    user_index, all_driver_indices,
                    item_features=self.item_features,
                )
            except Exception as e:
                print(f"[WARNING] predict failed: {e}")
                return {}

        # Normalisation softmax puis min-max
        shifted     = raw_scores - raw_scores.max()
        scores_soft = np.exp(shifted) / np.exp(shifted).sum()
        s_min, s_max = scores_soft.min(), scores_soft.max()
        scores_norm  = (
            (scores_soft - s_min) / (s_max - s_min)
            if s_max > s_min else np.zeros_like(scores_soft)
        )
        return {
            self.index_to_driver_id[idx]: float(scores_norm[i])
            for i, idx in enumerate(all_driver_indices)
        }


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
    hours_until_departure = 168.0  # défaut : 1 semaine

    if trajet.get("dateDepart"):
        try:
            from datetime import datetime, timezone
            date_depart = datetime.fromisoformat(
                trajet["dateDepart"].replace("Z", "+00:00")
            )
            hours_until_departure = max(
                0.0,
                (date_depart - datetime.now(timezone.utc)).total_seconds() / 3600,
            )
        except Exception:
            pass

    max_km = max_driver_distance(trajet_distance_km, hours_until_departure)

    if not all_drivers:
        return []

    passenger_key = f"P{str(passenger_id).lstrip('P')}"

    # ── Cold start ────────────────────────────────────────────────────────────
    if passenger_key not in recommender.user_id_map:
        print("   Mode: cold-start → filtrage préférences")
        return cold_start_by_preferences(
            all_drivers, preferences, departure_hour,
            hours_until_departure, start_lat, start_lng, max_km, top_n,
        )

    lightfm_scores_map = recommender.predict_for_passenger(passenger_key)

    global _optimized_weights
    w = (
        _optimized_weights if _optimized_weights is not None
        else (DEFAULT_WEIGHTS_GEO if geo_available else DEFAULT_WEIGHTS_NO_GEO)
    )
    w_lfm, w_pref, w_dist, w_work, w_rating = w

    scored_drivers = []
    for driver in all_drivers:
        driver_id = f"D{driver['id']}"
        dist_km   = None

        if geo_available and driver.get("latitude") and driver.get("longitude"):
            try:
                dist_km = haversine(
                    driver["latitude"], driver["longitude"], start_lat, start_lng
                )
                driver["distance_km"] = round(dist_km, 1)
            except Exception:
                pass

        if dist_km is not None and dist_km > max_km:
            continue

        # ✅ Même formule exp(-km/ref) que exportLightFM.js
        dist_score    = score_distance(dist_km, hours_until_departure) if dist_km is not None else 0.5
        lightfm_score = lightfm_scores_map.get(driver_id, 0.0)
        pref_score    = calculate_match_score(driver, preferences)
        work_score    = work_hour_match(driver, departure_hour)
        rating_score  = ((driver.get("avgRating") or 4.0) - 1) / 4

        if lightfm_scores_map and max(lightfm_scores_map.values()) > 0:
            final_score = (
                w_lfm    * lightfm_score +
                w_pref   * pref_score    +
                w_dist   * dist_score    +
                w_work   * work_score    +
                w_rating * rating_score
            )
        else:
            # Fallback si LightFM ne retourne rien d'utile
            final_score = (
                (0.40 * pref_score + 0.35 * dist_score + 0.15 * work_score + 0.10 * rating_score)
                if geo_available else
                (0.55 * pref_score + 0.30 * work_score + 0.15 * rating_score)
            )

        # Pénalité diversité (éviter de toujours recommander le même driver)
        nb = interaction_counts.get(str(driver["id"]), 0)
        if   nb >= 5: final_score *= 0.80
        elif nb >= 3: final_score *= 0.90

        driver["final_score"] = round(final_score, 4)
        driver["work_match"]  = work_score == 1.0
        driver["dist_score"]  = round(dist_score, 3) if dist_km is not None else None
        driver["_scores"]     = {
            "lightfm": lightfm_score,
            "pref":    pref_score,
            "dist":    dist_score,
            "work":    work_score,
            "rating":  rating_score,
        }
        scored_drivers.append(driver)

    # ── Logs avant/après optimisation ─────────────────────────────────────────
    source = "SLSQP optimisé" if _optimized_weights is not None else "DEFAULT (pas encore optimisé)"
    print(f"\n📊 Poids : lightfm={w_lfm:.3f} | pref={w_pref:.3f} | dist={w_dist:.3f} | work={w_work:.3f} | rating={w_rating:.3f}")
    print(f"   Source : {source}")
    print("─" * 60)
    for d in scored_drivers[:5]:
        s = d["_scores"]
        score_before = sum(0.2 * s[k] for k in WEIGHT_KEYS)
        score_after  = (w_lfm*s["lightfm"] + w_pref*s["pref"] +
                        w_dist*s["dist"]   + w_work*s["work"] + w_rating*s["rating"])
        print(f"   🚗 Driver {d['id']} | égal={score_before:.4f} | optim={score_after:.4f} | diff={score_after-score_before:+.4f}")
    print("─" * 60 + "\n")

    scored_drivers.sort(key=lambda d: d.get("final_score", 0), reverse=True)
    for driver in scored_drivers:
        driver.pop("final_score", None)

    print(f"✅ {len(scored_drivers)} drivers scorés | Top {min(top_n, len(scored_drivers))} retournés")
    return scored_drivers[:top_n]