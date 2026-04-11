import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart' as models;
import '../vynemit_provider.dart';

class NotificationBadge extends StatelessWidget {
  final Widget child;
  final Color? badgeColor;
  final TextStyle? textStyle;
  final bool hideIfEmpty;

  /// The visual size of the icon/child (not its touch target).
  /// Setting this constrains the badge overlay to the icon's visual bounds.
  /// Example: If wrapping an [IconButton] with a 24px icon, set [iconSize] to 24.
  final double? iconSize;

  /// Fine-tune the badge position offset from the top-right corner.
  /// Defaults to [Offset(6, -6)] which slightly overhangs the corner.
  final Offset badgeOffset;

  const NotificationBadge({
    Key? key,
    required this.child,
    this.badgeColor,
    this.textStyle,
    this.hideIfEmpty = true,
    this.iconSize,
    this.badgeOffset = const Offset(-5, 5),
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Consumer<VynemitProvider>(
      builder: (context, provider, _) {
        final count = provider.unreadCount;
        if (hideIfEmpty && count <= 0) return child;

        final badge = Transform.translate(
          offset: badgeOffset,
          child: Container(
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              color: badgeColor ?? Colors.red,
              shape: BoxShape.circle,
            ),
            constraints: const BoxConstraints(
              minWidth: 16,
              minHeight: 16,
            ),
            child: Text(
              count > 99 ? '99+' : count.toString(),
              style: textStyle ??
                  const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
              textAlign: TextAlign.center,
            ),
          ),
        );

        // If iconSize is provided, constrain the Stack to the visual icon size
        // so the badge anchors to the icon corner, not the larger touch target.
        if (iconSize != null) {
          return Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: [
              child,
              Positioned(
                width: iconSize,
                height: iconSize,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned(right: 0, top: 0, child: badge),
                  ],
                ),
              ),
            ],
          );
        }

        // Fallback: no iconSize, anchor at top-right of the child's own bounds
        return Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            child,
            Positioned(
              right: 0,
              top: 0,
              child: badge,
            ),
          ],
        );
      },
    );
  }
}

class NotificationList extends StatelessWidget {
  final Widget? emptyWidget;
  final Widget Function(BuildContext, models.Notification)? itemBuilder;
  final EdgeInsets? padding;

  const NotificationList({
    Key? key,
    this.emptyWidget,
    this.itemBuilder,
    this.padding,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Consumer<VynemitProvider>(
      builder: (context, provider, _) {
        if (provider.loading && provider.notifications.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }

        if (provider.notifications.isEmpty) {
          return emptyWidget ??
              const Center(child: Text('No notifications yet.'));
        }

        return RefreshIndicator(
          onRefresh: provider.fetchNotifications,
          child: ListView.builder(
            padding: padding ?? EdgeInsets.zero,
            itemCount: provider.notifications.length,
            itemBuilder: (context, index) {
              final notification = provider.notifications[index];
              if (itemBuilder != null) return itemBuilder!(context, notification);
              return NotificationItem(notification: notification);
            },
          ),
        );
      },
    );
  }
}

class NotificationItem extends StatelessWidget {
  final models.Notification notification;
  final VoidCallback? onTap;
  final Widget? leading;
  final Widget? trailing;

  const NotificationItem({
    Key? key,
    required this.notification,
    this.onTap,
    this.leading,
    this.trailing,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final isUnread = notification.status != models.NotificationStatus.read;
    final provider = context.read<VynemitProvider>();

    return ListTile(
      onTap: () {
        if (isUnread) provider.markAsRead(notification.id);
        if (onTap != null) onTap!();
      },
      leading: leading ?? _buildDefaultLeading(),
      title: Text(
        notification.title,
        style: TextStyle(
          fontWeight: isUnread ? FontWeight.bold : FontWeight.normal,
        ),
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(notification.body),
          const SizedBox(height: 4),
          Text(
            _formatTimestamp(notification.createdAt),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
      trailing: trailing ?? (isUnread ? _buildUnreadIndicator() : null),
      isThreeLine: true,
    );
  }

  Widget _buildDefaultLeading() {
    IconData icon;
    Color color;

    switch (notification.priority) {
      case models.NotificationPriority.urgent:
        icon = Icons.error_outline;
        color = Colors.red;
        break;
      case models.NotificationPriority.high:
        icon = Icons.warning_amber_rounded;
        color = Colors.orange;
        break;
      default:
        icon = Icons.notifications_none;
        color = Colors.blue;
    }

    return CircleAvatar(
      backgroundColor: color.withOpacity(0.1),
      child: Icon(icon, color: color, size: 20),
    );
  }

  Widget _buildUnreadIndicator() {
    return Container(
      width: 8,
      height: 8,
      decoration: const BoxDecoration(
        color: Colors.blue,
        shape: BoxShape.circle,
      ),
    );
  }

  String _formatTimestamp(DateTime timestamp) {
    final now = DateTime.now();
    final difference = now.difference(timestamp);

    if (difference.inMinutes < 1) return 'Just now';
    if (difference.inMinutes < 60) return '${difference.inMinutes}m ago';
    if (difference.inHours < 24) return '${difference.inHours}h ago';
    if (difference.inDays < 7) return '${difference.inDays}d ago';

    return '${timestamp.day}/${timestamp.month}/${timestamp.year}';
  }
}
