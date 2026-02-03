import os
from flask import Flask, request, jsonify
from recommender import get_recommendations

app = Flask(__name__)

@app.route('/recommend', methods=['POST']) 
def recommend():
    data = request.get_json()
    user_id = data.get('user_id')
    preference = data.get('preference')       
    
    recommendations = get_recommendations(user_id, preference)
    
    return jsonify({'recommendations': recommendations})

if __name__ == "__main__":
    app.run(debug=True, port=int(os.getenv("FLASK_PORT", 5000)))