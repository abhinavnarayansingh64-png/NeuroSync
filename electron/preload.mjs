import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('neurosyncDesktop', {
  isDesktop: true,
  getHardwareProfile: () => ipcRenderer.invoke('neurosync:hardware-profile'),
})
