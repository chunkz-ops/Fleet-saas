'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignup = async () => {
    setLoading(true)
    setError('')

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      })

      if (signupError) throw signupError
      if (!data.user) throw new Error('No user returned')

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({ name: companyName })
        .select()
        .single()

      if (companyError) throw companyError

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          full_name: fullName,
          role: 'super_admin',
          company_id: company.id
        })

      if (profileError) throw profileError

      router.push('/dashboard')

    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">FleetSync</h1>
          <p className="text-gray-400 mt-1 text-sm">Fleet Management Platform</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Create your account</h2>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-1.5 block">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Abebe Kebede"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600"
            />
          </div>
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-1.5 block">Company name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Addis Transport PLC"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600"
            />
          </div>
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-1.5 block">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600"
            />
          </div>
          <div className="mb-6">
            <label className="text-sm text-gray-400 mb-1.5 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600"
            />
          </div>
          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-3 text-sm transition-colors duration-200"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
          <p className="text-center text-gray-500 text-sm mt-6">
            Already have an account?{' '}
            <a href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}