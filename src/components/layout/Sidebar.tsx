import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  Users,
  MessageSquare,
  Users2,
  MessageCircle,
  Settings,
  Home,
  Zap
} from 'lucide-react'
import { cn } from '@/utils'
import { useAccountStore } from '@/store/database-store'
import { Badge } from '@/components/ui'
import { useI18n } from '@/i18n'

interface SidebarProps {
  collapsed?: boolean
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed = false }) => {
  const { activeAccount } = useAccountStore()
  const { t } = useI18n()

  const navigationItems = [
    {
      title: t('nav.dashboard'),
      href: '/',
      icon: Home,
      exact: true
    },
    {
      title: t('nav.accounts'),
      href: '/accounts',
      icon: Zap,
      badge: activeAccount ? 'active' : undefined
    },
    {
      title: t('nav.friends'),
      href: '/friends',
      icon: Users
    },
    {
      title: t('nav.personalMessages'),
      href: '/personal-messages',
      icon: MessageSquare
    },
    {
      title: t('nav.groups'),
      href: '/groups',
      icon: Users2
    },
    {
      title: t('nav.groupMessages'),
      href: '/group-messages',
      icon: MessageCircle
    },
    {
      title: t('nav.settings'),
      href: '/settings',
      icon: Settings
    }
  ]

  return (
    <div className={cn(
      'flex flex-col h-full bg-white border-r border-secondary-200 transition-all duration-300',
      'dark:bg-secondary-800 dark:border-secondary-700',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-secondary-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-secondary-900 dark:text-secondary-100">ZALO TOOL</h1>
              <p className="text-xs text-secondary-500 dark:text-secondary-400">SOCIALAUTOPRO</p>
            </div>
          )}
        </div>
      </div>

      {/* Account Status */}
      {!collapsed && activeAccount && (
        <div className="p-4 border-b border-secondary-200">
          <div className="flex items-center space-x-3">
            <div className={cn(
              'w-3 h-3 rounded-full',
              activeAccount.status === 'online' ? 'bg-success-500' :
              activeAccount.status === 'offline' ? 'bg-secondary-400' :
              'bg-error-500'
            )} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-secondary-900 dark:text-secondary-100 truncate">
                {activeAccount.name}
              </p>
              <p className="text-xs text-secondary-500 dark:text-secondary-400 truncate">
                {activeAccount.phone}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon
          
          return (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.exact}
              className={({ isActive }) => cn(
                'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                'hover:bg-secondary-50 hover:text-secondary-900 dark:hover:bg-secondary-700 dark:hover:text-secondary-100',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                isActive
                  ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600 dark:bg-primary-900 dark:text-primary-300'
                  : 'text-secondary-600 dark:text-secondary-300',
                collapsed ? 'justify-center' : 'justify-start'
              )}
              title={collapsed ? item.title : undefined}
            >
              <Icon className={cn(
                'flex-shrink-0',
                collapsed ? 'w-5 h-5' : 'w-5 h-5 mr-3'
              )} />
              
              {!collapsed && (
                <>
                  <span className="flex-1">{item.title}</span>
                  {item.badge && (
                    <Badge variant="success" size="sm">
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-secondary-200">
          <div className="text-xs text-secondary-500 dark:text-secondary-400 text-center">
            <p>SOCIALAUTOPRO v1.0.0</p>
            <p className="mt-1">by SocialAutoPro</p>
          </div>
        </div>
      )}
    </div>
  )
}

export { Sidebar }
