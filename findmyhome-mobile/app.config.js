/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: "Find My Home",
  slug: "findmyhome",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#1c1c1a",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: false,
    bundleIdentifier: "ug.findmyhome.app",
    infoPlist: {
      NSCameraUsageDescription: "Used to upload property photos and KYC documents.",
      NSPhotoLibraryUsageDescription: "Used to select property photos and KYC documents.",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#1c1c1a",
    },
    package: "ug.findmyhome.app",
    permissions: [
      "android.permission.CAMERA",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.VIBRATE",
      "android.permission.RECORD_AUDIO",
    ],
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#b8965a",
        sounds: [],
      },
    ],
    [
      "expo-image-picker",
      { photosPermission: "Allow Find My Home to access your photos." },
    ],
  ],
  scheme: "findmyhome",
  experiments: { typedRoutes: true },
  extra: {
    router: { origin: false },
    eas: { projectId: "6799d425-b641-4dd1-a3f4-e0211a37b6ed" },
  },
  owner: "profy256",
};

module.exports = { expo: config };
