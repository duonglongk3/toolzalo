// Test script để kiểm tra UI buttons trong Electron DevTools Console

console.log('🔥 Starting UI Button Test...')

// Test 1: Kiểm tra các button trong header có tồn tại không
setTimeout(() => {
  console.log('🔥 Test 1: Checking header buttons...')
  
  // Tìm button "Tài khoản mới"
  const newAccountBtn = document.querySelector('button[title*="Tài khoản mới"], button:contains("Tài khoản mới")')
  console.log('🔥 New Account Button:', newAccountBtn)
  
  // Tìm button Import
  const importBtn = document.querySelector('button[title*="Import"], button[title*="import"]')
  console.log('🔥 Import Button:', importBtn)
  
  // Tìm button Export  
  const exportBtn = document.querySelector('button[title*="Export"], button[title*="export"]')
  console.log('🔥 Export Button:', exportBtn)
  
  // Tìm button Settings
  const settingsBtn = document.querySelector('button[aria-label*="Cài đặt"], button[title*="Settings"]')
  console.log('🔥 Settings Button:', settingsBtn)
  
  // Tìm tất cả buttons trong header
  const headerButtons = document.querySelectorAll('header button')
  console.log('🔥 All Header Buttons:', headerButtons.length, headerButtons)
  
  // Test click events
  headerButtons.forEach((btn, index) => {
    console.log(`🔥 Button ${index}:`, btn.textContent?.trim(), btn.getAttribute('aria-label'), btn.getAttribute('title'))
    
    // Add test click listener
    btn.addEventListener('click', (e) => {
      console.log(`🔥 CLICKED Button ${index}:`, btn.textContent?.trim(), e)
    })
  })
  
}, 2000)

// Test 2: Kiểm tra React Router navigation
setTimeout(() => {
  console.log('🔥 Test 2: Checking React Router...')
  
  // Kiểm tra current location
  console.log('🔥 Current URL:', window.location.href)
  console.log('🔥 Current pathname:', window.location.pathname)
  
  // Kiểm tra React Router context
  const reactRouterElements = document.querySelectorAll('[data-testid*="router"], [class*="router"]')
  console.log('🔥 React Router Elements:', reactRouterElements)
  
}, 3000)

// Test 3: Kiểm tra console errors
setTimeout(() => {
  console.log('🔥 Test 3: Monitoring console errors...')
  
  // Override console.error để catch errors
  const originalError = console.error
  console.error = function(...args) {
    console.log('🔥 CONSOLE ERROR DETECTED:', ...args)
    originalError.apply(console, args)
  }
  
  // Override window.onerror
  window.onerror = function(message, source, lineno, colno, error) {
    console.log('🔥 WINDOW ERROR DETECTED:', { message, source, lineno, colno, error })
    return false
  }
  
}, 1000)

// Test 4: Kiểm tra React components
setTimeout(() => {
  console.log('🔥 Test 4: Checking React components...')
  
  // Tìm React root
  const reactRoot = document.querySelector('#root, [data-reactroot]')
  console.log('🔥 React Root:', reactRoot)
  
  // Kiểm tra React DevTools
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('🔥 React DevTools available')
  } else {
    console.log('🔥 React DevTools NOT available')
  }
  
}, 4000)

// Test 5: Manual button click test
setTimeout(() => {
  console.log('🔥 Test 5: Manual button click test...')
  
  // Tìm và click button đầu tiên trong header
  const firstHeaderBtn = document.querySelector('header button')
  if (firstHeaderBtn) {
    console.log('🔥 Attempting to click first header button:', firstHeaderBtn)
    firstHeaderBtn.click()
    console.log('🔥 Button clicked!')
  } else {
    console.log('🔥 No header button found!')
  }
  
}, 5000)

console.log('🔥 UI Test script loaded. Check console for results in 2-5 seconds...')
