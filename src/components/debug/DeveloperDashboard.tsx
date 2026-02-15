"use client"

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDeveloperDashboard } from '@/hooks/useDeveloperDashboard'
import { useRealtimeStats } from '@/hooks/useRealtimeStats'
import { RealtimePanel } from './panels/RealtimePanel'
import { PerformancePanel } from './panels/PerformancePanel'
import { NetworkPanel } from './panels/NetworkPanel'
import { AuthPanel } from './panels/AuthPanel'
import { ConfigPanel } from './panels/ConfigPanel'
import { X } from 'lucide-react'

const statusBadgeColors = {
  realtime: 'bg-green-500 shadow-green-500/50',
  polling: 'bg-yellow-500 shadow-yellow-500/50',
  connecting: 'bg-blue-500 shadow-blue-500/50',
} as const

export default function DeveloperDashboard() {
  const { isOpen, toggle, close, panelRef } = useDeveloperDashboard()
  const { stats } = useRealtimeStats()
  const [activeTab, setActiveTab] = useState('realtime')

  const connectionStatus = stats?.connectionStatus || 'connecting'
  const badgeColor = statusBadgeColors[connectionStatus] || 'bg-gray-500'

  return (
    <>
      {/* Collapsed badge */}
      {!isOpen && (
        <button
          onClick={toggle}
          className={`fixed bottom-4 right-4 z-[9999] w-10 h-10 rounded-full ${badgeColor} shadow-lg
            flex items-center justify-center cursor-pointer hover:scale-110 transition-transform
            border-2 border-background`}
          title="Developer Dashboard (Alt+R)"
        >
          <span className="text-white text-xs font-bold font-mono">
            {connectionStatus === 'realtime' ? 'RT' : connectionStatus === 'polling' ? 'PL' : '...'}
          </span>
        </button>
      )}

      {/* Expanded panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed bottom-4 right-4 z-[9999] w-[420px] rounded-lg border bg-background/95
            backdrop-blur-sm shadow-2xl flex flex-col overflow-hidden"
          style={{ height: '70vh', maxHeight: 'calc(100vh - 32px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${badgeColor.split(' ')[0]} animate-pulse`} />
              <h3 className="text-xs font-bold uppercase tracking-widest">Dev Dashboard</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-mono">Alt+R</span>
              <button
                onClick={close}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full justify-start rounded-none border-b h-8 bg-transparent px-1 shrink-0">
              <TabsTrigger value="realtime" className="text-[10px] px-2 py-1 h-6 data-[state=active]:bg-muted">
                Realtime
              </TabsTrigger>
              <TabsTrigger value="performance" className="text-[10px] px-2 py-1 h-6 data-[state=active]:bg-muted">
                Perf
              </TabsTrigger>
              <TabsTrigger value="network" className="text-[10px] px-2 py-1 h-6 data-[state=active]:bg-muted">
                Network
              </TabsTrigger>
              <TabsTrigger value="auth" className="text-[10px] px-2 py-1 h-6 data-[state=active]:bg-muted">
                Auth
              </TabsTrigger>
              <TabsTrigger value="config" className="text-[10px] px-2 py-1 h-6 data-[state=active]:bg-muted">
                Config
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <TabsContent value="realtime" className="mt-0 focus-visible:ring-0">
                <RealtimePanel />
              </TabsContent>
              <TabsContent value="performance" className="mt-0 focus-visible:ring-0">
                <PerformancePanel />
              </TabsContent>
              <TabsContent value="network" className="mt-0 focus-visible:ring-0">
                <NetworkPanel />
              </TabsContent>
              <TabsContent value="auth" className="mt-0 focus-visible:ring-0">
                <AuthPanel />
              </TabsContent>
              <TabsContent value="config" className="mt-0 focus-visible:ring-0">
                <ConfigPanel />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      )}
    </>
  )
}
