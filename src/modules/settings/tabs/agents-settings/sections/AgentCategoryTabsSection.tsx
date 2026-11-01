import { useTranslation } from 'react-i18next';

import { cn } from '@/shared/utils';
import type { AgentCategory, AgentProvider } from '@/shared/types';

type AgentCategoryTabsSectionProps = {
  categories: AgentCategory[];
  selectedAgent: AgentProvider;
  selectedCategory: AgentCategory;
  onSelectCategory: (category: AgentCategory) => void;
};

/** Rendered by AgentSettingsLayer to switch between the open provider's categories. */
export default function AgentCategoryTabsSection({
  categories,
  selectedAgent,
  selectedCategory,
  onSelectCategory,
}: AgentCategoryTabsSectionProps) {
  const { t } = useTranslation('settings');

  return (
    <div className="flex-shrink-0">
      <div role="tablist" className="scrollbar-hide flex overflow-x-auto px-2 md:px-4">
        {categories.map((category) => (
          <button
            key={category}
            role="tab"
            aria-selected={selectedCategory === category}
            onClick={() => onSelectCategory(category)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium touch-manipulation transition-colors duration-150 md:px-4',
              selectedCategory === category
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {category === 'account' && t('tabs.account')}
            {category === 'permissions' && t('tabs.permissions')}
            {category === 'mcp' && t('tabs.mcpServers')}
            {category === 'skills' && t('tabs.skills', {
              defaultValue: selectedAgent === 'opencode' ? 'Shared Skills' : 'Skills',
            })}
          </button>
        ))}
      </div>
    </div>
  );
}
