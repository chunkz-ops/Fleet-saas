'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'

interface FuelLog {
  id: string
  vehicle_id: string
  driver_id: string
  liters: number
  cost: number
  mileage: number
  fuel_station: string
  date: string
}

interface Vehicle { id: string; plate_number: string; model: string }
interface Driver { id: string; full_name: string }

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4']

export default function FuelPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<FuelLog[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [form, setForm] = useState({
    vehicle_id: '',
    driver_id: '',
    liters: '',
    cost: '',
    mileage: '',
    fuel_station: '',
    date: new Date().toISOString().split('T')[0],
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
    const [logsRes, vehiclesRes, driversRes] = await Promise.all([
      supabase.from('fuel_logs').select('*').eq('company_id', cid).order('date', { ascending: false }),
      supabase.from('vehicles').select('id, plate_number, model').eq('company_id', cid),
      supabase.from('drivers').select('id, full_name').eq('company_id', cid),
    ])
    setLogs(logsRes.data || [])
    setVehicles(vehiclesRes.data || [])
    setDrivers(driversRes.data || [])
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!companyId) { alert('No company found!'); return }
    const { error } = await supabase.from('fuel_logs').insert({
      vehicle_id: form.vehicle_id || null,
      driver_id: form.driver_id || null,
      liters: parseFloat(form.liters) || 0,
      cost: parseFloat(form.cost) || 0,
      mileage: parseFloat(form.mileage) || 0,
      fuel_station: form.fuel_station,
      date: form.date,
      company_id: companyId,
    })
    if (error) { alert('Error: ' + error.message); return }
    setShowForm(false)
    setForm({ vehicle_id: '', driver_id: '', liters: '', cost: '', mileage: '', fuel_station: '', date: new Date().toISOString().split('T')[0] })
    fetchAll(companyId)
  }

  const handleDelete = async (id: string) => {
    const ok = window.confirm('Delete this fuel log?')
    if (!ok) return
    const { error } = await supabase.from('fuel_logs').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    if (companyId) fetchAll(companyId)
  }

  const getVehicle = (id: string) => vehicles.find((v) => v.id === id)
  const getDriverName = (id: string) => drivers.find((d) => d.id === id)?.full_name || 'Unknown'

  const totalCost = logs.reduce((s, l) => s + (l.cost || 0), 0)
  const totalLiters = logs.reduce((s, l) => s + (l.liters || 0), 0)
  const avgCostPerLiter = totalLiters > 0 ? totalCost / totalLiters : 0

  const trendData = logs
    .reduce((acc: any[], log) => {
      const date = log.date?.split('T')[0] || log.date
      const existing = acc.find((d) => d.date === date)
      if (existing) { existing.cost += log.cost || 0; existing.liters += log.liters || 0 }
      else acc.push({ date, cost: log.cost || 0, liters: log.liters || 0 })
      return acc
    }, [])
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)

  const vehicleRanking = vehicles.map((v) => {
    const vLogs = logs.filter((l) => l.vehicle_id === v.id)
    return {
      name: v.plate_number,
      model: v.model,
      cost: vLogs.reduce((s, l) => s + (l.cost || 0), 0),
      liters: vLogs.reduce((s, l) => s + (l.liters || 0), 0),
    }
  }).filter((v) => v.cost > 0).sort((a, b) => b.cost - a.cost)

  const mostExpensive = vehicleRanking[0]

  const filteredLogs = logs.filter((l) => {
    const vehicle = getVehicle(l.vehicle_id)
    return (
      vehicle?.plate_number?.toLowerCase().includes(search.toLowerCase()) ||
      vehicle?.model?.toLowerCase().includes(search.toLowerCase()) ||
      l.fuel_station?.toLowerCase().includes(search.toLowerCase()) ||
      getDriverName(l.driver_id)?.toLowerCase().includes(search.toLowerCase())
    )
  })

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm">
          <p className="text-gray-400 mb-2">{label}</p>
          {payload.map((p: any) => (
            <p key={p.name} style={{ color: p.color }} className="font-semibold">
              {p.name === 'cost' ? `ETB ${p.value.toLocaleString()}` : `${p.value.toFixed(1)} L`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Fuel Management</h1>
          <p className="text-gray-400 mt-1">Track and analyze your fleet fuel consumption</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors">
          {showForm ? 'Close' : '+ Log Fuel'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Total Cost</p>
          <p className="text-2xl font-bold text-white">ETB {totalCost.toLocaleString()}</p>
          <p className="text-gray-500 text-xs mt-1">All time</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Total Liters</p>
          <p className="text-2xl font-bold text-blue-400">{totalLiters.toLocaleString()} L</p>
          <p className="text-gray-500 text-xs mt-1">Consumed</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Avg Cost/Liter</p>
          <p className="text-2xl font-bold text-yellow-400">ETB {avgCostPerLiter.toFixed(2)}</p>
          <p className="text-gray-500 text-xs mt-1">Per liter</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Most Expensive</p>
          <p className="text-2xl font-bold text-red-400">{mostExpensive?.name || 'N/A'}</p>
          <p className="text-gray-500 text-xs mt-1">{mostExpensive ? `ETB ${mostExpensive.cost.toLocaleString()}` : 'No data'}</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-6">Log Fuel Entry</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Vehicle</label>
              <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                <option value="">Select Vehicle</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_number} — {v.model}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Driver</label>
              <select value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                <option value="">Select Driver</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Fuel Station</label>
              <input type="text" value={form.fuel_station} onChange={(e) => setForm({ ...form, fuel_station: e.target.value })} placeholder="Total, NOC, Oilibya..." className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Liters</label>
              <input type="number" value={form.liters} onChange={(e) => setForm({ ...form, liters: e.target.value })} placeholder="50" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Total Cost (ETB)</label>
              <input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="3500" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Mileage (km)</label>
              <input type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} placeholder="45000" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">Save Fuel Log</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-6">Fuel Cost Trend</h2>
          {trendData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} name="cost" />
                <Line type="monotone" dataKey="liters" stroke="#22c55e" strokeWidth={2.5} dot={{ fill: '#22c55e', r: 4 }} name="liters" />
              </LineChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-xs text-gray-400">Cost (ETB)</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /><span className="text-xs text-gray-400">Liters</span></div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-6">Cost by Vehicle</h2>
          {vehicleRanking.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={vehicleRanking} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
                <Tooltip formatter={(v: any) => [`ETB ${v.toLocaleString()}`, 'Cost']} contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                <Bar dataKey="cost" radius={[0, 6, 6, 0]}>
                  {vehicleRanking.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold">Fuel Logs</h2>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by vehicle, driver, station..." className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600 w-72" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Date</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Vehicle</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Driver</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Station</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Liters</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Cost (ETB)</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">ETB/L</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Mileage</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr><td colSpan={9} className="text-center text-gray-400 py-12">Loading...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12"><p className="text-4xl mb-3">⛽</p><p className="text-gray-400">No fuel logs yet!</p></td></tr>
              ) : (
                filteredLogs.map((log) => {
                  const vehicle = getVehicle(log.vehicle_id)
                  const costPerLiter = log.liters > 0 ? log.cost / log.liters : 0
                  const isExpensive = costPerLiter > avgCostPerLiter * 1.2
                  return (
                    <tr key={log.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 text-gray-300 text-sm">{log.date}</td>
                      <td className="px-6 py-4">
                        <p className="text-white font-medium text-sm">{vehicle?.plate_number || 'Unknown'}</p>
                        <p className="text-gray-500 text-xs">{vehicle?.model}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-300 text-sm">{getDriverName(log.driver_id)}</td>
                      <td className="px-6 py-4 text-gray-300 text-sm">{log.fuel_station || '—'}</td>
                      <td className="px-6 py-4 text-gray-300 text-sm">{log.liters} L</td>
                      <td className="px-6 py-4 text-white font-semibold text-sm">ETB {log.cost?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={isExpensive ? 'text-red-400 font-semibold' : 'text-gray-300'}>
                          {costPerLiter.toFixed(2)}{isExpensive && ' ⚠️'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-300 text-sm">{log.mileage ? `${log.mileage.toLocaleString()} km` : '—'}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => handleDelete(log.id)} className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors">Delete</button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}