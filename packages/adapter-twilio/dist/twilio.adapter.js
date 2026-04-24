"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwilioProvider = void 0;
const twilio_1 = require("twilio");
class TwilioProvider {
    constructor(config) {
        this.config = config;
        this.name = 'sms';
        if (!config.accountSid || !config.authToken) {
            throw new Error('Twilio Account SID and Auth Token are required');
        }
        if (!config.fromNumber && !config.messagingServiceSid) {
            throw new Error('Twilio requires either fromNumber or messagingServiceSid');
        }
        this.client = new twilio_1.Twilio(config.accountSid, config.authToken);
        if (this.config.debug) {
            console.log(`[Twilio] Initialized with ${config.messagingServiceSid ? 'Messaging Service: ' + config.messagingServiceSid : 'Number: ' + config.fromNumber}`);
        }
    }
    async send(notification, preferences) {
        try {
            const phoneNumber = this.resolvePhoneNumber(notification, preferences);
            if (!phoneNumber) {
                throw new Error('No phone number found for recipient');
            }
            const isWhatsApp = !!(notification.data?.whatsapp || phoneNumber.startsWith('whatsapp:'));
            const recipient = isWhatsApp && !phoneNumber.startsWith('whatsapp:')
                ? `whatsapp:${phoneNumber}`
                : phoneNumber;
            if (this.config.debug) {
                console.log(`[Twilio] Sending ${isWhatsApp ? 'WhatsApp' : 'SMS'} to ${recipient}`);
            }
            const messageParams = {
                body: notification.body,
                to: recipient,
            };
            if (this.config.messagingServiceSid) {
                messageParams.messagingServiceSid = this.config.messagingServiceSid;
            }
            else {
                messageParams.from = isWhatsApp && !this.config.fromNumber?.startsWith('whatsapp:')
                    ? `whatsapp:${this.config.fromNumber}`
                    : this.config.fromNumber;
            }
            const message = await this.client.messages.create(messageParams);
            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'sent',
                attempts: 1,
                lastAttempt: new Date(),
                metadata: {
                    messageSid: message.sid,
                    status: message.status,
                    errorCode: message.errorCode,
                }
            };
        }
        catch (error) {
            const errorMessage = error.message || 'Unknown Twilio error';
            const errorCode = error.code || undefined;
            if (this.config.debug) {
                console.error(`[Twilio] Failed to send: ${errorMessage} (Code: ${errorCode})`);
            }
            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'failed',
                attempts: 1,
                lastAttempt: new Date(),
                error: errorMessage,
                metadata: { errorCode }
            };
        }
    }
    async sendBatch(notifications, preferences) {
        if (this.config.debug) {
            console.log(`[Twilio] Batch sending ${notifications.length} messages`);
        }
        return Promise.all(notifications.map(notification => this.send(notification, preferences)));
    }
    async sendMulticast(notifications, preferences) {
        return this.sendBatch(notifications, preferences);
    }
    canSend(notification, preferences) {
        const phoneNumber = this.resolvePhoneNumber(notification, preferences);
        return !!phoneNumber;
    }
    async healthCheck() {
        try {
            // Simple check to see if we can access the account
            await this.client.api.accounts(this.config.accountSid).fetch();
            return true;
        }
        catch (error) {
            if (this.config.debug) {
                console.error('[Twilio] Health check failed', error);
            }
            return false;
        }
    }
    resolvePhoneNumber(notification, preferences) {
        // 1. Check notification data
        if (notification.data?.phoneNumber && typeof notification.data.phoneNumber === 'string') {
            return notification.data.phoneNumber;
        }
        // 2. Check preferences data
        if (preferences?.data?.phoneNumber && typeof preferences.data.phoneNumber === 'string') {
            return preferences.data.phoneNumber;
        }
        // 3. Check if userId looks like a phone number
        if (this.isValidPhoneNumber(notification.userId)) {
            return notification.userId;
        }
        return undefined;
    }
    isValidPhoneNumber(phone) {
        // Basic check for E.164-ish format (including whatsapp: prefix)
        const cleanPhone = phone.startsWith('whatsapp:') ? phone.split(':')[1] : phone;
        return /^\+?[1-9]\d{1,14}$/.test(cleanPhone);
    }
}
exports.TwilioProvider = TwilioProvider;
