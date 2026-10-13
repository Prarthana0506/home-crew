import React from 'react';
import {
  Wrench,
  Zap,
  Sparkles,
  Droplets,
  Paintbrush,
  Hammer,
  Shield,
  Fan,
  Scissors,
  Truck,
  Flame,
  CheckCircle2
} from 'lucide-react';

export interface ServiceCategoryItem {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  base_price_inr?: number;
  icon?: string;
  is_emergency_capable?: boolean;
}

export interface CategoryGridProps {
  categories: ServiceCategoryItem[];
  selectedCategoryId?: string;
  onSelectCategory?: (category: ServiceCategoryItem) => void;
  showEmergencyOnly?: boolean;
}

// Icon resolver for category names
const getCategoryIcon = (name: string, iconKey?: string) => {
  const n = (iconKey || name).toLowerCase();
  const iconProps = { size: 22, strokeWidth: 2 };

  if (n.includes('plumb') || n.includes('leak') || n.includes('pipe') || n.includes('tap')) {
    return <Droplets {...iconProps} />;
  }
  if (n.includes('electr') || n.includes('wire') || n.includes('circuit') || n.includes('power')) {
    return <Zap {...iconProps} />;
  }
  if (n.includes('clean') || n.includes('maid') || n.includes('wash')) {
    return <Sparkles {...iconProps} />;
  }
  if (n.includes('paint')) {
    return <Paintbrush {...iconProps} />;
  }
  if (n.includes('carpent') || n.includes('furnitur') || n.includes('wood')) {
    return <Hammer {...iconProps} />;
  }
  if (n.includes('ac') || n.includes('cool') || n.includes('fan') || n.includes('appliance')) {
    return <Fan {...iconProps} />;
  }
  if (n.includes('salon') || n.includes('hair') || n.includes('beauty')) {
    return <Scissors {...iconProps} />;
  }
  if (n.includes('pack') || n.includes('shift') || n.includes('mov')) {
    return <Truck {...iconProps} />;
  }
  if (n.includes('secur') || n.includes('lock') || n.includes('cctv')) {
    return <Shield {...iconProps} />;
  }
  return <Wrench {...iconProps} />;
};

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  showEmergencyOnly = false
}) => {
  const filtered = showEmergencyOnly
    ? categories.filter(c => c.is_emergency_capable !== false)
    : categories;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '10px',
        width: '100%'
      }}
      aria-label="Category Selection Grid"
    >
      {filtered.map(cat => {
        const isSelected = selectedCategoryId === cat.id;

        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory && onSelectCategory(cat)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 10px',
              backgroundColor: isSelected ? 'var(--color-primary-light)' : '#ffffff',
              border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-sm)',
              boxShadow: isSelected ? 'var(--shadow-flat)' : 'none',
              transform: isSelected ? 'translate(-2px, -2px)' : 'none',
              cursor: 'pointer',
              textAlign: 'center',
              position: 'relative',
              transition: 'all 0.15s ease'
            }}
          >
            {/* Selected checkmark indicator */}
            {isSelected && (
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  color: 'var(--color-primary)'
                }}
              >
                <CheckCircle2 size={16} />
              </span>
            )}

            {/* Emergency badge */}
            {cat.is_emergency_capable && (
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  left: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '2px 4px',
                  fontSize: '9px',
                  fontWeight: 800,
                  color: 'var(--color-coral)',
                  backgroundColor: 'var(--color-coral-light)',
                  borderRadius: '4px',
                  border: '1px solid var(--color-coral)'
                }}
                title="Emergency service capable"
              >
                <Flame size={10} />
                SOS
              </span>
            )}

            {/* Icon Tile */}
            <div
              style={{
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isSelected ? '#ffffff' : 'var(--color-slate-light)',
                color: isSelected ? 'var(--color-primary)' : 'var(--color-slate)',
                border: `1.5px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-xs)',
                marginBottom: '8px',
                marginTop: cat.is_emergency_capable ? '8px' : '0'
              }}
            >
              {getCategoryIcon(cat.name, cat.icon)}
            </div>

            {/* Category Name */}
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: isSelected ? 700 : 600,
                color: isSelected ? 'var(--color-primary-dark)' : 'var(--color-dark)',
                lineHeight: 1.25,
                marginBottom: '4px',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {cat.name}
            </span>

            {/* Base Price if present */}
            {cat.base_price_inr != null && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-muted)'
                }}
              >
                From &#8377;{cat.base_price_inr}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
