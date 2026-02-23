import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  anthropic: {
    initialize: (apiKey: string) => ipcRenderer.invoke('anthropic:initialize', apiKey),
    testKey: (apiKey: string) => ipcRenderer.invoke('anthropic:test-key', apiKey),
    message: (params: {
      model: string
      max_tokens: number
      messages: Array<{ role: string; content: string }>
      system?: string
    }) => ipcRenderer.invoke('anthropic:message', params),
    isInitialized: () => ipcRenderer.invoke('anthropic:is-initialized'),
  },
  rss: {
    fetch: (feeds: Array<{
      rssUrl: string
      sourceName: string
      country: string
      orientation: string
      language: string
      trustworthiness: number
      factCheckRecord: string
    }>) => ipcRenderer.invoke('rss:fetch', feeds),
  },
  platform: process.platform,
})
