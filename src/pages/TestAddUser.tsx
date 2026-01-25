import React from 'react'
import AddUserToGroupTest from '@/components/AddUserToGroupTest'

const TestAddUser: React.FC = () => {
  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-secondary-900 dark:text-secondary-100 mb-2">
            Test Tính Năng Thêm Thành Viên
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            Kiểm tra giao diện và chức năng thêm người dùng vào nhóm
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AddUserToGroupTest groupName="Nhóm Test 1" />
          <AddUserToGroupTest groupName="Nhóm Công Việc" />
          <AddUserToGroupTest groupName="Nhóm Bạn Bè" />
        </div>

        <div className="mt-12 bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">
            Hướng Dẫn Test
          </h2>
          <div className="space-y-4 text-sm text-secondary-600 dark:text-secondary-400">
            <div>
              <h3 className="font-medium text-secondary-900 dark:text-secondary-100 mb-2">
                1. Test UI Components
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Click vào button "Thêm thành viên" để mở modal</li>
                <li>Kiểm tra toggle giữa "Số điện thoại" và "User ID"</li>
                <li>Test textarea với placeholder và validation</li>
                <li>Kiểm tra responsive design trên các kích thước màn hình</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-secondary-900 dark:text-secondary-100 mb-2">
                2. Test Functionality
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Nhập dữ liệu test và click "Thêm thành viên"</li>
                <li>Kiểm tra loading state và animation</li>
                <li>Xem console log để kiểm tra dữ liệu được xử lý</li>
                <li>Test các trường hợp edge case (dữ liệu rỗng, format sai)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-secondary-900 dark:text-secondary-100 mb-2">
                3. Test Data Examples
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div>
                  <p className="font-medium mb-1">Số điện thoại:</p>
                  <pre className="bg-secondary-100 dark:bg-secondary-700 p-2 rounded text-xs">
0901234567
0987654321
+84912345678
                  </pre>
                </div>
                <div>
                  <p className="font-medium mb-1">User ID:</p>
                  <pre className="bg-secondary-100 dark:bg-secondary-700 p-2 rounded text-xs">
1234567890123
9876543210987
5555666677778
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TestAddUser
