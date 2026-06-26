'use client'

import { useEffect, useRef } from 'react'

interface Trip {
  id: string
  start_location: string
  destination: string
  start_lat: number
  start_lng: number
  end_lat: number
  end_lng: number
  status: string
}

interface Props {
  trips: Trip[]
  selectedTrip: Trip | null
  onMapClick?: (lat: number, lng: number) => void
  pickingMode?: 'start' | 'end' | null
  startPin?: { lat: number; lng: number } | null
  endPin?: { lat: number; lng: number } | null
}

function getCurvedPoints(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  numPoints = 50
): [number, number][] {
  const points: [number, number][] = []
  const midLat = (lat1 + lat2) / 2
  const midLng = (lng1 + lng2) / 2
  const dist = Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2))
  const curveLat = midLat + dist * 0.2
  const curveLng = midLng

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    const lat = Math.pow(1 - t, 2) * lat1 + 2 * (1 - t) * t * curveLat + Math.pow(t, 2) * lat2
    const lng = Math.pow(1 - t, 2) * lng1 + 2 * (1 - t) * t * curveLng + Math.pow(t, 2) * lng2
    points.push([lat, lng])
  }
  return points
}

export default function TripMap({
  trips,
  selectedTrip,
  onMapClick,
  pickingMode,
  startPin,
  endPin,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const layersRef = useRef<any[]>([])
  const pinLayersRef = useRef<any[]>([])
  const onMapClickRef = useRef(onMapClick)
  const pickingModeRef = useRef(pickingMode)

  useEffect(() => { onMapClickRef.current = onMapClick }, [onMapClick])
  useEffect(() => { pickingModeRef.current = pickingMode }, [pickingMode])

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return '#22c55e'
      case 'completed': return '#3b82f6'
      case 'pending': return '#f59e0b'
      case 'cancelled': return '#ef4444'
      default: return '#6b7280'
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!mapRef.current) return
    if (mapInstanceRef.current) return

    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    const existing = document.querySelector('script[src*="leaflet"]')
    if (existing) { initMap(); return }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => initMap()
    document.head.appendChild(script)

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  const initMap = () => {
    if (!mapRef.current || mapInstanceRef.current) return
    const L = (window as any).L
    if (!L) return

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([9.032, 38.7469], 6)

    L.tileLayer('https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    map.on('click', (e: any) => {
      if (pickingModeRef.current && onMapClickRef.current) {
        onMapClickRef.current(e.latlng.lat, e.latlng.lng)
      }
    })

    mapInstanceRef.current = map
  }

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    const L = (window as any).L
    if (!L) return

    layersRef.current.forEach((l) => { try { map.removeLayer(l) } catch (e) {} })
    layersRef.current = []

    trips.forEach((trip) => {
      if (!trip.start_lat || !trip.end_lat) return
      const isSelected = selectedTrip?.id === trip.id
      const color = statusColor(trip.status)
      const curvedPoints = getCurvedPoints(
        trip.start_lat, trip.start_lng,
        trip.end_lat, trip.end_lng
      )

      const line = L.polyline(curvedPoints, {
        color,
        weight: isSelected ? 5 : 3,
        opacity: isSelected ? 1 : 0.6,
        smoothFactor: 1,
      }).addTo(map)

      const startIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:14px;height:14px;
          background:${color};
          border:3px solid white;
          border-radius:50%;
          box-shadow:0 0 8px ${color};
        "></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7],
      })

      const endIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:0;height:0;
          border-left:8px solid transparent;
          border-right:8px solid transparent;
          border-bottom:14px solid ${color};
          filter:drop-shadow(0 0 4px ${color});
        "></div>`,
        iconSize: [16, 14], iconAnchor: [8, 14],
      })

      const startMarker = L.marker([trip.start_lat, trip.start_lng], { icon: startIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:150px">
            <div style="font-weight:700;margin-bottom:4px">${trip.start_location || 'Start'}</div>
            <div style="color:#666;font-size:12px">🟢 Start Point</div>
          </div>
        `)

      const endMarker = L.marker([trip.end_lat, trip.end_lng], { icon: endIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:150px">
            <div style="font-weight:700;margin-bottom:4px">${trip.destination || 'End'}</div>
            <div style="color:#666;font-size:12px">🏁 Destination</div>
          </div>
        `)

      layersRef.current.push(line, startMarker, endMarker)
    })
  }, [trips, selectedTrip])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    const L = (window as any).L
    if (!L) return

    pinLayersRef.current.forEach((l) => { try { map.removeLayer(l) } catch (e) {} })
    pinLayersRef.current = []

    if (startPin) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:20px;height:20px;
          background:#22c55e;
          border:3px solid white;
          border-radius:50%;
          box-shadow:0 0 15px #22c55e;
          animation:pulse 1.5s infinite;
        "></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
      })
      const m = L.marker([startPin.lat, startPin.lng], { icon })
        .addTo(map)
        .bindPopup('<b>✅ Start Point Set</b>')
      pinLayersRef.current.push(m)
    }

    if (endPin) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:20px;height:20px;
          background:#ef4444;
          border:3px solid white;
          border-radius:3px;
          box-shadow:0 0 15px #ef4444;
        "></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
      })
      const m = L.marker([endPin.lat, endPin.lng], { icon })
        .addTo(map)
        .bindPopup('<b>🏁 End Point Set</b>')
      pinLayersRef.current.push(m)
    }

    if (startPin && endPin) {
      const curvedPoints = getCurvedPoints(
        startPin.lat, startPin.lng,
        endPin.lat, endPin.lng
      )
      const line = L.polyline(curvedPoints, {
        color: '#3b82f6',
        weight: 4,
        dashArray: '10,8',
        opacity: 0.9,
      }).addTo(map)
      pinLayersRef.current.push(line)

      const bounds = L.latLngBounds(
        [startPin.lat, startPin.lng],
        [endPin.lat, endPin.lng]
      )
      map.fitBounds(bounds, { padding: [80, 80] })
    }
  }, [startPin, endPin])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !selectedTrip) return
    const L = (window as any).L
    if (!L) return

    if (selectedTrip.start_lat && selectedTrip.end_lat) {
      const bounds = L.latLngBounds(
        [selectedTrip.start_lat, selectedTrip.start_lng],
        [selectedTrip.end_lat, selectedTrip.end_lng]
      )
      map.fitBounds(bounds, { padding: [60, 60] })
    }
  }, [selectedTrip])

  return (
    <div className="relative w-full h-full">
      {pickingMode && (
        <div
          className="absolute top-4 left-1/2 z-[1000] text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-xl"
          style={{
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            background: pickingMode === 'start' ? '#16a34a' : '#dc2626',
          }}
        >
          {pickingMode === 'start'
            ? '📍 Click anywhere on map to set START'
            : '🏁 Click anywhere on map to set END'}
        </div>
      )}
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}