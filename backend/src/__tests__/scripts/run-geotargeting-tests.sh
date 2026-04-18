#!/bin/bash

# Geotargeting Test Runner
# This script sets up test data and runs geotargeting integration tests

set -e

echo "🗺️  Starting Geotargeting Tests..."
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Always run from the backend root (where package.json lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
cd "${BACKEND_ROOT}"
print_status "Working directory: ${BACKEND_ROOT}"

# Determine environment (default to development)
NODE_ENV="${NODE_ENV:-development}"
ENV_FILE="envs/.env.${NODE_ENV}"

print_status "Environment: ${NODE_ENV}"
print_status "Using env file: ${ENV_FILE}"

# Check if the env file exists
if [ ! -f "${ENV_FILE}" ]; then
    print_error "Env file '${ENV_FILE}' not found."
    print_error "Available environments: development, staging, production"
    print_error "Usage: NODE_ENV=staging ./run-geotargeting-tests.sh"
    exit 1
fi

# Export vars from the env file
set -a
source "${ENV_FILE}"
set +a

export NODE_ENV  # Ensure NODE_ENV is inherited by all child processes (npm, npx, vitest)
export APP_ENV="${NODE_ENV}"  # Prevent vitest from overriding with "test" credentials


print_success "Environment variables loaded from ${ENV_FILE}"

# Step 1: Seed geographic data (states, LGAs, wards)
print_status "Step 1: Seeding geographic data..."
echo "NODE_ENV is: ${NODE_ENV}"

if npm run seed.geo; then
    print_success "Geographic data seeded successfully"
else
    print_error "Failed to seed geographic data"
    exit 1
fi

# Step 2: Seed test citizens
print_status "Step 2: Seeding test citizens for geotargeting..."
if npm run seed.test.citizens >/dev/null 2>&1; then
    print_success "Test citizens seeded successfully"
else
    print_error "Failed to seed test citizens"
    exit 1
fi

# Step 3: Run geotargeting integration tests
print_status "Step 3: Running geotargeting integration tests..."
if npx vitest run src/__tests__/performance/geotargeting.performance.test.ts --reporter=verbose; then
    print_success "All geotargeting tests passed! 🎉"
else
    print_error "Some geotargeting tests failed"
    exit 1
fi

echo ""
print_success "Geotargeting test suite completed successfully!"
echo ""
echo "📊 Test Results Summary:"
echo "   • Geographic data: ✅ Seeded"
echo "   • Test citizens: ✅ Created at various locations"
echo "   • Integration tests: ✅ Passed"
echo ""
echo "🧪 Test Citizen Locations:"
echo "   Lagos Central (6.5244, 3.3792): Main test point"
echo "   • Within 1km: 2-3 citizens"
echo "   • Within 10km: 4-6 citizens"
echo "   • Within 50km: 6-8 citizens"
echo "   • Remote areas: 0 citizens"
echo ""
echo "🔍 To run tests manually:"
echo "   npm run seed.test.citizens    # Seed test data"
echo "   npm run test:run              # Run all tests"
echo "   npx vitest run src/__tests__/performance/geotargeting.performance.test.ts"