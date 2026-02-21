import type { MultiPolygon, Point } from "geojson";

export interface IGeoConfig {
  tableName: string;
  nameField: string;
  parentField?: string;
  parentNameField?: string;
  getStateCode?: (stateName: string) => string;
}

export interface IState {
  id: string;
  name: string;
  stateCode: string;
  population: number | null;
  boundary: MultiPolygon | null;
  centroid: Point | null;
  areaKm2: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILGA {
  id: string;
  name: string;
  stateId: string;
  population: number | null;
  boundary: MultiPolygon | null;
  centroid: Point | null;
  areaKm2: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWard {
  id: string;
  name: string;
  lgaId: string;
  population: number | null;
  boundary: MultiPolygon | null;
  centroid: Point | null;
  areaKm2: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGeoPoint {
  latitude: number;
  longitude: number;
}
