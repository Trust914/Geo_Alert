import { JurisdictionLevel } from "../prisma/prisma/generated/enums.js";
import { logger } from "../utils/logger.util.js";

export interface ValidationResult {
  isValid: boolean;
  geometry: string;
  warnings: string[];
  geometryType: string;
}

export function extractNames(props: any, level: JurisdictionLevel) {
  let name = "";
  let stateName = "";
  let lgaName = "";

  if (level === JurisdictionLevel.STATE) {
    name = props.name || props.admin1Name || props.state_name || props.statename;
  } else if (level === JurisdictionLevel.LGA) {
    name = props.name || props.admin2Name || props.lga_name || props.lganame;
    stateName = props.state_name || props.admin1Name || props.statename;
  } else if (level === JurisdictionLevel.WARD) {
    name = props.name || props.wardname || props.ward_name;
    lgaName = props.lga_name || props.lganame || props.admin2Name;
    stateName = props.state_name || props.statename || props.admin1Name;
  }

  return { name, stateName, lgaName };
}

/**
 * Creates a default minimal MultiPolygon geometry
 * A small square around [0, 0] to satisfy PostGIS MultiPolygon requirements
 */
function createDefaultGeometry(): any {
  return {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [0, 0],
          [0, 0.0001],
          [0.0001, 0.0001],
          [0.0001, 0],
          [0, 0] // Close the ring
        ]
      ]
    ]
  };
}

/**
 * Validates and cleans geometry with comprehensive logging
 * Returns ValidationResult with geometry and any warnings
 */
export function validateAndCleanGeometry(
  geometry: any,
  name: string,
  level: string
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    geometry: "",
    warnings: [],
    geometryType: "Unknown"
  };

  try {
    // Handle NULL or missing geometry
    if (geometry === "NULL" || geometry === null || geometry === undefined) {
      result.isValid = false;
      result.warnings.push(`Geometry is NULL/undefined`);
      result.geometry = JSON.stringify(createDefaultGeometry());
      result.geometryType = "MultiPolygon (default)";
      return result;
    }

    // Parse if string
    const parsed = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;

    // Check basic structure
    if (!parsed || typeof parsed !== 'object') {
      result.isValid = false;
      result.warnings.push(`Invalid geometry object (not an object)`);
      result.geometry = JSON.stringify(createDefaultGeometry());
      result.geometryType = "MultiPolygon (default)";
      return result;
    }

    if (!parsed.type) {
      result.isValid = false;
      result.warnings.push(`Missing geometry type`);
      result.geometry = JSON.stringify(createDefaultGeometry());
      result.geometryType = "MultiPolygon (default)";
      return result;
    }

    result.geometryType = parsed.type;

    // Handle GeometryCollection
    if (parsed.type === 'GeometryCollection') {
      if (!parsed.geometries || !Array.isArray(parsed.geometries) || parsed.geometries.length === 0) {
        result.isValid = false;
        result.warnings.push(`GeometryCollection has no valid geometries`);
        result.geometry = JSON.stringify(createDefaultGeometry());
        result.geometryType = "MultiPolygon (default)";
        return result;
      }
      // GeometryCollection is valid
      result.geometry = JSON.stringify(parsed);
      return result;
    }

    // For non-GeometryCollection types, validate coordinates
    if (!parsed.coordinates) {
      result.isValid = false;
      result.warnings.push(`Missing coordinates`);
      result.geometry = JSON.stringify(createDefaultGeometry());
      result.geometryType = "MultiPolygon (default)";
      return result;
    }

    if (!Array.isArray(parsed.coordinates)) {
      result.isValid = false;
      result.warnings.push(`Coordinates not an array`);
      result.geometry = JSON.stringify(createDefaultGeometry());
      result.geometryType = "MultiPolygon (default)";
      return result;
    }

    if (parsed.coordinates.length === 0) {
      result.isValid = false;
      result.warnings.push(`Empty coordinates array`);
      result.geometry = JSON.stringify(createDefaultGeometry());
      result.geometryType = "MultiPolygon (default)";
      return result;
    }

    // Type-specific validation
    switch (parsed.type) {
      case 'Point':
        if (!isValidPoint(parsed.coordinates)) {
          result.isValid = false;
          result.warnings.push(`Invalid Point coordinates (expected [lon, lat] with valid numbers)`);
          result.geometry = JSON.stringify(createDefaultGeometry());
          result.geometryType = "MultiPolygon (default)";
          return result;
        }
        break;

      case 'LineString':
      case 'MultiPoint':
        if (!Array.isArray(parsed.coordinates) || parsed.coordinates.length < 2) {
          result.isValid = false;
          result.warnings.push(`${parsed.type} requires at least 2 points`);
          result.geometry = JSON.stringify(createDefaultGeometry());
          result.geometryType = "MultiPolygon (default)";
          return result;
        }
        break;

      case 'Polygon':
        if (!isValidPolygon(parsed.coordinates)) {
          result.isValid = false;
          result.warnings.push(`Invalid Polygon (requires at least 3 points in outer ring)`);
          result.geometry = JSON.stringify(createDefaultGeometry());
          result.geometryType = "MultiPolygon (default)";
          return result;
        }
        break;

      case 'MultiPolygon':
        if (!isValidMultiPolygon(parsed.coordinates)) {
          result.isValid = false;
          result.warnings.push(`Invalid MultiPolygon structure`);
          result.geometry = JSON.stringify(createDefaultGeometry());
          result.geometryType = "MultiPolygon (default)";
          return result;
        }
        break;

      case 'MultiLineString':
        if (!Array.isArray(parsed.coordinates) || parsed.coordinates.length === 0) {
          result.isValid = false;
          result.warnings.push(`Invalid MultiLineString structure`);
          result.geometry = JSON.stringify(createDefaultGeometry());
          result.geometryType = "MultiPolygon (default)";
          return result;
        }
        break;

      default:
        result.warnings.push(`Unknown geometry type: ${parsed.type}`);
        break;
    }

    // Geometry is valid
    result.geometry = JSON.stringify(parsed);
    return result;

  } catch (e) {
    result.isValid = false;
    result.warnings.push(`Parse error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    result.geometry = JSON.stringify(createDefaultGeometry());
    result.geometryType = "MultiPolygon (default)";
    return result;
  }
}

/**
 * Validates a Point coordinate pair
 */
function isValidPoint(coords: any): boolean {
  return Array.isArray(coords) &&
         coords.length >= 2 &&
         typeof coords[0] === 'number' &&
         typeof coords[1] === 'number' &&
         !isNaN(coords[0]) &&
         !isNaN(coords[1]) &&
         isFinite(coords[0]) &&
         isFinite(coords[1]);
}

/**
 * Validates Polygon coordinates
 */
function isValidPolygon(coords: any): boolean {
  if (!Array.isArray(coords) || coords.length === 0) {
    return false;
  }

  // Check outer ring (first element)
  const outerRing = coords[0];
  if (!Array.isArray(outerRing) || outerRing.length < 3) {
    return false;
  }

  // Validate each point in the outer ring
  return outerRing.every((point: any) => isValidPoint(point));
}

/**
 * Validates MultiPolygon coordinates
 */
function isValidMultiPolygon(coords: any): boolean {
  if (!Array.isArray(coords) || coords.length === 0) {
    return false;
  }

  // Each element should be a valid polygon
  return coords.every((polygon: any) => isValidPolygon(polygon));
}

/**
 * Enhanced GeoJSON validation - checks if geometry is structurally valid
 */
export function isValidGeoJSON(geometry: any): boolean {
  try {
    const parsed = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;

    if (!parsed || typeof parsed !== 'object') {
      return false;
    }

    if (!parsed.type) {
      return false;
    }

    const validTypes = [
      'Point',
      'LineString',
      'Polygon',
      'MultiPoint',
      'MultiLineString',
      'MultiPolygon',
      'GeometryCollection'
    ];

    if (!validTypes.includes(parsed.type)) {
      return false;
    }

    // GeometryCollection has geometries instead of coordinates
    if (parsed.type === 'GeometryCollection') {
      return parsed.geometries && Array.isArray(parsed.geometries) && parsed.geometries.length > 0;
    }

    // Other types must have coordinates
    return parsed.coordinates !== undefined && Array.isArray(parsed.coordinates);

  } catch (e) {
    return false;
  }
}

/**
 * Checks if geometry has actual valid coordinate data
 */
export function hasValidCoordinates(geometry: any): boolean {
  try {
    const parsed = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;

    if (!parsed || !parsed.coordinates) {
      return false;
    }

    if (!Array.isArray(parsed.coordinates) || parsed.coordinates.length === 0) {
      return false;
    }

    switch (parsed.type) {
      case 'Point':
        return isValidPoint(parsed.coordinates);

      case 'Polygon':
        return isValidPolygon(parsed.coordinates);

      case 'MultiPolygon':
        return isValidMultiPolygon(parsed.coordinates);

      case 'LineString':
      case 'MultiPoint':
        return parsed.coordinates.length >= 2 &&
               parsed.coordinates.every((point: any) => isValidPoint(point));

      case 'MultiLineString':
        return parsed.coordinates.every((line: any) =>
          Array.isArray(line) && line.length >= 2
        );

      default:
        return true;
    }

  } catch (e) {
    return false;
  }
}

/**
 * Helper to get geometry type for logging
 */
export function getGeometryType(geometry: any): string {
  try {
    const parsed = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
    return parsed?.type || 'Unknown';
  } catch {
    return 'Invalid';
  }
}

/**
 * Helper to count coordinates in a geometry
 */
export function countCoordinates(geometry: any): number {
  try {
    const parsed = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;

    if (!parsed || !parsed.coordinates) return 0;

    const type = parsed.type;
    const coords = parsed.coordinates;

    switch (type) {
      case 'Point':
        return 1;

      case 'LineString':
      case 'MultiPoint':
        return Array.isArray(coords) ? coords.length : 0;

      case 'Polygon':
        if (!Array.isArray(coords) || !coords[0]) return 0;
        return coords.reduce((sum: number, ring: any[]) => sum + (ring?.length || 0), 0);

      case 'MultiLineString':
        if (!Array.isArray(coords)) return 0;
        return coords.reduce((sum: number, line: any[]) => sum + (line?.length || 0), 0);

      case 'MultiPolygon':
        if (!Array.isArray(coords)) return 0;
        return coords.reduce((sum: number, polygon: any[]) => {
          return sum + polygon.reduce((ringSum: number, ring: any[]) => ringSum + (ring?.length || 0), 0);
        }, 0);

      default:
        return 0;
    }
  } catch {
    return 0;
  }
}

/**
 * Logs validation warnings for a jurisdiction
 */
export function logValidationWarning(
  level: string,
  name: string,
  warnings: string[],
  additionalInfo: Record<string, any> | undefined
): void {
  if (warnings.length === 0) return;

  const warningMsg = warnings.join('; ');
  logger.warn(`⚠️  ${level} "${name}": ${warningMsg}`, additionalInfo !== undefined ? additionalInfo : {});
}