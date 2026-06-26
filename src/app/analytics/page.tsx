'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4']

export default function AnalyticsPage() {
  const router = useRouter()
  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [trips, setTrips] = useState<any[]>([])
  const [fuelLogs, setFuelLogs] = useState<any[]>([])
  const [maintenance, setMaintenance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

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
    const [v, d, t, f, m] = await Promise.all([
      supabase.from('vehicles').select('*').eq('company_id', cid),
      supabase.from('drivers').select('*').eq('company_id', cid),
      supabase.from('trips').select('*').eq('company_id', cid),
      supabase.from('fuel_logs').select('*').eq('company_id', cid),
      supabase.from('maintenance_records').select('*').eq('company_id', cid),
    ])
    setVehicles(v.data || [])
    setDrivers(d.data || [])
    setTrips(t.data || [])
    setFuelLogs(f.data || [])
    setMaintenance(m.data || [])
    setLoading(false)
  }

  const totalFuelCost = fuelLogs.reduce((s, l) => s + (l.cost || 0), 0)
  const totalMaintenanceCost = maintenance.reduce((s, r) => s + (r.cost || 0), 0)
  const totalOperationalCost = totalFuelCost + totalMaintenanceCost
  const totalDistance = trips.reduce((s, t) => s + (t.distance || 0), 0)
  const costPerKm = totalDistance > 0 ? totalOperationalCost / totalDistance : 0
  const fleetUtilization = vehicles.length > 0
    ? Math.round((vehicles.filter(v => v.status === 'active').length / vehicles.length) * 100)
    : 0

  const fuelTrend = fuelLogs
    .reduce((acc: any[], log) => {
      const date = log.date?.split('T')[0] || log.date
      const existing = acc.find((d) => d.date === date)
      if (existing) { existing.cost += log.cost || 0; existing.liters += log.liters || 0 }
      else acc.push({ date, cost: log.cost || 0, liters: log.liters || 0 })
      return acc
    }, [])
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)

  const tripStatusData = [
    { name: 'Completed', value: trips.filter(t => t.status === 'completed').length },
    { name: 'Active', value: trips.filter(t => t.status === 'active').length },
    { name: 'Pending', value: trips.filter(t => t.status === 'pending').length },
    { name: 'Cancelled', value: trips.filter(t => t.status === 'cancelled').length },
  ].filter(d => d.value > 0)

  const vehicleStatusData = [
    { name: 'Active', value: vehicles.filter(v => v.status === 'active').length },
    { name: 'Maintenance', value: vehicles.filter(v => v.status === 'maintenance').length },
    { name: 'Inactive', value: vehicles.filter(v => v.status === 'inactive').length },
    { name: 'Retired', value: vehicles.filter(v => v.status === 'retired').length },
  ].filter(d => d.value > 0)

  const driverRanking = drivers.map((d) => {
    const driverTrips = trips.filter(t => t.driver_id === d.id)
    const driverFuel = fuelLogs.filter(f => f.driver_id === d.id)
    return {
      name: d.full_name,
      trips: driverTrips.length,
      distance: driverTrips.reduce((s, t) => s + (t.distance || 0), 0),
      fuel: driverFuel.reduce((s, f) => s + (f.liters || 0), 0),
    }
  }).filter(d => d.trips > 0).sort((a, b) => b.trips - a.trips)

  const monthlyCosts = Array.from({ length: 6 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (5 - i))
    const month = date.toLocaleString('default', { month: 'short' })
    const year = date.getFullYear()
    const monthNum = date.getMonth()
    const fuel = fuelLogs.filter(l => {
      const d = new Date(l.date)
      return d.getMonth() === monthNum && d.getFullYear() === year
    }).reduce((s, l) => s + (l.cost || 0), 0)
    const maint = maintenance.filter(r => {
      const d = new Date(r.service_date)
      return d.getMonth() === monthNum && d.getFullYear() === year
    }).reduce((s, r) => s + (r.cost || 0), 0)
    return { month, fuel, maintenance: maint, total: fuel + maint }
  })

  const vehicleCostRanking = vehicles.map((v) => {
    const vFuel = fuelLogs.filter(f => f.vehicle_id === v.id).reduce((s, f) => s + (f.cost || 0), 0)
    const vMaint = maintenance.filter(m => m.vehicle_id === v.id).reduce((s, m) => s + (m.cost || 0), 0)
    return { name: v.plate_number, model: v.model, fuel: vFuel, maintenance: vMaint, total: vFuel + vMaint }
  }).filter(v => v.total > 0).sort((a, b) => b.total - a.total)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm">
          <p className="text-gray-400 mb-2">{label}</p>
          {payload.map((p: any) => (
            <p key={p.name} style={{ color: p.color }} className="font-semibold">
              {p.name}: ETB {p.value?.toLocaleString()}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 mt-1">Full operational overview of your fleet</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Total Operational Cost</p>
          <p className="text-2xl font-bold text-white">ETB {totalOperationalCost.toLocaleString()}</p>
          <div className="flex gap-3 mt-2">
            <span className="text-xs text-blue-400">⛽ ETB {totalFuelCost.toLocaleString()}</span>
            <span className="text-xs text-yellow-400">🔧 ETB {totalMaintenanceCost.toLocaleString()}</span>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Cost Per KM</p>
          <p className="text-2xl font-bold text-blue-400">ETB {costPerKm.toFixed(2)}</p>
          <p className="text-gray-500 text-xs mt-1">{totalDistance.toLocaleString()} km total</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Fleet Utilization</p>
          <p className="text-2xl font-bold text-green-400">{fleetUtilization}%</p>
          <p className="text-gray-500 text-xs mt-1">{vehicles.filter(v => v.status === 'active').length} of {vehicles.length} active</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Total Trips</p>
          <p className="text-2xl font-bold text-purple-400">{trips.length}</p>
          <p className="text-gray-500 text-xs mt-1">{trips.filter(t => t.status === 'completed').length} completed</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
        <h2 className="text-white font-semibold mb-6">Monthly Cost Breakdown</h2>
        {monthlyCosts.every(m => m.total === 0) ? (
          <div className="flex items-center justify-center h-48 text-gray-500">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyCosts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(value) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{value}</span>} />
              <Bar dataKey="fuel" name="Fuel" stackId="a" fill="#3b82f6" />
              <Bar dataKey="maintenance" name="Maintenance" stackId="a" fill="#eab308" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-6">Fuel Cost Trend</h2>
          {fuelTrend.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={fuelTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="cost" name="Cost" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-6">Trip Status</h2>
          {tripStatusData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500">No trips yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={tripStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {tripStatusData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {tripStatusData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[index] }} />
                      <span className="text-gray-400 text-xs">{item.name}</span>
                    </div>
                    <span className="text-white text-xs font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-6">Vehicle Status</h2>
          {vehicleStatusData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500">No vehicles yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={vehicleStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {vehicleStatusData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {vehicleStatusData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[index] }} />
                      <span className="text-gray-400 text-xs">{item.name}</span>
                    </div>
                    <span className="text-white text-xs font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-6">Driver Rankings</h2>
          {driverRanking.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm text-center">No driver trip data yet</div>
          ) : (
            <div className="space-y-4">
              {driverRanking.slice(0, 6).map((d, index) => (
                <div key={d.name} className="flex items-center gap-4">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                    index === 1 ? 'bg-gray-400/20 text-gray-400' :
                    index === 2 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-gray-800 text-gray-500'
                  }`}>{index + 1}</div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{d.name}</p>
                    <p className="text-gray-500 text-xs">{d.trips} trips · {d.distance.toLocaleString()} km</p>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-400 text-sm font-semibold">{d.trips} trips</p>
                    <p className="text-gray-500 text-xs">{d.fuel.toFixed(0)} L</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-white font-semibold">Vehicle Cost Analysis</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Vehicle</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Fuel Cost</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Maintenance Cost</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Total Cost</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Cost Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {vehicleCostRanking.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-gray-400 py-12">No cost data yet</td></tr>
              ) : (
                vehicleCostRanking.map((v, index) => (
                  <tr key={v.name} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-white font-medium">{v.name}</p>
                      <p className="text-gray-500 text-xs">{v.model}</p>
                    </td>
                    <td className="px-6 py-4 text-blue-400 font-medium">ETB {v.fuel.toLocaleString()}</td>
                    <td className="px-6 py-4 text-yellow-400 font-medium">ETB {v.maintenance.toLocaleString()}</td>
                    <td className="px-6 py-4 text-white font-bold">ETB {v.total.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-800 rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${(v.total / vehicleCostRanking[0].total) * 100}%`, background: COLORS[index % COLORS.length] }} />
                        </div>
                        <span className="text-gray-400 text-xs w-10">
                          {totalOperationalCost > 0 ? Math.round((v.total / totalOperationalCost) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}