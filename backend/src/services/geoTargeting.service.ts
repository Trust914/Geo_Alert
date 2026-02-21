import { prisma } from "../lib/prisma.js";
import { TargetType } from "../prisma/prisma/generated/enums.js";
import type { CoordinatePair, IAlertTarget, IGeoJSONGeometry, IGeoPoint } from "../types/alert.types.js";
import { logger } from "../utils/logger.util.js";

export class GeoTargetingService {
  private static readonly tableMap: Partial<Record<TargetType, string>> = {
    [TargetType.STATE]: `${TargetType.STATE.toLowerCase()}s`,
    [TargetType.LGA]: `${TargetType.LGA.toLowerCase()}s`,
    [TargetType.WARD]: `${TargetType.WARD.toLowerCase()}s`,
  };

  /**
   * Calculates the precise center point (Latitude/Longitude) for ANY target type.
   * This is used to place the "Incident Marker" on the dashboard map.
   */
  static async calculateIncidentLocation(target: IAlertTarget): Promise<IGeoPoint | null> {
    try {
      // 1. Handle Map-based targets with GeoJSON geometry
      if (target.geometry) {
        return this.calculateCentroidFromGeoJSON(target.geometry);
      }

      // 2. Handle Admin Areas (STATE / LGA / WARD)
      // These require a Database Lookup using PostGIS for accuracy.
      if ([TargetType.STATE, TargetType.LGA, TargetType.WARD].includes(target.targetType as any)) {
        return await this.fetchAdminAreaCentroid(target);
      }

      // 3. Handle legacy RADIUS structure (fallback for backward compatibility)
      if (target.targetType === TargetType.RADIUS) {
        // Check for flattened structure (frontend) or nested (backend type)
        if ('latitude' in target && 'longitude' in target) {
          return {
            latitude: target.latitude as number,
            longitude: target.longitude as number
          };
        }
        // Fallback for nested centerPoint structure
        if ((target as any).centerPoint) {
          const center = (target as any).centerPoint;
          return {
            latitude: center.latitude,
            longitude: center.longitude
          };
        }
      }

      // 4. Handle legacy POLYGON/PATH with coordinates array (fallback)
      if (target.targetType === TargetType.POLYGON || target.targetType === TargetType.PATH) {
        if ((target as any).coordinates && Array.isArray((target as any).coordinates) && (target as any).coordinates.length > 0) {
          return this.calculateCentroidFromCoordinates((target as any).coordinates);
        }
      }

      logger.warn("Unable to calculate incident location for target", { targetType: target.targetType });
      return null;

    } catch (error) {
      // FAIL-SAFE: Log error but return null.
      // Do not block Alert Creation just because the map pin failed to calculate.
      logger.error("GeoTargeting Error: Failed to calculate incident location", {
        error: (error as Error).message,
        targetType: target.targetType
      });
      return null;
    }
  }

  /**
   * Calculate centroid from GeoJSON geometry
   */
  private static calculateCentroidFromGeoJSON(geometry: IGeoJSONGeometry): IGeoPoint | null {
    try {
      switch (geometry.type) {
        case "Point":
          const [lng, lat] = geometry.coordinates;
          return { latitude: lat, longitude: lng };

        case "Polygon":
          // Use the first ring (outer boundary) for centroid calculation
          const polygonCoords = geometry.coordinates[0];
          return this.calculateCentroidFromCoordinates(polygonCoords as unknown as CoordinatePair[]);

        case "LineString":
          const lineCoords = geometry.coordinates;
          return this.calculateCentroidFromCoordinates(lineCoords);

        default:
          logger.warn("Unsupported GeoJSON geometry type", { type: (geometry as any).type });
          return null;
      }
    } catch (error) {
      logger.error("Failed to calculate centroid from GeoJSON", { error });
      return null;
    }
  }

  /**
   * Pure math helper to calculate the arithmetic mean of a coordinate set.
   * Handles GeoJSON format: array of [lng, lat]
   */
  private static calculateCentroidFromCoordinates(coords: CoordinatePair[]): IGeoPoint {
    let latSum = 0;
    let lngSum = 0;
    let validPoints = 0;

    for (const point of coords) {
      // Validate point structure [lng, lat]
      if (Array.isArray(point) && point.length >= 2) {
        const lng = point[0];
        const lat = point[1];

        // Basic sanity check to ensure we aren't adding NaNs
        if (typeof lat === 'number' && typeof lng === 'number') {
          lngSum += lng;
          latSum += lat;
          validPoints++;
        }
      }
    }

    if (validPoints === 0) {
      // Return a default fallback (e.g., Nigeria Center) if calculation fails
      logger.warn("No valid coordinates found for centroid calculation, using default");
      return { latitude: 9.0820, longitude: 8.6753 };
    }

    return {
      latitude: latSum / validPoints,
      longitude: lngSum / validPoints,
    };
  }

  /**
   * Efficiently queries PostGIS for the centroid of an administrative boundary.
   */
  private static async fetchAdminAreaCentroid(target: IAlertTarget): Promise<IGeoPoint | null> {
    let tableName = "";
    let recordId = "";

    // Determine Table and ID based on Target Type
    switch (target.targetType) {
      case TargetType.WARD:
        if (!target.wardId) return null;
        tableName = this.tableMap[TargetType.WARD]!;
        recordId = target.wardId;
        break;
      case TargetType.LGA:
        if (!target.lgaId) return null;
        tableName = this.tableMap[TargetType.LGA]!;
        recordId = target.lgaId;
        break;
      case TargetType.STATE:
        if (!target.stateId) return null;
        tableName = this.tableMap[TargetType.STATE]!;
        recordId = target.stateId;
        break;
      default:
        return null;
    }

    try {
      // ⚡️ PERFORMANCE: We use ST_Centroid on the database side.
      // fetching the full geometry to Node.js would be slow and memory-heavy.
      // boundary::geometry cast ensures it works even if stored as geography.
      const result = await prisma.$queryRawUnsafe<Array<{ latitude: number; longitude: number }>>(
        `
        SELECT
          ST_X(ST_Centroid(boundary::geometry)) as longitude,
          ST_Y(ST_Centroid(boundary::geometry)) as latitude
        FROM "${tableName}"
        WHERE id = $1
        LIMIT 1;
        `,
        recordId
      );

      if (result && result.length > 0) {
        const row = result[0];
        return {
          latitude: row?.latitude as number,
          longitude: row?.longitude as number,
        };
      }

      logger.warn("No centroid found for admin area", { tableName, recordId });
      return null;
    } catch (error) {
      logger.error("Failed to fetch admin area centroid from database", {
        error: (error as Error).message,
        tableName,
        recordId
      });
      return null;
    }
  }

  /**
   * Calculate centroid from Administrative ID
   * Tries Ward -> LGA -> State to find the most precise location
   */
  static async deriveLocationFromAddress(stateId: string, lgaId: string, wardId?: string | null): Promise<IGeoPoint | null> {
    let queryTable = "";
    let queryId = "";

    // 1. Prioritize Ward (Most Accurate)
    if (wardId) {
      queryTable = this.tableMap[TargetType.WARD]!;
      queryId = wardId;
    }
    // 2. Fallback to LGA
    else if (lgaId) {
      queryTable = this.tableMap[TargetType.LGA]!;
      queryId = lgaId;
    }
    // 3. Fallback to State (Least Accurate)
    else if (stateId) {
      queryTable = this.tableMap[TargetType.STATE]!;
      queryId = stateId;
    } else {
      return null;
    }

    logger.debug("Attempting to derive location from address", {
      queryId,
      queryTable,
    });

    try {
      // Efficiently fetch the pre-calculated centroid directly
      // We use ST_X/ST_Y to extract simple floats from the PostGIS geometry
      const result = await prisma.$queryRawUnsafe<any[]>(
        `
        SELECT
          ST_X(centroid::geometry) as longitude,
          ST_Y(centroid::geometry) as latitude
        FROM "${queryTable}"
        WHERE id = $1
        `,
        queryId
      );

      if (result.length > 0 && result[0].latitude && result[0].longitude) {
        return {
          latitude: result[0].latitude,
          longitude: result[0].longitude,
        };
      }

      logger.warn("No centroid found for address-derived location", { queryTable, queryId });
      return null;
    } catch (error) {
      logger.error("Failed to derive location from address", {
        error: (error as Error).message,
        queryTable,
        queryId,
      });
      return null;
    }
  }

  /**
   * Helper to convert WKT to centroid (for legacy support)
   * @deprecated Use GeoJSON instead
   */
  private static async getCentroidFromWKT(wkt: string): Promise<IGeoPoint | null> {
    try {
      const result = await prisma.$queryRawUnsafe<any[]>(
        `
        SELECT
          ST_X(ST_Centroid(ST_GeomFromText($1, 4326))) as longitude,
          ST_Y(ST_Centroid(ST_GeomFromText($1, 4326))) as latitude
        `,
        wkt
      );

      if (result.length > 0) {
        return {
          latitude: result[0].latitude,
          longitude: result[0].longitude,
        };
      }
      return null;
    } catch (error) {
      logger.error("Failed to calculate centroid from WKT", { error });
      return null;
    }
  }
}