#!/usr/bin/env bash

# AIDD docs entrypoint
# Usage: aidd-docs.sh [OPTIONS]

set -e

CURRENT_DIR="$(pwd)"

# Detect if running in dev (cli/assets) or installed (aidd/assets) structure
if [ -d "$CURRENT_DIR/cli/assets/scripts" ]; then
  # Dev structure
  SCRIPTS_DIR="$CURRENT_DIR/cli/assets/scripts"
  TEMPLATE_DIR="$CURRENT_DIR/prompts/templates"
else
  # Installed structure
  SCRIPTS_DIR="$CURRENT_DIR/aidd/assets/scripts"
  TEMPLATE_DIR="$CURRENT_DIR/aidd/prompts/templates"
fi

DOCS_DIR="$CURRENT_DIR/docs"

# Component flags
GENERATE_TREE=false
GENERATE_MEMORY_BANK=false
GENERATE_RULES=false
VERBOSE=false

# Parse command line arguments
for arg in "$@"; do
  case $arg in
    --tree)
      GENERATE_TREE=true
      shift
      ;;
    --memory-bank)
      GENERATE_MEMORY_BANK=true
      shift
      ;;
    --rules)
      GENERATE_RULES=true
      shift
      ;;
    --docs-dir=*)
      DOCS_DIR="${arg#*=}"
      shift
      ;;
    --all)
      GENERATE_TREE=true
      GENERATE_MEMORY_BANK=true
      GENERATE_RULES=true
      shift
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    --help|-h)
      echo "Usage: aidd-docs.sh [OPTIONS]"
      echo ""
      echo "Generate AIDD documentation files with selective component generation"
      echo ""
      echo "OPTIONS:"
      echo "  --tree           Generate project tree section"
      echo "  --memory-bank    Generate memory bank section"
      echo "  --rules          Generate coding rules section"
      echo "  --all            Generate all components (default if no flags)"
      echo "  --docs-dir=<path>  Override docs directory (default: ./docs)"
      echo "  -v, --verbose    Show detailed progress output"
      echo "  -h, --help       Show this help message"
      echo ""
      echo "Examples:"
      echo "  aidd-docs.sh                     # Generate all components"
      echo "  aidd-docs.sh --all               # Generate all components"
      echo "  aidd-docs.sh --tree              # Only project tree"
      echo "  aidd-docs.sh --memory-bank       # Only memory bank"
      echo "  aidd-docs.sh --rules             # Only rules"
      echo "  aidd-docs.sh --rules --memory-bank # Rules and memory bank"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# If no specific flags are provided, generate all components
if [ "$GENERATE_TREE" = false ] && [ "$GENERATE_MEMORY_BANK" = false ] && [ "$GENERATE_RULES" = false ]; then
  GENERATE_TREE=true
  GENERATE_MEMORY_BANK=true
  GENERATE_RULES=true
fi

# Ensure docs directory exists
mkdir -p "$DOCS_DIR"

# Generate components based on flags
if [ "$GENERATE_TREE" = true ]; then
  TREES_DIR="$DOCS_DIR/trees"
  mkdir -p "$TREES_DIR"

  [ "$VERBOSE" = true ] && echo "Generating project tree..."
  sh "$SCRIPTS_DIR/tree.sh" --scan-dir="$CURRENT_DIR" --output-file="$TREES_DIR/project-tree.txt"

  [ "$VERBOSE" = true ] && echo "Generating docs tree..."
  sh "$SCRIPTS_DIR/tree.sh" --scan-dir="$DOCS_DIR" --output-file="$TREES_DIR/docs-tree.txt"

  if [ -d "$DOCS_DIR" ]; then
    find "$DOCS_DIR" -mindepth 1 -maxdepth 1 -type d ! -name trees -print | LC_ALL=C sort | while IFS= read -r target; do
      tree_name="$(basename "$target")"
      [ "$VERBOSE" = true ] && echo "Generating $tree_name tree..."
      sh "$SCRIPTS_DIR/tree.sh" --scan-dir="$target" --output-file="$TREES_DIR/${tree_name}-tree.txt"
    done
  fi
fi

if [ "$GENERATE_RULES" = true ]; then
  [ "$VERBOSE" = true ] && echo "Generating rules..."
  node "$SCRIPTS_DIR/merge.cjs" \
    --input-dir="$DOCS_DIR/rules" \
    --output-file="$DOCS_DIR/rules.md"
fi

if [ "$GENERATE_MEMORY_BANK" = true ]; then
   [ "$VERBOSE" = true ] && echo "Generating AGENTS.md with memory bank..."
   mkdir -p "$DOCS_DIR"


   AGENTS_TEMPLATE="$TEMPLATE_DIR/memory/AGENTS.md"
   AGENTS_HEADERS="$DOCS_DIR/AGENTS_HEADERS.md"

   rm -f "$DOCS_DIR/AGENTS.md"

   if [ ! -f "$AGENTS_HEADERS" ]; then
     if [ ! -f "$AGENTS_TEMPLATE" ]; then
       echo "❌ Missing AGENTS template at $AGENTS_TEMPLATE"
       exit 1
     fi

     cp "$AGENTS_TEMPLATE" "$AGENTS_HEADERS"
     echo "✅ Created AGENTS headers from template at $AGENTS_HEADERS"
   fi

   cp "$AGENTS_HEADERS" "$DOCS_DIR/AGENTS.md"

   if [ -d "$DOCS_DIR/memory-bank" ] && [ -n "$(find "$DOCS_DIR/memory-bank" -type f \( -name '*.md' -o -name '*.mdc' -o -name '*.mmd' -o -name '*.txt' \) 2>/dev/null)" ]; then
      # Merge all memory-bank entries except the top-level AGENTS.md (already provided by header)
      node "$SCRIPTS_DIR/merge.cjs" --input-dir="$DOCS_DIR/memory-bank" --ignore="AGENTS.md" --output-file=/dev/stdout >> "$DOCS_DIR/AGENTS.md"
   fi

   if [ -L "$CURRENT_DIR/AGENTS.md" ]; then
      [ "$VERBOSE" = true ] && echo "✅ AGENTS.md already symlinked, leaving as-is"
   elif [ -f "$CURRENT_DIR/AGENTS.md" ]; then
      BACKUP_PATH="$CURRENT_DIR/AGENTS.md.backup-$(date +%Y%m%d-%H%M%S)"
      mv "$CURRENT_DIR/AGENTS.md" "$BACKUP_PATH"
      ln -s "docs/AGENTS.md" "$CURRENT_DIR/AGENTS.md"
      [ "$VERBOSE" = true ] && echo "✅ Backed up to: $BACKUP_PATH"
   else
      ln -s "docs/AGENTS.md" "$CURRENT_DIR/AGENTS.md"
   fi
   [ "$VERBOSE" = true ] && echo "✅ AGENTS.md synced: AGENTS.md -> docs/AGENTS.md"

   if [ -d "$DOCS_DIR/memory-bank" ]; then
     ls -1 "$DOCS_DIR/memory-bank" 2>/dev/null | while IFS= read -r entry; do
       [ -d "$DOCS_DIR/memory/$entry" ] || continue
       node "$SCRIPTS_DIR/merge.cjs" --input-dir="$DOCS_DIR/memory/$entry" --output-file="$DOCS_DIR/$entry.md"
     done
   fi
else
   [ "$VERBOSE" = true ] && echo "Skipping memory bank generation"
fi
