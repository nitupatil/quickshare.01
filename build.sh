#!/bin/bash
# build.sh - Run this before pushing to GitHub Pages

echo "Structuring folders for extensionless URLs..."

# Function to create clean URL directory
make_clean_route() {
    local route_name=$1
    if [ -f "${route_name}.html" ]; then
        mkdir -p "$route_name"
        mv "${route_name}.html" "${route_name}/index.html"
        echo "Created clean route for /${route_name}"
    fi
}

# Add any future pages here
make_clean_route "about"
make_clean_route "contact"
make_clean_route "privacy"

echo "Build complete. Ready to push."
