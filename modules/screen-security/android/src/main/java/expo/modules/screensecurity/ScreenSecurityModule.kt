package expo.modules.screensecurity

import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ScreenSecurityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ScreenSecurity")

    Function("setScreenshotsBlocked") { blocked: Boolean ->
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread {
        if (blocked) {
          activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
          activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
      }
    }

    Function("isScreenshotsBlocked") {
      appContext.currentActivity
        ?.let { activity ->
          (activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE) != 0
        }
        ?: true
    }
  }
}
