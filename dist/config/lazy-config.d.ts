/**
 * lazy-config.ts — Lazy loading configuration defaults and normalization.
 */
import type { LazyConfig } from "../shared/types.js";
export declare const LAZY_DEFAULTS: Required<LazyConfig>;
export declare function normalizeLazyConfig(lazy?: LazyConfig): Required<LazyConfig>;
