// 仅用于 Node 环境自测的 Obsidian 桩模块。
// 把 obsidian 别名到本文件后，docx-core 可在无 Electron / 无浏览器环境下运行。
const noop = () => {};

const momentObj = { locale: () => "zh-cn" };
export const moment = Object.assign((..._a) => momentObj, { locale: () => "zh-cn" });

export class App {}
export class Plugin {}
export class Menu {}
export class Platform {
  static isMobile = false;
  static isDesktop = true;
}
export class TFile {}
export class TFolder {}
export class TAbstractFile {}
export class Vault {}
export const Notice = class {
  constructor(_m) {}
};
export const normalizePath = (p) => p;
export const requestUrl = async () => ({
  arrayBuffer: new ArrayBuffer(0),
  text: "",
  json: {},
});
export const setIcon = noop;
export const addIcon = noop;

export default {
  App,
  Plugin,
  Menu,
  Platform,
  TFile,
  TFolder,
  TAbstractFile,
  Vault,
  Notice,
  moment,
  normalizePath,
  requestUrl,
  setIcon,
  addIcon,
};
