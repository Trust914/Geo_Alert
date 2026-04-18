-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "AgencyType" AS ENUM ('FEDERAL', 'STATE', 'LOCAL');

-- CreateEnum
CREATE TYPE "AgencyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'COORDINATOR', 'OPERATOR');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('LOGIN', 'LOGOUT', 'CREATE_ALERT', 'SEND_ALERT', 'CANCEL_ALERT', 'UPDATE_ALERT', 'CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'CREATE_AGENCY', 'UPDATE_AGENCY', 'DELETE_AGENCY', 'REGISTER_CITIZEN', 'UPDATE_CITIZEN');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ENGLISH', 'HAUSA', 'YORUBA', 'IGBO', 'PIDGIN');

-- CreateEnum
CREATE TYPE "AlertCategory" AS ENUM ('WEATHER', 'SECURITY', 'HEALTH', 'SAFETY', 'FIRE', 'FLOOD', 'OTHER');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('EXTREME', 'SEVERE', 'MODERATE', 'MINOR');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('IMMEDIATE', 'EXPECTED', 'FUTURE');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('DRAFT', 'PENDING', 'SENT', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('STATE', 'LGA', 'WARD', 'RADIUS', 'POLYGON', 'PATH');

-- CreateEnum
CREATE TYPE "JurisdictionLevel" AS ENUM ('NATIONAL', 'STATE', 'LGA', 'WARD');

-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AgencyType" NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "jurisdiction_level" "JurisdictionLevel" NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "status" "AgencyStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "category" "AlertCategory" NOT NULL,
    "severity" "Severity" NOT NULL,
    "urgency" "Urgency" NOT NULL,
    "headline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instruction" TEXT,
    "cap_xml" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'DRAFT',
    "affected_area" geometry(MultiPolygon, 4326),
    "incident_location" geometry(Point, 4326),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_targets" (
    "id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "target_type" "TargetType" NOT NULL,
    "state_id" TEXT,
    "lga_id" TEXT,
    "ward_id" TEXT,
    "radius_meters" INTEGER,
    "center_point" geometry(Point, 4326),
    "target_polygon" geometry(Polygon, 4326),
    "target_path" geometry(LineString, 4326),
    "path_buffer_meters" INTEGER,
    "estimated_recipients" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "citizen_id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "gateway_message_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" "ActionType" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "changes" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "states" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state_code" TEXT NOT NULL,
    "population" INTEGER,
    "boundary" geometry(MultiPolygon, 4326),
    "centroid" geometry(Point, 4326),
    "area_km2" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lgas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state_id" TEXT NOT NULL,
    "population" INTEGER,
    "boundary" geometry(MultiPolygon, 4326),
    "centroid" geometry(Point, 4326),
    "area_km2" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lgas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lga_id" TEXT NOT NULL,
    "population" INTEGER,
    "boundary" geometry(MultiPolygon, 4326),
    "centroid" geometry(Point, 4326),
    "area_km2" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "agency_id" TEXT NOT NULL,
    "last_login_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citizens" (
    "id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "state_id" TEXT NOT NULL,
    "lga_id" TEXT NOT NULL,
    "ward_id" TEXT,
    "location" geometry(Point, 4326),
    "preferred_language" "Language" NOT NULL DEFAULT 'ENGLISH',
    "is_opted_in" BOOLEAN NOT NULL DEFAULT true,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "citizens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agencies_name_key" ON "agencies"("name");

-- CreateIndex
CREATE INDEX "agencies_status_idx" ON "agencies"("status");

-- CreateIndex
CREATE INDEX "agencies_jurisdiction_level_idx" ON "agencies"("jurisdiction_level");

-- CreateIndex
CREATE INDEX "alerts_agency_id_idx" ON "alerts"("agency_id");

-- CreateIndex
CREATE INDEX "alerts_created_by_user_id_idx" ON "alerts"("created_by_user_id");

-- CreateIndex
CREATE INDEX "alerts_status_idx" ON "alerts"("status");

-- CreateIndex
CREATE INDEX "alerts_category_idx" ON "alerts"("category");

-- CreateIndex
CREATE INDEX "alerts_created_at_idx" ON "alerts"("created_at");

-- CreateIndex
CREATE INDEX "alerts_affected_area_idx" ON "alerts" USING GIST ("affected_area");

-- CreateIndex
CREATE INDEX "alerts_incident_location_idx" ON "alerts" USING GIST ("incident_location");

-- CreateIndex
CREATE INDEX "alert_targets_alert_id_idx" ON "alert_targets"("alert_id");

-- CreateIndex
CREATE INDEX "alert_targets_state_id_idx" ON "alert_targets"("state_id");

-- CreateIndex
CREATE INDEX "alert_targets_lga_id_idx" ON "alert_targets"("lga_id");

-- CreateIndex
CREATE INDEX "alert_targets_ward_id_idx" ON "alert_targets"("ward_id");

-- CreateIndex
CREATE INDEX "alert_targets_center_point_idx" ON "alert_targets" USING GIST ("center_point");

-- CreateIndex
CREATE INDEX "alert_targets_target_polygon_idx" ON "alert_targets" USING GIST ("target_polygon");

-- CreateIndex
CREATE INDEX "alert_targets_target_path_idx" ON "alert_targets" USING GIST ("target_path");

-- CreateIndex
CREATE INDEX "deliveries_alert_id_idx" ON "deliveries"("alert_id");

-- CreateIndex
CREATE INDEX "deliveries_citizen_id_idx" ON "deliveries"("citizen_id");

-- CreateIndex
CREATE INDEX "deliveries_status_idx" ON "deliveries"("status");

-- CreateIndex
CREATE INDEX "deliveries_queued_at_idx" ON "deliveries"("queued_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "states_name_key" ON "states"("name");

-- CreateIndex
CREATE UNIQUE INDEX "states_state_code_key" ON "states"("state_code");

-- CreateIndex
CREATE INDEX "states_state_code_idx" ON "states"("state_code");

-- CreateIndex
CREATE INDEX "states_boundary_idx" ON "states" USING GIST ("boundary");

-- CreateIndex
CREATE INDEX "lgas_state_id_idx" ON "lgas"("state_id");

-- CreateIndex
CREATE INDEX "lgas_boundary_idx" ON "lgas" USING GIST ("boundary");

-- CreateIndex
CREATE UNIQUE INDEX "lgas_state_id_name_key" ON "lgas"("state_id", "name");

-- CreateIndex
CREATE INDEX "wards_lga_id_idx" ON "wards"("lga_id");

-- CreateIndex
CREATE INDEX "wards_boundary_idx" ON "wards" USING GIST ("boundary");

-- CreateIndex
CREATE UNIQUE INDEX "wards_lga_id_name_key" ON "wards"("lga_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_agency_id_idx" ON "users"("agency_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "citizens_phone_number_key" ON "citizens"("phone_number");

-- CreateIndex
CREATE INDEX "citizens_phone_number_idx" ON "citizens"("phone_number");

-- CreateIndex
CREATE INDEX "citizens_state_id_idx" ON "citizens"("state_id");

-- CreateIndex
CREATE INDEX "citizens_lga_id_idx" ON "citizens"("lga_id");

-- CreateIndex
CREATE INDEX "citizens_ward_id_idx" ON "citizens"("ward_id");

-- CreateIndex
CREATE INDEX "citizens_is_opted_in_idx" ON "citizens"("is_opted_in");

-- CreateIndex
CREATE INDEX "citizens_location_idx" ON "citizens" USING GIST ("location");

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_targets" ADD CONSTRAINT "alert_targets_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_targets" ADD CONSTRAINT "alert_targets_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_targets" ADD CONSTRAINT "alert_targets_lga_id_fkey" FOREIGN KEY ("lga_id") REFERENCES "lgas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_targets" ADD CONSTRAINT "alert_targets_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_citizen_id_fkey" FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lgas" ADD CONSTRAINT "lgas_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_lga_id_fkey" FOREIGN KEY ("lga_id") REFERENCES "lgas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citizens" ADD CONSTRAINT "citizens_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citizens" ADD CONSTRAINT "citizens_lga_id_fkey" FOREIGN KEY ("lga_id") REFERENCES "lgas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citizens" ADD CONSTRAINT "citizens_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
