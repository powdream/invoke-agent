---
description: Install invoke-agent CLI for the current OS and architecture; download the matching release, place it in a user bin directory, and add that directory to PATH. Supports Windows (cmd, PowerShell), bash, zsh, fish.
---

# Install Skill

Install the invoke-agent CLI for the user's current OS and architecture, then add the install directory to PATH so `invoke-agent` is available in the shell.

**Available substitutions**: `$ARGUMENTS` (optional extra args), `${CLAUDE_SKILL_DIR}` — directory of this skill (e.g. `${CLAUDE_SKILL_DIR}/scripts/install.sh` for a bundled script). See [Skills docs](https://code.claude.com/docs/en/skills#available-string-substitutions).

## 1. Detect OS and architecture

- **Unix (macOS/Linux)**: Run `uname -s` (Darwin or Linux) and `uname -m` (x86_64 or aarch64).
- **Windows**: Use `$env:OS` and `$env:PROCESSOR_ARCHITECTURE` in PowerShell, or `%OS%` and `%PROCESSOR_ARCHITECTURE%` in cmd. Map to x64 or ARM64.

## 2. Map to release asset

GitHub Releases use triples matching `tools/build.ts`:

| OS     | Arch   | Triple                        | Extension |
|--------|--------|-------------------------------|-----------|
| Linux  | x64    | x86_64-unknown-linux-gnu      | —         |
| Linux  | arm64  | aarch64-unknown-linux-gnu     | —         |
| Windows| x64    | x86_64-pc-windows-msvc        | .exe      |
| macOS  | x64    | x86_64-apple-darwin          | —         |
| macOS  | arm64  | aarch64-apple-darwin         | —         |

Latest release asset name format: `invoke-agent-<version>-<triple>.zip`
Base URL: `https://github.com/powdream/invoke-agent/releases/latest/download/`

## 3. Download and extract

- **Unix**: Create a temp dir, then e.g. `curl -L -o artifact.zip "<url>"` and `unzip artifact.zip` (or use `tar` if the asset is .tar.gz). Copy the binary out of the triple-named folder.
- **Windows PowerShell**: `Invoke-WebRequest -Uri "<url>" -OutFile artifact.zip -UseBasicParsing` then `Expand-Archive -Path artifact.zip -DestinationPath .`

## 4. Install directory

- **Linux/macOS**: `~/.local/bin` (create if needed). Copy the single executable (e.g. `invoke-agent` or `invoke-agent.exe` for Windows) there.
- **Windows**: `$env:LOCALAPPDATA\invoke-agent\bin` or `%USERPROFILE%\.local\bin`. Create the directory and copy the executable.

## 5. Add to PATH (by shell)

- **Windows cmd**: `setx PATH "%PATH%;<install-dir>"`. For current session: `set PATH=%PATH%;<install-dir>`.
- **Windows PowerShell**: `[Environment]::SetEnvironmentVariable("Path", $env:Path + ";<install-dir>", "User")`. For current session: `$env:Path += ";<install-dir>"`.
- **bash**: `echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc` (skip if already present).
- **zsh**: `echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc`.
- **fish**: `fish_add_path $HOME/.local/bin` or `set -Ua fish_user_paths $HOME/.local/bin`.

Ask the user which shell they use (or detect from `$SHELL` / `ComSpec`) and run only the matching command.

## 6. Verify

Run `invoke-agent --version` (or `invoke-agent --version` in a new shell on Windows after PATH update) and confirm the version matches the release.

## Optional: bundled scripts

If this skill includes `scripts/install.sh` (Unix) or `scripts/install.ps1` (PowerShell), run them with `${CLAUDE_SKILL_DIR}/scripts/install.sh` or `${CLAUDE_SKILL_DIR}/scripts/install.ps1` so the path works regardless of current working directory. Those scripts can perform OS/arch detection, download, install, and PATH update in one go.
