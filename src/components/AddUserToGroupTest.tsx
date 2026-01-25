import React from 'react'
import { UserPlus } from 'lucide-react'
import { Button, Modal, Textarea } from '@/components/ui'
import { cn } from '@/utils'

interface AddUserToGroupTestProps {
  groupName?: string
}

const AddUserToGroupTest: React.FC<AddUserToGroupTestProps> = ({ 
  groupName = "Test Group" 
}) => {
  const [showModal, setShowModal] = React.useState(false)
  const [addUserInput, setAddUserInput] = React.useState('')
  const [addUserType, setAddUserType] = React.useState<'phone' | 'userid'>('phone')
  const [loading, setLoading] = React.useState(false)

  const handleAddUsers = async () => {
    setLoading(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    console.log('Test: Adding users to group', {
      groupName,
      type: addUserType,
      input: addUserInput
    })
    
    setLoading(false)
    setShowModal(false)
    setAddUserInput('')
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 mb-4">
          Test Group Card
        </h3>
        <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
          {groupName} • 25 thành viên
        </p>
        
        <Button
          onClick={() => setShowModal(true)}
          icon={<UserPlus className="w-4 h-4" />}
          className="w-full"
        >
          Thêm thành viên
        </Button>
      </div>

      {/* Add Users Modal */}
      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false)
          setAddUserInput('')
        }}
        title="Thêm thành viên vào nhóm"
        description={`Thêm thành viên mới vào nhóm "${groupName}"`}
        size="lg"
      >
        <div className="space-y-6">
          {/* Input Type Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
              Loại dữ liệu đầu vào
            </label>
            <div className="flex space-x-1 bg-secondary-100 dark:bg-secondary-800 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setAddUserType('phone')}
                className={cn(
                  'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
                  addUserType === 'phone'
                    ? 'bg-white dark:bg-secondary-700 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-200'
                )}
              >
                Số điện thoại
              </button>
              <button
                type="button"
                onClick={() => setAddUserType('userid')}
                className={cn(
                  'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
                  addUserType === 'userid'
                    ? 'bg-white dark:bg-secondary-700 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-200'
                )}
              >
                User ID
              </button>
            </div>
          </div>

          {/* Input Field */}
          <Textarea
            label={addUserType === 'phone' ? 'Danh sách số điện thoại' : 'Danh sách User ID'}
            value={addUserInput}
            onChange={(e) => setAddUserInput(e.target.value)}
            placeholder={
              addUserType === 'phone'
                ? 'Nhập số điện thoại, mỗi số một dòng hoặc cách nhau bằng dấu phẩy:\n0901234567\n0987654321\n...'
                : 'Nhập User ID, mỗi ID một dòng hoặc cách nhau bằng dấu phẩy:\n1234567890\n9876543210\n...'
            }
            rows={8}
            required
          />

          {/* Help Text */}
          <div className="text-sm text-secondary-600 dark:text-secondary-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-xl">
            <div className="flex items-start space-x-2">
              <div className="flex-shrink-0 w-5 h-5 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">Hướng dẫn sử dụng</p>
                {addUserType === 'phone' ? (
                  <ul className="space-y-1.5 text-xs text-blue-800 dark:text-blue-200">
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Nhập số điện thoại Việt Nam (bắt đầu bằng 0 hoặc +84)</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Mỗi số điện thoại một dòng hoặc cách nhau bằng dấu phẩy, chấm phẩy</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Hệ thống sẽ tự động tìm User ID từ số điện thoại</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Chỉ thêm được những người đã là bạn bè trên Zalo</span>
                    </li>
                  </ul>
                ) : (
                  <ul className="space-y-1.5 text-xs text-blue-800 dark:text-blue-200">
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Nhập User ID (chỉ số, không có ký tự đặc biệt)</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Mỗi User ID một dòng hoặc cách nhau bằng dấu phẩy, chấm phẩy</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Có thể lấy User ID từ tính năng "Xem thành viên" của nhóm khác</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                      <span>User ID thường là dãy số dài 10-15 chữ số</span>
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-secondary-200 dark:border-secondary-700">
            <Button
              variant="outline"
              onClick={() => {
                setShowModal(false)
                setAddUserInput('')
              }}
              disabled={loading}
              className="px-6 py-2.5"
            >
              Hủy
            </Button>
            <Button
              onClick={handleAddUsers}
              loading={loading}
              icon={<UserPlus className="w-4 h-4" />}
              className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Thêm thành viên
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default AddUserToGroupTest
