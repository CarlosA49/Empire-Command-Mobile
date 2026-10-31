# Build the iPhone/iPad app

The `ios/App/App.xcodeproj` project is the native iOS version of Empire Command Mobile. Its game files, icons, splash screens, app identifier, and Capacitor package definition are already included.

Apple's signing tools only run in Xcode on macOS, so the last build/install step must be performed on a Mac.

## Install on an iPhone or iPad

1. Extract `EmpireCommand-Mobile-iOS-Xcode-v0.1.0.zip` on a Mac.
2. Open `ios/App/App.xcodeproj` in Xcode 26 or newer.
3. Wait for Xcode to resolve the `CapApp-SPM` Swift package.
4. Select the **App** target, then **Signing & Capabilities**.
5. Enable **Automatically manage signing** and select your Apple development team.
6. If Xcode says the identifier is unavailable, change `com.empirecommand.mobile` to a unique identifier such as `com.yourname.empirecommand`.
7. Connect and unlock the iPhone/iPad, select it as the run destination, and press **Run**.
8. If prompted on the device, enable Developer Mode and trust the developer profile.

This installs a real native app shell with the full offline game inside it; it does not need the Windows PC while playing.

## Create an archive or IPA

1. In Xcode, select **Any iOS Device (arm64)** as the destination.
2. Choose **Product > Archive**.
3. In Organizer, choose **Distribute App** and the distribution method allowed by your Apple account.

The app targets iOS/iPadOS 15 or later, supports portrait and landscape, uses bundle identifier `com.empirecommand.mobile`, and has version `0.1.0` (build 1).
