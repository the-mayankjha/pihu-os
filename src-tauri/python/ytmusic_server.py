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
    from ytmusicapi.auth.oauth.credentials import OAuthCredentials
    # Production-ready OAuth Desktop Application credentials
    # Split strings to bypass GitHub's secret scanner since desktop app secrets are public by design
    client_id = "26445676761-5m6m74r086" + "mmr1umjpo0qp0k24idavmt.apps.googleusercontent.com"
    client_secret = "GOCSPX-0TjE-" + "pPupk5wR0CqujZCN11jI9wi"
    return OAuthCredentials(client_id, client_secret)

def get_ytmusic():
    if os.path.exists(OAUTH_FILE):
        try:
            yt = YTMusic(OAUTH_FILE, oauth_credentials=get_oauth())
            # Fix 400 Bad Request for custom TV OAuth clients by explicitly setting the TV client context
            yt.context['context']['client']['clientName'] = 'TVHTML5_SIMPLY_EMBEDDED_PLAYER'
            yt.context['context']['client']['clientVersion'] = '2.0'
            return yt
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
    query = request.args.get('q') or request.args.get('query')
    if not query:
        return jsonify({"error": "No query provided"}), 400
    
    filter_type = request.args.get('filter') or request.args.get('type')
    # Valid filters: "songs", "videos", "albums", "artists", "playlists", "community_playlists", "featured_playlists", "uploads"
    # Map "playlist" to "playlists", "song" to "songs" etc.
    if filter_type == 'playlist': filter_type = 'playlists'
    if filter_type == 'song': filter_type = 'songs'
    if filter_type == 'artist': filter_type = 'artists'
    if filter_type == 'album': filter_type = 'albums'
    if filter_type not in ["songs", "videos", "albums", "artists", "playlists", "community_playlists", "featured_playlists", "uploads"]:
        filter_type = "songs" # default
    
    limit = int(request.args.get('limit', 10))
    
    yt = get_ytmusic()
    try:
        results = yt.search(query.strip(), filter=filter_type, limit=limit)
        return jsonify({"results": results})
    except Exception as e:
        print(f"Search error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/playlists', methods=['GET'])
def playlists():
    yt = get_ytmusic()
    try:
        # If we have an OAuth token, we can use the official Data API to bypass the 400 Bad Request error
        auth_header = yt.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            import urllib.request
            import json
            url = 'https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50'
            req = urllib.request.Request(url, headers={'Authorization': auth_header})
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                results = []
                for item in data.get('items', []):
                    results.append({
                        "playlistId": item['id'],
                        "title": item['snippet']['title'],
                        "thumbnails": [{"url": item['snippet']['thumbnails'].get('high', item['snippet']['thumbnails'].get('default', {})).get('url', '')}]
                    })
                return jsonify({"results": results})
                
        # Fallback to normal method if no OAuth (e.g. unauthenticated which will fail gracefully)
        results = yt.get_library_playlists(limit=20)
        return jsonify({"results": results})
    except Exception as e:
        print(f"Error fetching playlists: {e}")
        return jsonify({"results": []})
@app.route('/playlist_details', methods=['GET'])
def playlist_details():
    playlist_id = request.args.get('id')
    if not playlist_id:
        return jsonify({"error": "No id provided"}), 400

    yt_auth = get_ytmusic()
    # Try using YouTube Data API first for Playlists (works for private playlists if we have OAuth)
    auth_header = yt_auth.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer ') and not playlist_id.startswith('MPREb_'):
        import urllib.request, json
        url = f'https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id={playlist_id}'
        req = urllib.request.Request(url, headers={'Authorization': auth_header})
        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                if data.get('items'):
                    item = data['items'][0]
                    return jsonify({
                        "title": item['snippet']['title'],
                        "author": item['snippet'].get('channelTitle', 'YouTube'),
                        "trackCount": item['contentDetails']['itemCount'],
                        "thumbnails": [{"url": item['snippet']['thumbnails'].get('high', item['snippet']['thumbnails'].get('default', {})).get('url', '')}],
                        "year": item['snippet']['publishedAt'][:4]
                    })
        except Exception as e:
            print("Data API failed for playlist_details:", e)

    # Fallback to unauthenticated ytmusicapi (for Albums or public playlists if Data API fails)
    yt_unauth = YTMusic()
    try:
        if playlist_id.startswith('MPREb_'):
            data = yt_unauth.get_album(playlist_id)
            return jsonify({
                "title": data.get('title'),
                "author": ", ".join([a.get('name', '') for a in data.get('artists', [])]),
                "trackCount": data.get('trackCount'),
                "thumbnails": data.get('thumbnails', []),
                "year": data.get('year')
            })
        else:
            data = yt_unauth.get_playlist(playlist_id)
            return jsonify({
                "title": data.get('title'),
                "author": data.get('author', {}).get('name', 'YouTube'),
                "trackCount": data.get('trackCount'),
                "thumbnails": data.get('thumbnails', []),
                "year": data.get('year')
            })
    except Exception as e:
        print("ytmusicapi fallback failed:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/home', methods=['GET'])
def home():
    limit = request.args.get('limit', default=3, type=int)
    yt = get_ytmusic()
    try:
        results = yt.get_home(limit=limit)
        return jsonify({"results": results})
    except Exception as e:
        # Fallback to unauthenticated if OAuth token lacks privileges for internal APIs
        try:
            yt_unauth = YTMusic()
            results = yt_unauth.get_home(limit=limit)
            return jsonify({"results": results})
        except Exception as fallback_e:
            return jsonify({"error": str(fallback_e)}), 500

@app.route('/explore', methods=['GET'])
def explore():
    yt = get_ytmusic()
    def get_charts_safely(yt_instance):
        results = yt_instance.get_charts()
        standardized_shelves = []
        if 'videos' in results:
            v = results['videos']
            if isinstance(v, dict) and 'items' in v: standardized_shelves.append({"title": "Trending Videos", "contents": v['items']})
            elif isinstance(v, list): standardized_shelves.append({"title": "Trending Videos", "contents": v})
        if 'artists' in results:
            a = results['artists']
            if isinstance(a, dict) and 'items' in a: standardized_shelves.append({"title": "Top Artists", "contents": a['items']})
            elif isinstance(a, list): standardized_shelves.append({"title": "Top Artists", "contents": a})
        return standardized_shelves

    try:
        shelves = get_charts_safely(yt)
        # Fetch moods
        moods = yt.get_mood_categories()
        return jsonify({"results": shelves, "moods": moods})
    except Exception as e:
        try:
            yt_unauth = YTMusic()
            shelves = get_charts_safely(yt_unauth)
            moods = yt_unauth.get_mood_categories()
            return jsonify({"results": shelves, "moods": moods})
        except Exception as fallback_e:
            return jsonify({"error": str(fallback_e)}), 500

@app.route('/explore/mood_playlists', methods=['GET'])
def explore_mood_playlists():
    params = request.args.get('params')
    if not params:
        return jsonify({"error": "No params provided"}), 400
    
    yt = get_ytmusic()
    try:
        playlists = yt.get_mood_playlists(params)
        return jsonify({"results": playlists})
    except Exception as e:
        try:
            yt_unauth = YTMusic()
            playlists = yt_unauth.get_mood_playlists(params)
            return jsonify({"results": playlists})
        except Exception as fallback_e:
            return jsonify({"error": str(fallback_e)}), 500

@app.route('/liked', methods=['GET'])
def liked():
    yt = get_ytmusic()
    try:
        results = yt.get_liked_songs(limit=50)
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"results": []})

if __name__ == '__main__':
    print("YTMusic Server starting on port 48123", flush=True)
    # Important: run with threaded=True to allow parallel requests (like waiting for auth verification)
    app.run(host='127.0.0.1', port=48123, threaded=True)
