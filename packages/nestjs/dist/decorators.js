"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InjectNotificationsService = void 0;
const common_1 = require("@nestjs/common");
const notification_service_1 = require("./services/notification.service");
const InjectNotificationsService = () => (0, common_1.Inject)(notification_service_1.NotificationsService);
exports.InjectNotificationsService = InjectNotificationsService;
//# sourceMappingURL=decorators.js.map