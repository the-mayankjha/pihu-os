#!/usr/bin/env python3
"""Prepare standalone optional-MCP repositories without modifying GitHub or existing folders."""
import argparse
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
MCP = ROOT / 'src-tauri/pihu_mcps'
CORE = {'pihu-file-mcp', 'pihu-system-mcp', 'pihu-project-mcp', 'pihu-web-search-mcp'}

def copy(source, destination):
    if source.is_dir():
        shutil.copytree(source, destination, ignore=shutil.ignore_patterns('.git', 'node_modules', '.venv', '__pycache__', 'test', 'tests', 'store', '*.db', '*.db-*', '*.sqlite*', '*.pyc', '.env', '.env.*'))
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

def export(destination):
    catalog = json.loads((MCP / 'market/catalog.json').read_text())
    for item in catalog['packages']:
        if item['id'] in CORE: continue
        package_id = item['id']
        target = destination / package_id
        if target.exists(): raise ValueError(f'Refusing to overwrite existing directory: {target}')
        target.mkdir(parents=True)
        manifest = {key:value for key,value in item.items() if key not in ('connection','status','verified','entrypoint')}
        manifest['schema_version'] = 1
        manifest['tags'] = item.get('tags', [])
        manifest['name'] = package_id
        manifest['repository'] = {'type':'git','url':f'https://github.com/the-mayankjha/{package_id}', 'branch':'main'}
        manifest['artifacts'] = []
        manifest['compatibility'] = {'minimum_pihu_version':'1.2.8','operating_systems':['macos','windows','linux'],'architectures':['arm64','x64']}
        manifest['permissions'] = {'network':True,'filesystem':False,'shell_execution':False,'env_vars_required':[]}
        manifest['auth_required'] = package_id in ('google-workspace-mcp', 'pihu-whatsapp-mcp', 'spotify-mcp')
        manifest['installation'] = {'type':'archive','entrypoint':'server.py'}
        manifest['entrypoint'] = {'command':'python','args':[],'env':{}}
        if package_id in ('browser-mcp','spotify-mcp'):
            folder = ROOT / ('bin/browser-runtime' if package_id == 'browser-mcp' else 'bin/spotify-runtime')
            for name in ('package.json','package-lock.json','bridge.mjs','native-playback.mjs','vtop.mjs','build','src','tsconfig.json','pihu-logo.png','LICENSE','README.md'):
                if (folder/name).exists(): copy(folder/name, target/name)
            manifest['runtime'] = {'type':'node'}
            manifest['entrypoint']['command'] = 'node'
            manifest['installation']['entrypoint'] = 'node_modules/@playwright/mcp/cli.js' if package_id == 'browser-mcp' else 'build/index.js'
            manifest['entrypoint']['args'] = ['--browser','chrome'] if package_id == 'browser-mcp' else []
            manifest['permissions']['filesystem'] = True
            # The desktop app provides Node; do not ship a second Node distribution.
            if package_id == 'spotify-mcp':
                package = json.loads((target/'package.json').read_text())
                package['dependencies'].pop('node', None)
                (target/'package.json').write_text(json.dumps(package, indent=2)+'\n')
                lock = json.loads((target/'package-lock.json').read_text())
                lock['packages']['']['dependencies'].pop('node', None)
                for key in list(lock['packages']):
                    if key == 'node_modules/node' or key.startswith('node_modules/node/') or key == 'node_modules/node-bin-setup':
                        del lock['packages'][key]
                (target/'package-lock.json').write_text(json.dumps(lock, indent=2)+'\n')
        else:
            name = {'github-mcp':'pihu_github_mcp.py','google-workspace-mcp':'google.py','pihu-whatsapp-mcp':'pihu_whatsapp_mcp.py'}[package_id]
            copy(MCP/'mcp/servers'/name, target/'server.py')
            (target/'requirements.txt').write_text('mcp==1.30.0\nhttpx==0.28.1\n')
            if package_id == 'google-workspace-mcp':
                copy(MCP/'mcp/servers/google_api_client.py',target/'google_api_client.py')
                for name in ('google_oauth_server.py','google_oauth_page.html','pihu-logo.png'):
                    copy(MCP/'mcp/servers'/name,target/name)
            if package_id == 'pihu-whatsapp-mcp':
                copy(MCP/'mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge',target/'bridge-source')
                copy(MCP/'mcp/servers/pihu-whatsapp-mcp/LICENSE',target/'LICENSE')
        (target/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        copy(MCP/'market/templates/release.yml',target/'.github/workflows/release.yml')
        for name in ('build_release.py','publish_release.py'):
            copy(MCP/'market/tools'/name,target/'tools'/name)
        (target/'.gitignore').write_text('.env\n.env.*\n.venv/\nnode_modules/\ndist/\n__pycache__/\n')
        if (target/'README.md').is_file(): shutil.copy2(target/'README.md',target/'UPSTREAM_README.md')
        (target/'README.md').write_text(f'''# {manifest['display_name']}

{manifest['description']}

Standalone optional MCP package for PIHU. Source exported from pihu_mcp and pihu-os.

## Release

1. Review this repository's source, licenses and manifest.
2. Official packages are discovered through the trusted pihu_web registry catalog; a publisher token is optional.
3. Set a new manifest version and push the matching `vVERSION` tag.
4. All four native builds must succeed before package files are released and metadata is registered through `https://pihu.nfks.co.in/api/v2`.
5. pihu_web validates official release identity, platform coverage, checksums and sizes before exposing downloads. Community packages use publisher approval.

Python archives include a wheelhouse and hashed lock file for offline installation using PIHU's shared Python 3.11 runtime. Node archives include their dependencies and use PIHU's shared Node runtime. Browser uses installed Chrome; browser binaries are not included.

Desktop service integration and account sign-in must be verified before publishing this initial export.
''')
        print(target)

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,default=ROOT/'.pihu-setup/mcp-repositories')
    args=parser.parse_args()
    export(args.output.resolve())
