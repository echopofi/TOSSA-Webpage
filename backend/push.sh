#!/bin/bash
# Resolve the Supabase pooler hostname to an IPv4 address at runtime.
# Prisma's Rust engine intermittently fails with P1001 when it tries an
# unreachable IPv6(-mapped) route that libpq/psql never attempts; using the
# IPv4 literal for the connection keeps schema push reliable.
IP=$(getent ahostsv4 aws-0-eu-west-2.pooler.supabase.com | awk 'NR==1{print $1}')
export DATABASE_URL="postgresql://postgres.gkrwxshycmcivulkcfjz:x8hR5EOPCI6GhHau@${IP}:5432/postgres?sslmode=require"
echo "Connecting to Supabase pooler at ${IP}"
npx prisma db push
