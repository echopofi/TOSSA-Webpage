#!/bin/bash
#!/bin/bash
IP=$(getent hosts aws-0-eu-west-2.pooler.supabase.com | awk 'NR==1{print $1}')
export DATABASE_URL="postgresql://postgres.gkrwxshycmcivulkcfjz:x8hR5EOPCI6GhHau@${IP}:5432/postgres?sslmode=require"
nodemon src/index.js
