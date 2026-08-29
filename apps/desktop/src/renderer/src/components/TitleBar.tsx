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
        // Chrome-style: taller title bar so tabs sit at traffic-light height
        height: 52,
        background: '#f8f8fc',
        borderBottom: '1px solid rgba(0,0,0,.08)',
        display: 'flex',
        alignItems: 'flex-end', // tabs sit at the bottom of the bar
        flexShrink: 0,
        WebkitAppRegion: 'drag',
        userSelect: 'none',
      } as ElectronCSSProperties}
    >
      {/*
        Spacer for native macOS traffic-light buttons.
        With titleBarStyle:'hiddenInset' the buttons are inset at the top-left
        of the window frame; 80px clears them comfortably.
      */}
      <div style={{ width: 80, flexShrink: 0, height: '100%' }} />

      {/* Draft pill — vertically centred in the top half of the bar */}
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
              marginBottom: 13, // lift to vertical centre of the 52px bar
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
              marginBottom: 16,
              flexShrink: 0,
            }}
          />
        </>
      )}

      {/* Tabs — Chrome style: rounded top corners, flush with bottom border */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          height: '100%',
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
                // Tab sits flush with the bottom of the title bar
                height: 36,
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                fontSize: 12.5,
                fontFamily: 'var(--font-sans)',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#1a1a2e' : '#64648c',
                // Active: white pill with top-rounded corners that "lifts" off the bar
                background: isActive ? '#fff' : 'transparent',
                borderRadius: isActive ? '8px 8px 0 0' : 4,
                border: isActive
                  ? '1px solid rgba(0,0,0,.08)'
                  : '1px solid transparent',
                borderBottom: isActive ? '1px solid #fff' : '1px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                // Negative bottom margin so the tab bottom overlaps the border
                marginBottom: -1,
                transition: 'background 0.1s, color 0.1s',
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
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
            marginBottom: -1,
          }}
        >
          <Plus size={13} color="#8e8eaa" />
        </button>
      </div>
    </div>
  );
}
