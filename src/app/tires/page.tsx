'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Tire {
  id: string; vehicle_id: string; brand: string; size: string; position: string
  status: string; purchase_date: string; purchase_cost: number
  mileage_at_install: number; current_mileage: number; expected_lifespan: number; notes: string
}
interface Vehicle { id: string; plate_number: string; model: string }

// All 4 tires + spare in one batch form
interface TireBatchForm {
  brand: string; size: string; purchase_date: string
  purchase_cost: string; mileage_at_install: string; current_mileage: string
  expected_lifespan: string; notes: string
  positions: { [key: string]: boolean }
}

const ALL_POSITIONS = ['Front Left', 'Front Right', 'Rear Left', 'Rear Right', 'Spare']

export default function TiresPage() {
  const router = useRouter()
  const [tires, setTires] = useState<Tire[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState('')
  const [batchForm, setBatchForm] = useState<TireBatchForm>({
    brand: '', size: '', purchase_date: new Date().toISOString().split('T')[0],
    purchase_cost: '', mileage_at_install: '', current_mileage: '',
    expected_lifespan: '50000', notes: '',
    positions: { 'Front Left': true, 'Front Right': true, 'Rear Left': true, 'Rear Right': true, 'Spare': false },
  })
  const [singleForm, setSingleForm] = useState({
    vehicle_id: '', brand: '', size: '', position: 'Front Left', status: 'active',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_cost: '', mileage_at_install: '', current_mileage: '', expected_lifespan: '50000', notes: '',
  })

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    if (profile?.company_id) { setCompanyId(profile.company_id); fetchAll(profile.company_id) }
  }

  const fetchAll = async (cid: string) => {
    const [tiresRes, vehiclesRes] = await Promise.all([
      supabase.from('tires').select('*').eq('company_id', cid).order('created_at', { ascending: false }),
      supabase.from('vehicles').select('id, plate_number, model').eq('company_id', cid),
    ])
    setTires(tiresRes.data || [])
    setVehicles(vehiclesRes.data || [])
    setLoading(false)
  }

  const handleAddSingle = async () => {
    if (!companyId) { alert('No company found!'); return }
    const { error } = await supabase.from('tires').insert({
      ...singleForm, company_id: companyId,
      purchase_cost: parseFloat(singleForm.purchase_cost) || 0,
      mileage_at_install: parseFloat(singleForm.mileage_at_install) || 0,
      current_mileage: parseFloat(singleForm.current_mileage) || 0,
      expected_lifespan: parseFloat(singleForm.expected_lifespan) || 50000,
    })
    if (error) { alert('Error: ' + error.message); return }
    setShowForm(false)
    fetchAll(companyId)
  }

  const handleAddBatch = async () => {
    if (!companyId || !selectedVehicle) { alert('Please select a vehicle!'); return }
    const selectedPositions = ALL_POSITIONS.filter(p => batchForm.positions[p])
    if (selectedPositions.length === 0) { alert('Select at least one tire position!'); return }
    const inserts = selectedPositions.map(position => ({
      vehicle_id: selectedVehicle, brand: batchForm.brand, size: batchForm.size,
      position, status: 'active', purchase_date: batchForm.purchase_date,
      purchase_cost: parseFloat(batchForm.purchase_cost) || 0,
      mileage_at_install: parseFloat(batchForm.mileage_at_install) || 0,
      current_mileage: parseFloat(batchForm.current_mileage) || 0,
      expected_lifespan: parseFloat(batchForm.expected_lifespan) || 50000,
      notes: batchForm.notes, company_id: companyId,
    }))
    const { error } = await supabase.from('tires').insert(inserts)
    if (error) { alert('Error: ' + error.message); return }
    setShowForm(false)
    fetchAll(companyId)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this tire?')) return
    await supabase.from('tires').delete().eq('id', id)
    if (companyId) fetchAll(companyId)
  }

  const getVehicle = (id: string) => vehicles.find(v => v.id === id)
  const getWear = (t: Tire) => {
    if (!t.mileage_at_install || !t.current_mileage || !t.expected_lifespan) return 0
    return Math.min(100, Math.round(((t.current_mileage - t.mileage_at_install) / t.expected_lifespan) * 100))
  }
  const wearColor = (w: number) => w >= 80 ? 'text-red-400' : w >= 60 ? 'text-yellow-400' : 'text-green-400'
  const wearBg = (w: number) => w >= 80 ? 'bg-red-500' : w >= 60 ? 'bg-yellow-500' : 'bg-green-500'
  const statusColor = (s: string) => ({ active: 'bg-green-500/20 text-green-400', worn: 'bg-yellow-500/20 text-yellow-400', replaced: 'bg-gray-500/20 text-gray-400', damaged: 'bg-red-500/20 text-red-400' }[s] || 'bg-gray-500/20 text-gray-400')

  const totalCost = tires.reduce((s, t) => s + (t.purchase_cost || 0), 0)
  const wornTires = tires.filter(t => getWear(t) >= 80).length

  const filtered = tires.filter(t => {
    const v = getVehicle(t.vehicle_id)
    return (v?.plate_number?.toLowerCase().includes(search.toLowerCase()) ||
      t.brand?.toLowerCase().includes(search.toLowerCase()) ||
      t.position?.toLowerCase().includes(search.toLowerCase())) &&
      (filterStatus === 'all' || t.status === filterStatus)
  })

  // Group by vehicle for visual display
  const groupedByVehicle = vehicles.map(v => ({
    vehicle: v,
    tires: filtered.filter(t => t.vehicle_id === v.id),
  })).filter(g => g.tires.length > 0)

  const ungrouped = filtered.filter(t => !vehicles.find(v => v.id === t.vehicle_id))

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Tire Management</h1>
          <p className="text-gray-400 mt-1">Track wear, costs and replacements</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors">
          {showForm ? 'Close' : '+ Add Tire'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5"><p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Total Tires</p><p className="text-2xl font-bold text-white">{tires.length}</p></div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5"><p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Needs Replacement</p><p className="text-2xl font-bold text-red-400">{wornTires}</p><p className="text-gray-500 text-xs mt-1">80%+ wear</p></div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5"><p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Total Cost</p><p className="text-2xl font-bold text-blue-400">ETB {totalCost.toLocaleString()}</p></div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5"><p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Avg Cost</p><p className="text-2xl font-bold text-yellow-400">ETB {tires.length > 0 ? Math.round(totalCost / tires.length).toLocaleString() : 0}</p></div>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-6">
            <button onClick={() => setMode('single')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'single' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              Single Tire
            </button>
            <button onClick={() => setMode('batch')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'batch' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              All Tires at Once (Batch)
            </button>
          </div>

          {mode === 'batch' ? (
            <>
              <h2 className="text-lg font-semibold text-white mb-2">Add All Tires for a Vehicle</h2>
              <p className="text-gray-400 text-sm mb-6">Same brand/size for all selected positions — great when replacing a full set.</p>
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-1.5 block">Vehicle</label>
                <select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)}
                  className="w-full max-w-sm bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Select Vehicle</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} — {v.model}</option>)}
                </select>
              </div>
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-3 block">Select Positions</label>
                <div className="flex flex-wrap gap-3">
                  {ALL_POSITIONS.map(pos => (
                    <button key={pos} onClick={() => setBatchForm(f => ({ ...f, positions: { ...f.positions, [pos]: !f.positions[pos] } }))}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${batchForm.positions[pos] ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                      🔵 {pos}
                    </button>
                  ))}
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  {ALL_POSITIONS.filter(p => batchForm.positions[p]).length} position(s) selected
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Brand', key: 'brand', placeholder: 'Michelin, Bridgestone...' },
                  { label: 'Size', key: 'size', placeholder: '225/65R17' },
                  { label: 'Purchase Cost Each (ETB)', key: 'purchase_cost', placeholder: '3500', type: 'number' },
                  { label: 'Purchase Date', key: 'purchase_date', type: 'date' },
                  { label: 'Mileage at Install (km)', key: 'mileage_at_install', placeholder: '45000', type: 'number' },
                  { label: 'Current Mileage (km)', key: 'current_mileage', placeholder: '50000', type: 'number' },
                  { label: 'Expected Lifespan (km)', key: 'expected_lifespan', placeholder: '50000', type: 'number' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-sm text-gray-400 mb-1.5 block">{field.label}</label>
                    <input type={field.type || 'text'} value={(batchForm as any)[field.key]}
                      onChange={e => setBatchForm(f => ({ ...f, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
                  </div>
                ))}
                <div>
                  <label className="text-sm text-gray-400 mb-1.5 block">Notes</label>
                  <input type="text" value={batchForm.notes} onChange={e => setBatchForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes..." className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleAddBatch} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">
                  Save {ALL_POSITIONS.filter(p => batchForm.positions[p]).length} Tire(s)
                </button>
                <button onClick={() => setShowForm(false)} className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white mb-6">Add Single Tire</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1.5 block">Vehicle</label>
                  <select value={singleForm.vehicle_id} onChange={e => setSingleForm({ ...singleForm, vehicle_id: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Select Vehicle</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} — {v.model}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1.5 block">Position</label>
                  <select value={singleForm.position} onChange={e => setSingleForm({ ...singleForm, position: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                    {ALL_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1.5 block">Status</label>
                  <select value={singleForm.status} onChange={e => setSingleForm({ ...singleForm, status: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                    {['active', 'worn', 'replaced', 'damaged'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {[
                  { label: 'Brand', key: 'brand', placeholder: 'Michelin' },
                  { label: 'Size', key: 'size', placeholder: '225/65R17' },
                  { label: 'Purchase Cost (ETB)', key: 'purchase_cost', placeholder: '3500', type: 'number' },
                  { label: 'Purchase Date', key: 'purchase_date', type: 'date' },
                  { label: 'Mileage at Install (km)', key: 'mileage_at_install', placeholder: '45000', type: 'number' },
                  { label: 'Current Mileage (km)', key: 'current_mileage', placeholder: '50000', type: 'number' },
                  { label: 'Expected Lifespan (km)', key: 'expected_lifespan', placeholder: '50000', type: 'number' },
                  { label: 'Notes', key: 'notes', placeholder: 'Optional...', colSpan: true },
                ].map(field => (
                  <div key={field.key} className={field.colSpan ? 'md:col-span-2' : ''}>
                    <label className="text-sm text-gray-400 mb-1.5 block">{field.label}</label>
                    <input type={field.type || 'text'} value={(singleForm as any)[field.key]}
                      onChange={e => setSingleForm({ ...singleForm, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleAddSingle} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">Save Tire</button>
                <button onClick={() => setShowForm(false)} className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {wornTires > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 mb-8">
          <p className="text-red-400 font-semibold">⚠️ {wornTires} tire{wornTires > 1 ? 's' : ''} need replacement (80%+ wear)</p>
        </div>
      )}

      <div className="flex gap-4 mb-6 flex-wrap">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by vehicle, brand, position..."
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600 flex-1 min-w-48" />
        <div className="flex gap-2">
          {['all', 'active', 'worn', 'replaced', 'damaged'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="text-center text-gray-400 py-12">Loading...</div>
        : filtered.length === 0 ? (
          <div className="text-center py-16"><p className="text-5xl mb-4">🔵</p><p className="text-white font-semibold">No tires found</p><p className="text-gray-400 mt-2 text-sm">Add your first tire record!</p></div>
        ) : (
          <div className="space-y-8">
            {groupedByVehicle.map(({ vehicle, tires: vTires }) => (
              <div key={vehicle.id}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-lg">🚗</span>
                  <h2 className="text-white font-semibold">{vehicle.plate_number}</h2>
                  <span className="text-gray-500 text-sm">{vehicle.model}</span>
                  <span className="text-gray-600 text-xs bg-gray-800 px-2 py-0.5 rounded-full">{vTires.length} tire{vTires.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vTires.map(tire => {
                    const wear = getWear(tire)
                    const kmUsed = tire.current_mileage - tire.mileage_at_install
                    const kmLeft = Math.max(0, tire.expected_lifespan - kmUsed)
                    return (
                      <div key={tire.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-white font-semibold">{tire.brand || 'Unknown Brand'}</p>
                            <p className="text-gray-400 text-sm">{tire.size || 'Unknown Size'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColor(tire.status)}`}>{tire.status}</span>
                            <span className="text-blue-400 text-xs font-medium">{tire.position}</span>
                          </div>
                        </div>
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-gray-500 text-xs">Wear</span>
                            <span className={`text-xs font-bold ${wearColor(wear)}`}>{wear}%</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <div className={`h-2 rounded-full ${wearBg(wear)}`} style={{ width: `${wear}%` }} />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-gray-600 text-xs">{kmUsed.toLocaleString()} km used</span>
                            <span className="text-gray-600 text-xs">{kmLeft.toLocaleString()} km left</span>
                          </div>
                        </div>
                        <div className="space-y-1 mb-3">
                          <div className="flex justify-between"><span className="text-gray-500 text-xs">Cost</span><span className="text-white text-xs font-semibold">ETB {tire.purchase_cost?.toLocaleString()}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500 text-xs">Installed</span><span className="text-gray-300 text-xs">{tire.purchase_date || 'N/A'}</span></div>
                        </div>
                        {wear >= 80 && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 mb-3"><p className="text-red-400 text-xs font-semibold">⚠️ Needs replacement!</p></div>}
                        {wear >= 60 && wear < 80 && <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-1.5 mb-3"><p className="text-yellow-400 text-xs font-semibold">🔔 Monitor closely</p></div>}
                        <button onClick={() => handleDelete(tire.id)}
                          className="w-full text-center text-red-400 hover:text-red-300 text-xs font-medium transition-colors border border-red-500/20 rounded-lg py-1.5">Delete</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {ungrouped.length > 0 && (
              <div>
                <h2 className="text-gray-400 font-semibold mb-4">No Vehicle Assigned</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ungrouped.map(tire => {
                    const wear = getWear(tire)
                    return (
                      <div key={tire.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                        <div className="flex justify-between mb-2"><p className="text-white font-semibold">{tire.brand}</p><span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(tire.status)}`}>{tire.status}</span></div>
                        <p className="text-gray-400 text-sm mb-3">{tire.position} • {tire.size}</p>
                        <div className="w-full bg-gray-800 rounded-full h-2 mb-3"><div className={`h-2 rounded-full ${wearBg(wear)}`} style={{ width: `${wear}%` }} /></div>
                        <button onClick={() => handleDelete(tire.id)} className="w-full text-red-400 hover:text-red-300 text-xs border border-red-500/20 rounded-lg py-1.5">Delete</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  )
}