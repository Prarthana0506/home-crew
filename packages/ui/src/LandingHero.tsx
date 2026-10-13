import React from 'react';
import { useAuth, t } from '@urbanclap/lib';
import { Button } from './Button';
import { Zap, Clock, Star, Coins, ShieldCheck, MapPin } from 'lucide-react';

export interface LandingHeroProps {
  onPrimaryCta: () => void;
  onSecondaryCta?: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onPrimaryCta,
  onSecondaryCta
}) => {
  const { language, appRole } = useAuth();

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
      {/* Top Banner Card */}
      <div className="flat-card flat-card-teal" style={{ padding: '32px 24px', position: 'relative' }}>
        <div style={{ maxWidth: '720px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            <span className="flat-badge badge-emergency">
              <ShieldCheck size={13} /> {t('landing_badge_dispatch', language)}
            </span>
            <span className="flat-badge badge-ordinary">
              <MapPin size={13} /> Coimbatore
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.6rem)', fontWeight: 800, lineHeight: 1.15, marginBottom: '14px', letterSpacing: '-0.5px' }}>
            {t('landing_hero_title', language)}
          </h1>

          <p style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)', color: '#d0e5e8', lineHeight: 1.5, marginBottom: '24px' }}>
            {t('landing_hero_subtitle', language)}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <Button
              variant={appRole === 'provider' ? 'red' : 'gold'}
              size="lg"
              onClick={onPrimaryCta}
            >
              {appRole === 'provider' ? t('landing_cta_provider', language) : t('landing_cta_customer', language)}
            </Button>
            {onSecondaryCta && (
              <Button
                variant="secondary"
                size="lg"
                onClick={onSecondaryCta}
              >
                Learn More
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px'
      }}>
        <div className="flat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ background: 'var(--color-teal-light)', padding: '8px', borderRadius: '8px', color: 'var(--color-teal-dark)' }}>
              <Clock size={20} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
              {t('landing_feature_ordinary_title', language)}
            </h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            {t('landing_feature_ordinary_desc', language)}
          </p>
        </div>

        <div className="flat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ background: 'var(--color-coral-light)', padding: '8px', borderRadius: '8px', color: 'var(--color-terracotta)' }}>
              <Zap size={20} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-terracotta)' }}>
              {t('landing_feature_emergency_title', language)}
            </h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            {t('landing_feature_emergency_desc', language)}
          </p>
        </div>

        <div className="flat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ background: '#fef3c7', padding: '8px', borderRadius: '8px', color: '#92400e' }}>
              <Star size={20} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-dark)' }}>
              {t('landing_feature_reviews_title', language)}
            </h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            {t('landing_feature_reviews_desc', language)}
          </p>
        </div>

        <div className="flat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ background: '#dcfce7', padding: '8px', borderRadius: '8px', color: '#166534' }}>
              <Coins size={20} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-dark)' }}>
              {t('landing_feature_coins_title', language)}
            </h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            {t('landing_feature_coins_desc', language)}
          </p>
        </div>
      </div>
    </section>
  );
};
