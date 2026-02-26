-- ─────────────────────────────────────────────────────────────
-- GeoAlert — Database Initialisation
-- Runs once on first container startup
-- ─────────────────────────────────────────────────────────────

-- Enable PostGIS spatial extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Verify PostGIS installed correctly
SELECT PostGIS_version();