/**
 * Fetch Sri Lanka's electricity transmission grid (CEB high-voltage lines) from
 * OpenStreetMap via Overpass, as a GeoJSON LineString layer for the map.
 *
 * OSM tags: power=line (transmission) and power=minor_line. We keep voltage where
 * tagged (drives line weight). Run mapshaper -simplify on the output afterward.
 *
 * Usage: node scripts/build-grid-geojson.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '..', 'public/data/sri-lanka-grid.geojson')

// Sri Lanka bounding box (S,W,N,E). Simpler + more robust than an area lookup.
const query = `[out:json][timeout:90];
way["power"="line"](5.7,79.4,9.95,82.0);
out geom;`

function fetchOverpass() {
  const data = 'data=' + encodeURIComponent(query)
  const opts = {
    method: 'POST',
    hostname: 'overpass-api.de',
    path: '/api/interpreter',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(data),
      'User-Agent': 'lanka-mapper/1.0 (open-data map; build script)',
      'Accept': 'application/json',
    },
  }
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => (res.statusCode === 200 ? resolve(JSON.parse(body)) : reject(new Error('HTTP ' + res.statusCode))))
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

const json = await fetchOverpass()
const features = []
for (const el of json.elements || []) {
  if (el.type !== 'way' || !el.geometry) continue
  const coords = el.geometry.map((p) => [p.lon, p.lat])
  if (coords.length < 2) continue
  const v = el.tags?.voltage ? parseInt(String(el.tags.voltage).split(';')[0], 10) : null
  features.push({
    type: 'Feature',
    properties: { kv: Number.isFinite(v) ? Math.round(v / 1000) : null },
    geometry: { type: 'LineString', coordinates: coords },
  })
}

fs.writeFileSync(outPath, JSON.stringify({ type: 'FeatureCollection', features }))
const kvs = [...new Set(features.map((f) => f.properties.kv).filter(Boolean))].sort((a, b) => b - a)
console.log(`grid lines: ${features.length}, voltages(kV): ${kvs.join(', ') || 'untagged'} -> ${outPath}`)
