import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

/// With `--dart-define=FORGE_SHOTS=1` (decision 100), each test keeps a picture of its last screen in
/// build/forge-shots/: the PNG and a JSON record with what it shows, when, and the test. The QA engineer
/// records them for the dashboard with `forge shot --dir build/forge-shots`.
const _flag = String.fromEnvironment('FORGE_SHOTS');
const shots = _flag != '' && _flag != '0' && _flag != 'false';

/// The key of the [RepaintBoundary] the tests put around the app.
const screenKey = Key('forge-screen');

Future<void> keepScreen(
  WidgetTester tester,
  String what, {
  required String test,
}) async {
  if (!shots) return;
  // About a second of frames first, so a fading error or a button's ripple is finished in the picture.
  for (var i = 0; i < 20; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
  final boundary = tester.renderObject<RenderRepaintBoundary>(
    find.byKey(screenKey),
  );
  final png = await tester.runAsync(() async {
    final image = await boundary.toImage(
      pixelRatio: tester.view.devicePixelRatio,
    );
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    return bytes!.buffer.asUint8List();
  });
  final dir = Directory('build/forge-shots')..createSync(recursive: true);
  final name = what
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-|-$'), '');
  File('${dir.path}/$name.png').writeAsBytesSync(png!);
  File('${dir.path}/$name.json').writeAsStringSync(
    jsonEncode({
      'what': what,
      'at': DateTime.now().toUtc().toIso8601String(),
      'test': test,
      'file': '$name.png',
    }),
  );
}
