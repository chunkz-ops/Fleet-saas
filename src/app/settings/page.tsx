'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profileForm, setProfileForm] = useState({ full_name: '' })
  const [companyForm, setCompanyForm] = useState({ name: '' })
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchProfile() }, [])

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileData) {
      setProfile(profileData)
      setProfileForm({ full_name: profileData.full_name || '' })

      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profileData.company_id)
        .single()

      if (companyData) {
        setCompany(companyData)
        setCompanyForm({ name: companyData.name || '' })
      }
    }
    setLoading(false)
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: profileForm.full_name })
      .eq('id', user.id)

    if (error) { alert('Error saving: ' + error.message); setSaving(false); return }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleSaveCompany = async () => {
    setSaving(true)
    if (!company) return

    const { error } = await supabase
      .from('companies')
      .update({ name: companyForm.name })
      .eq('id', company.id)

    if (error) { alert('Error saving: ' + error.message); setSaving(false); return }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleChangePassword = async () => {
    setPasswordError('')
    if (passwordForm.password !== passwordForm.confirm) {
      setPasswordError('Passwords do not match')
      return
    }
    if (passwordForm.password.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: passwordForm.password
    })

    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordSaved(true)
      setPasswordForm({ password: '', confirm: '' })
      setTimeout(() => setPasswordSaved(false), 3000)
    }
  }

  const handleDeleteAccount = async () => {
    const confirm1 = window.confirm('Are you sure you want to delete your account? This cannot be undone!')
    if (!confirm1) return
    const confirm2 = window.confirm('This will delete ALL your data including vehicles, drivers, trips and fuel logs. Are you absolutely sure?')
    if (!confirm2) return

    setDeleting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (profileData?.company_id) {
        const companyId = profileData.company_id

        await supabase.from('fuel_logs').delete().eq('company_id', companyId)
        await supabase.from('maintenance_records').delete().eq('company_id', companyId)
        await supabase.from('trips').delete().eq('company_id', companyId)
        await supabase.from('drivers').delete().eq('company_id', companyId)
        await supabase.from('vehicles').delete().eq('company_id', companyId)
        await supabase.from('profiles').delete().eq('id', user.id)
        await supabase.from('companies').delete().eq('id', companyId)
      }

      await supabase.auth.signOut()
      router.push('/signup')

    } catch (err: any) {
      alert('Error deleting account: ' + err.message)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account and company settings</p>
      </div>

      {saved && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl px-4 py-3 mb-6 text-sm">
          Changes saved successfully!
        </div>
      )}

      {/* Profile Settings */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Profile</h2>
        <p className="text-gray-400 text-sm mb-6">Update your personal information</p>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Full Name</label>
            <input
              type="text"
              value={profileForm.full_name}
              onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Role</label>
            <div className="w-full bg-gray-800 border border-gray-700 text-gray-400 rounded-lg px-4 py-3 text-sm capitalize">
              {profile?.role?.replace('_', ' ')}
            </div>
          </div>
        </div>
        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="mt-6 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {/* Company Settings */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Company</h2>
        <p className="text-gray-400 text-sm mb-6">Update your company information</p>
        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">Company Name</label>
          <input
            type="text"
            value={companyForm.name}
            onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={handleSaveCompany}
          disabled={saving}
          className="mt-6 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          {saving ? 'Saving...' : 'Save Company'}
        </button>
      </div>

      {/* Change Password */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Change Password</h2>
        <p className="text-gray-400 text-sm mb-6">Update your account password</p>

        {passwordError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 mb-4 text-sm">
            {passwordError}
          </div>
        )}
        {passwordSaved && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl px-4 py-3 mb-4 text-sm">
            Password changed successfully!
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">New Password</label>
            <input
              type="password"
              value={passwordForm.password}
              onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
              placeholder="At least 6 characters"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Confirm Password</label>
            <input
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              placeholder="Repeat your password"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600"
            />
          </div>
        </div>
        <button
          onClick={handleChangePassword}
          className="mt-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          Change Password
        </button>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h2>
        <p className="text-gray-400 text-sm mb-6">These actions are irreversible</p>
        <div className="space-y-4">
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors text-left"
          >
            Sign Out
          </button>
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="w-full bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 border border-red-500/30 text-red-400 font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors text-left"
          >
            {deleting ? 'Deleting everything...' : 'Delete Account and All Data'}
          </button>
        </div>
      </div>
    </div>
  )
}