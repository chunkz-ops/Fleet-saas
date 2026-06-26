'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Driver {
  id: string
  full_name: string
  phone: string
  license_number: string
  license_expiry: string
  status: string
  photo_url: string
  id_photo_url: string
}

const BLANK_FORM = {
  full_name: '', phone: '', license_number: '',
  license_expiry: '', status: 'active', photo_url: '', id_photo_url: '',
}

export default function DriversPage() {
  const router = useRouter()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadingId, setUploadingId] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [form, setForm] = useState(BLANK_FORM)
  const [search, setSearch] = useState('')

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles').select('company_id').eq('id', user.id).single()
    if (profile?.company_id) {
      setCompanyId(profile.company_id)
      fetchDrivers(profile.company_id)
    }
  }

  const fetchDrivers = async (cid: string) => {
    const { data } = await supabase
      .from('drivers').select('*').eq('company_id', cid)
      .order('created_at', { ascending: false })
    setDrivers(data || [])
    setLoading(false)
  }

  const openEdit = (driver: Driver) => {
    setEditingDriver(driver)
    setForm({
      full_name: driver.full_name || '',
      phone: driver.phone || '',
      license_number: driver.license_number || '',
      license_expiry: driver.license_expiry || '',
      status: driver.status || 'active',
      photo_url: driver.photo_url || '',
      id_photo_url: driver.id_photo_url || '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingDriver(null)
    setForm(BLANK_FORM)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'id') => {
    const file = e.target.files?.[0]
    if (!file) return
    type === 'photo' ? setUploading(true) : setUploadingId(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random()}.${fileExt}`
    const filePath = `${type === 'photo' ? 'driver-photos' : 'driver-ids'}/${fileName}`
    const { error: uploadError } = await supabase.storage.from('fleet-media').upload(filePath, file)
    if (uploadError) {
      alert('Error uploading: ' + uploadError.message)
      type === 'photo' ? setUploading(false) : setUploadingId(false)
      return
    }
    const { data } = supabase.storage.from('fleet-media').getPublicUrl(filePath)
    if (type === 'photo') { setForm(f => ({ ...f, photo_url: data.publicUrl })); setUploading(false) }
    else { setForm(f => ({ ...f, id_photo_url: data.publicUrl })); setUploadingId(false) }
  }

  const handleSave = async () => {
    if (!companyId) { alert('No company found!'); return }
    if (editingDriver) {
      const { error } = await supabase.from('drivers').update({
        full_name: form.full_name, phone: form.phone,
        license_number: form.license_number, license_expiry: form.license_expiry,
        status: form.status, photo_url: form.photo_url, id_photo_url: form.id_photo_url,
      }).eq('id', editingDriver.id)
      if (error) { alert('Error: ' + error.message); return }
    } else {
      const { error } = await supabase.from('drivers').insert({
        ...form, company_id: companyId,
      })
      if (error) { alert('Error: ' + error.message); return }
    }
    closeForm()
    fetchDrivers(companyId)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this driver? This cannot be undone.')) return
    await supabase.from('drivers').delete().eq('id', id)
    if (companyId) fetchDrivers(companyId)
  }

  const statusColor = (s: string) =>
    s === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'

  const filtered = drivers.filter(d =>
    d.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.phone?.toLowerCase().includes(search.toLowerCase()) ||
    d.license_number?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Drivers</h1>
          <p className="text-gray-400 mt-1">Manage your fleet drivers</p>
        </div>
        <button onClick={() => { closeForm(); setShowForm(true) }}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors">
          + Add Driver
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-blue-500/30 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-6">
            {editingDriver ? `Edit — ${editingDriver.full_name}` : 'Add New Driver'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Profile Photo */}
            <div>
              <label className="text-sm text-gray-400 mb-3 block">Profile Photo</label>
              <div className="flex items-center gap-4">
                {form.photo_url ? (
                  <div className="relative">
                    <img src={form.photo_url} alt="Driver" className="w-20 h-20 rounded-full object-cover border-2 border-gray-700" />
                    <button onClick={() => setForm(f => ({ ...f, photo_url: '' }))}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">✕</button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <label className="cursor-pointer bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors block text-center">
                  {uploading ? 'Uploading...' : form.photo_url ? 'Change Photo' : 'Upload Photo'}
                  <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'photo')} className="hidden" />
                </label>
              </div>
            </div>
            {/* ID Photo */}
            <div>
              <label className="text-sm text-gray-400 mb-3 block">ID / License Photo</label>
              <div className="flex items-center gap-4">
                {form.id_photo_url ? (
                  <div className="relative">
                    <img src={form.id_photo_url} alt="ID" className="w-28 h-20 rounded-lg object-cover border-2 border-gray-700 cursor-pointer"
                      onClick={() => window.open(form.id_photo_url, '_blank')} />
                    <button onClick={() => setForm(f => ({ ...f, id_photo_url: '' }))}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">✕</button>
                  </div>
                ) : (
                  <div className="w-28 h-20 rounded-lg bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                  </div>
                )}
                <label className="cursor-pointer bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors block text-center">
                  {uploadingId ? 'Uploading...' : form.id_photo_url ? 'Change ID' : 'Upload ID'}
                  <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'id')} className="hidden" />
                </label>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Full Name</label>
              <input type="text" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="Abebe Kebede" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Phone Number</label>
              <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+251 91 234 5678" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">License Number</label>
              <input type="text" value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })}
                placeholder="ETH-123456" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">License Expiry</label>
              <input type="date" value={form.license_expiry} onChange={e => setForm({ ...form, license_expiry: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">
              {editingDriver ? 'Save Changes' : 'Save Driver'}
            </button>
            <button onClick={closeForm}
              className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search drivers by name, phone, license..."
          className="w-full max-w-md bg-gray-900 border border-gray-800 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600" />
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <p className="text-4xl mb-3">👤</p>
          <p>{search ? 'No drivers match your search.' : 'No drivers yet. Add your first driver!'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((driver) => (
            <div key={driver.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-4">
                {driver.photo_url ? (
                  <img src={driver.photo_url} alt={driver.full_name} className="w-16 h-16 rounded-full object-cover border-2 border-gray-700" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center">
                    <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-white font-semibold">{driver.full_name}</h3>
                  <p className="text-gray-400 text-sm">{driver.phone}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColor(driver.status)}`}>
                  {driver.status}
                </span>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">License</span>
                  <span className="text-gray-300 text-xs font-medium">{driver.license_number || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">Expires</span>
                  <span className={`text-xs font-medium ${driver.license_expiry && new Date(driver.license_expiry) < new Date() ? 'text-red-400' : 'text-gray-300'}`}>
                    {driver.license_expiry || 'N/A'}
                  </span>
                </div>
              </div>
              {driver.id_photo_url && (
                <div className="mb-4">
                  <p className="text-gray-500 text-xs mb-2">ID / License Photo</p>
                  <img src={driver.id_photo_url} alt="ID"
                    className="w-full h-24 object-cover rounded-lg border border-gray-700 cursor-pointer hover:opacity-90"
                    onClick={() => window.open(driver.id_photo_url, '_blank')} />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => openEdit(driver)}
                  className="flex-1 text-center text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors border border-blue-500/20 hover:border-blue-500/40 rounded-lg py-2">
                  Edit
                </button>
                <button onClick={() => handleDelete(driver.id)}
                  className="flex-1 text-center text-red-400 hover:text-red-300 text-sm font-medium transition-colors border border-red-500/20 hover:border-red-500/40 rounded-lg py-2">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}