#!/usr/bin/env bash

# ==============================================================================
# GEOALERT FRONTEND SCAFFOLDER (SAFE MODE)
# ==============================================================================
# Usage: Run inside 'frontend/'
# Strategy: "Safe Skip" - Preserves existing files, creates missing ones.
# ==============================================================================

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# --- 1. Safety Check ---

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found!${NC}"
    echo "   Please run this script inside your 'frontend' directory."
    exit 1
fi

# --- 2. Configuration ---

DIRECTORIES=(
    # Core
    "src/app" "src/config" "src/context" "src/hooks"
    "src/store/middleware" "src/styles/themes"
    "src/test/fixtures" "src/test/mocks" "src/test/utils"

    # Assets
    "src/assets/fonts" "src/assets/images/icons"
    "src/assets/images/illustrations" "src/assets/images/logos" "src/assets/videos"

    # Components
    "src/components/data-display" "src/components/feedback"
    "src/components/forms" "src/components/layout" "src/components/ui"

    # Libs & Services
    "src/lib/axios" "src/lib/mapbox" "src/lib/reactQuery"
    "src/services/api" "src/services/storage" "src/services/websocket"

    # Utils
    "src/utils/constants" "src/utils/formatters"
    "src/utils/helpers" "src/utils/validators"

    # Features (Auth, Agencies, Alerts, Citizens, Users, etc.)
    "src/features/auth/components" "src/features/auth/hooks" "src/features/auth/pages"
    "src/features/auth/services" "src/features/auth/store" "src/features/auth/types" "src/features/auth/utils"

    "src/features/agencies/components" "src/features/agencies/hooks" "src/features/agencies/pages"
    "src/features/agencies/services" "src/features/agencies/store" "src/features/agencies/types"

    "src/features/alerts/components" "src/features/alerts/hooks" "src/features/alerts/pages"
    "src/features/alerts/services" "src/features/alerts/store" "src/features/alerts/types" "src/features/alerts/utils"

    "src/features/citizens/components" "src/features/citizens/hooks" "src/features/citizens/pages"
    "src/features/citizens/services" "src/features/citizens/store" "src/features/citizens/types"

    "src/features/users/components" "src/features/users/hooks" "src/features/users/pages"
    "src/features/users/services" "src/features/users/store" "src/features/users/types"

    "src/features/twoFactor/components" "src/features/twoFactor/hooks" "src/features/twoFactor/pages"
    "src/features/twoFactor/services" "src/features/twoFactor/types"

    "src/features/sms/components" "src/features/sms/hooks" "src/features/sms/pages"
    "src/features/sms/services" "src/features/sms/types"

    "src/features/auditLogs/components" "src/features/auditLogs/hooks" "src/features/auditLogs/pages"
    "src/features/auditLogs/services" "src/features/auditLogs/types"

    "src/features/dashboard/components" "src/features/dashboard/hooks" "src/features/dashboard/pages" "src/features/dashboard/services"
    "src/features/profile/components" "src/features/profile/hooks" "src/features/profile/pages"
    "src/features/maps/components" "src/features/maps/hooks" "src/features/maps/services" "src/features/maps/types" "src/features/maps/utils"
)

FILES=(
    "src/app/App.tsx" "src/app/AppProviders.tsx" "src/app/routes.tsx"
    "src/components/index.ts" "src/features/index.ts" "src/hooks/index.ts"
    "src/lib/index.ts" "src/services/index.ts" "src/types/index.ts" "src/utils/index.ts"
    "src/types/api.types.ts" "src/types/common.types.ts" "src/types/enums.types.ts" "src/types/env.d.ts"
    "src/config/env.ts" "src/config/index.ts" "src/config/permissions.ts" "src/config/routes.ts"
    "src/lib/axios/axiosInstance.ts" "src/lib/axios/index.ts" "src/lib/axios/interceptors.ts"
    "src/lib/reactQuery/index.ts" "src/lib/reactQuery/queryClient.ts" "src/lib/reactQuery/queryKeys.ts"
    "src/store/hooks.ts" "src/store/index.ts" "src/store/rootReducer.ts"
    "src/utils/constants/apiEndpoints.ts" "src/utils/constants/appConstants.ts"
    "src/utils/constants/rolePermissions.ts" "src/utils/helpers/errorHandler.ts"
    "src/styles/globals.css" "src/styles/variables.css"
)

# --- 3. Execution ---

echo -e "${BLUE}🚀 checking structure...${NC}"

# A. Directories
# mkdir -p is silent if dir exists, so we just run it.
mkdir -p "${DIRECTORIES[@]}"

# B. Files
created=0
skipped=0

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        # File exists: Do nothing
        ((skipped++))
    else
        # File missing: Create it
        touch "$file"
        ((created++))
        # echo -e "${GRAY}  + Created: $file${NC}" # Uncomment for verbose
    fi
done

# --- 4. Report ---

echo ""
echo "========================================================"
echo -e "🎉 Scan Complete!"
echo "--------------------------------------------------------"
echo -e "📂 Directories:  ${GREEN}Verified${NC}"
echo -e "📄 Files Created: ${GREEN}$created${NC}"
echo -e "⏭️  Files Skipped: ${YELLOW}$skipped${NC} (Already existed)"
echo "========================================================"