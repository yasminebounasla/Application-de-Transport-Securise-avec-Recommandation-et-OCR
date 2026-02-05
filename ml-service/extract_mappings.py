import pickle

# ✅ Charge depuis model_real/
with open("model_real/dataset_real.pkl", "rb") as f:
    dataset = pickle.load(f)

# Extrait les mappings
user_id_map = dict(dataset.mapping()[0])
driver_id_map = dict(dataset.mapping()[2])

# Sauvegarde dans model_real/
with open("model_real/user_id_map.pkl", "wb") as f:
    pickle.dump(user_id_map, f)

with open("model_real/driver_id_map.pkl", "wb") as f:
    pickle.dump(driver_id_map, f)

print("✅ Mappings créés!")
print(f"Passengers: {list(user_id_map.keys())[:10]}")
print(f"Drivers: {list(driver_id_map.keys())[:10]}")