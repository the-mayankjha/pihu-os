import sys

with open("src-tauri/python/wakeword.py", "r") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'mode = "WAKEWORD" # Modes: WAKEWORD, LISTENING' in line:
        new_lines.append(line)
        new_lines.append('total_listening_frames = 0\n')
        new_lines.append('MAX_LISTENING_FRAMES = int((16000 / CHUNK) * 10)  # 10 seconds max\n')
        continue
    if 'silence_frames = 0' in line and 'time.sleep(1.0)' in lines[lines.index(line)+1]:
        new_lines.append(line)
        new_lines.append('                    total_listening_frames = 0\n')
        continue
    if 'if silence_frames > FRAMES_FOR_SILENCE:' in line:
        new_lines.append('            total_listening_frames += 1\n')
        new_lines.append('            if silence_frames > FRAMES_FOR_SILENCE or total_listening_frames > MAX_LISTENING_FRAMES:\n')
        continue
    new_lines.append(line)

with open("src-tauri/python/wakeword.py", "w") as f:
    f.writelines(new_lines)
