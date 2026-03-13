#!/usr/bin/env bash
set -euo pipefail

REPO="powdream/invoke-agent"
BASE_URL="https://github.com/${REPO}/releases/latest/download"
BIN_NAME="invoke-agent"
INSTALL_DIR="${HOME}/.local/bin"

# --- Detect OS and architecture ---
OS="$(uname -s)"
ARCH="$(uname -m)"

case "${OS}" in
  Linux)
    case "${ARCH}" in
      x86_64)  TRIPLE="x86_64-unknown-linux-gnu" ;;
      aarch64) TRIPLE="aarch64-unknown-linux-gnu" ;;
      arm64)   TRIPLE="aarch64-unknown-linux-gnu" ;;
      *)       echo "Unsupported architecture: ${ARCH}"; exit 1 ;;
    esac
    ;;
  Darwin)
    case "${ARCH}" in
      x86_64) TRIPLE="x86_64-apple-darwin" ;;
      arm64)  TRIPLE="aarch64-apple-darwin" ;;
      *)      echo "Unsupported architecture: ${ARCH}"; exit 1 ;;
    esac
    ;;
  *)
    echo "Unsupported OS: ${OS}"
    exit 1
    ;;
esac

# Fetch the latest version tag from GitHub
LATEST_VERSION="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep '"tag_name"' \
  | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')"

if [[ -z "${LATEST_VERSION}" ]]; then
  echo "Failed to fetch latest version from GitHub."
  exit 1
fi

ASSET_NAME="${BIN_NAME}-${LATEST_VERSION}-${TRIPLE}.zip"
DOWNLOAD_URL="${BASE_URL}/${ASSET_NAME}"

echo "Latest version : ${LATEST_VERSION}"
echo "Triple         : ${TRIPLE}"
echo "Asset          : ${ASSET_NAME}"

# --- Determine install destination ---
EXISTING_PATH="$(command -v "${BIN_NAME}" 2>/dev/null || true)"

if [[ -n "${EXISTING_PATH}" ]]; then
  DEST="${EXISTING_PATH}"
  echo "Existing install found at ${DEST}. Replacing in place."
else
  mkdir -p "${INSTALL_DIR}"
  DEST="${INSTALL_DIR}/${BIN_NAME}"
  echo "Installing to ${DEST}."
fi

# --- Download and extract ---
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

echo "Downloading ${DOWNLOAD_URL} ..."
curl -fsSL -o "${TMP_DIR}/artifact.zip" "${DOWNLOAD_URL}"

echo "Extracting ..."
unzip -q "${TMP_DIR}/artifact.zip" -d "${TMP_DIR}/extracted"

# The zip contains a directory named after the triple; find the binary inside.
# Find the executable inside the extracted folder
EXTRACTED_BIN="$(find "${TMP_DIR}/extracted" -type f -name "${BIN_NAME}" | head -n 1)"
if [[ -z "${EXTRACTED_BIN}" ]]; then
  echo "Binary '${BIN_NAME}' not found in the downloaded archive."
  exit 1
fi

chmod +x "${EXTRACTED_BIN}"
cp "${EXTRACTED_BIN}" "${DEST}"
echo "Installed ${BIN_NAME} to ${DEST}."

# --- Update PATH if needed (only when installing fresh) ---
if [[ -z "${EXISTING_PATH}" ]]; then
  # Check whether INSTALL_DIR is already in PATH
  case ":${PATH}:" in
    *":${INSTALL_DIR}:"*)
      echo "${INSTALL_DIR} is already in PATH."
      ;;
    *)
      EXPORT_LINE="export PATH=\"${INSTALL_DIR}:\$PATH\""

      # bash
      if [[ -f "${HOME}/.bashrc" ]]; then
        if ! grep -qF "${INSTALL_DIR}" "${HOME}/.bashrc"; then
          echo "" >> "${HOME}/.bashrc"
          echo "# Added by invoke-agent installer" >> "${HOME}/.bashrc"
          echo "${EXPORT_LINE}" >> "${HOME}/.bashrc"
          echo "Added ${INSTALL_DIR} to PATH in ~/.bashrc"
        fi
      fi

      # zsh
      if [[ -f "${HOME}/.zshrc" ]]; then
        if ! grep -qF "${INSTALL_DIR}" "${HOME}/.zshrc"; then
          echo "" >> "${HOME}/.zshrc"
          echo "# Added by invoke-agent installer" >> "${HOME}/.zshrc"
          echo "${EXPORT_LINE}" >> "${HOME}/.zshrc"
          echo "Added ${INSTALL_DIR} to PATH in ~/.zshrc"
        fi
      fi

      # fish
      FISH_CONFIG_DIR="${HOME}/.config/fish"
      if [[ -d "${FISH_CONFIG_DIR}" ]]; then
        if command -v fish &>/dev/null; then
          fish -c "fish_add_path '${INSTALL_DIR}'" 2>/dev/null \
            && echo "Added ${INSTALL_DIR} to fish_user_paths" \
            || true
        fi
      fi

      echo ""
      echo "NOTE: To use invoke-agent in your current shell session, run:"
      echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
      ;;
  esac
fi

# --- Verify ---
echo ""
"${DEST}" --version && echo "Installation complete."