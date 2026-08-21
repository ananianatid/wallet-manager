#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_root"

package_name="com.ananianatid.wallettheapp"
artifact="android/app/build/outputs/apk/release/app-release.apk"

# L’APK doit utiliser une URL absolue : `/api` ne peut être résolu que par le
# navigateur qui partage le domaine de la vitrine. Une valeur explicitement
# fournie par l’environnement reste prioritaire pour les builds de test.
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://wallet-manager.causalset.sbs/api}"
echo "==> API cloud embarquée: $EXPO_PUBLIC_API_URL"

echo "==> Régénération Android propre..."
npx expo prebuild --clean --platform android --no-install

echo "==> Vérification de l'identité native..."
rg -q "namespace ['\"]$package_name['\"]" android/app/build.gradle || {
  echo "ERREUR: le namespace Android généré est incorrect." >&2
  exit 1
}
rg -q "applicationId ['\"]$package_name['\"]" android/app/build.gradle || {
  echo "ERREUR: l'applicationId Android généré est incorrect." >&2
  exit 1
}
rg -q '<string name="app_name">Wallet Manager</string>' \
  android/app/src/main/res/values/strings.xml || {
  echo "ERREUR: le nom Android généré est incorrect." >&2
  exit 1
}

echo "==> Build release arm64-v8a..."
(
  cd android
  NODE_ENV=production ./gradlew :app:assembleRelease \
    -PreactNativeArchitectures=arm64-v8a \
    --build-cache
)

test -s "$artifact"
abis="$(unzip -l "$artifact" | sed -nE 's#.*lib/([^/]+)/.*#\1#p' | sort -u)"
if [[ "$abis" != "arm64-v8a" ]]; then
  echo "ERREUR: architectures trouvées dans l'APK: $abis" >&2
  exit 1
fi

build_finished_at="$(date '+%d-%m-%Y-%H-%M-%S')"
output="dist/wallet-manager-arm64-${build_finished_at}.apk"
mkdir -p dist
cp "$artifact" "$output"

# Rafraîchir aussi les chemins utilisés par la vitrine et les habitudes
# d'installation existantes. Ils doivent toujours pointer vers ce build,
# sinon un ancien APK peut encore être téléchargé et ouvrir la route web.
cp "$artifact" "dist/app-release.apk"
cp "$artifact" "public/app-release.apk"

echo "==> APK prêt: $output"
echo "==> Alias installation: dist/app-release.apk"
echo "==> Téléchargement web: public/app-release.apk"
ls -lh "$output"
