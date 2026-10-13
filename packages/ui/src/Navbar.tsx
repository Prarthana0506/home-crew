import React from 'react';
import { useAuth, t } from '@urbanclap/lib';
import { Wrench, Globe, LogOut, User as UserIcon, Shield, Bell } from 'lucide-react';
import { Button } from './Button';

export interface NavbarProps {
  onOpenAuth?: () => void;
  brandSubtitle?: string;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAuth,
  brandSubtitle,
  onOpenNotifications,
  unreadNotificationsCount
}) => {
  const { authUser, profile, appRole, language, setLanguage, signOut } = useAuth();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ta' : 'en');
  };

  const appTitle =
    appRole === 'admin'
      ? 'Admin Console'
      : appRole === 'provider'
        ? 'Partner Portal'
        : 'Customer Portal';

  return (
    <header
      style={{
        backgroundColor: '#ffffff',
        borderBottom: '2px solid var(--color-teal-dark)',
        boxShadow: '0 2px 0px rgba(27,79,89,0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              backgroundColor: appRole === 'admin' ? 'var(--color-dark)' : appRole === 'provider' ? 'var(--color-terracotta)' : 'var(--color-teal-dark)',
              border: '2px solid var(--color-teal-dark)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '2px 2px 0px var(--color-teal-dark)'
            }}
          >
            {appRole === 'admin' ? (
              <Shield size={20} color="#ffffff" />
            ) : (
              <Wrench size={20} color="#ffffff" />
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-teal-dark)' }}>
                HomeCrew
              </span>
              <span
                className="flat-badge"
                style={{
                  backgroundColor: appRole === 'admin' ? '#e2e8f0' : appRole === 'provider' ? '#fbeee9' : '#e8f3f5',
                  color: appRole === 'admin' ? '#334155' : appRole === 'provider' ? 'var(--color-terracotta)' : 'var(--color-teal-dark)',
                  borderColor: 'var(--color-teal-dark)',
                  fontSize: '0.68rem',
                  padding: '2px 8px'
                }}
              >
                {brandSubtitle || appTitle}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', fontWeight: 600 }}>
              Coimbatore Verified Dispatch
            </div>
          </div>
        </div>

        {/* Right side items */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Language toggle */}
          <button
            type="button"
            onClick={toggleLanguage}
            className="btn-flat btn-flat-secondary btn-flat-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Switch Language (English / Tamil)"
          >
            <Globe size={15} />
            <span>{language === 'en' ? 'தமிழ்' : 'English'}</span>
          </button>

          {/* Notifications Inbox Bell */}
          {authUser && onOpenNotifications && (
            <button
              type="button"
              id="navbar-notifications-btn"
              onClick={onOpenNotifications}
              className="btn-flat btn-flat-secondary btn-flat-sm"
              style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', padding: 0 }}
              title="Notifications Inbox"
            >
              <Bell size={16} />
              {(unreadNotificationsCount || 0) > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: 'var(--color-crimson)',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontWeight: 800,
                    borderRadius: '8px',
                    minWidth: '16px',
                    height: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                    border: '1px solid #ffffff'
                  }}
                >
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          )}

          {/* User profile or Sign In */}
          {authUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  backgroundColor: 'var(--bg-sand)',
                  border: '2px solid var(--color-teal-dark)',
                  borderRadius: '8px',
                  boxShadow: '2px 2px 0px var(--color-teal-dark)'
                }}
              >
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-teal-dark)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff'
                  }}
                >
                  <UserIcon size={16} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-dark)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile?.name || authUser.email?.split('@')[0]}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'capitalize' }}>
                    {profile?.area?.name || profile?.role || appRole}
                  </span>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={signOut}
                title={t('btn_logout', language)}
                style={{ padding: '6px 10px' }}
              >
                <LogOut size={16} />
              </Button>
            </div>
          ) : (
            onOpenAuth && (
              <Button size="sm" onClick={onOpenAuth}>
                {t('btn_sign_in', language)}
              </Button>
            )
          )}
        </div>
      </div>
    </header>
  );
};