export interface Dataset {
  value: string;
  label: string;
  downloadUrl: string;
  partial?: boolean;
  layers?: string[];
  // Add other relevant properties like source, format, etc.
}

export const datasets: Dataset[] = [
  // TIGER Datasets (Source: https://www2.census.gov/geo/tiger/TIGER2024/)
  {
    value: 'tiger-states',
    label: 'TIGER/Line States',
    downloadUrl:
      'https://www2.census.gov/geo/tiger/TIGER2024/STATE/tl_2024_us_state.zip', // Specific shapefile
  },
  {
    value: 'tiger-counties',
    label: 'TIGER/Line Counties',
    downloadUrl:
      'https://www2.census.gov/geo/tiger/TIGER2024/COUNTY/tl_2024_us_county.zip', // Specific shapefile
  },
  {
    value: 'tiger-zctas',
    label: 'TIGER/Line ZCTAs (Zip Codes)',
    downloadUrl:
      'https://www2.census.gov/geo/tiger/TIGER2024/ZCTA520/tl_2024_us_zcta520.zip', // Specific shapefile
  },
  {
    value: 'tiger-cbsas',
    label: 'TIGER/Line CBSAs',
    downloadUrl:
      'https://www2.census.gov/geo/tiger/TIGER2024/CBSA/tl_2024_us_cbsa.zip', // Specific shapefile
  },
  {
    value: 'tiger-uac20',
    label: 'TIGER/Line UAC20 (Tribal Land)',
    downloadUrl:
      'https://www2.census.gov/geo/tiger/TIGER2024/UAC20/tl_2024_us_uac20.zip', // Specific shapefile
  },
  {
    value: 'tiger-aiannh',
    label: 'TIGER AIANNH (Tribal Land)',
    downloadUrl:
      'https://www2.census.gov/geo/tiger/TIGER2024/AIANNH/tl_2024_us_aiannh.zip', // Specific shapefile
  },
  // USGS Datasets (Finding direct download links requires navigating data portals)
  {
    value: 'usgs-nhdplushr',
    label: 'USGS NHDPlusHR (Hydrography)',
    partial: true,
    layers: ['NHDArea', 'NHDWaterbody', 'NHDLine'],
    downloadUrl:
      'https://prd-tnm.s3.amazonaws.com/StagedProducts/Hydrography/NHDPlusHR/National/GDB/NHDPlus_H_National_Release_2_GDB.zip',
  },
  {
    value: 'usgs-3dep-dem',
    label: 'USGS 3DEP DEM (Solar Ready, Elevation, Slope)',
    partial: true,
    downloadUrl:
      'https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1m/FullExtentSpatialMetadata/FESM_1m.gpkg',
  },
  // OSM Datasets (Typically accessed via Overpass API or extracts)
  {
    value: 'osm',
    label: 'OSM (Highways, Amenities, Shops, etc.)',
    partial: true,
    downloadUrl:
      'https://download.geofabrik.de/north-america/us-latest.osm.pbf',
  },
];
