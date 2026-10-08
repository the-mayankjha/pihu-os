"""Fixed JavaScript for Automation script; browser names travel only as argv."""
import subprocess
from .control import ALIASES

PLAY_SCRIPT = r'''ObjC.import('AppKit');
function run(argv) {
    var name = argv[0] || ObjC.unwrap($.NSWorkspace.sharedWorkspace.frontmostApplication.localizedName);
    if (['Safari', 'Google Chrome', 'Brave Browser', 'Microsoft Edge'].indexOf(name) < 0)
        throw new Error('Playback verification supports Safari, Chrome, Brave and Edge. Specify one of these browsers.');
    var browser = Application(name);
    var js = "(function(){if(location.hostname!=='www.youtube.com'||location.pathname!=='/watch')return 'not-ready';var v=document.querySelector('video');if(!v)return 'not-ready';if(!v.paused)return 'playing';var p=v.play();if(p)p.catch(function(){});return 'requested';})()";
    for (var attempt = 0; attempt < 20; attempt++) {
        var state = name === 'Safari' ? browser.doJavaScript(js, {in: browser.documents[0]})
            : browser.windows[0].activeTab.execute({javascript: js});
        if (state === 'playing') return 'Video playback started.';
        delay(0.25);
    }
    throw new Error('The video page opened, but playback could not be verified. Check autoplay restrictions or the player.');
}'''


def play_video(app=''):
    name = ALIASES.get(app.casefold(), app)
    result = subprocess.run(['/usr/bin/osascript', '-l', 'JavaScript', '-e', PLAY_SCRIPT, name],
                            capture_output=True, text=True, timeout=8)
    if result.returncode:
        raise RuntimeError('The video was opened, but playback failed: ' + result.stderr.strip()
                           + ' Browser scripting may require Develop/View > Allow JavaScript from Apple Events.')
    return {'message': result.stdout.strip()}
