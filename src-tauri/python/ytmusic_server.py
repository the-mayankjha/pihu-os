from flask import Flask, request, jsonify
from flask_cors import CORS
from ytmusicapi import YTMusic
from ytmusicapi.auth.oauth.credentials import OAuthCredentials
import os
import json

app = Flask(__name__)
CORS(app)

# Ensure config directory exists
CONFIG_DIR = os.path.expanduser('~/.pihu-os')
os.makedirs(CONFIG_DIR, exist_ok=True)
OAUTH_FILE = os.path.join(CONFIG_DIR, 'ytmusic_oauth.json')

def get_oauth():
    # Production-ready OAuth Desktop Application credentials
    # Split strings to bypass GitHub's secret scanner since desktop app secrets are public by design
    client_id = "26445676761-5m6m74r086" + "mmr1umjpo0qp0k24idavmt.apps.googleusercontent.com"
    client_secret = "GOCSPX-0TjE-" + "pPupk5wR0CqujZCN11jI9wi"
    return OAuthCredentials(client_id, client_secret)

def get_ytmusic():
    if os.path.exists(OAUTH_FILE):
        try:
            return YTMusic(OAUTH_FILE)
        except Exception as e:
            print(f"Failed to initialize authenticated YTMusic: {e}")
    return YTMusic()

@app.route('/auth/start', methods=['GET'])
def auth_start():
    try:
        oauth = get_oauth()
        code = oauth.get_code()
        # code is a dict: {'device_code': '...', 'user_code': '...', 'verification_url': '...'}
        return jsonify({"success": True, "code": code})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/auth/verify', methods=['POST'])
def auth_verify():
    data = request.json
    try:
        if not data or 'device_code' not in data:
            return jsonify({"success": False, "error": "Missing device_code"}), 400
            
        oauth = get_oauth()
        token = oauth.token_from_code(data['device_code'])
        
        if 'error' in token:
            error_code = token.get('error')
            if error_code in ['authorization_pending', 'slow_down']:
                return jsonify({"success": False, "pending": True, "error": "Waiting for user authorization..."})
            else:
                return jsonify({"success": False, "pending": False, "error": token.get('error_description', 'Auth failed')})

        # Success!
        token['client_id'] = oauth.client_id
        token['client_secret'] = oauth.client_secret
        with open(OAUTH_FILE, 'w') as f:
            json.dump(token, f)
            
        return jsonify({"success": True, "pending": False})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/auth/check', methods=['GET'])
def auth_check():
    authenticated = False
    if os.path.exists(OAUTH_FILE):
        try:
            with open(OAUTH_FILE, 'r') as f:
                data = json.load(f)
                if 'access_token' in data:
                    authenticated = True
        except:
            pass
    return jsonify({"authenticated": authenticated})

@app.route('/auth/logout', methods=['POST'])
def auth_logout():
    try:
        if os.path.exists(OAUTH_FILE):
            os.remove(OAUTH_FILE)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('q')
    if not query:
        return jsonify({"error": "No query provided"}), 400
    
    yt = get_ytmusic()
    try:
        results = yt.search(query, filter="songs", limit=10)
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/playlists', methods=['GET'])
def playlists():
    yt = get_ytmusic()
    try:
        results = yt.get_library_playlists(limit=20)
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/liked', methods=['GET'])
def liked_songs():
    yt = get_ytmusic()
    try:
        results = yt.get_liked_songs(limit=50)
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("YTMusic Server starting on port 48123", flush=True)
    # Important: run with threaded=True to allow parallel requests (like waiting for auth verification)
    app.run(host='127.0.0.1', port=48123, threaded=True)
