import 'package:flutter_test/flutter_test.dart';

import 'package:vynemit_flutter_example/main.dart';

void main() {
  testWidgets('renders example content', (WidgetTester tester) async {
    await tester.pumpWidget(const ExampleApp());

    expect(find.text('vynemit_flutter'), findsOneWidget);
    expect(find.text('Package overview'), findsOneWidget);
    expect(find.text('NotificationConfig'), findsOneWidget);
    expect(find.text('Serialized notifications'), findsOneWidget);
  });
}
