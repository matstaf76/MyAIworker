#!/bin/bash
# Deploy the business-lookup service to Cloud Run (source deploy).
# The live endpoint Vapi calls is a Cloud Run SERVICE named "business-lookup"
# (NOT a Cloud Function), built from source with the Functions Framework
# (entry point businessLookup). Run from inside the backend/ folder:  bash deploy.sh

# ── Load secret (gitignored) ───────────────────────────────────
# Put PLACES_API_KEY in backend/secrets.sh (never committed).
if [ -f "$(dirname "$0")/secrets.sh" ]; then
  source "$(dirname "$0")/secrets.sh"
fi
if [ -z "$PLACES_API_KEY" ]; then
  echo "ERROR: PLACES_API_KEY not set. Create backend/secrets.sh with:"
  echo '  export PLACES_API_KEY="your_key_here"'
  exit 1
fi
PROJECT="myaiworker-backend"
REGION="us-central1"
SERVICE="business-lookup"

# Cloud Run keeps the current healthy revision serving until the new one is
# ready, so this is zero-downtime; a failed build/revision never takes traffic.
#
# --min-instances=1 keeps one container warm. This is called mid-conversation
# while a prospect is listening, and a cold start is 2-5s of dead air right
# when Max should sound sharp. Costs a few dollars a month; worth it.
gcloud run deploy $SERVICE \
  --source=. \
  --project=$PROJECT \
  --region=$REGION \
  --function=businessLookup \
  --allow-unauthenticated \
  --update-env-vars PLACES_API_KEY=$PLACES_API_KEY \
  --memory=256Mi \
  --timeout=10 \
  --min-instances=1

echo ""
echo "Deployed. Service URL:"
gcloud run services describe $SERVICE \
  --region=$REGION --project=$PROJECT \
  --format="value(status.url)"
