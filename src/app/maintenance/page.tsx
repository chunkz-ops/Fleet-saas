'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface MaintenanceRecord {
  id: string; vehicle_id: string; service_type: string; cost: number
  notes: string; service_date: string; next_service_date: string
}
interface Vehicle { id: string; plate_number: string; model: string }

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4']

const DEFAULT_SERVICE_TYPES = [
  'Oil Change', 'Tire Rotation', 'Brake Service', 'Engine Repair',
  'Transmission Service', 'Battery Replacement', 'Air Filter',
  'Coolant Flush', 'Wheel Alignment', 'General Inspection',
]

export default function MaintenancePage() {
  const router = useRouter()
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [customTypes, setCustomTypes] = useState<string[]>([])
  const [newCustomType, setNewCustomType] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [form, setForm] = useState({
    vehicle_id: '', service_type: 'Oil Change', cost: '',
    notes: '', service_date: new Date().toISOString().split('T')[0], next_service_date: '',
  })

  const allServiceTypes = [...DEFAULT_SERVICE_TYPES, ...customTypes]

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    if (profile?.company_id) {
      setCompanyId(profile.company_id)
      fetchAll(profile.company_id)
      loadCustomTypes(profile.company_id)
    }
  }

  const loadCustomTypes = async (cid: string) => {
    // Store custom types in companies table or localStorage as fallback
    const stored = localStorage.getItem(`custom_service_types_${cid}`)
    if (stored) setCustomTypes(JSON.parse(stored))
  }

  const saveCustomType = () => {
    if (!newCustomType.trim() || !companyId) return
    const updated = [...customTypes, newCustomType.trim()]
    setCustomTypes(updated)
    localStorage.setItem(`custom_service_types_${companyId}`, JSON.stringify(updated))
    setForm(f => ({ ...f, service_type: newCustomType.trim() }))
    setNewCustomType('')
    setShowCustomInput(false)
  }

  const removeCustomType = (type: string) => {
    if (!companyId) return
    const updated = customTypes.filter(t => t !== type)
    setCustomTypes(updated)
    localStorage.setItem(`custom_service_types_${companyId}`, JSON.stringify(updated))
  }

  const fetchAll = async (cid: string) => {
    const [recordsRes, vehiclesRes] = await Promise.all([
      supabase.from('maintenance_records').select('*').eq('company_id', cid).order('service_date', { ascending: false }),
      supabase.from('vehicles').select('id, plate_number, model').eq('company_id', cid),
    ])
    setRecords(recordsRes.data || [])
    setVehicles(vehiclesRes.data || [])
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!companyId) { alert('No company found!'); return }
    const { error } = await supabase.from('maintenance_records').insert({
      vehicle_id: form.vehicle_id || null, service_type: form.service_type,
      cost: parseFloat(form.cost) || 0, notes: form.notes,
      service_date: form.service_date, next_service_date: form.next_service_date || null,
      company_id: companyId,
    })
    if (error) { alert('Error: ' + error.message); return }
    setShowForm(false)
    setForm({ vehicle_id: '', service_type: 'Oil Change', cost: '', notes: '', service_date: new Date().toISOString().split('T')[0], next_service_date: '' })
    fetchAll(companyId)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this record?')) return
    await supabase.from('maintenance_records').delete().eq('id', id)
    if (companyId) fetchAll(companyId)
  }

  const getVehicle = (id: string) => vehicles.find(v => v.id === id)
  const totalCost = records.reduce((s, r) => s + (r.cost || 0), 0)
  const today = new Date()
  const thisMonth = records.filter(r => { const d = new Date(r.service_date); return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear() })
  const thisMonthCost = thisMonth.reduce((s, r) => s + (r.cost || 0), 0)
  const upcoming = records.filter(r => r.next_service_date && new Date(r.next_service_date) >= today).sort((a, b) => new Date(a.next_service_date).getTime() - new Date(b.next_service_date).getTime()).slice(0, 5)
  const overdue = records.filter(r => r.next_service_date && new Date(r.next_service_date) < today)
  const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  const serviceTypeCosts = allServiceTypes.map(type => {
    const cost = records.filter(r => r.service_type === type).reduce((s, r) => s + (r.cost || 0), 0)
    return { name: type.split(' ')[0], fullName: type, cost }
  }).filter(s => s.cost > 0).sort((a, b) => b.cost - a.cost)

  const vehicleRanking = vehicles.map(v => {
    const vr = records.filter(r => r.vehicle_id === v.id)
    return { name: v.plate_number, model: v.model, cost: vr.reduce((s, r) => s + (r.cost || 0), 0), count: vr.length }
  }).filter(v => v.cost > 0).sort((a, b) => b.cost - a.cost)

  const filteredRecords = records.filter(r => {
    const vehicle = getVehicle(r.vehicle_id)
    return vehicle?.plate_number?.toLowerCase().includes(search.toLowerCase()) ||
      vehicle?.model?.toLowerCase().includes(search.toLowerCase()) ||
      r.service_type?.toLowerCase().includes(search.toLowerCase()) ||
      r.notes?.toLowerCase().includes(search.toLowerCase())
  })

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm">
        <p className="text-gray-400 mb-1">{payload[0]?.payload?.fullName}</p>
        <p className="text-white font-semibold">ETB {payload[0]?.value?.toLocaleString()}</p>
      </div>
    )
    return null
  }

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Maintenance</h1>
          <p className="text-gray-400 mt-1">Track vehicle service and repair history</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors">
          {showForm ? 'Close' : '+ Add Service'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Cost', value: `ETB ${totalCost.toLocaleString()}`, sub: 'All time', color: 'text-white' },
          { label: 'This Month', value: `ETB ${thisMonthCost.toLocaleString()}`, sub: `${thisMonth.length} services`, color: 'text-blue-400' },
          { label: 'Upcoming', value: upcoming.length, sub: 'Services due', color: 'text-yellow-400' },
          { label: 'Overdue', value: overdue.length, sub: 'Need attention', color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-gray-500 text-xs mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-6">Add Service Record</h2>

          {/* Custom Service Types Manager */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-300 font-medium">Service Types</p>
              <button onClick={() => setShowCustomInput(!showCustomInput)}
                className="text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 px-3 py-1 rounded-lg transition-colors">
                + Add Custom Type
              </button>
            </div>
            {showCustomInput && (
              <div className="flex gap-2 mb-3">
                <input type="text" value={newCustomType} onChange={e => setNewCustomType(e.target.value)}
                  placeholder="e.g. Turbo Replacement"
                  onKeyDown={e => e.key === 'Enter' && saveCustomType()}
                  className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
                <button onClick={saveCustomType} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Save</button>
                <button onClick={() => setShowCustomInput(false)} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors">Cancel</button>
              </div>
            )}
            {customTypes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customTypes.map(t => (
                  <span key={t} className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs px-2.5 py-1 rounded-full">
                    {t}
                    <button onClick={() => removeCustomType(t)} className="hover:text-red-400 transition-colors">✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Vehicle</label>
              <select value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                <option value="">Select Vehicle</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} — {v.model}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Service Type</label>
              <select value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                {allServiceTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Cost (ETB)</label>
              <input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })}
                placeholder="5000" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Service Date</label>
              <input type="date" value={form.service_date} onChange={e => setForm({ ...form, service_date: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Next Service Date</label>
              <input type="date" value={form.next_service_date} onChange={e => setForm({ ...form, next_service_date: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Any additional notes..." className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">Save Record</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {(upcoming.length > 0 || overdue.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {overdue.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
              <h3 className="text-red-400 font-semibold mb-4">⚠️ Overdue ({overdue.length})</h3>
              <div className="space-y-3">
                {overdue.slice(0, 4).map(r => {
                  const v = getVehicle(r.vehicle_id)
                  return <div key={r.id} className="flex items-center justify-between">
                    <div><p className="text-white text-sm font-medium">{v?.plate_number || 'Unknown'}</p><p className="text-gray-400 text-xs">{r.service_type}</p></div>
                    <span className="text-red-400 text-xs font-semibold">{Math.abs(daysUntil(r.next_service_date))}d overdue</span>
                  </div>
                })}
              </div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6">
              <h3 className="text-yellow-400 font-semibold mb-4">🔔 Upcoming ({upcoming.length})</h3>
              <div className="space-y-3">
                {upcoming.slice(0, 4).map(r => {
                  const v = getVehicle(r.vehicle_id)
                  const days = daysUntil(r.next_service_date)
                  return <div key={r.id} className="flex items-center justify-between">
                    <div><p className="text-white text-sm font-medium">{v?.plate_number || 'Unknown'}</p><p className="text-gray-400 text-xs">{r.service_type}</p></div>
                    <span className={`text-xs font-semibold ${days <= 7 ? 'text-red-400' : 'text-yellow-400'}`}>in {days}d</span>
                  </div>
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-6">Cost by Service Type</h2>
          {serviceTypeCosts.length === 0 ? <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No data yet</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={serviceTypeCosts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
                  {serviceTypeCosts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-6">Most Expensive Vehicles</h2>
          {vehicleRanking.length === 0 ? <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No data yet</div> : (
            <div className="space-y-4">
              {vehicleRanking.slice(0, 6).map((v, i) => (
                <div key={v.name} className="flex items-center gap-4">
                  <span className="text-gray-500 text-sm w-5">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div><span className="text-white text-sm font-medium">{v.name}</span><span className="text-gray-500 text-xs ml-2">{v.model}</span></div>
                      <span className="text-white text-sm font-semibold">ETB {v.cost.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${(v.cost / vehicleRanking[0].cost) * 100}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold">Service History</h2>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search..." className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600 w-64" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-800">
              {['Vehicle', 'Service Type', 'Service Date', 'Next Service', 'Cost (ETB)', 'Notes', 'Actions'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? <tr><td colSpan={7} className="text-center text-gray-400 py-12">Loading...</td></tr>
                : filteredRecords.length === 0 ? <tr><td colSpan={7} className="text-center py-12"><p className="text-4xl mb-3">🔧</p><p className="text-gray-400">No maintenance records yet!</p></td></tr>
                : filteredRecords.map(record => {
                  const v = getVehicle(record.vehicle_id)
                  const isOverdue = record.next_service_date && new Date(record.next_service_date) < today
                  const isDueSoon = record.next_service_date && daysUntil(record.next_service_date) <= 7 && !isOverdue
                  return (
                    <tr key={record.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4"><p className="text-white font-medium text-sm">{v?.plate_number || 'Unknown'}</p><p className="text-gray-500 text-xs">{v?.model}</p></td>
                      <td className="px-6 py-4"><span className="bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full text-xs font-medium">{record.service_type}</span></td>
                      <td className="px-6 py-4 text-gray-300 text-sm">{record.service_date}</td>
                      <td className="px-6 py-4 text-sm">
                        {record.next_service_date ? (
                          <span className={isOverdue ? 'text-red-400 font-semibold' : isDueSoon ? 'text-yellow-400 font-semibold' : 'text-gray-300'}>
                            {record.next_service_date}{isOverdue && ' ⚠️'}{isDueSoon && ' 🔔'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-4 text-white font-semibold text-sm">ETB {record.cost?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-gray-400 text-sm max-w-xs truncate">{record.notes || '—'}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => handleDelete(record.id)} className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors">Delete</button>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}