import { BrowserWindow, ipcMain, dialog, shell } from 'electron';
import PATH from 'path';
import FS from 'fs';
import FSE from 'fs-extra'
import chokidar from 'chokidar';
import util from 'util';
import os from 'os'

const changeListeners = new Map<string,chokidar.FSWatcher> ;

const path_to_arcitect = (path: string) => path.split(PATH.sep).join('/')
const path_to_system = (path: string) => path.split('/').join(PATH.sep)

export const LocalFileSystemService = {

  getAllXLSX_: (files,directory) => {
    const filesInDirectory = FS.readdirSync(directory);
    for(const file of filesInDirectory) {
      const absolute = PATH.join(directory, file);
      if (FS.statSync(absolute).isDirectory()) {
          LocalFileSystemService.getAllXLSX_(files,absolute);
      } else if(file.endsWith('.xlsx')) {
          files.push(absolute);
      }
    }
  },

  getAllXLSX: async (e,root) => {
    root = path_to_system(root);
    let xlsx_files = [];
    LocalFileSystemService.getAllXLSX_(xlsx_files,root);
    return xlsx_files.map( p=>path_to_arcitect(p.replace(root+PATH.sep,'')) );
  },

  readDir: (e,path) => {
    path = path_to_system(path)
    const children = [];

    const labels = FS.readdirSync(path);
    for(const l of labels){
      const path_ = PATH.join(path,l);
      const stat = FS.lstatSync(path_);
      if(l.startsWith('isa.') || l.startsWith('.git') || l.startsWith('.arc'))
        continue;

      stat.id = path_to_arcitect(path_);
      stat.isDirectory = stat.isDirectory();
      children.push(stat);
    }

    return children;
  },

  selectDir: async (e,[title,message])=>{
    const window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
    const result = await dialog.showOpenDialog(window, {
      title: title,
      message: message,
      properties: ['openDirectory']
    });
    const path = result.filePaths[0];
    return path ? path_to_arcitect(path) : null;
  },

  selectAny: async ()=>{
    const window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile','openDirectory','multiSelections']
    });
    return result ? result.filePaths.map(path_to_arcitect) : null;
  },

  saveFile: async ()=>{
    const window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
    const result = await dialog.showSaveDialog(window);
    return path_to_arcitect(result.filePath);
  },

  readFile: (e,parameters)=>{
    let path=null;
    let options={encoding:'UTF8'};
    if(typeof parameters === 'string'){
      path = parameters;
    } else {
      path = parameters[0];
      options = parameters[1];
    }
    path = path_to_system(path)
    // const file = FS.readFileSync(path,{encoding:encoding});
    return FS.readFileSync(path,options);
  },

  copy: async (e,[src,dst])=>{
    src = path_to_system(src)
    dst = path_to_system(dst)
    try {
      FSE.copySync(src, PATH.join(dst,PATH.basename(src)), { overwrite: true })
      return 1;
    } catch (err) {
      console.error(err);
      return 0;
    }
  },

  registerChangeListener: async (e,path)=>{
    path = path_to_system(path)

    if(changeListeners.has(path))
      await LocalFileSystemService.unregisterChangeListener(null,path);
    const listener = chokidar.watch(path,{ignoreInitial:true, usePolling: os.platform()==='win32'});
    changeListeners.set(path, listener);

    const updatePath = path => {
      const window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
      window?.webContents.send('LocalFileSystemService.updatePath', path_to_arcitect(path));
    };
    const updateParentPath = path => {
      updatePath( PATH.dirname(path) );
    };

    listener
      // .on('all', (event, path) => {
      //   // console.log(event,path);
      // })
      .on('add', updateParentPath)
      .on('unlink', updateParentPath)
      .on('addDir', updateParentPath)
      .on('unlinkDir', updateParentPath)
    ;

    return;
  },

  unregisterChangeListener: async (e,path)=>{
    // console.log('ul',path)
    path = path_to_system(path)
    const watcher = changeListeners.get(path);
    if(!watcher)
      return;

    await watcher.unwatch(path);
    changeListeners.delete(path);
    return;
  },

  createEmptyFile: async (e,path)=>{
    path = path_to_system(path)
    const fpath = (path.slice(-3)==='.md' || path.slice(-4)==='.txt') ? path : path +'.md';
    FS.writeFileSync(fpath,"");
    return fpath;
  },

  writeFile: async (e,[path,data,options])=>{
    options = options || {encoding:'UTF-8'};
    path = path_to_system(path);
    FS.mkdirSync(PATH.dirname(path),{recursive:true});
    if(data==='' && FS.existsSync(path)) return;
    try {
        FS.writeFileSync(path,data,options);
    } catch (err) {
        let window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
        window?.webContents.send('CORE.MSG', err);
    }
  },

  getPathSeparator: async e=>{
    return PATH.sep;
  },

  getFileSizes: async (e,file_paths)=>{
    const sizes = [];
    for(let file_path of file_paths){
      file_path = path_to_system(file_path);
      let size = 0;
      try {
        size = FS.statSync(file_path).size / (1024*1024);
      } catch {}
      sizes.push( size );
    }
    return sizes;
  },

  exists: async (e,path)=>{
    try {
      FS.statSync(path_to_system(path))
      return true;
    } catch {return false;}
  },

  remove: async (e,path)=>{
    try {
      FS.rmSync(path_to_system(path), {recursive:true,force:true});
      return true;
    } catch {return false;}
  },

  openPath: async (e, path:string)=>{
    path = path_to_system(path)
    try {
        shell.openPath(path);
        return true
    } catch {
        return false
    }
  },

  init: async () => {
    process.on('unhandledRejection', (reason, p) => {
      console.error(`Unhandled Rejection at: ${util.inspect(p)} reason: ${reason}`);
    });

    ipcMain.handle('LocalFileSystemService.remove', LocalFileSystemService.remove);
    ipcMain.handle('LocalFileSystemService.readDir', LocalFileSystemService.readDir);
    ipcMain.handle('LocalFileSystemService.readFile', LocalFileSystemService.readFile);
    ipcMain.handle('LocalFileSystemService.writeFile', LocalFileSystemService.writeFile);
    ipcMain.handle('LocalFileSystemService.selectDir', LocalFileSystemService.selectDir);
    ipcMain.handle('LocalFileSystemService.selectAny', LocalFileSystemService.selectAny);
    ipcMain.handle('LocalFileSystemService.saveFile', LocalFileSystemService.saveFile);
    ipcMain.handle('LocalFileSystemService.copy', LocalFileSystemService.copy);
    ipcMain.handle('LocalFileSystemService.createEmptyFile', LocalFileSystemService.createEmptyFile);
    ipcMain.handle('LocalFileSystemService.registerChangeListener', LocalFileSystemService.registerChangeListener);
    ipcMain.handle('LocalFileSystemService.unregisterChangeListener', LocalFileSystemService.unregisterChangeListener);
    ipcMain.handle('LocalFileSystemService.getPathSeparator', LocalFileSystemService.getPathSeparator);
    ipcMain.handle('LocalFileSystemService.getAllXLSX', LocalFileSystemService.getAllXLSX);
    ipcMain.handle('LocalFileSystemService.getFileSizes', LocalFileSystemService.getFileSizes);
    ipcMain.handle('LocalFileSystemService.exists', LocalFileSystemService.exists);
    ipcMain.handle('LocalFileSystemService.openPath', LocalFileSystemService.openPath);
  }
}
