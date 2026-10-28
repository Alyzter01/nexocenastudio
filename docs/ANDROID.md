# Android

Capacitor 8, package `com.nexocena.studio`, nome NEXOCENA STUDIO. Projeto nativo versionado, com Gradle wrapper. Requer Java 21 e Android SDK de acordo com `android/variables.gradle`.

```sh
npm ci
NEXOCENA_APP_URL=https://seu-dominio.example npm run android:sync
cd apps/android/android
./gradlew assembleDebug --no-daemon --max-workers=2
```

Defina `NEXOCENA_APP_URL` como variável do repositório no GitHub para o workflow. A URL deve servir web e API no mesmo domínio HTTPS. Sem URL configurada, o APK contém a interface local, mas a API não estará acessível: não é um aplicativo conectado funcional. O domínio deve estar sob seu controle. Nunca aponte para conteúdo não confiável. Não coloque segredos na URL.

O workflow valida tipos, testes, build web, sincroniza Capacitor, compila e disponibiliza o APK debug e SHA-256 como artifacts. Um artifact só existe se o job concluir. APK debug não é release de produção. Não foi executado build Android neste ambiente sem SDK.

Pendente: homologação dos ícones/splash vetoriais próprios, integração nativa de download/compartilhamento, tratamento explícito de Voltar e retomada, testes em dispositivo, assinatura release. A seleção de arquivo usa o input HTML da WebView. Upload/download devem ser homologados em dispositivo.

Para release, configure assinatura Gradle via variáveis/arquivo temporário injetado no CI e keystore armazenada como secret; nunca versione chave ou senha. O workflow atual produz somente debug e não promete uma release assinada.
