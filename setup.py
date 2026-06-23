import os
import sys
import subprocess
import platform
import urllib.request
import venv
import time
from pathlib import Path

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'

def print_banner():
    # Clear screen
    os.system('cls' if os.name == 'nt' else 'clear')
    banner = f"""{Colors.OKCYAN}{Colors.BOLD}
    ╭───────────────────────────────────────────────╮
    │                                               │
    │                 PIHU-OS SETUP                 │
    │           Automated Environment Prep          │
    │                                               │
    ╰───────────────────────────────────────────────╯
    {Colors.ENDC}"""
    print(banner)

def print_status(msg):
    print(f"\n{Colors.OKBLUE}{Colors.BOLD}▶ {msg}{Colors.ENDC}")

def print_success(msg):
    print(f"  {Colors.OKGREEN}✔ {msg}{Colors.ENDC}")

def print_warning(msg):
    print(f"  {Colors.WARNING}⚠ {msg}{Colors.ENDC}")

def print_error(msg):
    print(f"  {Colors.FAIL}✖ {msg}{Colors.ENDC}")
    sys.exit(1)

def run_command(cmd, cwd=None, exit_on_error=True, env=None):
    try:
        # Print the command in dim text so the user knows what's running
        print(f"  {Colors.DIM}$ {cmd}{Colors.ENDC}")
        
        # Merge environment variables if provided
        run_env = os.environ.copy()
        if env:
            run_env.update(env)
            
        subprocess.run(cmd, check=True, shell=True, cwd=cwd, env=run_env)
    except subprocess.CalledProcessError as e:
        if exit_on_error:
            print_error(f"Command failed: {cmd}")
        else:
            print_warning(f"Command failed (ignored): {cmd}")

def check_prerequisites():
    print_status("Checking prerequisites...")
    try:
        subprocess.run(["node", "-v"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print_success("Node.js found")
    except:
        print_error("Node.js is required but not installed.")

    try:
        subprocess.run(["cargo", "-V"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print_success("Rust/Cargo found")
    except:
        print_error("Rust (cargo) is required but not installed.")

    # OS specific checks
    if platform.system() == "Darwin":
        try:
            subprocess.run(["brew", "-v"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print_status("Checking portaudio (macOS)...")
            run_command("brew install portaudio", exit_on_error=False)
            print_success("Portaudio setup complete")
        except:
            print_warning("Homebrew not found. Skipping portaudio installation.")

def setup_frontend():
    print_status("Installing frontend dependencies...")
    run_command("npm install")
    print_success("Frontend dependencies installed")

def setup_python_env():
    print_status("Setting up Python Virtual Environment...")
    venv_dir = Path("src-tauri/python/venv")
    
    if not venv_dir.exists():
        print(f"  {Colors.DIM}Creating virtual environment at {venv_dir}...{Colors.ENDC}")
        venv.create(venv_dir, with_pip=True)
        print_success("Virtual environment created")
    else:
        print_success("Virtual environment already exists")

    # Determine pip path
    if platform.system() == "Windows":
        pip_exe = venv_dir / "Scripts" / "pip.exe"
        python_exe = venv_dir / "Scripts" / "python.exe"
    else:
        pip_exe = venv_dir / "bin" / "pip"
        python_exe = venv_dir / "bin" / "python"

    print_status("Installing Python dependencies...")
    run_command(f'"{pip_exe}" install --upgrade pip')
    run_command(f'"{pip_exe}" install -r src-tauri/python/requirements.txt')
    print_success("Python dependencies installed")

    print_status("Pre-downloading Kokoro TTS model (this may take a minute)...")
    kokoro_script = "from kokoro import KPipeline; KPipeline(lang_code='a')"
    env = {
        "PYTHONUNBUFFERED": "1",
        "HF_HUB_DISABLE_PROGRESS_BARS": "0"
    }
    run_command(f'"{python_exe}" -c "{kokoro_script}"', exit_on_error=False, env=env)
    print_success("Kokoro model cached")

def download_progress_hook(block_num, block_size, total_size):
    downloaded = block_num * block_size
    if total_size > 0:
        percent = min(100, int(downloaded * 100 / total_size))
        bar_length = 30
        filled_length = int(bar_length * downloaded // total_size)
        bar = '█' * filled_length + '░' * (bar_length - filled_length)
        sys.stdout.write(f'\r  {Colors.OKCYAN}Downloading: [{bar}] {percent}% ({downloaded / (1024*1024):.1f}MB / {total_size / (1024*1024):.1f}MB){Colors.ENDC}')
        sys.stdout.flush()

def setup_models():
    print_status("Checking STT Whisper Model...")
    models_dir = Path("models/stt")
    models_dir.mkdir(parents=True, exist_ok=True)
    
    model_path = models_dir / "ggml-base.en.bin"
    if not model_path.exists():
        print(f"  {Colors.DIM}Downloading Whisper base.en model...{Colors.ENDC}")
        url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"
        urllib.request.urlretrieve(url, str(model_path), reporthook=download_progress_hook)
        print() # New line after progress bar
        print_success("Whisper model downloaded")
    else:
        print_success("Whisper model already exists")

def setup_rust():
    print_status("Fetching Rust dependencies...")
    run_command("cargo fetch", cwd="src-tauri")
    print_success("Rust dependencies fetched")

def main():
    print_banner()
    
    check_prerequisites()
    setup_frontend()
    setup_python_env()
    setup_models()
    setup_rust()

    success_msg = f"""
    {Colors.OKGREEN}{Colors.BOLD}╭───────────────────────────────────────────────╮
    │                                               │
    │             🎉 SETUP COMPLETE! 🎉             │
    │                                               │
    ╰───────────────────────────────────────────────╯{Colors.ENDC}
    
    {Colors.BOLD}You can now start the development server by running:{Colors.ENDC}
    {Colors.OKCYAN}👉 npm run tauri dev{Colors.ENDC}
    """
    print(success_msg)

if __name__ == "__main__":
    main()
