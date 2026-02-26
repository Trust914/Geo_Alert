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
  properties: GeoProperties;
}

export interface InputProperties {
  state_name: string;
  lga_name: string;
  ward_name: string;
  pop_total: number;
  gender: string; // "M" or "F"
  [key: string]: any;
}

export interface GeoJSON {
  type: string;
  features: {
    type: string;
    properties: InputProperties;
  }[];
}

export interface WardOutput {
  ward: string;
  population: number;
}

export interface LGAOutput {
  lga: string;
  population: number;
  wards: WardOutput[];
}

export interface StateOutput {
  state: string;
  population: number;
  lgas: LGAOutput[];
}
