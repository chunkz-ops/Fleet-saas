'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'

const TripMap = dynamic(() => import('@/components/ui/TripMap'), { ssr: false })

interface Trip {
  id: string
  start_location: string
  destination: string
  start_time: string
  end_time: string
  distance: number
  fuel_used: number
  status: string
  driver_id: string
  vehicle_id: string
  start_lat: number
  start_lng: number
  end_lat: number
  end_lng: number
}

interface Driver { id: string; full_name: string }
interface Vehicle { id: string; plate_number: string }

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
}

function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

export default function TripsPage() {
  const router = useRouter()
  const [trips, setTrips] = useState<Trip[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [pickingMode, setPickingMode] = useState<'start' | 'end' | null>(null)
  const [startPin, setStartPin] = useState<{ lat: number; lng: number } | null>(null)
  const [endPin, setEndPin] = useState<{ lat: number; lng: number } | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [form, setForm] = useState({
    start_location: '',
    destination: '',
    start_time: '',
    end_time: '',
    distance: '',
    fuel_used: '',
    status: 'pending',
    driver_id: '',
    vehicle_id: '',
    start_lat: '',
    start_lng: '',
    end_lat: '',
    end_lng: '',
  })

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles').select('company_id').eq('id', user.id).single()
    if (profile?.company_id) {
      setCompanyId(profile.company_id)
      fetchAll(profile.company_id)
    }
  }

  const fetchAll = async (cid: string) => {
    const [tripsRes, driversRes, vehiclesRes] = await Promise.all([
      supabase.from('trips').select('*').eq('company_id', cid).order('created_at', { ascending: false }),
      supabase.from('drivers').select('id, full_name').eq('company_id', cid),
      supabase.from('vehicles').select('id, plate_number').eq('company_id', cid),
    ])
    setTrips(tripsRes.data || [])
    setDrivers(driversRes.data || [])
    setVehicles(vehiclesRes.data || [])
    setLoading(false)
  }

  const handleMapClick = (lat: number, lng: number) => {
    if (pickingMode === 'start') {
      setStartPin({ lat, lng })
      setForm((f) => ({
        ...f,
        start_lat: lat.toFixed(6),
        start_lng: lng.toFixed(6),
      }))
      setPickingMode('end')
    } else if (pickingMode === 'end') {
      setEndPin({ lat, lng })
      const dist = calculateDistance(
        parseFloat(form.start_lat),
        parseFloat(form.start_lng),
        lat, lng
      )
      setForm((f) => ({
        ...f,
        end_lat: lat.toFixed(6),
        end_lng: lng.toFixed(6),
        distance: dist.toString(),
      }))
      setPickingMode(null)
    }
  }

  const handleAdd = async () => {
    if (!companyId) { alert('Not logged in'); return }

    const { error } = await supabase.from('trips').insert({
      start_location: form.start_location,
      destination: form.destination,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      distance: parseFloat(form.distance) || 0,
      fuel_used: parseFloat(form.fuel_used) || 0,
      status: form.status,
      driver_id: form.driver_id || null,
      vehicle_id: form.vehicle_id || null,
      company_id: companyId,
      start_lat: parseFloat(form.start_lat) || null,
      start_lng: parseFloat(form.start_lng) || null,
      end_lat: parseFloat(form.end_lat) || null,
      end_lng: parseFloat(form.end_lng) || null,
    })

    if (error) { alert('Error: ' + error.message); return }

    setShowForm(false)
    setStartPin(null)
    setEndPin(null)
    setPickingMode(null)
    setForm({
      start_location: '', destination: '', start_time: '',
      end_time: '', distance: '', fuel_used: '', status: 'pending',
      driver_id: '', vehicle_id: '', start_lat: '', start_lng: '',
      end_lat: '', end_lng: '',
    })
    fetchAll(companyId)
  }

  const handleDelete = async (id: string) => {
    const ok = window.confirm('Delete this trip?')
    if (!ok) return
    const { error } = await supabase.from('trips').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    if (selectedTrip?.id === id) setSelectedTrip(null)
    if (companyId) fetchAll(companyId)
  }

  const getDriverName = (id: string) =>
    drivers.find((d) => d.id === id)?.full_name || 'Unassigned'

  const getVehiclePlate = (id: string) =>
    vehicles.find((v) => v.id === id)?.plate_number || 'Unassigned'

  const filteredTrips = trips.filter((t) => {
    const matchStatus = filterStatus === 'all' || t.status === filterStatus
    const matchSearch =
      t.start_location?.toLowerCase().includes(search.toLowerCase()) ||
      t.destination?.toLowerCase().includes(search.toLowerCase()) ||
      getDriverName(t.driver_id)?.toLowerCase().includes(search.toLowerCase()) ||
      getVehiclePlate(t.vehicle_id)?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const stats = {
    total: trips.length,
    active: trips.filter((t) => t.status === 'active').length,
    completed: trips.filter((t) => t.status === 'completed').length,
    totalDistance: trips.reduce((sum, t) => sum + (t.distance || 0), 0),
    totalFuel: trips.reduce((sum, t) => sum + (t.fuel_used || 0), 0),
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden -m-8">
      {/* Top Stats Bar */}
      <div className="flex items-center gap-4 px-8 py-4 bg-gray-900 border-b border-gray-800 shrink-0 flex-wrap">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="w-px h-8 bg-gray-800" />
        <div><p className="text-xs text-gray-500 uppercase">Total</p><p className="text-xl font-bold text-white">{stats.total}</p></div>
        <div className="w-px h-8 bg-gray-800" />
        <div><p className="text-xs text-gray-500 uppercase">Active</p><p className="text-xl font-bold text-green-400">{stats.active}</p></div>
        <div className="w-px h-8 bg-gray-800" />
        <div><p className="text-xs text-gray-500 uppercase">Completed</p><p className="text-xl font-bold text-blue-400">{stats.completed}</p></div>
        <div className="w-px h-8 bg-gray-800" />
        <div><p className="text-xs text-gray-500 uppercase">Distance</p><p className="text-xl font-bold text-white">{stats.totalDistance.toLocaleString()} km</p></div>
        <div className="w-px h-8 bg-gray-800" />
        <div><p className="text-xs text-gray-500 uppercase">Fuel</p><p className="text-xl font-bold text-white">{stats.totalFuel.toLocaleString()} L</p></div>
        <div className="ml-auto">
          <button
            onClick={() => {
              setShowForm(!showForm)
              if (showForm) {
                setStartPin(null)
                setEndPin(null)
                setPickingMode(null)
              }
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {showForm ? 'Close Form' : '+ New Trip'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <TripMap
            trips={trips}
            selectedTrip={selectedTrip}
            onMapClick={handleMapClick}
            pickingMode={pickingMode}
            startPin={startPin}
            endPin={endPin}
          />
        </div>

        {/* Right Panel */}
        <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">

          {/* Add Trip Form */}
          {showForm && (
            <div className="p-4 border-b border-gray-800 overflow-y-auto max-h-[65vh]">
              <h3 className="text-white font-semibold mb-4">New Trip</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Start Location</label>
                    <input
                      type="text"
                      value={form.start_location}
                      onChange={(e) => setForm({ ...form, start_location: e.target.value })}
                      placeholder="Addis Ababa"
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Destination</label>
                    <input
                      type="text"
                      value={form.destination}
                      onChange={(e) => setForm({ ...form, destination: e.target.value })}
                      placeholder="Hawassa"
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600"
                    />
                  </div>
                </div>

                {/* Map Picking */}
                <div className="bg-gray-800 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-gray-400 font-medium">📍 Pick locations on the map:</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPickingMode('start')}
                      className={`flex-1 text-xs py-2 rounded-lg border transition-colors font-medium ${
                        pickingMode === 'start'
                          ? 'bg-green-600 border-green-500 text-white'
                          : startPin
                          ? 'bg-green-500/20 border-green-500/30 text-green-400'
                          : 'bg-gray-700 border-gray-600 text-gray-300 hover:text-white'
                      }`}
                    >
                      📍 {startPin ? `${startPin.lat.toFixed(3)}, ${startPin.lng.toFixed(3)}` : 'Set Start'}
                    </button>
                    <button
                      onClick={() => {
                        if (!startPin) { alert('Set start point first!'); return }
                        setPickingMode('end')
                      }}
                      className={`flex-1 text-xs py-2 rounded-lg border transition-colors font-medium ${
                        pickingMode === 'end'
                          ? 'bg-red-600 border-red-500 text-white'
                          : endPin
                          ? 'bg-red-500/20 border-red-500/30 text-red-400'
                          : 'bg-gray-700 border-gray-600 text-gray-300 hover:text-white'
                      }`}
                    >
                      🏁 {endPin ? `${endPin.lat.toFixed(3)}, ${endPin.lng.toFixed(3)}` : 'Set End'}
                    </button>
                  </div>
                  {form.distance && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                      <p className="text-blue-400 text-xs font-semibold">
                        📏 Auto distance: {form.distance} km
                      </p>
                    </div>
                  )}
                  {(startPin || endPin) && (
                    <button
                      onClick={() => {
                        setStartPin(null)
                        setEndPin(null)
                        setPickingMode(null)
                        setForm(f => ({ ...f, start_lat: '', start_lng: '', end_lat: '', end_lng: '', distance: '' }))
                      }}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Clear pins
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Driver</label>
                    <select
                      value={form.driver_id}
                      onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Select Driver</option>
                      {drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Vehicle</label>
                    <select
                      value={form.vehicle_id}
                      onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Select Vehicle</option>
                      {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Distance (km)</label>
                    <input
                      type="number"
                      value={form.distance}
                      onChange={(e) => setForm({ ...form, distance: e.target.value })}
                      placeholder="Auto calculated"
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Fuel Used (L)</label>
                    <input
                      type="number"
                      value={form.fuel_used}
                      onChange={(e) => setForm({ ...form, fuel_used: e.target.value })}
                      placeholder="30"
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Start Time</label>
                    <input
                      type="datetime-local"
                      value={form.start_time}
                      onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleAdd}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
                >
                  Save Trip
                </button>
              </div>
            </div>
          )}

          {/* Search and Filter */}
          <div className="p-4 border-b border-gray-800 shrink-0">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trips, drivers, vehicles..."
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600 mb-3"
            />
            <div className="flex gap-2 flex-wrap">
              {['all', 'active', 'pending', 'completed', 'cancelled'].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                    filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Trip Cards */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="text-center text-gray-400 py-12">Loading...</div>
            ) : filteredTrips.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <p className="text-4xl mb-3">🗺️</p>
                <p>No trips found</p>
                <p className="text-xs mt-2 text-gray-600">Click New Trip to create one</p>
              </div>
            ) : (
              filteredTrips.map((trip) => (
                <div
                  key={trip.id}
                  onClick={() => setSelectedTrip(trip.id === selectedTrip?.id ? null : trip)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedTrip?.id === trip.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-800 bg-gray-800/50 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <div className="w-px h-4 bg-gray-600" />
                      <div className="w-2 h-2 rounded-sm bg-red-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{trip.start_location || 'Unknown'}</p>
                      <p className="text-gray-400 text-xs mt-1">{trip.destination || 'Unknown'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_COLORS[trip.status] || STATUS_COLORS.cancelled}`}>
                      {trip.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>👤 {getDriverName(trip.driver_id)}</span>
                    <span>🚗 {getVehiclePlate(trip.vehicle_id)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    {trip.distance > 0 && <span>📏 {trip.distance} km</span>}
                    {trip.fuel_used > 0 && <span>⛽ {trip.fuel_used} L</span>}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(trip.id) }}
                    className="mt-3 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete trip
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}