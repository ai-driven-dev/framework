#
# AI-Driven Dev : Scripts and Aliases
# -----------------------------------
#
# Install:
#   cp aidd.sh ~/.aidd.sh
#   echo 'source ~/.aidd.sh' >> ~/.zshrc   # zsh
#   echo 'source ~/.aidd.sh' >> ~/.bashrc  # bash
#   source ~/.aidd.sh
#

## Tools

alias cc="claude --chrome --dangerously-skip-permissions"
alias cco="claude_ollama"
alias cdx="codex --full-auto"
alias ss="specstory run"

## Productivity
alias ll="ls -la"

## Custom
alias mm="merge_markdown"
alias def="delete_empty_folders"
alias osxu="osx_update"
alias nmu="npm_update"

## Libs
export CLAUDE_PATH=$(which claude)

## Functions

### NPM

npm_update () {
  npm outdated -g --depth=0 ; npm install -g npm ; npm -g update
  corepack install -g pnpm@latest
}


### OSX

osx_update () {
  brew update
  brew cleanup --prune=all
  brew outdated --greedy
  brew upgrade --greedy
  brew doctor
  npm_update
}

### Filesystem

delete_empty_folders () {
  find . -type d -empty -delete
}

### Utilities

translate () {
  local file="${1}"
  local lang="${2:-French}"

  whisper "${file}" --model large --language "${lang}" --task translate
}


merge_markdown () {
  find . -type f -print0 | \
    grep -zE '\.(md|mdx|rst)$' | \
    grep -vzZ 'all.md' | \
    sort -zV | \
    while IFS= read -r -d '' file; do
      echo "$file"  # Affiche uniquement le chemin du fichier
      {
        echo -e "\n---\nFile: $file\n---\n"
        cat "$file"
        echo ""  # Ajoute une ligne vide après chaque fichier
      } >> all.md
    done
}

claude_ollama () {
  local model="${1:-gpt-oss:20b}"

  # Check if Ollama is running, start if not
  if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "Starting Ollama..."
    ollama serve > /dev/null 2>&1 &
    sleep 2
  fi

  ANTHROPIC_AUTH_TOKEN=ollama ANTHROPIC_BASE_URL=http://localhost:11434 claude --model "$model" "${@:2}"
}
