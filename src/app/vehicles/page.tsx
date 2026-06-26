'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Vehicle {
  id: string
  plate_number: string
  model: string
  year: number
  fuel_type: string
  status: string
  insurance_expiry: string
}

export default function VehiclesPage() {
  const router = useRouter()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [form, setForm] = useState({
    plate_number: '',
    model: '',
    year: '',
    fuel_type: 'petrol',
    status: 'active',
    insurance_expiry: '',
  })

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles').select('company_id').eq('id', user.id).single()
    if (profile?.company_id) {
      setCompanyId(profile.company_id)
      fetchVehicles(profile.company_id)
    }
  }

  const fetchVehicles = async (cid: string) => {
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false })
    setVehicles(data || [])
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!companyId) { alert('No company found!'); return }
    const { error } = await supabase.from('vehicles').insert({
      plate_number: form.plate_number,
      model: form.model,
      year: parseInt(form.year),
      fuel_type: form.fuel_type,
      status: form.status,
      insurance_expiry: form.insurance_expiry,
      company_id: companyId,
    })
    if (error) { alert('Error: ' + error.message); return }
    setShowForm(false)
    setForm({ plate_number: '', model: '', year: '', fuel_type: 'petrol', status: 'active', insurance_expiry: '' })
    fetchVehicles(companyId)
  }

  const handleDelete = async (id: string) => {
    const ok = window.confirm('Delete this vehicle and all its related data?')
    if (!ok) return
    const { error } = await supabase.from('vehicles').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    if (companyId) fetchVehicles(companyId)
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400'
      case 'maintenance': return 'bg-yellow-500/20 text-yellow-400'
      case 'inactive': return 'bg-gray-500/20 text-gray-400'
      case 'retired': return 'bg-red-500/20 text-red-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
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
          <h1 className="text-2xl font-bold text-white">Vehicles</h1>
          <p className="text-gray-400 mt-1">Manage your fleet vehicles</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors">
          Add Vehicle
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-6">Add New Vehicle</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Plate Number</label>
              <input type="text" value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })} placeholder="AA 12345" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Model</label>
              <input type="text" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Toyota Hilux" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Year</label>
              <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2020" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Fuel Type</label>
              <select value={form.fuel_type} onChange={(e) => setForm({ ...form, fuel_type: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                <option value="petrol">Petrol</option>
                <option value="diesel">Diesel</option>
                <option value="electric">Electric</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Insurance Expiry</label>
              <input type="date" value={form.insurance_expiry} onChange={(e) => setForm({ ...form, insurance_expiry: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">Save Vehicle</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Plate</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Model</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Year</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Fuel</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Status</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Insurance</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-12">Loading...</td></tr>
              ) : vehicles.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-12">No vehicles yet. Add your first vehicle!</td></tr>
              ) : (
                vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 text-white font-medium">{vehicle.plate_number}</td>
                    <td className="px-6 py-4 text-gray-300">{vehicle.model}</td>
                    <td className="px-6 py-4 text-gray-300">{vehicle.year}</td>
                    <td className="px-6 py-4 text-gray-300 capitalize">{vehicle.fuel_type}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColor(vehicle.status)}`}>{vehicle.status}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{vehicle.insurance_expiry}</td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleDelete(vehicle.id)} className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors">Delete</button>
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