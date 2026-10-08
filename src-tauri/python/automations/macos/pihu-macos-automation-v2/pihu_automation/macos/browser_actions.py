"""Browser state, YouTube search and media actions via fixed JXA and JSON arguments."""
import json
import subprocess
from urllib.parse import urlparse, quote

SCRIPT = r'''ObjC.import('AppKit');
function run(argv) {
 var p=JSON.parse(argv[0]);
 var name=p.app || ObjC.unwrap($.NSWorkspace.sharedWorkspace.frontmostApplication.localizedName);
 if(['Safari','Google Chrome','Brave Browser','Microsoft Edge'].indexOf(name)<0)throw Error('Use Safari, Chrome, Brave or Edge for browser controls.');
 var b=Application(name), safari=name==='Safari';
 var tab=safari?b.documents[0]:b.windows[0].activeTab;
 if(p.action==='state')return JSON.stringify({url:tab.url(),app:name});
 var js='('+function(p){
   if(p.action==='reload'){location.reload();return {message:'Reload requested.'};}
   if(p.action==='back'||p.action==='forward'){history[p.action]();return {message:'Navigation requested.'};}
   if(p.action==='focus_search'){
     if(!/(^|\.)youtube\.com$/.test(location.hostname))throw Error('Search-field focus currently supports YouTube. Use a direct search for other sites.');
     var field=document.querySelector('input[name="search_query"],input[placeholder="Search"]');
     if(!field)throw Error('No YouTube search field found.');field.focus();field.select();
     if(document.activeElement!==field)throw Error('Could not focus the search field.');
     return {message:'Focused YouTube search field.'};
   }
   var v=document.querySelector('video');
   if(!v)throw Error('No video player on this page.');
   if(p.action==='play'){var promise=v.play();if(promise)promise.catch(function(){});return {paused:v.paused};}
   if(p.action==='pause')v.pause();
   if(p.action==='mute')v.muted=true;
   if(p.action==='unmute')v.muted=false;
   if(p.action==='volume')v.volume=p.value/100;
   if(p.action==='seek')v.currentTime=Math.max(0,Math.min(Number.isFinite(v.duration)?v.duration:Infinity,v.currentTime+p.value));
   if(p.action==='fullscreen'){if(!document.fullscreenElement){if(v.requestFullscreen){var f=v.requestFullscreen();if(f)f.catch(function(){});}else if(v.webkitEnterFullscreen)v.webkitEnterFullscreen();}return {fullscreen:!!document.fullscreenElement||!!v.webkitDisplayingFullscreen};}
   if(p.action==='exit_fullscreen'){if(document.fullscreenElement)document.exitFullscreen();else if(v.webkitExitFullscreen)v.webkitExitFullscreen();return {fullscreen:!!document.fullscreenElement||!!v.webkitDisplayingFullscreen};}
   return {paused:v.paused,muted:v.muted,volume:Math.round(v.volume*100),time:v.currentTime};
 }.toString()+')('+JSON.stringify(p)+')';
 function evaluate(code){return safari?b.doJavaScript(code,{in:tab}):tab.execute({javascript:code});}
 var result=evaluate('JSON.stringify('+js+')');
 if(p.action==='play'){
  for(var i=0;i<20;i++){if(JSON.parse(result).paused===false)return JSON.stringify({message:'Video playback started.'});delay(.25);result=evaluate('JSON.stringify({paused:!document.querySelector("video")||document.querySelector("video").paused})');}
  throw Error('Playback could not be verified.');
 }
 return result;
}'''


def script(payload):
    try:
        result = subprocess.run(['/usr/bin/osascript', '-l', 'JavaScript', '-e', SCRIPT, json.dumps(payload)],
                                capture_output=True, text=True, timeout=9)
    except subprocess.TimeoutExpired:
        raise RuntimeError('Browser control timed out. Check macOS Automation permission prompts for Safari or your browser.') from None
    if result.returncode:
        raise RuntimeError(result.stderr.strip() + ' Browser media controls require Allow JavaScript from Apple Events.')
    return json.loads(result.stdout)


def perform_browser(payload):
    action = payload.get('browser_action')
    app = payload.get('app') or ''
    value = payload.get('value')
    if action not in {'state', 'search', 'focus_search', 'play', 'pause', 'mute', 'unmute', 'volume', 'seek', 'fullscreen', 'exit_fullscreen', 'reload', 'back', 'forward'}:
        raise ValueError('Unsupported browser action')
    if action in {'volume', 'seek'}:
        if not isinstance(value, (int, float)) or isinstance(value, bool) or not (-3600 <= value <= 3600):
            raise ValueError('Invalid media value')
        if action == 'volume' and not 0 <= value <= 100:
            raise ValueError('Volume must be between 0 and 100')
    if action == 'search':
        query = payload.get('query')
        if not isinstance(query, str) or not query.strip() or len(query) > 1500:
            raise ValueError('Provide a search query up to 1500 characters')
        site = payload.get('site', 'current')
        if site not in {'current', 'google', 'youtube'}:
            raise ValueError('Search site must be current, google or youtube')
        state = current_page(app)
        youtube = site == 'youtube' or (site == 'current' and (urlparse(state['url']).hostname or '') in {'youtube.com', 'www.youtube.com', 'm.youtube.com'})
        url = ('https://www.youtube.com/results?search_query=' if youtube else 'https://www.google.com/search?q=') + quote(query.strip(), safe='')
        result = subprocess.run(['/usr/bin/open', '-a', state['app'], url], capture_output=True, text=True, timeout=5)
        if result.returncode: raise RuntimeError(result.stderr.strip())
        return {'message': f'Searched {"YouTube" if youtube else "Google"} for {query}.', 'url': url, 'app': state['app']}
    if action == 'state': return current_page(app)
    state = script({'action': action, 'app': app, 'value': value})
    if action == 'state': return state
    if action in {'fullscreen', 'exit_fullscreen'} and state.get('fullscreen') != (action == 'fullscreen'):
        raise RuntimeError('The browser did not confirm the fullscreen change; it may require a user gesture.')
    return {'message': state.get('message') or f'Video {action} applied.', 'state': state}



def current_page(app):
    # Accessibility exposes the URL without JavaScript-from-Apple-Events permission.
    if app:
        from .accessibility import AX
        from .ui_actions import PID_SCRIPT
        ax = None
        try:
            pid_result = subprocess.run(['/usr/bin/osascript', '-e', PID_SCRIPT, app], capture_output=True, text=True, timeout=5)
            if pid_result.returncode == 0:
                ax = AX()
                _, window = ax.target(int(pid_result.stdout.strip()))
                nodes, _ = ax.inspect(window)
                pages = [n for n in nodes if n['role'] == 'AXWebArea' and n.get('url')]
                if pages: return {'app': app, 'url': pages[0]['url']}
        except (RuntimeError, ValueError, subprocess.TimeoutExpired):
            pass
        finally:
            if ax is not None: ax.close()
    return script({'action': 'state', 'app': app})
