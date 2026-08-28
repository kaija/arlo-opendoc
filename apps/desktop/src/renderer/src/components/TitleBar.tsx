import React from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import type { DraftStatus, Tab } from '../types';

// Electron-specific CSS property not in React's type definitions
type ElectronCSSProperties = React.CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag';
};

interface TitleBarProps {
  draftStatus: DraftStatus;
  draftName: string;
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  onNewTab: () => void;
}

function StatusDot({ status }: { status: DraftStatus }): React.ReactElement | null {
  if (status === null) return null;

  const baseStyle: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  };

  if (status === 'working') {
    return <span style={{ ...baseStyle, background: '#5856D6' }} />;
  }
  if (status === 'needs-approval') {
    return <span style={{ ...baseStyle, background: '#c07a12' }} />;
  }
  // draft — empty circle
  return (
    <span
      style={{
        ...baseStyle,
        border: '1.5px solid #8e8eaa',
        background: 'transparent',
      }}
    />
  );
}

export function TitleBar({
  draftStatus,
  draftName,
  tabs,
  activeTabId,
  onTabClick,
  onNewTab,
}: TitleBarProps): React.ReactElement {
  return (
    <div
      style={{
        height: 38,
        background: '#f8f8fc',
        borderBottom: '1px solid rgba(0,0,0,.08)',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        WebkitAppRegion: 'drag',
        userSelect: 'none',
      } as ElectronCSSProperties}
    >
      {/* Traffic lights */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 20,
          paddingRight: 18,
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: '50%',
            background: '#ff5f57',
            display: 'block',
          }}
        />
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: '50%',
            background: '#febc2e',
            display: 'block',
          }}
        />
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: '50%',
            background: '#28c840',
            display: 'block',
          }}
        />
      </div>

      {/* Draft pill */}
      {draftStatus !== null && (
        <>
          <div
            style={{
              height: 26,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              paddingLeft: 9,
              paddingRight: 9,
              background: '#fff',
              border: '1px solid rgba(0,0,0,.08)',
              borderRadius: 6,
              flexShrink: 0,
              WebkitAppRegion: 'no-drag',
              cursor: 'default',
            } as ElectronCSSProperties}
          >
            <StatusDot status={draftStatus} />
            <span
              style={{
                fontWeight: 500,
                fontSize: 12,
                color: '#1a1a2e',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {draftName}
            </span>
            <ChevronDown size={12} color="#8e8eaa" />
          </div>

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 20,
              background: 'rgba(0,0,0,.08)',
              marginLeft: 8,
              marginRight: 4,
              flexShrink: 0,
            }}
          />
        </>
      )}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          WebkitAppRegion: 'no-drag',
        } as ElectronCSSProperties}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => onTabClick(tab.id)}
              style={{
                height: 38,
                display: 'flex',
                alignItems: 'center',
                padding: '0 14px',
                fontSize: 12.5,
                fontFamily: 'var(--font-sans)',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#1a1a2e' : '#64648c',
                background: isActive ? '#fff' : 'transparent',
                boxShadow: isActive ? 'inset 0 -1px 0 0 #5856D6' : 'none',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {tab.title}
            </button>
          );
        })}

        {/* New tab button */}
        <button
          onClick={onNewTab}
          style={{
            width: 30,
            height: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Plus size={13} color="#8e8eaa" />
        </button>
      </div>
    </div>
  );
}
