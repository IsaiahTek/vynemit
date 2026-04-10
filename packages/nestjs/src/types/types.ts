// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

import { NotificationConfig, NotificationTemplate } from "@vynelix/vynemit-core";

export const NOTIFICATION_OPTIONS = 'NOTIFICATION_OPTIONS';
export const NOTIFICATION_CENTER = 'NOTIFICATION_CENTER';

export interface NotificationsModuleOptions extends NotificationConfig {
  // Additional NestJS-specific options
  enableWebSocket?: boolean;
  websocketPort?: number;
  websocketPath?: string;
  enableRestApi?: boolean;
  apiPrefix?: string;
  
  // Guards
  authGuard?: any; // AuthGuard class
  
  // Templates
  templates?: NotificationTemplate[];
}

export interface NotificationsModuleAsyncOptions {
  imports?: any[];
  useFactory?: (...args: any[]) => Promise<NotificationsModuleOptions> | NotificationsModuleOptions;
  inject?: any[];
  enableWebSocket?: boolean;
  enableRestApi?: boolean;
}
