import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { MAX_TABS } from '@arlo-doc/shared';
import type { DraftStatus, WorktreeTab } from '../types';

// Electron-specific CSS property not in React's type definitions
type ElectronCSSProperties = React.CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag';
};

interface TitleBarProps {
  draftStatus: DraftStatus;
  draftName: string;
  tabs: WorktreeTab[];
  activeTabId: string | null;
  onTabClick: (id: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  isCreatingTab?: boolean | undefined;
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

// ── Tab width calculation constants ────────────────────────────────────────
const TAB_BAR_RESERVED = 120; // traffic lights + "+" button
const MIN_TAB_WIDTH = 40;
const MAX_TAB_WIDTH = 160;

export function TitleBar({
  draftStatus,
  draftName,
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onNewTab,
  isCreatingTab = false,
}: TitleBarProps): React.ReactElement {
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(600);

  // Track the tab bar's width via ResizeObserver
  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setAvailableWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    // Seed the initial width synchronously
    setAvailableWidth(el.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, []);

  // Compute per-tab width from available space
  const tabCount = tabs.length;
  const usableWidth = availableWidth - TAB_BAR_RESERVED;

  // Base width shared across all tabs; active tab gets +20px
  const baseWidth =
    tabCount === 0
      ? MAX_TAB_WIDTH
      : Math.max(MIN_TAB_WIDTH, Math.min(MAX_TAB_WIDTH, usableWidth / tabCount));

  const showTitle = baseWidth > MIN_TAB_WIDTH;

  const handleDoubleClick = useCallback(() => {
    window.windowControls?.toggleMaximize();
  }, []);

  const atMaxTabs = tabs.length >= MAX_TABS;
  const newTabDisabled = atMaxTabs || isCreatingTab;

  return (
    <div
      onDoubleClick={handleDoubleClick}
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
        ref={tabBarRef}
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
          // Active tab gets an extra 20px budget; clamp to MAX_TAB_WIDTH
          const tabWidth = Math.min(isActive ? baseWidth + 20 : baseWidth, MAX_TAB_WIDTH);

          return (
            <button
              key={tab.id}
              onClick={() => onTabClick(tab.id)}
              style={{
                // Tab sits flush with the bottom of the title bar
                height: 36,
                width: tabWidth,
                minWidth: tabWidth,
                maxWidth: tabWidth,
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px 0 12px',
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
                flexShrink: 0,
                // Negative bottom margin so the tab bottom overlaps the border
                marginBottom: -1,
                transition: 'background 0.1s, color 0.1s',
                overflow: 'hidden',
                gap: 4,
              }}
            >
              {showTitle && (
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {tab.title}
                </span>
              )}

              {/* Close (×) button */}
              <span
                role="button"
                aria-label={`Close ${tab.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                style={{
                  flexShrink: 0,
                  color: '#a8a8be',
                  padding: '0 2px',
                  borderRadius: 3,
                  lineHeight: 1,
                  fontSize: 14,
                  // Always reserve space so the tab doesn't reflow when hiding title
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </span>
            </button>
          );
        })}

        {/* New tab button — disabled + tooltip when at MAX_TABS or creating */}
        <button
          onClick={newTabDisabled ? undefined : onNewTab}
          disabled={newTabDisabled}
          title={atMaxTabs ? `Maximum ${MAX_TABS} tabs open` : isCreatingTab ? '正在建立 Worktree…' : undefined}
          style={{
            width: 30,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: newTabDisabled ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            marginBottom: -1,
            opacity: newTabDisabled ? 0.4 : 1,
          }}
        >
          {isCreatingTab ? (
            <span
              style={{
                width: 12,
                height: 12,
                border: '1.5px solid #8e8eaa',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.7s linear infinite',
              }}
            />
          ) : (
            <Plus size={13} color="#8e8eaa" />
          )}
        </button>
      </div>
    </div>
  );
}
