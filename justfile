default:
    @just --list

# Start development server
dev:
    npm run dev

# Build production assets
build:
    npm run build

# Run type and svelte checks
check:
    npm run check

# Run unit and integration tests
test:
    npm test

# Preview production build locally
preview:
    npm run preview
