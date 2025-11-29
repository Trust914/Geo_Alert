export interface GeoProperties {
  // State/LGA File Format
  admin1Name: string; // State Name
  admin2Name?: string; // LGA Name

  // Ward File Format
  wardname?: string;
  lganame?: string;
  statename?: string;
}

export interface GeoFeature {
  type: "Feature";
  properties: GeoProperties;
  geometry: {
    type: string;
    coordinates: any[];
  };
}

export interface ProcessedBatchItem {
  id: string;
  name: string;
  codeOrParentId: string; // stateCode for States, stateId for LGAs or lgaId for Wards
  geometry: string; // Stringified JSON for PostGIS
}

