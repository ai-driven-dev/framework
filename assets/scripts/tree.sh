#!/bin/bash

# Generate directory tree structure with configurable options
# Usage: tree.sh [OPTIONS]

set -e

# Default values
DEFAULT_EXCLUDE="coverage|dist|build|archives|documentations|public|llm.txt|.git|.repomix|aidd"
SCAN_DIR="."
OUTPUT_FILE=""
EXCLUDE="$DEFAULT_EXCLUDE"
SHOW_HELP=false
VERBOSE=false

# Parse command line arguments
parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --scan-dir)
        SCAN_DIR="$2"
        shift 2
        ;;
      --scan-dir=*)
        SCAN_DIR="${1#*=}"
        shift
        ;;
      --output-file)
        OUTPUT_FILE="$2"
        shift 2
        ;;
      --output-file=*)
        OUTPUT_FILE="${1#*=}"
        shift
        ;;
      --exclude)
        EXCLUDE="$2"
        shift 2
        ;;
      --exclude=*)
        EXCLUDE="${1#*=}"
        shift
        ;;
      -h|--help)
        SHOW_HELP=true
        shift
        ;;
      -v|--verbose)
        VERBOSE=true
        shift
        ;;
      *)
        echo "Unknown option: $1"
        show_help
        exit 1
        ;;
    esac
  done
}

# Show help information
show_help() {
  cat << EOF
Usage: tree.sh [OPTIONS]

Generate a directory tree structure and save it to a file.

OPTIONS:
  --scan-dir <path>        Directory to scan (default: current directory)
  --output-file <path>     Output file path (default: docs/tree.txt)
  --exclude <pattern>      Exclude patterns separated by | (default: $DEFAULT_EXCLUDE)
  -v, --verbose           Show detailed progress output
  -h, --help              Show this help message

EXAMPLES:
  tree.sh --scan-dir /path/to/project --output-file project-tree.txt
  tree.sh --scan-dir . --exclude "node_modules|dist|build"
  tree.sh --output-file custom-tree.txt

EOF
}

# Generate tree output
generate_tree() {
  # Set default output file if not provided
  if [[ -z "$OUTPUT_FILE" ]]; then
    OUTPUT_FILE="docs/tree.txt"
  fi

  # Create output directory if it doesn't exist
  local output_dir
  output_dir="$(dirname "$OUTPUT_FILE")"
  mkdir -p "$output_dir"

  # Normalize scan directory to avoid absolute paths in output
  local scan_path="$SCAN_DIR"
  local pwd_dir
  pwd_dir="$(pwd)"

  if [[ "$scan_path" == "$pwd_dir" ]]; then
    scan_path="."
  elif [[ "$scan_path" == "$pwd_dir/"* ]]; then
    scan_path="${scan_path#"$pwd_dir/"}"
  fi

  # Generate tree
  if [[ "$VERBOSE" == true ]]; then
    echo "Generating tree for: $scan_path"
    echo "Output file: $OUTPUT_FILE"
    echo "Exclude patterns: $EXCLUDE"
  fi

  if ! command -v tree >/dev/null 2>&1; then
    echo "Error: 'tree' command not found. Please install it first."
    echo "  macOS: brew install tree"
    echo "  Ubuntu/Debian: apt-get install tree"
    echo "  CentOS/RHEL: yum install tree"
    exit 1
  fi

  # Get current date
  local current_date
  current_date="$(date +%Y-%m-%d)"

  # Write header and tree to output file
  {
    echo "## $current_date: Tree of project \`$scan_path\`"
    echo ""
    tree --noreport --prune -a --gitignore -I "$EXCLUDE" "$scan_path"
  } > "$OUTPUT_FILE"

  if [[ "$VERBOSE" == true ]]; then
    echo "✅ Tree: $OUTPUT_FILE"
  fi
}

# Main execution
main() {
  parse_args "$@"
  
  if [[ "$SHOW_HELP" == true ]]; then
    show_help
    exit 0
  fi
  
  generate_tree
}

# Run main function with all arguments
main "$@"
