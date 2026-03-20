export type Position = [number, number];
export type PolygonCoordinates = Position[][];
export type MultiPolygonCoordinates = PolygonCoordinates[];

export type Geometry =
  | { type: "Point"; coordinates: Position }
  | { type: "Polygon"; coordinates: PolygonCoordinates }
  | { type: "MultiPolygon"; coordinates: MultiPolygonCoordinates };

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const BITS = [16, 8, 4, 2, 1] as const;

export interface BoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

function pointInRing(point: Position, ring: Position[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(point: Position, polygon: PolygonCoordinates): boolean {
  if (polygon.length === 0 || polygon[0]!.length === 0) {
    return false;
  }
  if (!pointInRing(point, polygon[0]!)) {
    return false;
  }
  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(point, polygon[i]!)) {
      return false;
    }
  }
  return true;
}

function onSegment(a: Position, b: Position, c: Position): boolean {
  return (
    Math.min(a[0], c[0]) <= b[0] &&
    b[0] <= Math.max(a[0], c[0]) &&
    Math.min(a[1], c[1]) <= b[1] &&
    b[1] <= Math.max(a[1], c[1])
  );
}

function orientation(a: Position, b: Position, c: Position): number {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < Number.EPSILON) {
    return 0;
  }
  return value > 0 ? 1 : 2;
}

function segmentsIntersect(p1: Position, q1: Position, p2: Position, q2: Position): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

function ringSegments(ring: Position[]): Array<[Position, Position]> {
  const segments: Array<[Position, Position]> = [];
  for (let i = 0; i < ring.length; i += 1) {
    segments.push([ring[i]!, ring[(i + 1) % ring.length]!]);
  }
  return segments;
}

function polygonsOverlap(left: PolygonCoordinates, right: PolygonCoordinates): boolean {
  const leftOuter = left[0] ?? [];
  const rightOuter = right[0] ?? [];
  for (const [a1, a2] of ringSegments(leftOuter)) {
    for (const [b1, b2] of ringSegments(rightOuter)) {
      if (segmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  return pointInPolygon(leftOuter[0] ?? [0, 0], right) || pointInPolygon(rightOuter[0] ?? [0, 0], left);
}

export function geometryContainsPoint(geometry: Geometry, latitude: number, longitude: number): boolean {
  if (geometry.type === "Point") {
    return geometry.coordinates[0] === longitude && geometry.coordinates[1] === latitude;
  }
  if (geometry.type === "Polygon") {
    return pointInPolygon([longitude, latitude], geometry.coordinates);
  }
  return geometry.coordinates.some((polygon) => pointInPolygon([longitude, latitude], polygon));
}

export function geometryIntersectsPolygon(geometry: Geometry, polygon: PolygonCoordinates): boolean {
  if (geometry.type === "Point") {
    return pointInPolygon(geometry.coordinates, polygon);
  }
  if (geometry.type === "Polygon") {
    return polygonsOverlap(geometry.coordinates, polygon);
  }
  return geometry.coordinates.some((item) => polygonsOverlap(item, polygon));
}

export function rectangleToPolygon(minLon: number, minLat: number, maxLon: number, maxLat: number): PolygonCoordinates {
  return [[
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat],
    [minLon, minLat]
  ]];
}

export function encodeGeohash(latitude: number, longitude: number, precision: number): string {
  if (precision < 1 || precision > 12) {
    throw new Error("length must be between 1 and 12");
  }
  let isEven = true;
  let bit = 0;
  let ch = 0;
  let hash = "";
  let latRange: [number, number] = [-90, 90];
  let lonRange: [number, number] = [-180, 180];

  while (hash.length < precision) {
    if (isEven) {
      const mid = (lonRange[0] + lonRange[1]) / 2;
      if (longitude > mid) {
        ch |= BITS[bit]!;
        lonRange = [mid, lonRange[1]];
      } else {
        lonRange = [lonRange[0], mid];
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (latitude > mid) {
        ch |= BITS[bit]!;
        latRange = [mid, latRange[1]];
      } else {
        latRange = [latRange[0], mid];
      }
    }
    isEven = !isEven;
    if (bit < 4) {
      bit += 1;
    } else {
      hash += BASE32[ch]!;
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

export function decodeGeohashBounds(hash: string): BoundingBox {
  let isEven = true;
  let latRange: [number, number] = [-90, 90];
  let lonRange: [number, number] = [-180, 180];

  for (const char of hash) {
    const cd = BASE32.indexOf(char);
    for (const mask of BITS) {
      if (isEven) {
        const mid = (lonRange[0] + lonRange[1]) / 2;
        if ((cd & mask) !== 0) {
          lonRange = [mid, lonRange[1]];
        } else {
          lonRange = [lonRange[0], mid];
        }
      } else {
        const mid = (latRange[0] + latRange[1]) / 2;
        if ((cd & mask) !== 0) {
          latRange = [mid, latRange[1]];
        } else {
          latRange = [latRange[0], mid];
        }
      }
      isEven = !isEven;
    }
  }

  return {
    minLon: lonRange[0],
    maxLon: lonRange[1],
    minLat: latRange[0],
    maxLat: latRange[1]
  };
}

export function decodeGeohash(hash: string): Position {
  const bounds = decodeGeohashBounds(hash);
  return [
    (bounds.minLon + bounds.maxLon) / 2,
    (bounds.minLat + bounds.maxLat) / 2
  ];
}

export function geohashContains(hash: string, latitude: number, longitude: number): boolean {
  const bounds = decodeGeohashBounds(hash);
  return latitude >= bounds.minLat && latitude <= bounds.maxLat && longitude >= bounds.minLon && longitude <= bounds.maxLon;
}

function boundsForGeometry(geometry: Geometry): BoundingBox {
  const points: Position[] =
    geometry.type === "Point"
      ? [geometry.coordinates]
      : geometry.type === "Polygon"
        ? geometry.coordinates.flat()
        : geometry.coordinates.flat(2) as Position[];

  let minLon = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const [lon, lat] of points) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }

  return { minLon, minLat, maxLon, maxLat };
}

function polygonBounds(polygon: PolygonCoordinates): BoundingBox {
  return boundsForGeometry({ type: "Polygon", coordinates: polygon });
}

function geohashPolygon(hash: string): PolygonCoordinates {
  const bounds = decodeGeohashBounds(hash);
  return rectangleToPolygon(bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat);
}

function bboxContainsPoint(bounds: BoundingBox, point: Position): boolean {
  return point[0] >= bounds.minLon && point[0] <= bounds.maxLon && point[1] >= bounds.minLat && point[1] <= bounds.maxLat;
}

function bboxIntersects(left: BoundingBox, right: BoundingBox): boolean {
  return !(left.maxLon < right.minLon || left.minLon > right.maxLon || left.maxLat < right.minLat || left.minLat > right.maxLat);
}

function geohashIntersectsPolygon(hash: string, polygon: PolygonCoordinates): boolean {
  return polygonsOverlap(geohashPolygon(hash), polygon);
}

export function eastGeohash(hash: string): string {
  const bounds = decodeGeohashBounds(hash);
  const lonDiff = bounds.maxLon - bounds.minLon;
  const lat = (bounds.minLat + bounds.maxLat) / 2;
  let lon = bounds.maxLon + lonDiff / 2;
  if (lon > 180) {
    lon = -180 + (lon - 180);
  }
  if (lon < -180) {
    lon = -180;
  }
  return encodeGeohash(lat, lon, hash.length);
}

export function northGeohash(hash: string): string {
  const bounds = decodeGeohashBounds(hash);
  const latDiff = bounds.maxLat - bounds.minLat;
  const lat = bounds.maxLat + latDiff / 2;
  const lon = (bounds.minLon + bounds.maxLon) / 2;
  return encodeGeohash(lat, lon, hash.length);
}

function collectGeohashesForPolygon(polygon: PolygonCoordinates, precision: number): Set<string> {
  const bbox = polygonBounds(polygon);
  const covered = new Set<string>();
  let rowHash = encodeGeohash(bbox.minLat, bbox.minLon, precision);
  let rowBounds = decodeGeohashBounds(rowHash);

  while (rowBounds.minLat < bbox.maxLat) {
    let columnHash = rowHash;
    let columnBounds = rowBounds;
    while (columnBounds.minLon < bbox.maxLon) {
      if (geohashIntersectsPolygon(columnHash, polygon)) {
        covered.add(columnHash);
      }
      columnHash = eastGeohash(columnHash);
      columnBounds = decodeGeohashBounds(columnHash);
    }
    rowHash = northGeohash(rowHash);
    rowBounds = decodeGeohashBounds(rowHash);
  }

  return covered;
}

export function geohashesForGeometry(geometry: Geometry, precision: number): Set<string> {
  if (geometry.type === "Point") {
    return new Set([encodeGeohash(geometry.coordinates[1], geometry.coordinates[0], precision)]);
  }
  if (geometry.type === "Polygon") {
    return collectGeohashesForPolygon(geometry.coordinates, precision);
  }
  const hashes = new Set<string>();
  for (const polygon of geometry.coordinates) {
    for (const hash of collectGeohashesForPolygon(polygon, precision)) {
      hashes.add(hash);
    }
  }
  return hashes;
}

export function geometryIntersectsGeohash(geometry: Geometry, hash: string): boolean {
  const bounds = decodeGeohashBounds(hash);
  const geometryBounds = boundsForGeometry(geometry);
  if (!bboxIntersects(bounds, geometryBounds)) {
    return false;
  }
  if (geometry.type === "Point") {
    return bboxContainsPoint(bounds, geometry.coordinates);
  }
  return geometryIntersectsPolygon(geometry, geohashPolygon(hash));
}
