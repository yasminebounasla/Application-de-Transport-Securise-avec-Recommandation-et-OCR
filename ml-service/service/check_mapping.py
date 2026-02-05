import pickle

# Charge user_id_map
with open("model_real/user_id_map.pkl", "rb") as f:
    user_id_map = pickle.load(f)

print(f"📊 Nombre de passengers dans le modèle: {len(user_id_map)}")
print(f"🔍 Premiers passengers: {list(user_id_map.keys())[:10]}")

# Vérifie si P0 existe
if "P0" in user_id_map:
    print(f"✅ P0 existe à l'index {user_id_map['P0']}")
else:
    print(f"❌ P0 N'EXISTE PAS dans le modèle!")
    print(f"💡 Utilise un de ces IDs à la place: {list(user_id_map.keys())[:5]}")