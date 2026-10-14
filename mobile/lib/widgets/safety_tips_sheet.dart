import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

Future<void> showSafetyTips(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: const Color(0xFF0F172A),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (context) => const SafetyTipsSheet(),
  );
}

class SafetyTipsSheet extends StatelessWidget {
  const SafetyTipsSheet({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.82,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Expanded(
                  child: Text(
                    'PREPARACIÓN',
                    style: TextStyle(
                      color: kKicker,
                      fontSize: 12,
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                  tooltip: 'Cerrar',
                ),
              ],
            ),
            Text(
              'Qué hacer en un sismo',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Pasos generales. Si las autoridades locales dan otra indicación, sigue esa.',
              style: TextStyle(color: kMuted),
            ),
            const SizedBox(height: 16),
            for (final section in safetySections) ...[
              Text(
                section.title,
                style: const TextStyle(
                  color: kKicker,
                  fontSize: 13,
                  letterSpacing: 1.1,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              for (var index = 0; index < section.steps.length; index++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 24,
                        child: Text(
                          '${index + 1}.',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      Expanded(child: Text(section.steps[index])),
                    ],
                  ),
                ),
              const SizedBox(height: 8),
            ],
          ],
        ),
      ),
    );
  }
}

class SafetySection {
  const SafetySection(this.title, this.steps);

  final String title;
  final List<String> steps;
}

const safetySections = <SafetySection>[
  SafetySection('Antes', [
    'Identifica lugares seguros en casa, el trabajo y la escuela, y acuerda un punto de encuentro con tu familia.',
    'Fija muebles altos y revisa cómo cerrar el gas y la electricidad.',
    'Ten a mano agua, una linterna, una radio, tus medicamentos y copias de documentos importantes.',
  ]),
  SafetySection('Durante', [
    'Agáchate, cúbrete y sujétate: métete bajo una mesa firme y agárrate hasta que termine el movimiento.',
    'Aléjate de ventanas, espejos, estanterías y de cualquier objeto que pueda caer.',
    'Si no hay un mueble cerca, agáchate junto a un muro interior y protégete la cabeza y el cuello.',
    'No uses escaleras ni el ascensor mientras se mueve el suelo.',
    'En la calle, aléjate de postes, cables, árboles y fachadas.',
    'Si vas conduciendo, detente en un lugar abierto y quédate dentro del vehículo.',
  ]),
  SafetySection('Después', [
    'Comprueba si alguien necesita ayuda y si hay grietas graves, olor a gas o cables sueltos.',
    'Si hueles gas, no enciendas interruptores ni llamas. Abre las ventanas y sal.',
    'Si el edificio está dañado, evacúa por las escaleras.',
    'Si estás en la costa y las autoridades avisan de tsunami, aléjate del mar hacia una zona alta.',
    'Usa el teléfono solo para emergencias y sigue la información oficial. Puede haber réplicas.',
  ]),
];
