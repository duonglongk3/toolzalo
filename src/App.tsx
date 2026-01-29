import React from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { LicenseProvider } from '@/contexts/LicenseContext'
import { I18nProvider } from '@/i18n'
import LicenseGuard from '@/components/LicenseGuard'
import UpdateNotification from '@/components/UpdateNotification'

// Direct imports for debugging (temporary)
import Dashboard from '@/pages/Dashboard'
import Accounts from '@/pages/Accounts'
import Friends from '@/pages/Friends'
import PersonalMessages from '@/pages/PersonalMessages'
import Groups from '@/pages/Groups'
import GroupMessages from '@/pages/GroupMessages'
import Settings from '@/pages/Settings'
import TestAddUser from '@/pages/TestAddUser'
import TestAdminGroups from '@/pages/TestAdminGroups'
import ActiveKey from '@/pages/ActiveKey'

// Loading component
const PageLoader: React.FC = () => {
  console.log('🔥 PageLoader rendered - loading page...')
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 bg-primary-600 rounded-full animate-pulse"></div>
        <div className="w-4 h-4 bg-primary-600 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-4 h-4 bg-primary-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </div>
  )
}

// Placeholder components for routes that will be implemented later
const PlaceholderPage: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="p-6">
    <div className="max-w-2xl mx-auto text-center py-12">
      <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-secondary-900 mb-2">{title}</h1>
      <p className="text-secondary-600 mb-6">{description}</p>
      <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
        <p className="text-warning-800 text-sm">
          🚧 Tính năng này đang được phát triển và sẽ sớm có mặt trong phiên bản tiếp theo.
        </p>
      </div>
    </div>
  </div>
)

const App: React.FC = () => {
  return (
    <I18nProvider>
      <LicenseProvider>
        <Router>
        <div className="App">
          <Routes>
            {/* License activation page - accessible without license */}
            <Route path="/activate" element={<ActiveKey />} />
            
            {/* Protected routes - require valid license */}
            <Route path="/" element={
              <LicenseGuard>
                <Layout />
              </LicenseGuard>
            }>
              <Route index element={<Dashboard />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="friends" element={<Friends />} />
              <Route path="personal-messages" element={<PersonalMessages />} />
              <Route path="groups" element={<Groups />} />
              <Route path="group-messages" element={<GroupMessages />} />
              <Route path="settings" element={<Settings />} />
              <Route path="test-add-user" element={<TestAddUser />} />
              <Route path="test-admin" element={<TestAdminGroups />} />
              {/* Redirect unknown routes to dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          
          {/* Update notification popup */}
          <UpdateNotification />
        </div>
        </Router>
      </LicenseProvider>
    </I18nProvider>
  )
}

export default App
