import React, { useState } from 'react'
import toast from 'react-hot-toast'

interface GroupResult {
  id: string
  name: string
  adminIds: string[]
  isAdmin: boolean
  memberCount: number
}

interface TestResult {
  success: boolean
  adminCount: number
  totalGroups: number
  testedGroups: number
  currentUserId: string
  results: GroupResult[]
  error?: string
}

const TestAdminGroups: React.FC = () => {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

  const handleTest = async () => {
    setTesting(true)
    setResult(null)
    
    try {
      const electronAPI = (window as any).electronAPI
      if (!electronAPI?.zalo?.testGroupsAdmin) {
        toast.error('Electron API không khả dụng')
        return
      }

      const testResult = await electronAPI.zalo.testGroupsAdmin()
      setResult(testResult)
      
      if (testResult.success) {
        toast.success(`Tìm thấy ${testResult.adminCount} nhóm admin`)
      } else {
        toast.error(`Lỗi: ${testResult.error}`)
      }
    } catch (error) {
      console.error('Test error:', error)
      toast.error('Có lỗi xảy ra khi test')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Test Admin Groups
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Kiểm tra xem tài khoản hiện tại là admin của bao nhiêu nhóm
        </p>
      </div>

      <div className="mb-6">
        <button
          onClick={handleTest}
          disabled={testing}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {testing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Đang kiểm tra...
            </>
          ) : (
            <>
              🔍 Kiểm tra nhóm admin
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          {result.success ? (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  🎯 Kết quả kiểm tra
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {result.adminCount}
                    </div>
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      Nhóm admin
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                      {result.testedGroups}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Nhóm đã test
                    </div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {result.totalGroups}
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-400">
                      Tổng nhóm
                    </div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                    <div className="text-sm font-mono text-purple-600 dark:text-purple-400 break-all">
                      {result.currentUserId}
                    </div>
                    <div className="text-sm text-purple-600 dark:text-purple-400">
                      User ID
                    </div>
                  </div>
                </div>
              </div>

              {result.results && result.results.length > 0 && (
                <div>
                  <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
                    📋 Chi tiết nhóm
                  </h4>
                  <div className="space-y-3">
                    {result.results.map((group) => (
                      <div
                        key={group.id}
                        className={`p-4 rounded-lg border ${
                          group.isAdmin
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h5 className="font-semibold text-gray-900 dark:text-white">
                                {group.name}
                              </h5>
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  group.isAdmin
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                    : 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-300'
                                }`}
                              >
                                {group.isAdmin ? '✅ ADMIN' : '❌ Không phải admin'}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                              <div>ID: <code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">{group.id}</code></div>
                              <div>Thành viên: {group.memberCount}</div>
                              <div>Admin IDs: [{group.adminIds.join(', ')}]</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-red-500 text-lg mb-2">❌ Lỗi</div>
              <div className="text-gray-600 dark:text-gray-400">{result.error}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TestAdminGroups
