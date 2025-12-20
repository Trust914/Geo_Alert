import { JurisdictionLevel } from "../prisma/prisma/generated/enums";

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

export function isValidGeoJSON(geometry: any): boolean {
  try {
    const parsed = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
    
    // Check if it has required properties
    if (!parsed || typeof parsed !== 'object') return false;
    if (!parsed.type || !parsed.coordinates) return false;
    
    // Check if coordinates array is valid
    if (!Array.isArray(parsed.coordinates)) return false;
    if (parsed.coordinates.length === 0) return false;
    
    // Basic type validation
    const validTypes = ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'];
    if (!validTypes.includes(parsed.type)) return false;
    
    return true;
  } catch (e) {
    return false;
  }
}