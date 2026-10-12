import { MongoClient } from 'mongodb';

const URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27019';
export const DB_NAME = process.env.MONGO_DB || 'drishti';

let client;
export async function connect() {
  if (!client) {
    client = new MongoClient(URI, { maxPoolSize: 20 });
    await client.connect();
  }
  return client.db(DB_NAME);
}

export async function close() {
  if (client) await client.close();
  client = null;
}

// Collections described in the synopsis (Ch.6.2) plus the supporting analytic collections.
export const COLLECTIONS = [
  'stations',
  'rainfall_records',
  'river_levels',
  'weather_data',
  'risk_zones',
  'disaster_events',
  'alerts',
  'station_baselines',
  'risk_snapshots',
  'reports',
  'sim_state',
];
