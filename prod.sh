#!/bin/bash
# Requires the aws cli for s3 deploys (make sure to set your bucket region!)
# Requires that android-release-key.keystore be in the directory above
# Requires that you run `aws configure set preview.cloudfront true` to enable cloudfront invalidation
# Builds prod versions of the android (expedition.apk), iOS and web apps
# and deploys to app.expeditiongame.com, including invalidating the files on cloudfront (CDN)

# To generate a new key:
# keytool -genkey -v -keystore android-release-key.keystore -alias expedition_android -keyalg RSA -keysize 2048 -validity 10000
# Tutorial:
# http://developer.android.com/tools/publishing/app-signing.html#signing-manually

read -p "Did you test a quest on the beta build? (y/N) " -n 1
printf "\nEnter android keystore passphrase: "
read -s androidkeystorepassphrase
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  rm -rf www
  rm platforms/android/build/outputs/apk/expedition.apk

  # Rebuild the web app files
  export NODE_ENV='production'
  export API_HOST='https://api.expeditiongame.com'
  webpack --config ./webpack.dist.config.js

  # Android: build the signed prod app
  cordova build --release android
  # Signing the release APK
  jarsigner -storepass $androidkeystorepassphrase -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore ../android-release-key.keystore platforms/android/build/outputs/apk/android-release-unsigned.apk expedition_android
  # Verification:
  jarsigner -verify -verbose -certs platforms/android/build/outputs/apk/android-release-unsigned.apk
  # Aligning memory blocks (takes less RAM on app)
  ./zipalign -v 4 platforms/android/build/outputs/apk/android-release-unsigned.apk platforms/android/build/outputs/apk/expedition.apk

  # iOS
  cordova build ios

  # Deploy web app to prod with 1 day cache
  export AWS_DEFAULT_REGION='us-east-2'
  aws s3 cp www s3://app.expeditiongame.com --recursive --cache-control max-age=86400 --cache-control public

  # Upload the APK for side-loading
  aws s3 cp platforms/android/build/outputs/apk/expedition.apk s3://app.expeditiongame.com/expedition.apk

  # Invalidate files on cloudfront
  aws cloudfront create-invalidation --distribution-id EDFP2F13AASZW --paths /\*
else
  echo "Prod build cancelled until tested on beta."
fi
