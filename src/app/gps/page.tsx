'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Vehicle {
  id: string
  plate_number: string
  model: string
  status: string
}

interface VehicleLocation {
  vehicle_id: string
  lat: number
  lng: number
  speed: number
  heading: number
  gps_status: string
  last_updated: string
}

export default function GPSPage() {
  const router = useRouter()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [locations, setLocations] = useState<Record<string, VehicleLocation>>({})
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [simulating, setSimulating] = useState(false)

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles').select('company_id').eq('id', user.id).single()
    if (profile?.company_id) {
      fetchVehicles(profile.company_id)
    }
  }

  const fetchVehicles = async (cid: string) => {
    const { data } = await supabase
      .from('vehicles').select('*').eq('company_id', cid)
    setVehicles(data || [])
    initLocations(data || [])
    setLoading(false)
  }

  const initLocations = (vehicleList: Vehicle[]) => {
    const locs: Record<string, VehicleLocation> = {}
    vehicleList.forEach((v) => {
      locs[v.id] = {
        vehicle_id: v.id,
        lat: 9.032 + (Math.random() - 0.5) * 0.5,
        lng: 38.7469 + (Math.random() - 0.5) * 0.5,
        speed: v.status === 'active' ? Math.floor(Math.random() * 80) : 0,
        heading: Math.floor(Math.random() * 360),
        gps_status: v.status === 'active'
          ? (Math.random() > 0.3 ? 'moving' : 'idle')
          : 'offline',
        last_updated: new Date().toISOString(),
      }
    })
    setLocations(locs)
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

    const map = L.map(mapRef.current).setView([9.032, 38.7469], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)
    mapInstanceRef.current = map
  }

  useEffect(() => {
    if (!mapInstanceRef.current) return
    const L = (window as any).L
    if (!L) return
    const map = mapInstanceRef.current

    Object.values(markersRef.current).forEach((m) => {
      try { map.removeLayer(m) } catch (e) {}
    })
    markersRef.current = {}

    vehicles.forEach((vehicle) => {
      const loc = locations[vehicle.id]
      if (!loc) return
      const isSelected = selectedVehicle === vehicle.id
      const color = loc.gps_status === 'moving' ? '#22c55e'
        : loc.gps_status === 'idle' ? '#f59e0b'
        : '#6b7280'

      const icon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative">
            <div style="
              width:${isSelected ? '44px' : '36px'};
              height:${isSelected ? '44px' : '36px'};
              background:${color};
              border:${isSelected ? '3px' : '2px'} solid white;
              border-radius:50%;
              box-shadow:0 0 ${isSelected ? '16px' : '8px'} ${color};
              display:flex;align-items:center;justify-content:center;
              font-size:${isSelected ? '18px' : '14px'};
            ">🚗</div>
            ${loc.gps_status === 'moving' ? `
              <div style="
                position:absolute;bottom:-18px;left:50%;
                transform:translateX(-50%);
                background:rgba(0,0,0,0.7);color:white;
                font-size:9px;padding:1px 5px;
                border-radius:999px;white-space:nowrap;font-weight:600;
              ">${Math.round(loc.speed)} km/h</div>
            ` : ''}
          </div>
        `,
        iconSize: [isSelected ? 44 : 36, isSelected ? 44 : 36],
        iconAnchor: [isSelected ? 22 : 18, isSelected ? 22 : 18],
      })

      const marker = L.marker([loc.lat, loc.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:160px">
            <div style="font-weight:700;font-size:14px;margin-bottom:6px">${vehicle.plate_number}</div>
            <div style="color:#555;font-size:12px;margin-bottom:4px">${vehicle.model}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <div style="width:8px;height:8px;border-radius:50%;background:${color}"></div>
              <span style="font-size:12px;font-weight:600;color:${color};text-transform:capitalize">${loc.gps_status}</span>
            </div>
            ${loc.gps_status === 'moving' ? `<div style="font-size:12px">Speed: <b>${Math.round(loc.speed)} km/h</b></div>` : ''}
            <div style="font-size:11px;color:#999;margin-top:4px">Updated: ${new Date(loc.last_updated).toLocaleTimeString()}</div>
          </div>
        `)

      marker.on('click', () => setSelectedVehicle(vehicle.id))
      markersRef.current[vehicle.id] = marker
    })
  }, [locations, selectedVehicle, vehicles])

  useEffect(() => {
    if (!mapInstanceRef.current || !selectedVehicle) return
    const loc = locations[selectedVehicle]
    if (!loc) return
    mapInstanceRef.current.setView([loc.lat, loc.lng], 14, { animate: true })
  }, [selectedVehicle])

  useEffect(() => {
    if (!simulating) return
    const interval = setInterval(() => {
      setLocations(prev => {
        const updated = { ...prev }
        vehicles.forEach((v) => {
          if (!updated[v.id] || updated[v.id].gps_status === 'offline') return
          const loc = updated[v.id]
          if (loc.gps_status === 'moving') {
            const rad = (loc.heading * Math.PI) / 180
            const speed = 0.0001
            updated[v.id] = {
              ...loc,
              lat: loc.lat + Math.cos(rad) * speed,
              lng: loc.lng + Math.sin(rad) * speed,
              heading: (loc.heading + (Math.random() - 0.5) * 10) % 360,
              speed: Math.max(10, Math.min(120, loc.speed + (Math.random() - 0.5) * 10)),
              last_updated: new Date().toISOString(),
            }
          }
        })
        return updated
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [simulating, vehicles])

  const filteredVehicles = vehicles.filter((v) => {
    const loc = locations[v.id]
    if (filter === 'all') return true
    return loc?.gps_status === filter
  })

  const statusColor = (status: string) => {
    switch (status) {
      case 'moving': return 'text-green-400'
      case 'idle': return 'text-yellow-400'
      case 'offline': return 'text-gray-400'
      default: return 'text-gray-400'
    }
  }

  const statusBg = (status: string) => {
    switch (status) {
      case 'moving': return 'bg-green-500/20 border-green-500/30'
      case 'idle': return 'bg-yellow-500/20 border-yellow-500/30'
      case 'offline': return 'bg-gray-500/20 border-gray-500/30'
      default: return 'bg-gray-500/20 border-gray-500/30'
    }
  }

  const movingCount = Object.values(locations).filter(l => l.gps_status === 'moving').length
  const idleCount = Object.values(locations).filter(l => l.gps_status === 'idle').length
  const offlineCount = Object.values(locations).filter(l => l.gps_status === 'offline').length

  return (
    <div className="h-screen flex flex-col overflow-hidden -m-8">
      <div className="flex items-center gap-4 px-8 py-4 bg-gray-900 border-b border-gray-800 shrink-0 flex-wrap">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="w-px h-8 bg-gray-800" />
        <div><p className="text-xs text-gray-500 uppercase">Moving</p><p className="text-xl font-bold text-green-400">{movingCount}</p></div>
        <div className="w-px h-8 bg-gray-800" />
        <div><p className="text-xs text-gray-500 uppercase">Idle</p><p className="text-xl font-bold text-yellow-400">{idleCount}</p></div>
        <div className="w-px h-8 bg-gray-800" />
        <div><p className="text-xs text-gray-500 uppercase">Offline</p><p className="text-xl font-bold text-gray-400">{offlineCount}</p></div>
        <div className="w-px h-8 bg-gray-800" />
        <div><p className="text-xs text-gray-500 uppercase">Total</p><p className="text-xl font-bold text-white">{vehicles.length}</p></div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${simulating ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className="text-xs text-gray-400">{simulating ? 'Live' : 'Paused'}</span>
          </div>
          <button
            onClick={() => setSimulating(!simulating)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              simulating
                ? 'bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30'
                : 'bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-green-600/30'
            }`}
          >
            {simulating ? '⏸ Pause' : '▶ Start Live'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
          {loading && (
            <div className="absolute inset-0 bg-gray-950 flex items-center justify-center">
              <p className="text-gray-400">Loading map...</p>
            </div>
          )}
        </div>

        <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <p className="text-white font-semibold mb-3">Fleet Vehicles</p>
            <div className="flex gap-2 flex-wrap">
              {['all', 'moving', 'idle', 'offline'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                    filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            ) : filteredVehicles.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <p className="text-3xl mb-2">🚗</p>
                <p className="text-sm">No vehicles found</p>
              </div>
            ) : (
              filteredVehicles.map((vehicle) => {
                const loc = locations[vehicle.id]
                const isSelected = selectedVehicle === vehicle.id
                return (
                  <div
                    key={vehicle.id}
                    onClick={() => setSelectedVehicle(isSelected ? null : vehicle.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/10'
                        : `${statusBg(loc?.gps_status || 'offline')} hover:border-gray-600`
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-white font-semibold text-sm">{vehicle.plate_number}</p>
                        <p className="text-gray-400 text-xs">{vehicle.model}</p>
                      </div>
                      <span className={`text-xs font-semibold capitalize ${statusColor(loc?.gps_status || 'offline')}`}>
                        {loc?.gps_status || 'offline'}
                      </span>
                    </div>
                    {loc && (
                      <div className="space-y-1">
                        {loc.gps_status === 'moving' && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 text-xs">Speed</span>
                            <span className="text-green-400 text-xs font-semibold">{Math.round(loc.speed)} km/h</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-xs">Location</span>
                          <span className="text-gray-300 text-xs">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-xs">Updated</span>
                          <span className="text-gray-400 text-xs">{new Date(loc.last_updated).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div className="p-4 border-t border-gray-800">
            <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider">Legend</p>
            <div className="space-y-1.5">
              {[
                { color: 'bg-green-400', label: 'Moving' },
                { color: 'bg-yellow-400', label: 'Idle' },
                { color: 'bg-gray-400', label: 'Offline' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-gray-400 text-xs">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}