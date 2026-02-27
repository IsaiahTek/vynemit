// ============================================================================
// REST API CONTROLLER
// ============================================================================

import { Controller, Put, Post, Delete, Get, Param, Query, Body, Sse, MessageEvent, Req } from "@nestjs/common";
import { Observable } from "rxjs";

type RequestLike = {
    once(event: 'close', listener: () => void): void;
    removeListener(event: 'close', listener: () => void): void;
};

import { NotificationsService } from "../services/notification.service";
import { NotificationFilters, NotificationInput, NotificationPreferences } from '@synq/notifications-core/';

@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Get('health')
    async health() {
        return this.notificationsService.healthCheck();
    }

    // @Sse(':userId/stream')
    // streamNotifications(
    //     @Param('userId') userId: string,
    //     @Req() req: RequestLike
    // ): Observable<MessageEvent> {
    //     return new Observable<MessageEvent>((subscriber) => {
    //         const push = (type: string, data: any) => subscriber.next({ type, data });

    //         void Promise.all([
    //             this.notificationsService.getForUser(userId, { limit: 20 }),
    //             this.notificationsService.getUnreadCount(userId),
    //         ]).then(([notifications, unreadCount]) => {
    //             push('initial-data', { notifications, unreadCount });
    //         }).catch((error) => {
    //             subscriber.error(error);
    //         });

    //         const unsubscribeNotification = this.notificationsService.subscribe(userId, (notification) => {
    //             console.log(`ATTEMPTING TO EMIT Notification sent for user ${notification.userId}:`, notification);
    //             // Stringify the IDs to handle cases where userId is an ObjectId or other complex type
    //             if (String(notification.userId) === String(userId)) {
    //                 console.log(`Emitting notification to client ${userId}:`, notification);
    //                 push('notification', {
    //                     type: 'notification',
    //                     notification,
    //                 });
    //             }
    //         });

    //         const unsubscribeUnread = this.notificationsService.onUnreadCountChange(userId, (count, changedUserId) => {
    //             if (String(changedUserId) === String(userId)) {
    //                 push('unread-count', {
    //                     type: 'unread-count',
    //                     count,
    //                 });
    //             }
    //         });

    //         const close = () => {
    //             unsubscribeNotification();
    //             unsubscribeUnread();
    //             subscriber.complete();
    //         };

    //         req.once('close', close);

    //         return () => {
    //             req.removeListener('close', close);
    //             close();
    //         };
    //     });
    // }

    @Get(':userId')
    async getNotifications(
        @Param('userId') userId: string,
        @Query('status') status?: string,
        @Query('type') type?: string,
        @Query('category') category?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string
    ) {
        const filters: NotificationFilters = {
            ...(status && { status: status as any }),
            ...(type && { type }),
            ...(category && { category }),
            ...(limit && { limit: parseInt(limit) }),
            ...(offset && { offset: parseInt(offset) })
        };

        return this.notificationsService.getForUser(userId, filters);
    }

    @Get(':userId/unread-count')
    async getUnreadCount(@Param('userId') userId: string) {
        const count = await this.notificationsService.getUnreadCount(userId);
        return { count };
    }

    @Get(':userId/stats')
    async getStats(@Param('userId') userId: string) {
        return this.notificationsService.getStats(userId);
    }

    @Get(':userId/preferences')
    async getPreferences(@Param('userId') userId: string) {
        return this.notificationsService.getPreferences(userId);
    }

    @Put(':userId/preferences')
    async updatePreferences(
        @Param('userId') userId: string,
        @Body() preferences: Partial<NotificationPreferences>
    ) {
        await this.notificationsService.updatePreferences(userId, preferences);
        return { success: true };
    }

    @Post()
    async sendNotification(@Body() input: NotificationInput) {
        return this.notificationsService.send(input);
    }

    @Post('batch')
    async sendBatch(@Body() inputs: NotificationInput[]) {
        return this.notificationsService.sendBatch(inputs);
    }

    @Post(':userId/:id/read')
    async markAsRead(
        @Param('userId') userId: string,
        @Param('id') id: string
    ) {
        await this.notificationsService.markAsReadForUser(userId, id);
        return { success: true };
    }

    @Post(':userId/read-all')
    async markAllAsRead(@Param('userId') userId: string) {
        await this.notificationsService.markAllAsRead(userId);
        return { success: true };
    }

    @Delete(':userId/all')
    async deleteAll(@Param('userId') userId: string) {
        await this.notificationsService.deleteAll(userId);
        return { success: true };
    }

    @Delete(':userId/:id')
    async deleteNotification(
        @Param('userId') userId: string,
        @Param('id') id: string
    ) {
        await this.notificationsService.deleteForUser(userId, id);
        return { success: true };
    }

}
