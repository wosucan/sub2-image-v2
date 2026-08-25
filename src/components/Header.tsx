import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { useVersionCheck } from '../hooks/useVersionCheck'
import { useTooltip } from '../hooks/useTooltip'
import { dismissAllTooltips } from '../lib/tooltipDismiss'
import { isSub2ApiEmbeddedMode } from '../lib/embeddedMode'
import ViewportTooltip from './ViewportTooltip'
import HelpModal from './HelpModal'
import { useFavoriteCollectionTitle } from './FavoriteCollections'
import { HelpCircleIcon, SettingsIcon } from './icons'

function formatBalance(balance?: number) {
  return typeof balance === 'number' && Number.isFinite(balance) ? balance.toFixed(4) : '未知'
}

const BRAND_URL = 'https://sub2.luoyv.net'

export default function Header() {
  const appMode = useStore((s) => s.appMode)
  const setAppMode = useStore((s) => s.setAppMode)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const agentMobileHeaderVisible = useStore((s) => s.agentMobileHeaderVisible)
  const agentConversations = useStore((s) => s.agentConversations)
  const activeAgentConversationId = useStore((s) => s.activeAgentConversationId)
  const filterFavorite = useStore((s) => s.filterFavorite)
  const activeFavoriteCollectionId = useStore((s) => s.activeFavoriteCollectionId)
  const activeConversation = agentConversations.find((item) => item.id === activeAgentConversationId)
  const sub2ApiUser = useStore((s) => s.sub2ApiAccount.user)
  const favoriteCollectionTitle = useFavoriteCollectionTitle()
  const showFavoriteCollectionTitle = appMode === 'gallery' && Boolean(activeFavoriteCollectionId)
  const { hasUpdate, latestRelease, dismiss } = useVersionCheck()
  const [showHelp, setShowHelp] = useState(false)
  const [hintVisible, setHintVisible] = useState(false)
  const embeddedMode = isSub2ApiEmbeddedMode()

  useEffect(() => {
    if (appMode === 'agent' && !agentMobileHeaderVisible) {
      setHintVisible(true)
      const timer = setTimeout(() => {
        setHintVisible(false)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [appMode, agentMobileHeaderVisible])

  const helpTooltip = useTooltip()
  const settingsTooltip = useTooltip()

  return (
    <>
      <header data-no-drag-select className="safe-area-top fixed top-0 left-0 right-0 z-40 translate-y-0 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-white/[0.08] transition-transform duration-300 ease-in-out">
        <div className={`safe-area-x safe-header-inner max-w-7xl mx-auto flex justify-between relative ${embeddedMode ? 'items-center' : 'items-stretch'}`}>
          <div className={`flex flex-1 min-w-0 items-start py-2 pr-2 ${embeddedMode ? 'flex-row justify-start' : 'flex-col justify-between'}`}>
            {!embeddedMode && (
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="inline-flex min-w-0 items-start relative mr-2">
                  {showFavoriteCollectionTitle ? (
                    <>
                      <span className="min-w-0 truncate text-[17px] font-bold tracking-tight text-gray-800 dark:text-gray-100 sm:hidden" title={favoriteCollectionTitle}>{favoriteCollectionTitle}</span>
                      <a
                        href={BRAND_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden text-lg font-bold tracking-tight text-gray-800 transition-colors hover:text-gray-600 dark:text-gray-100 dark:hover:text-gray-300 sm:inline"
                      >
                        落羽小站
                      </a>
                    </>
                  ) : (
                    <a
                      href={BRAND_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[17px] sm:text-lg font-bold tracking-tight text-gray-800 dark:text-gray-100 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      落羽小站
                    </a>
                  )}
                  {hasUpdate && latestRelease && (
                    <a
                      href={latestRelease.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={dismiss}
                      className="absolute -right-1 -top-1 translate-x-full -translate-y-1/4 px-1 py-0.5 rounded-[4px] border border-red-500/30 text-[9px] font-black bg-red-500 text-white hover:bg-red-600 transition-all animate-fade-in leading-none shadow-sm"
                      title={`新版本 ${latestRelease.tag}`}
                    >
                      NEW
                    </a>
                  )}
                </h1>
                {sub2ApiUser && (
                  <button
                    type="button"
                    onClick={() => setShowSettings(true, 'account')}
                    className="flex max-w-[220px] flex-col items-start gap-0.5 rounded-lg border border-blue-100 bg-blue-50/80 px-2 py-1 text-xs leading-tight text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15"
                    title={`sub2昵称：${sub2ApiUser.username || sub2ApiUser.email} · 余额 ${formatBalance(sub2ApiUser.balance)}`}
                  >
                    <span className="max-w-full truncate">sub2昵称：{sub2ApiUser.username || sub2ApiUser.email}</span>
                    <span className="text-blue-500/80 dark:text-blue-300/80">余额 {formatBalance(sub2ApiUser.balance)}</span>
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-1">
              <div
                className="relative"
                {...helpTooltip.handlers}
              >
                <button
                  onClick={() => {
                    dismissAllTooltips()
                    setShowHelp(true)
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                  aria-label="操作指南"
                >
                  <HelpCircleIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <ViewportTooltip visible={helpTooltip.visible} className="whitespace-nowrap">
                  操作指南
                </ViewportTooltip>
              </div>
              <div
                className="relative"
                {...settingsTooltip.handlers}
              >
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                  aria-label="设置"
                >
                  <SettingsIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <ViewportTooltip visible={settingsTooltip.visible} className="whitespace-nowrap">
                  设置
                </ViewportTooltip>
              </div>
            </div>
          </div>
          {showFavoriteCollectionTitle && (
            <div className="absolute left-1/2 top-1/2 hidden max-w-[30%] -translate-x-1/2 -translate-y-1/2 sm:flex">
              <div className="truncate rounded px-2 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300" title={favoriteCollectionTitle}>
                {favoriteCollectionTitle}
              </div>
            </div>
          )}
          <div className={`flex w-[10.5rem] shrink-0 items-center gap-1 rounded-xl border border-gray-200 bg-gray-100/70 p-1 dark:border-white/[0.08] dark:bg-white/[0.04] sm:w-[12rem] ${embeddedMode ? 'mb-0 self-center' : 'mb-2 self-end'}`}>
            <button
              type="button"
              onClick={() => setAppMode('gallery')}
              className={`min-w-0 flex-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${appMode === 'gallery' ? 'bg-white text-gray-900 shadow-sm font-medium dark:bg-white/10 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
            >
              画廊
            </button>
            <button
              type="button"
              onClick={() => setAppMode('agent')}
              className={`min-w-0 flex-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${appMode === 'agent' ? 'bg-white text-gray-900 shadow-sm font-medium dark:bg-white/10 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
            >
              Agent
            </button>
          </div>
        </div>
      </header>
      
      {/* Hint for sliding down */}
      <div className={`fixed top-0 left-0 right-0 z-30 flex justify-center pointer-events-none transition-all duration-300 ease-in-out sm:hidden ${appMode === 'agent' && hintVisible && !agentMobileHeaderVisible ? 'translate-y-[env(safe-area-inset-top,0px)] opacity-100' : '-translate-y-full opacity-0'}`}>
        <div className="bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-b-xl shadow-lg">
          下拉展示顶栏
        </div>
      </div>

      <div className="safe-area-top invisible pointer-events-none max-h-[500px] opacity-100 transition-all duration-300 ease-in-out" aria-hidden="true">
        <div className="safe-header-inner" />
      </div>
      {showHelp && <HelpModal appMode={appMode} isFavoriteCollectionOverview={appMode === 'gallery' && filterFavorite && !activeFavoriteCollectionId} onClose={() => setShowHelp(false)} />}
    </>
  )
}
