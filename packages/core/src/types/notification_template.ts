
import { ChannelType, Notification } from "../types";

export interface NotificationTemplate {
  id: string;
  type: string;
  defaults: {
    title: string | ((data: any) => string);
    body: string | ((data: any) => string);
    channels: ChannelType[];
    priority: Notification['priority'];
  };
}


// // Usage
// center.registerTemplate({
//   id: 'new-comment',
//   type: 'comment',
//   defaults: {
//     title: (data) => `${data.author} commented on your post`,
//     body: (data) => data.text,
//     channels: ['inapp', 'push'],
//     priority: 'normal'
//   }
// });

// // Now send using template
// center.send({
//   template: 'new-comment',
//   userId: 'user:123',
//   data: { author: 'Alice', text: 'Great post!' }
// });