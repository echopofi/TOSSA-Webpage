#!/bin/bash
set -a
source .env
set +a

IP=$(getent hosts aws-0-eu-west-2.pooler.supabase.com | awk 'NR==1{print $1}')
export DATABASE_URL=$(echo "$DATABASE_URL" | sed "s/aws-0-eu-west-2.pooler.supabase.com/${IP}/")
nodemon src/index.js