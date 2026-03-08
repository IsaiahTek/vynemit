"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useServerSyncedStore = exports.useStore = exports.Store = exports.SynqStore = void 0;
__exportStar(require("synq-store"), exports);
var synq_store_1 = require("synq-store");
Object.defineProperty(exports, "SynqStore", { enumerable: true, get: function () { return synq_store_1.SynqStore; } });
var synq_store_2 = require("synq-store");
Object.defineProperty(exports, "Store", { enumerable: true, get: function () { return synq_store_2.Store; } });
var use_store_1 = require("./use_store");
Object.defineProperty(exports, "useStore", { enumerable: true, get: function () { return use_store_1.useStore; } });
Object.defineProperty(exports, "useServerSyncedStore", { enumerable: true, get: function () { return use_store_1.useServerSyncedStore; } });
//# sourceMappingURL=index.js.map