export interface BasemapConfig {
  tileUrl: string;
  attribution: string;
  maxZoom: number;
}

export const satelliteBasemap: BasemapConfig = {
  tileUrl:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution:
    "Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community",
  maxZoom: 19,
};
