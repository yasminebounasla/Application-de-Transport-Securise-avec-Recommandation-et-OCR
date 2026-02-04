import pickle

# Charge le dataset
with open("model/dataset.pkl", "rb") as f:
    dataset = pickle.load(f)

# Extrait les mappings
user_id_map = dataset.mapping()[0]  # {passenger_id: index}
driver_id_map = dataset.mapping()[2]  # {driver_id: index}

# Sauvegarde
with open("model/user_id_map.pkl", "wb") as f:
    pickle.dump(user_id_map, f)

with open("model/driver_id_map.pkl", "wb") as f:
    pickle.dump(driver_id_map, f)

print(" Mappings créés!")
print(f"Passengers: {list(user_id_map.keys())[:10]}")
print(f"Drivers: {list(driver_id_map.keys())[:10]}")