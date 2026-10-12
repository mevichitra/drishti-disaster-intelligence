// Flood-prone cities / river basins around the world used to build the synthetic network.
// [city, country, continent, river, lat, lon, wet(0..1), peakMonth, flashy(0..1), coastal]
const RAW = [
  // South Asia
  ['Patna', 'India', 'Asia', 'Ganga', 25.61, 85.14, 0.85, 8, 0.3, 0],
  ['Guwahati', 'India', 'Asia', 'Brahmaputra', 26.14, 91.74, 0.95, 7, 0.4, 0],
  ['Kochi', 'India', 'Asia', 'Periyar', 9.93, 76.27, 0.9, 7, 0.7, 1],
  ['Mumbai', 'India', 'Asia', 'Mithi', 19.07, 72.88, 0.85, 7, 0.9, 1],
  ['Chennai', 'India', 'Asia', 'Adyar', 13.08, 80.27, 0.6, 11, 0.8, 1],
  ['Srinagar', 'India', 'Asia', 'Jhelum', 34.08, 74.8, 0.5, 4, 0.5, 0],
  ['Kolkata', 'India', 'Asia', 'Hooghly', 22.57, 88.36, 0.8, 8, 0.4, 1],
  ['Surat', 'India', 'Asia', 'Tapi', 21.17, 72.83, 0.7, 8, 0.6, 1],
  ['Dhaka', 'Bangladesh', 'Asia', 'Buriganga', 23.81, 90.41, 0.9, 7, 0.4, 0],
  ['Sylhet', 'Bangladesh', 'Asia', 'Surma', 24.89, 91.87, 0.95, 6, 0.6, 0],
  ['Sukkur', 'Pakistan', 'Asia', 'Indus', 27.7, 68.86, 0.45, 8, 0.3, 0],
  ['Nowshera', 'Pakistan', 'Asia', 'Kabul River', 34.01, 71.98, 0.5, 7, 0.7, 0],
  ['Kathmandu', 'Nepal', 'Asia', 'Bagmati', 27.71, 85.32, 0.8, 7, 0.8, 0],
  ['Colombo', 'Sri Lanka', 'Asia', 'Kelani', 6.93, 79.86, 0.85, 5, 0.6, 1],
  // East & South-East Asia
  ['Wuhan', 'China', 'Asia', 'Yangtze', 30.59, 114.3, 0.8, 7, 0.3, 0],
  ['Guangzhou', 'China', 'Asia', 'Pearl River', 23.13, 113.26, 0.8, 6, 0.5, 1],
  ['Zhengzhou', 'China', 'Asia', 'Yellow River', 34.75, 113.62, 0.55, 7, 0.5, 0],
  ['Bangkok', 'Thailand', 'Asia', 'Chao Phraya', 13.75, 100.5, 0.8, 9, 0.3, 1],
  ['Ho Chi Minh City', 'Vietnam', 'Asia', 'Saigon-Mekong', 10.82, 106.63, 0.8, 9, 0.4, 1],
  ['Phnom Penh', 'Cambodia', 'Asia', 'Mekong', 11.56, 104.92, 0.75, 9, 0.3, 0],
  ['Jakarta', 'Indonesia', 'Asia', 'Ciliwung', -6.2, 106.85, 0.9, 1, 0.8, 1],
  ['Manila', 'Philippines', 'Asia', 'Pasig', 14.6, 120.98, 0.9, 8, 0.8, 1],
  ['Yangon', 'Myanmar', 'Asia', 'Irrawaddy', 16.87, 96.2, 0.85, 7, 0.4, 1],
  ['Tokyo', 'Japan', 'Asia', 'Arakawa', 35.68, 139.65, 0.6, 9, 0.7, 1],
  // Europe
  ['Cologne', 'Germany', 'Europe', 'Rhine', 50.94, 6.96, 0.45, 7, 0.5, 0],
  ['Dresden', 'Germany', 'Europe', 'Elbe', 51.05, 13.74, 0.45, 6, 0.5, 0],
  ['Budapest', 'Hungary', 'Europe', 'Danube', 47.5, 19.04, 0.4, 6, 0.4, 0],
  ['Ferrara', 'Italy', 'Europe', 'Po', 44.84, 11.62, 0.5, 10, 0.5, 0],
  ['Valencia', 'Spain', 'Europe', 'Turia', 39.47, -0.38, 0.35, 10, 0.95, 1],
  ['London', 'United Kingdom', 'Europe', 'Thames', 51.5, -0.12, 0.4, 11, 0.3, 1],
  // Africa
  ['Niamey', 'Niger', 'Africa', 'Niger', 13.51, 2.11, 0.55, 8, 0.4, 0],
  ['Lokoja', 'Nigeria', 'Africa', 'Niger-Benue', 7.8, 6.74, 0.7, 9, 0.4, 0],
  ['Khartoum', 'Sudan', 'Africa', 'Blue Nile', 15.5, 32.56, 0.45, 8, 0.4, 0],
  ['Beira', 'Mozambique', 'Africa', 'Pungwe', -19.84, 34.84, 0.8, 2, 0.6, 1],
  ['Maputo', 'Mozambique', 'Africa', 'Limpopo', -25.97, 32.57, 0.6, 1, 0.5, 1],
  ['Kinshasa', 'DR Congo', 'Africa', 'Congo', -4.32, 15.31, 0.85, 11, 0.4, 0],
  // Americas
  ['New Orleans', 'USA', 'North America', 'Mississippi', 29.95, -90.07, 0.6, 5, 0.3, 1],
  ['Houston', 'USA', 'North America', 'Buffalo Bayou', 29.76, -95.37, 0.6, 9, 0.9, 1],
  ['Villahermosa', 'Mexico', 'North America', 'Grijalva', 17.99, -92.93, 0.8, 10, 0.5, 0],
  ['Manaus', 'Brazil', 'South America', 'Amazon', -3.12, -60.02, 0.9, 5, 0.2, 0],
  ['Porto Alegre', 'Brazil', 'South America', 'Guaiba', -30.03, -51.23, 0.65, 9, 0.5, 1],
  ['Asuncion', 'Paraguay', 'South America', 'Paraguay River', -25.26, -57.58, 0.55, 3, 0.3, 0],
  ['Buenos Aires', 'Argentina', 'South America', 'Parana', -34.6, -58.38, 0.5, 3, 0.4, 1],
  // Oceania
  ['Brisbane', 'Australia', 'Oceania', 'Brisbane River', -27.47, 153.03, 0.6, 2, 0.7, 1],
  ['Lismore', 'Australia', 'Oceania', 'Wilsons River', -28.81, 153.28, 0.75, 3, 0.8, 0],
  ['Wagga Wagga', 'Australia', 'Oceania', 'Murrumbidgee', -35.12, 147.37, 0.4, 9, 0.4, 0],
];

export const HOTSPOTS = RAW.map(([city, country, continent, river, lat, lon, wet, peakMonth, flashy, coastal], i) => ({
  id: i + 1,
  city,
  country,
  continent,
  river,
  lat,
  lon,
  wet,
  peakMonth,
  flashy,
  coastal: !!coastal,
}));

export const GAUGE_SUFFIX = ['Upper Gauge', 'City Gauge', 'Lower Gauge'];
