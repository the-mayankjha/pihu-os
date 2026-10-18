"""Use public download URLs in the signed-updater manifest (never API asset URLs)."""
import json
import os
import urllib.request

repo = os.environ.get('REPOSITORY', 'the-mayankjha/pihu-os')
tag = os.environ['TAG_NAME']
token = os.environ['GH_TOKEN']
headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'User-Agent': 'PIHU-release'}
def request(url, method='GET', data=None, extra=None):
    with urllib.request.urlopen(urllib.request.Request(url, headers={**headers, **(extra or {})}, method=method, data=data), timeout=60) as response:
        return response.read()
release = json.loads(request(f'https://api.github.com/repos/{repo}/releases/tags/{tag}'))
assets = release['assets']
manifest_asset = next(a for a in assets if a['name'] == 'latest.json')
manifest = json.loads(request(manifest_asset['url'], extra={'Accept': 'application/octet-stream'}))
for platform, package in manifest['platforms'].items():
    matches = [a for a in assets if package['url'] in [a['url'], a['browser_download_url']]]
    if len(matches) != 1 or not package.get('signature'):
        raise RuntimeError(f'Cannot resolve signed updater artifact: {platform}')
    package['url'] = matches[0]['browser_download_url']
if manifest['version'] != tag.removeprefix('v'): raise RuntimeError('Manifest version mismatch')
payload = json.dumps(manifest, indent=2).encode()
# Stage replacement first so a failed upload leaves the existing feed intact.
staged = json.loads(request(release['upload_url'].split('{')[0] + '?name=latest-public.json', 'POST', payload, {'Content-Type':'application/json'}))
request(manifest_asset['url'], 'DELETE')
request(staged['url'], 'PATCH', json.dumps({'name':'latest.json'}).encode(), {'Content-Type':'application/json'})
print(f'Updated {tag} manifest to public download URLs; signatures unchanged.')
