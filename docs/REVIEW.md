# Revisão para Pull Request — web responsiva e Runway Gen-4.5

Base comparada: `main` / `6ed2412d2b0ad16ffce821a4dd2ee54c6c79bf15`.

## Resultado

- Projeto exclusivamente web, responsivo para celular e computador; Android/Capacitor/APK e build nativo removidos.
- `docs/VIDEO.md` presente e revisado: endpoints oficiais, limites, confirmação, tarefas persistidas, importação, requisitos e pendências.
- README e CI refletem somente web. Nenhum passo de deploy ou merge automático foi adicionado.
- Cadastro, sessões, isolamento, projetos, AutoSave, restauração, upload, reprodução, aprovação e exportações existentes preservados.
- As remoções se limitam a 56 arquivos do projeto nativo e `docs/ANDROID.md`; nenhum banco, mídia ou dado de usuário foi removido.

## Validação executada nesta revisão

| Verificação | Resultado |
| --- | --- |
| TypeScript (`npm run typecheck`) | Aprovado |
| API/adaptador (`npm test`) | 5 testes aprovados |
| Chromium (`npm run test:e2e`) | 2 testes aprovados, incluindo desktop/mobile e confirmação de custo |
| Produção (`npm run build`) | Aprovado |
| Geração real Runway | Não executada; testes usam provedores explicitamente simulados |
| Cobranças reais | Não configuradas nem executadas |

## Auditoria e limites

A revisão confere a árvore candidata ao commit e padrões de chaves/tokens, arquivos privados e configurações locais. `.env` e variantes, SQLite, mídias privadas, node_modules, relatórios/screenshot de testes e dist não são incluídos. Somente `.env.example` sem segredo é versionado. Valores de teste são fixtures explicitamente identificadas, nunca credenciais válidas. Busca por padrões não é garantia absoluta contra qualquer segredo desconhecido.

O backend continua SQLite/disco privado em uma instância persistente; funções efêmeras da Vercel não substituem essa API. Geração real, disponibilidade do provedor e importação de saída Runway ainda exigem homologação separada autorizada. Não se afirma estabilidade em produção. Veja `VIDEO.md` e `STATUS.md`.

## Lista completa de alterações em relação à main

Total: 77 arquivos (7 adicionados, 13 modificados, 57 removidos).

| Estado | Arquivo |
| --- | --- |
| M | `.env.example` |
| M | `.github/workflows/ci.yml` |
| M | `README.md` |
| D | `apps/android/android/.gitignore` |
| D | `apps/android/android/app/.gitignore` |
| D | `apps/android/android/app/build.gradle` |
| D | `apps/android/android/app/capacitor.build.gradle` |
| D | `apps/android/android/app/proguard-rules.pro` |
| D | `apps/android/android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java` |
| D | `apps/android/android/app/src/main/AndroidManifest.xml` |
| D | `apps/android/android/app/src/main/java/com/nexocena/studio/MainActivity.java` |
| D | `apps/android/android/app/src/main/res/drawable-land-hdpi/splash.png` |
| D | `apps/android/android/app/src/main/res/drawable-land-mdpi/splash.png` |
| D | `apps/android/android/app/src/main/res/drawable-land-xhdpi/splash.png` |
| D | `apps/android/android/app/src/main/res/drawable-land-xxhdpi/splash.png` |
| D | `apps/android/android/app/src/main/res/drawable-land-xxxhdpi/splash.png` |
| D | `apps/android/android/app/src/main/res/drawable-port-hdpi/splash.png` |
| D | `apps/android/android/app/src/main/res/drawable-port-mdpi/splash.png` |
| D | `apps/android/android/app/src/main/res/drawable-port-xhdpi/splash.png` |
| D | `apps/android/android/app/src/main/res/drawable-port-xxhdpi/splash.png` |
| D | `apps/android/android/app/src/main/res/drawable-port-xxxhdpi/splash.png` |
| D | `apps/android/android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml` |
| D | `apps/android/android/app/src/main/res/drawable/ic_launcher_background.xml` |
| D | `apps/android/android/app/src/main/res/drawable/nexocena_icon.xml` |
| D | `apps/android/android/app/src/main/res/drawable/splash.png` |
| D | `apps/android/android/app/src/main/res/layout/activity_main.xml` |
| D | `apps/android/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` |
| D | `apps/android/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml` |
| D | `apps/android/android/app/src/main/res/mipmap-hdpi/ic_launcher.png` |
| D | `apps/android/android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png` |
| D | `apps/android/android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png` |
| D | `apps/android/android/app/src/main/res/mipmap-mdpi/ic_launcher.png` |
| D | `apps/android/android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png` |
| D | `apps/android/android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png` |
| D | `apps/android/android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` |
| D | `apps/android/android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png` |
| D | `apps/android/android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png` |
| D | `apps/android/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` |
| D | `apps/android/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png` |
| D | `apps/android/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png` |
| D | `apps/android/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` |
| D | `apps/android/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png` |
| D | `apps/android/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png` |
| D | `apps/android/android/app/src/main/res/values/ic_launcher_background.xml` |
| D | `apps/android/android/app/src/main/res/values/strings.xml` |
| D | `apps/android/android/app/src/main/res/values/styles.xml` |
| D | `apps/android/android/app/src/main/res/xml/file_paths.xml` |
| D | `apps/android/android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java` |
| D | `apps/android/android/build.gradle` |
| D | `apps/android/android/capacitor.settings.gradle` |
| D | `apps/android/android/gradle.properties` |
| D | `apps/android/android/gradle/wrapper/gradle-wrapper.jar` |
| D | `apps/android/android/gradle/wrapper/gradle-wrapper.properties` |
| D | `apps/android/android/gradlew` |
| D | `apps/android/android/gradlew.bat` |
| D | `apps/android/android/settings.gradle` |
| D | `apps/android/android/variables.gradle` |
| D | `apps/android/capacitor.config.ts` |
| D | `apps/android/package.json` |
| A | `apps/api/src/generation.ts` |
| M | `apps/api/src/server.ts` |
| A | `apps/web/src/components/VideoGeneration.tsx` |
| A | `apps/web/src/lib/api.ts` |
| M | `apps/web/src/main.tsx` |
| M | `apps/web/src/style.css` |
| D | `docs/ANDROID.md` |
| M | `docs/OPERATIONS.md` |
| A | `docs/REVIEW.md` |
| M | `docs/STATUS.md` |
| A | `docs/VIDEO.md` |
| M | `package-lock.json` |
| M | `package.json` |
| A | `packages/ai-providers/src/runway.ts` |
| M | `playwright.config.ts` |
| M | `tests/browser/studio.spec.ts` |
| A | `tests/video.test.ts` |
| M | `tsconfig.json` |
