import React, { useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Template {
  id: string
  name: string
  content: string
  createdAt: string
}

interface TemplateSelectorProps {
  templates: Template[]
  selectedTemplate: Template | null
  onSelectTemplate: (template: Template | null) => void
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  templates,
  selectedTemplate,
  onSelectTemplate
}) => {
  const [showAll, setShowAll] = useState(false)

  // Get 5 most recent templates
  const recentTemplates = templates
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  const displayTemplates = showAll ? templates : recentTemplates
  const hasMoreTemplates = templates.length > 5

  return (
    <div>
      <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
        Chọn template
      </label>
      
      {templates.length === 0 ? (
        <div className="p-4 border border-secondary-300 dark:border-secondary-600 rounded-lg text-center">
          <p className="text-sm text-secondary-500 dark:text-secondary-400">
            Chưa có template nào
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Recent Templates Grid */}
          <div className="grid grid-cols-1 gap-2">
            {displayTemplates.map(template => (
              <div
                key={template.id}
                className={`
                  p-3 border rounded-lg cursor-pointer transition-all duration-200
                  ${selectedTemplate?.id === template.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-400'
                    : 'border-secondary-300 dark:border-secondary-600 hover:border-secondary-400 dark:hover:border-secondary-500 bg-white dark:bg-secondary-800'
                  }
                `}
                onClick={() => onSelectTemplate(template)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-secondary-900 dark:text-secondary-100 truncate">
                      {template.name}
                    </h4>
                    <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1 line-clamp-2">
                      {template.content}
                    </p>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    <div className={`
                      w-4 h-4 rounded-full border-2 transition-colors
                      ${selectedTemplate?.id === template.id
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-secondary-300 dark:border-secondary-600'
                      }
                    `}>
                      {selectedTemplate?.id === template.id && (
                        <div className="w-full h-full rounded-full bg-white scale-50" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Show More/Less Button */}
          {hasMoreTemplates && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll(!showAll)}
                className="text-sm"
              >
                <ChevronDown className={`w-4 h-4 mr-1 transition-transform ${showAll ? 'rotate-180' : ''}`} />
                {showAll ? `Ẩn bớt (${templates.length - 5} template)` : `Hiện thêm (${templates.length - 5} template)`}
              </Button>
            </div>
          )}

          {/* Clear Selection */}
          {selectedTemplate && (
            <div className="flex justify-start">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectTemplate(null)}
                className="text-sm text-secondary-500 dark:text-secondary-400"
              >
                Bỏ chọn template
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TemplateSelector
