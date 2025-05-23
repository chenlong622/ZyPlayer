import { is } from '@electron-toolkit/utils';
import { app, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { resolve, join } from 'path';
import logger from '@main/core/logger';
import { getWin } from '@main/core/winManger';
import { getAppDefaultPath } from '@main/utils/hiker/path';

const updaterCacheDirName = 'zyfun-updater';
const updatePath = join(getAppDefaultPath('runtime'), updaterCacheDirName, 'pending');

if (is.dev) {
  Object.defineProperty(app, 'isPackaged', {
    get() {
      return true;
    },
  });
  autoUpdater.updateConfigPath = resolve(__dirname, '../../dev-app-update.yml');
};

autoUpdater.autoDownload = false; // 关闭自动下载
autoUpdater.autoInstallOnAppQuit = false; // 关闭自动安装
autoUpdater.disableDifferentialDownload = true; // 关闭差分更新

export default () => {
  // 通用的IPC发送函数
  const sendUpdateMessage = (channel: string, message?: any) => {
    const win = getWin('main');
    if (win) win.webContents.send(channel, message);
  };

  // 下载更新的函数，包含错误处理逻辑
  const downloadUpdate = () => {
    autoUpdater.downloadUpdate();
  };

  // 主进程监听检查更新事件
  ipcMain.on('check-for-update', () => {
    logger.info('[update] check for update');
    autoUpdater.checkForUpdates();
  });

  // 主进程监听开始下载事件
  ipcMain.on('download-update', () => {
    logger.info('[update] download update');
    downloadUpdate();
  });

  // 主进程监听退出并安装事件
  ipcMain.on('quit-and-install', () => {
    logger.info('[update] quit and install');
    autoUpdater.quitAndInstall();
  });

  // 监听各类更新事件并发送IPC消息
  autoUpdater.on('checking-for-update', () => {
    logger.info('[update] checking update');
    sendUpdateMessage('checking-for-update');
  });

  autoUpdater.on('update-available', (info: any) => {
    logger.info(`[update] available`, info);
    const { version, releaseNotes } = info;
    sendUpdateMessage('update-available', { code: 0, msg: 'ok', data: { version, releaseNotes, available: true } });
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('[update] not available');
    sendUpdateMessage('update-not-available', { code: 0, msg: 'ok', data: { version: app.getVersion(), releaseNotes: '', available: false } });
  });

  autoUpdater.on('error', (err: any) => {
    logger.error(`[update] error`, err);
    sendUpdateMessage('update-error', { code: -1, msg: err.message, data: err });
  });

  autoUpdater.on('download-progress', (progress: any) => {
    const percent = Math.trunc(progress.percent);
    logger.info(`[update] download progress: ${percent}%`);
    sendUpdateMessage('download-progress', { code: 0, msg: 'ok', data: { percent, downloaded: percent === 100 } });
  });

  autoUpdater.on('update-downloaded', () => {
    logger.info('[update] downloaded');
    sendUpdateMessage('update-downloaded', { code: 0, msg: 'ok', data: { percent: 100, downloaded: true } });
  });

  logger.info(`[update][init] path:${updatePath}`);
};
