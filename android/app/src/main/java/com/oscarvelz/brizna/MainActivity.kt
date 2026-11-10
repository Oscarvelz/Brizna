package com.oscarvelz.brizna

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.graphics.Color
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.os.PowerManager
import android.os.SystemClock
import android.print.PrintAttributes
import android.print.PrintJob
import android.print.PrintManager
import android.provider.MediaStore
import android.provider.Settings
import android.speech.RecognizerIntent
import android.util.Base64
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.*
import android.widget.FrameLayout
import android.widget.Toast
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

/**
 * Brizna for Android: a thin shell around the Brizna web app, loaded live from GitHub Pages so every web release
 * arrives on its own (the service worker keeps it working offline after the first open). The app's WebView storage is
 * its own, separate from Chrome's: the clients come back by signing in (Nube) or restoring a backup.
 *
 * The page talks to the app through window.BriznaNative (src/spa/native.ts in the web source, feature-detected there):
 * Back (BriznaBack / atRoot), bar colours, downloads into Downloads/Brizna, the share sheet, printing, the phone's
 * BiometricPrompt for the fingerprint lock, local reminders (Notify.kt), the battery exemption and the "Hoy" widget.
 * Nothing in the web app changes when BriznaNative is absent.
 */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var root: FrameLayout
    private lateinit var frame: FrameLayout
    private lateinit var statusBg: View
    private val home = "https://oscarvelz.github.io/Brizna/"
    private val prefs by lazy { getSharedPreferences("brizna-shell", MODE_PRIVATE) }
    private var topColor = Color.BLACK
    private var bottomColor = Color.BLACK
    private var topDark = true
    private var bottomDark = true
    private var fileCb: ValueCallback<Array<Uri>>? = null
    private var camUri: Uri? = null
    private var geoAsk: Pair<String, GeolocationPermissions.Callback>? = null
    @Volatile private var trusted = false
    @Volatile private var pageReady = false
    @Volatile private var pendingRoute: String? = null
    private var lastBack = 0L
    private val crashes = ArrayList<Long>()
    private val saves = ConcurrentHashMap<String, Save>()
    private val shares = ConcurrentHashMap<String, Share>()
    private val main = Handler(Looper.getMainLooper())
    // android-3: "A inglés" on the phone (ML Kit)
    private val translator by lazy { Translate(this) { d -> event("briznanative-translate", d) } }
    // android-4: "Dictar" with the phone's speech recognizer (a WebView has no Web Speech recognition)
    // android-8: when every bound service disconnects, Dictate asks for the system's own speech screen.
    private val dictation by lazy {
        Dictate(this) { d -> event("briznanative-dictate", d) }.also { dc ->
            dc.systemFallback = { id, lang -> launchSpeechUi(id, lang) }
        }
    }
    /** The dictation id waiting on the system's speech screen (RQ_SPEECH), or null. */
    private var speechAsk: String? = null

    /** android-8: open the system's speech screen (the one the keyboard's microphone opens). False when none exists. */
    private fun launchSpeechUi(id: String, lang: String): Boolean {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        if (intent.resolveActivity(packageManager) == null) return false
        speechAsk = id
        return try { startActivityForResult(intent, RQ_SPEECH); true }
        catch (e: ActivityNotFoundException) { speechAsk = null; false }
    }
    private var micAsk: Pair<String, String>? = null
    private var dictId: String? = null
    private var webMicAsk: PermissionRequest? = null

    private class Save(val uri: Uri, val out: OutputStream, val name: String)
    private class Share(val files: MutableList<Pair<File, String>>, var cur: OutputStream?)

    companion object {
        private const val RQ_FILES = 7
        private const val RQ_CAMERA = 8
        private const val RQ_NOTIFY = 9
        private const val RQ_GEO = 10
        private const val RQ_MIC = 11
        private const val RQ_WEBMIC = 12
        private const val RQ_SPEECH = 13
        private const val HOST = "oscarvelz.github.io"
        private const val AUTH = BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        private const val REPO_RELEASES = "https://api.github.com/repos/Oscarvelz/Brizna/releases?per_page=30"
    }

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        topColor = prefs.getInt("top", topColor); bottomColor = prefs.getInt("bottom", bottomColor)
        topDark = prefs.getBoolean("topDark", true); bottomDark = prefs.getBoolean("bottomDark", true)
        // 1.4.98 (android-2): the system splash leaves at once (no icon animation); the page's own splash follows on
        // the same ground colour.
        if (Build.VERSION.SDK_INT >= 31) runCatching { splashScreen.setOnExitAnimationListener { it.remove() } }
        splashFor(topDark)
        window.setDecorFitsSystemWindows(false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        window.isNavigationBarContrastEnforced = false
        window.isStatusBarContrastEnforced = false
        Notify.channels(this)

        root = FrameLayout(this)
        frame = FrameLayout(this)
        statusBg = View(this)
        web = makeWeb()
        frame.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        root.addView(frame, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        root.addView(statusBg, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, Gravity.TOP))
        // The page sits between the system bars like the installed PWA; the status bar shows the colour at the top of
        // the page, the navigation bar the colour at its bottom (both sent by the page; AMOLED night is #000).
        root.setOnApplyWindowInsetsListener { _, insets ->
            val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
            val ime = insets.getInsets(WindowInsets.Type.ime())
            frame.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            statusBg.layoutParams = (statusBg.layoutParams as FrameLayout.LayoutParams).apply { height = bars.top }
            WindowInsets.CONSUMED
        }
        setContentView(root)
        applyBars()
        takeRoute(intent)
        if (state != null) web.restoreState(state) else web.loadUrl(home)
        checkUpdate()
        Notify.arm(this)
        Notify.armWidgetTick(this)
    }

    /** Builds the page's WebView. Also used to start a fresh one if the page's process is ever lost. */
    private fun makeWeb(): WebView {
        val w = WebView(this)
        w.setBackgroundColor(topColor)
        w.settings.apply {
            javaScriptEnabled = true; domStorageEnabled = true; databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false; allowContentAccess = true
            setSupportMultipleWindows(true); javaScriptCanOpenWindowsAutomatically = true
            setGeolocationEnabled(true)
            textZoom = 100
            userAgentString = "$userAgentString BriznaAndroid/${BuildConfig.VERSION_NAME}"
        }
        ServiceWorkerController.getInstance().serviceWorkerWebSettings.apply {
            cacheMode = WebSettings.LOAD_DEFAULT; allowContentAccess = true; allowFileAccess = false
        }
        CookieManager.getInstance().setAcceptCookie(true)
        w.addJavascriptInterface(Bridge(), "BriznaNative")
        w.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                if (isBrizna(r.url)) return false
                openOutside(r.url); return true
            }
            override fun onPageStarted(v: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                trusted = url != null && isBrizna(Uri.parse(url)); pageReady = false
            }
            override fun onPageFinished(v: WebView, url: String?) {
                trusted = url != null && isBrizna(Uri.parse(url)); pageReady = trusted
                if (pageReady && pendingRoute != null) dispatch("dispatchEvent(new Event('briznanative-route'))")
            }
            override fun onReceivedError(v: WebView, r: WebResourceRequest, e: WebResourceError) {
                if (!r.isForMainFrame) return
                offlinePage(v, "Brizna necesita internet la primera vez que se abre; después funciona sin conexión.", "Intentar de nuevo")
            }
            // If the page's process dies (out of memory, say), Android would close the whole app unless the app says it
            // handled it. Start a fresh page instead.
            override fun onRenderProcessGone(v: WebView, detail: RenderProcessGoneDetail): Boolean {
                recoverWeb(v, detail.didCrash())
                return true
            }
        }
        w.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
                fileCb?.onReceiveValue(null); fileCb = cb
                return try { pickFiles(p); true } catch (e: Exception) { fileCb = null; false }
            }
            override fun onGeolocationPermissionsShowPrompt(origin: String, cb: GeolocationPermissions.Callback) {
                if (Uri.parse(origin).host != "oscarvelz.github.io") { cb.invoke(origin, false, false); return }
                if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    cb.invoke(origin, true, false); return
                }
                geoAsk = origin to cb
                requestPermissions(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION), RQ_GEO)
            }
            // android-4, second path: getUserMedia({audio}) from Brizna's own pages only, once Android's microphone
            // permission is granted (asked here if not). Every other origin and every other resource is refused.
            override fun onPermissionRequest(req: PermissionRequest) {
                runOnUiThread {
                    val own = req.origin?.scheme == "https" && req.origin?.host == HOST
                    val wantsAudio = req.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                    if (!own || !wantsAudio) { req.deny(); return@runOnUiThread }
                    if (micGranted()) { req.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE)); return@runOnUiThread }
                    webMicAsk?.deny(); webMicAsk = req
                    prefs.edit().putBoolean("askedMic", true).apply()
                    requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), RQ_WEBMIC)
                }
            }
            override fun onPermissionRequestCanceled(req: PermissionRequest) { if (webMicAsk === req) webMicAsk = null }
            // target=_blank / window.open: Brizna pages stay here, everything else opens in its own app or the browser.
            override fun onCreateWindow(v: WebView, dialog: Boolean, gesture: Boolean, msg: Message): Boolean {
                val probe = WebView(this@MainActivity)
                var done = false
                fun take(pv: WebView, u: Uri?): Boolean {
                    if (u == null || u.scheme == "about" || done) return true
                    done = true
                    if (isBrizna(u)) web.loadUrl(u.toString()) else openOutside(u)
                    pv.post { pv.stopLoading(); pv.destroy() }
                    return true
                }
                probe.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(pv: WebView, r: WebResourceRequest): Boolean = take(pv, r.url)
                    override fun onPageStarted(pv: WebView, url: String?, favicon: android.graphics.Bitmap?) { take(pv, url?.let { Uri.parse(it) }) }
                }
                (msg.obj as WebView.WebViewTransport).webView = probe
                msg.sendToTarget()
                return true
            }
        }
        w.setDownloadListener { url, _, _, _, _ ->
            // blob:/data: downloads are taken by the page (native.ts) and saved into Downloads/Brizna; real links open outside.
            if (url.startsWith("http")) openOutside(Uri.parse(url))
        }
        return w
    }

    private fun offlinePage(v: WebView, text: String, link: String) {
        val bg = String.format("#%06X", 0xFFFFFF and topColor)
        val fg = if (topDark) "#F5F5F5" else "#1A261C"
        val ac = if (topDark) "#4ADE80" else "#1F6A3A"
        v.loadDataWithBaseURL(home, "<html><head><meta name=viewport content='width=device-width'></head>" +
            "<body style=\"background:$bg;color:$fg;font:18px sans-serif;padding:32px;line-height:1.5\">" +
            "<p>$text</p><p><a style=\"color:$ac;font-weight:600\" href=\"$home\">$link</a></p></body></html>", "text/html", "utf-8", null)
    }

    /** A fresh page after the old one's process was lost, so the app stays open instead of closing. */
    private fun recoverWeb(dead: WebView, wasCrash: Boolean = false) {
        // android-9: el registro queda en silencio. La recuperación se anunciaba con un toast
        // («Brizna reabrió la página después de que se detuvo.») que Oscar reportó como un
        // problema — no sabía de dónde salía ni qué era. La recuperación no necesita anuncio:
        // la página reabre y el libro está intacto. A cambio, el evento queda registrado en
        // las prefs (cuenta, cuándo, si fue choque o el sistema reclamó el proceso) para
        // poder diagnosticarlo si vuelve a pasar seguido.
        runCatching {
            val gone = prefs.getInt("rendererGone", 0) + 1
            prefs.edit()
                .putInt("rendererGone", gone)
                .putLong("rendererGoneAt", System.currentTimeMillis())
                .putBoolean("rendererGoneCrash", wasCrash)
                .apply()
            android.util.Log.w("Brizna", "renderer gone #$gone crash=$wasCrash")
        }
        if (dead !== web) { runCatching { (dead.parent as? ViewGroup)?.removeView(dead); dead.destroy() }; return }
        frame.removeView(dead)
        runCatching { dead.destroy() }
        val now = SystemClock.elapsedRealtime()
        crashes.add(now)
        crashes.removeAll { now - it > 60_000 }
        web = makeWeb()
        frame.addView(web, 0, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        applyBars()
        if (crashes.size >= 3) {
            offlinePage(web, "Brizna tuvo que reabrir la página varias veces en un minuto, así que espera aquí. Tus datos están guardados en el teléfono.", "Abrir Brizna")
        } else {
            web.loadUrl(home)
        }
    }

    private fun isBrizna(u: Uri): Boolean {
        val s = u.scheme ?: return false
        if (s == "blob" || s == "data" || s == "about") return true
        val path = u.path ?: ""
        return s == "https" && u.host == "oscarvelz.github.io" && (path == "/Brizna" || path.startsWith("/Brizna/"))
    }

    private fun openOutside(u: Uri) {
        try {
            val i = when (u.scheme) {
                "intent" -> Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME).apply { selector = null; component = null }
                "tel" -> Intent(Intent.ACTION_DIAL, u)
                "sms", "smsto", "mailto" -> Intent(Intent.ACTION_SENDTO, u)
                else -> Intent(Intent.ACTION_VIEW, u)
            }
            if (u.scheme == "http" || u.scheme == "https" || u.scheme == "intent") i.addCategory(Intent.CATEGORY_BROWSABLE)
            startActivity(i)
        } catch (_: Exception) {
            Toast.makeText(this, "No hay una app para abrir este enlace.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun dispatch(js: String) = runOnUiThread { if (::web.isInitialized) web.evaluateJavascript(js, null) }
    private fun event(name: String, detail: JSONObject? = null) =
        dispatch(if (detail == null) "dispatchEvent(new Event('$name'))" else "dispatchEvent(new CustomEvent('$name',{detail:$detail}))")

    /** Android 13+: the next launch's system splash takes the ground of the theme the page shows now (night black / day linen). */
    private var splashDark: Boolean? = null
    private fun splashFor(dark: Boolean) {
        if (Build.VERSION.SDK_INT < 33 || splashDark == dark) return
        splashDark = dark
        runCatching { splashScreen.setSplashScreenTheme(if (dark) R.style.Brizna else R.style.Brizna_Day) }
    }

    private fun applyBars() {
        statusBg.setBackgroundColor(topColor)
        root.setBackgroundColor(bottomColor)
        frame.setBackgroundColor(bottomColor)
        web.setBackgroundColor(topColor)
        window.decorView.setBackgroundColor(bottomColor)
        val ls = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
        val ln = WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
        window.insetsController?.setSystemBarsAppearance((if (topDark) 0 else ls) or (if (bottomDark) 0 else ln), ls or ln)
    }

    private fun parseColor(s: String): Int? = runCatching {
        val t = s.trim()
        when {
            t.startsWith("#") -> Color.parseColor(t)
            t.startsWith("rgb") -> { val n = Regex("[\\d.]+").findAll(t).map { it.value.toFloat() }.toList(); Color.rgb(n[0].toInt(), n[1].toInt(), n[2].toInt()) }
            else -> null
        }
    }.getOrNull()

    /* ---------- files: camera, pictures, backups ---------- */

    private fun pickFiles(p: WebChromeClient.FileChooserParams) {
        val accept = p.acceptTypes.flatMap { it.split(',') }.map { it.trim().lowercase() }.filter { it.isNotEmpty() }
        val imagesOnly = accept.isNotEmpty() && accept.all { it.startsWith("image/") || it in setOf(".jpg", ".jpeg", ".png", ".webp", ".heic") }
        val multiple = p.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE
        if (p.isCaptureEnabled && imagesOnly) {
            val dir = File(cacheDir, "camera").apply { mkdirs() }
            dir.listFiles()?.forEach { if (System.currentTimeMillis() - it.lastModified() > 86_400_000L) it.delete() }
            val f = File(dir, "Brizna-${System.currentTimeMillis()}.jpg")
            val uri = FileProvider.getUriForFile(this, "com.oscarvelz.brizna.files", f)
            camUri = uri
            val cam = Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, uri)
                .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            startActivityForResult(cam, RQ_CAMERA)
            return
        }
        val intent = if (imagesOnly && Build.VERSION.SDK_INT >= 33) {
            Intent(MediaStore.ACTION_PICK_IMAGES).apply { if (multiple) putExtra(MediaStore.EXTRA_PICK_IMAGES_MAX, minOf(12, MediaStore.getPickImagesMaxLimit())) }
        } else {
            Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).apply {
                // Exact MIME filters grey out .json backups that phones label oddly, so only pictures are filtered.
                type = if (imagesOnly) "image/*" else "*/*"
                if (multiple) putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }
        }
        try { startActivityForResult(intent, RQ_FILES) }
        catch (e: ActivityNotFoundException) {
            startActivityForResult(Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType(if (imagesOnly) "image/*" else "*/*")
                .apply { if (multiple) putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true) }, RQ_FILES)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(rq: Int, rc: Int, d: Intent?) {
        when (rq) {
            RQ_CAMERA -> {
                val u = camUri; camUri = null
                val ok = rc == RESULT_OK && u != null && runCatching { contentResolver.openFileDescriptor(u, "r")?.use { it.statSize > 0 } ?: false }.getOrDefault(false)
                fileCb?.onReceiveValue(if (ok) arrayOf(u!!) else null); fileCb = null
            }
            RQ_FILES -> {
                val cd = d?.clipData
                val res: Array<Uri>? = if (rc != RESULT_OK) null
                    else if (cd != null && cd.itemCount > 0) Array(cd.itemCount) { cd.getItemAt(it).uri }
                    else d?.data?.let { arrayOf(it) }
                fileCb?.onReceiveValue(res); fileCb = null
            }
            RQ_SPEECH -> {
                // android-8: the system's speech screen closed — hand what it heard back to Dictate.
                val ask = speechAsk; speechAsk = null
                if (ask != null) {
                    val text = if (rc == RESULT_OK) d?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull() else null
                    dictation.deliverSystem(ask, text)
                }
            }
            else -> super.onActivityResult(rq, rc, d)
        }
    }

    override fun onRequestPermissionsResult(rq: Int, perms: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(rq, perms, results)
        val granted = results.isNotEmpty() && results.any { it == PackageManager.PERMISSION_GRANTED }
        when (rq) {
            RQ_NOTIFY -> { if (granted) Notify.arm(this); event("briznanative-status") }
            RQ_GEO -> {
                val ask = geoAsk; geoAsk = null
                ask?.second?.invoke(ask.first, granted, false)
            }
            RQ_MIC -> {
                val ask = micAsk; micAsk = null
                if (ask == null) return
                if (granted) { dictId = ask.first; dictation.start(ask.first, ask.second) }
                else {
                    val why = micRefusal()
                    prefs.edit().putBoolean("micRefused", why == "blocked").apply()
                    event("briznanative-dictate", JSONObject().put("id", ask.first).put("ok", false).put("error", why))
                }
            }
            RQ_WEBMIC -> {
                val r = webMicAsk; webMicAsk = null
                if (granted) r?.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) else r?.deny()
            }
        }
    }

    /* ---------- routes from a reminder or the widget ---------- */

    private fun takeRoute(i: Intent?) {
        val r = i?.getStringExtra("route") ?: return
        if (i.action != "brizna.OPEN") return
        pendingRoute = if (r.startsWith("/")) r else "/"
        if (pageReady) event("briznanative-route")
    }

    /* ---------- the bridge ---------- */

    inner class Bridge {
        @JavascriptInterface fun version(): String = BuildConfig.VERSION_NAME
        @JavascriptInterface fun versionCode(): Int = BuildConfig.VERSION_CODE

        @JavascriptInterface fun setBars(top: String, bottom: String, darkTop: Boolean, darkBottom: Boolean) {
            if (!trusted) return
            val t = parseColor(top) ?: return
            val b = parseColor(bottom) ?: t
            runOnUiThread {
                topColor = t; bottomColor = b; topDark = darkTop; bottomDark = darkBottom
                prefs.edit().putInt("top", t).putInt("bottom", b).putBoolean("topDark", darkTop).putBoolean("bottomDark", darkBottom).apply()
                applyBars()
                splashFor(darkTop)
            }
        }

        @JavascriptInterface fun atRoot(msg: String) {
            runOnUiThread { leaveOnSecondBack(msg.ifBlank { "Pulsa atrás otra vez para salir" }) }
        }

        @JavascriptInterface fun takeRoute(): String {
            if (!trusted) return ""
            val r = pendingRoute ?: return ""
            pendingRoute = null
            return r
        }

        /* translation (android-3) */

        @JavascriptInterface fun translateState(): String = translator.state()
        @JavascriptInterface fun translate(id: String, text: String) {
            if (!trusted) { event("briznanative-translate", JSONObject().put("id", id).put("ok", false).put("error", "failed")); return }
            runOnUiThread { translator.run(id, text) }
        }

        /* dictation (android-4) */

        /** "ready" (allowed), "ask" (Android will ask), "blocked" (refused for good: only app settings can allow it), "none" (no recognizer). */
        @JavascriptInterface fun dictateState(): String = when {
            !dictation.available() -> "none"
            micGranted() -> "ready"
            prefs.getBoolean("micRefused", false) && !shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO) -> "blocked"
            else -> "ask"
        }

        @JavascriptInterface fun dictate(id: String, lang: String) {
            if (!trusted) { event("briznanative-dictate", JSONObject().put("id", id).put("ok", false).put("error", "failed")); return }
            val l = if (Regex("^[a-z]{2}(-[A-Z]{2})?$").matches(lang)) lang else "es-US"
            runOnUiThread {
                if (!dictation.available()) { event("briznanative-dictate", JSONObject().put("id", id).put("ok", false).put("error", "none")); return@runOnUiThread }
                if (micGranted()) { dictId = id; dictation.start(id, l); return@runOnUiThread }
                // refused for good earlier: Android would answer "no" at once without asking, so say so straight away
                if (prefs.getBoolean("askedMic", false) && !shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO) && prefs.getBoolean("micRefused", false)) {
                    event("briznanative-dictate", JSONObject().put("id", id).put("ok", false).put("error", "blocked")); return@runOnUiThread
                }
                micAsk = id to l
                prefs.edit().putBoolean("askedMic", true).apply()
                event("briznanative-dictate", JSONObject().put("id", id).put("state", "asking"))
                requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), RQ_MIC)
            }
        }

        @JavascriptInterface fun dictateStop(id: String) { runOnUiThread { dictation.stop(id) } }
        @JavascriptInterface fun dictateCancel() { runOnUiThread { micAsk = null; dictId = null; speechAsk = null; dictation.cancel() } }

        /* fingerprint */

        @JavascriptInterface fun canAuth(): String {
            val bm = getSystemService(BiometricManager::class.java) ?: return "no"
            return if (bm.canAuthenticate(AUTH) == BiometricManager.BIOMETRIC_SUCCESS) "yes" else "no"
        }

        @JavascriptInterface fun authenticate(id: String, title: String, subtitle: String) {
            if (!trusted) { authReply(id, false); return }
            runOnUiThread {
                try {
                    val prompt = BiometricPrompt.Builder(this@MainActivity)
                        .setTitle(title.ifBlank { "Desbloquear Brizna" })
                        .setSubtitle(subtitle)
                        .setAllowedAuthenticators(AUTH)
                        .build()
                    prompt.authenticate(CancellationSignal(), mainExecutor, object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) = authReply(id, true)
                        override fun onAuthenticationError(code: Int, msg: CharSequence) = authReply(id, false)
                        // onAuthenticationFailed (a finger not recognised) keeps the prompt open: no reply yet.
                    })
                } catch (e: Exception) { authReply(id, false) }
            }
        }

        /* downloads into Downloads/Brizna */

        @JavascriptInterface fun saveBegin(name: String, mime: String): String {
            if (!trusted) return "error"
            return try {
                val clean = cleanName(name)
                val v = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, clean)
                    put(MediaStore.MediaColumns.MIME_TYPE, mime.ifBlank { "application/octet-stream" })
                    put(MediaStore.MediaColumns.RELATIVE_PATH, "Download/Brizna/")
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
                val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v) ?: return "error"
                val out = contentResolver.openOutputStream(uri, "w") ?: return "error"
                var shown = clean
                contentResolver.query(uri, arrayOf(MediaStore.MediaColumns.DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) shown = c.getString(0) ?: clean }
                val id = java.util.UUID.randomUUID().toString()
                saves[id] = Save(uri, out, shown)
                id
            } catch (e: Exception) { "error" }
        }

        @JavascriptInterface fun saveChunk(id: String, b64: String): String {
            val s = saves[id] ?: return "error"
            return try { s.out.write(Base64.decode(b64, Base64.DEFAULT)); "ok" }
            catch (e: Exception) { drop(id); "error" }
        }

        @JavascriptInterface fun saveEnd(id: String, template: String): String {
            val s = saves.remove(id) ?: return "error"
            return try {
                s.out.close()
                contentResolver.update(s.uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
                val msg = template.ifBlank { "Guardado en Descargas › Brizna: %s" }.replace("%s", s.name)
                runOnUiThread { Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show() }
                "ok"
            } catch (e: Exception) { runCatching { contentResolver.delete(s.uri, null, null) }; "error" }
        }

        /* the Android share sheet (WhatsApp, mail, Drive) */

        @JavascriptInterface fun shareBegin(): String {
            if (!trusted) return "error"
            val dir = File(cacheDir, "share").apply { mkdirs() }
            dir.listFiles()?.forEach { if (System.currentTimeMillis() - it.lastModified() > 3_600_000L) it.delete() }
            val id = java.util.UUID.randomUUID().toString()
            shares[id] = Share(ArrayList(), null)
            return id
        }

        @JavascriptInterface fun shareFile(id: String, name: String, mime: String): String {
            val s = shares[id] ?: return "error"
            return try {
                runCatching { s.cur?.close() }
                val dir = File(File(cacheDir, "share"), id.take(8)).apply { mkdirs() }
                val f = File(dir, cleanName(name))
                s.cur = f.outputStream()
                s.files.add(f to mime.ifBlank { "application/octet-stream" })
                "ok"
            } catch (e: Exception) { "error" }
        }

        @JavascriptInterface fun shareChunk(id: String, b64: String): String {
            val s = shares[id] ?: return "error"
            return try { s.cur!!.write(Base64.decode(b64, Base64.DEFAULT)); "ok" } catch (e: Exception) { "error" }
        }

        @JavascriptInterface fun shareEnd(id: String, title: String, text: String): String {
            val s = shares.remove(id) ?: return "error"
            runCatching { s.cur?.close() }
            return try {
                val uris = ArrayList(s.files.map { FileProvider.getUriForFile(this@MainActivity, "com.oscarvelz.brizna.files", it.first) })
                val mimes = s.files.map { it.second }.distinct()
                val send = if (uris.size == 1) Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris[0])
                    else if (uris.isNotEmpty()) Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
                    else Intent(Intent.ACTION_SEND)
                send.type = if (uris.isEmpty()) "text/plain" else if (mimes.size == 1) mimes[0] else "*/*"
                if (text.isNotBlank()) send.putExtra(Intent.EXTRA_TEXT, text)
                if (title.isNotBlank()) send.putExtra(Intent.EXTRA_SUBJECT, title)
                if (uris.isNotEmpty()) {
                    send.clipData = ClipData.newRawUri(title, uris[0]).apply { for (u in uris.drop(1)) addItem(ClipData.Item(u)) }
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                runOnUiThread { startActivity(Intent.createChooser(send, title.ifBlank { "Compartir" })) }
                "ok"
            } catch (e: Exception) { "error" }
        }

        /* printing (WebView has no window.print) */

        @JavascriptInterface fun print(title: String) {
            if (!trusted) return
            runOnUiThread {
                try {
                    val pm = getSystemService(PrintManager::class.java) ?: return@runOnUiThread
                    val name = title.ifBlank { "Brizna" }.take(80)
                    val job = pm.print(name, web.createPrintDocumentAdapter(name), PrintAttributes.Builder().build())
                    watchPrint(job)
                } catch (e: Exception) { event("afterprint") }
            }
        }

        /* reminders */

        @JavascriptInterface fun setSchedule(json: String): String {
            if (!trusted) return "error"
            val n = Notify.store(this@MainActivity, json)
            return if (n < 0) "error" else "ok:$n"
        }

        @JavascriptInterface fun notifyStatus(): String {
            val nm = getSystemService(NotificationManager::class.java)
            val pm = getSystemService(PowerManager::class.java)
            val perm = when {
                nm?.areNotificationsEnabled() == true -> "granted"
                Build.VERSION.SDK_INT >= 33 && !prefs.getBoolean("askedNotify", false) -> "ask"
                else -> "denied"
            }
            val next = Notify.nextAt(this@MainActivity)
            return JSONObject()
                .put("permission", perm)
                .put("exact", Notify.canExact(this@MainActivity))
                .put("battery", pm?.isIgnoringBatteryOptimizations(packageName) == true)
                .put("samsung", Build.MANUFACTURER.equals("samsung", true))
                .put("widget", HoyWidget.hasWidgets(this@MainActivity))
                .put("panel", PanelWidget.hasWidgets(this@MainActivity))
                .put("semana", SemanaWidget.hasWidgets(this@MainActivity))
                .put("next", next)
                .put("count", Notify.read(this@MainActivity).size)
                .toString()
        }

        @JavascriptInterface fun requestNotify() {
            runOnUiThread {
                val nm = getSystemService(NotificationManager::class.java)
                if (nm?.areNotificationsEnabled() == true) { event("briznanative-status"); return@runOnUiThread }
                if (Build.VERSION.SDK_INT >= 33 && !prefs.getBoolean("askedNotify", false)) {
                    prefs.edit().putBoolean("askedNotify", true).apply()
                    requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), RQ_NOTIFY)
                } else {
                    // Asked before and refused: Android only lets the person turn it on in the app's notification settings.
                    open(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
                }
            }
        }

        @JavascriptInterface fun requestBattery() {
            runOnUiThread {
                val ok = open(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
                if (!ok) open(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
            }
        }

        @JavascriptInterface fun requestExact() {
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= 31) open(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:$packageName")))
            }
        }

        @JavascriptInterface fun openAppSettings() {
            runOnUiThread { open(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))) }
        }

        @JavascriptInterface fun testNotify(delayMs: Int, title: String, body: String) {
            if (!trusted) return
            Notify.channels(this@MainActivity)
            Notify.test(this@MainActivity, delayMs.toLong(), title, body)
        }

        /* the "Hoy" widget */

        @JavascriptInterface fun setWidget(json: String): String {
            if (!trusted) return "error"
            if (runCatching { JSONObject(json) }.isFailure) return "error"
            HoyWidget.save(this@MainActivity, json)
            return "ok"
        }
    }

    private fun micGranted() = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    /** After a refusal: "denied" when Android will ask again next time, "blocked" when only the app's settings can allow it. */
    private fun micRefusal() = if (shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO)) "denied" else "blocked"

    private fun open(i: Intent): Boolean = try { startActivity(i); true } catch (_: Exception) { false }

    private fun cleanName(name: String) = name.replace(Regex("[\\\\/:*?\"<>|\\n\\r]"), "_").trim().ifBlank { "Brizna" }.take(120)

    private fun watchPrint(job: PrintJob) {
        // Tell the page when the print dialog is done, like a browser's afterprint, so it puts its print pages away.
        val start = SystemClock.elapsedRealtime()
        val tick = object : Runnable {
            override fun run() {
                val done = job.isCompleted || job.isCancelled || job.isFailed
                if (done || SystemClock.elapsedRealtime() - start > 10 * 60_000) { event("afterprint"); return }
                main.postDelayed(this, 1000)
            }
        }
        main.postDelayed(tick, 1500)
    }

    private fun drop(id: String) {
        val s = saves.remove(id) ?: return
        runCatching { s.out.close() }; runCatching { contentResolver.delete(s.uri, null, null) }
    }

    private fun authReply(id: String, ok: Boolean) =
        dispatch("dispatchEvent(new CustomEvent('briznanative-auth',{detail:{id:${JSONObject.quote(id)},ok:$ok}}))")

    /* ---------- back ---------- */

    private fun leaveOnSecondBack(msg: String) {
        val now = System.currentTimeMillis()
        if (now - lastBack < 2000) finish()
        else { lastBack = now; Toast.makeText(this, msg, Toast.LENGTH_SHORT).show() }
    }

    @Deprecated("Deprecated in Java")
    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (!pageReady) { plainBack(); return }
        // Brizna's own history decides (each open sheet owns its step, jumps glide back); it calls atRoot() at the root.
        web.evaluateJavascript("(function(){try{return window.BriznaBack?window.BriznaBack():'none'}catch(e){return 'none'}})()") { r ->
            if (r == null || r.contains("none")) plainBack()
        }
    }

    private fun plainBack() {
        if (web.canGoBack()) web.goBack() else leaveOnSecondBack("Pulsa atrás otra vez para salir")
    }

    /* ---------- updates of the app itself ---------- */

    /** If GitHub has a newer android-N release with Brizna.apk, offer it (at most once a day per version) and install in place. */
    private fun checkUpdate() = Thread {
        try {
            val c = URL(REPO_RELEASES).openConnection() as HttpURLConnection
            c.setRequestProperty("Accept", "application/vnd.github+json"); c.connectTimeout = 8000; c.readTimeout = 8000
            val list = JSONArray(c.inputStream.bufferedReader().readText())
            var best = BuildConfig.VERSION_CODE
            var url: String? = null
            for (i in 0 until list.length()) {
                val r = list.getJSONObject(i)
                if (r.optBoolean("draft") || r.optBoolean("prerelease")) continue
                val n = r.getString("tag_name").takeIf { it.startsWith("android-") }?.substringAfter("android-")?.toIntOrNull() ?: continue
                if (n <= best) continue
                val assets = r.getJSONArray("assets")
                val apk = (0 until assets.length()).map { assets.getJSONObject(it) }.firstOrNull { it.getString("name") == "Brizna.apk" } ?: continue
                best = n; url = apk.getString("browser_download_url")
            }
            val found = url ?: return@Thread
            val askedAt = prefs.getLong("asked-$best", 0L)
            if (System.currentTimeMillis() - askedAt < 86_400_000L) return@Thread
            runOnUiThread {
                prefs.edit().putLong("asked-$best", System.currentTimeMillis()).apply()
                AlertDialog.Builder(this).setTitle("Nueva versión de la app Brizna")
                    .setMessage("Hay una versión nueva de la app. ¿Instalarla ahora? Tus clientes, tu cuenta y tus avisos se quedan igual.")
                    .setPositiveButton("Instalar") { _, _ -> install(found) }.setNegativeButton("Más tarde", null).show()
            }
        } catch (_: Exception) {}
    }.start()

    private fun install(url: String) {
        Toast.makeText(this, "Descargando la actualización", Toast.LENGTH_SHORT).show()
        Thread {
            try {
                val pi = packageManager.packageInstaller
                val id = pi.createSession(PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL))
                pi.openSession(id).use { s ->
                    val c = URL(url).openConnection() as HttpURLConnection; c.instanceFollowRedirects = true
                    c.inputStream.use { inp -> s.openWrite("brizna.apk", 0, -1).use { out -> inp.copyTo(out); s.fsync(out) } }
                    val back = Intent(this, MainActivity::class.java).setAction("brizna.INSTALL")
                    val pend = PendingIntent.getActivity(this, 1, back, PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
                    s.commit(pend.intentSender)
                }
            } catch (e: Exception) { runOnUiThread { Toast.makeText(this, "No se pudo actualizar: ${e.message}", Toast.LENGTH_LONG).show() } }
        }.start()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.action == "brizna.INSTALL") {
            when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -999)) {
                PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                    @Suppress("DEPRECATION") val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
                    if (confirm != null) startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                }
                PackageInstaller.STATUS_SUCCESS -> {}
                else -> Toast.makeText(this, "La actualización no se instaló: " + (intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: ""), Toast.LENGTH_LONG).show()
            }
            return
        }
        takeRoute(intent)
    }

    override fun onResume() {
        super.onResume()
        // Back from Android's settings (notifications, battery, exact alarms): the page re-reads the status.
        if (::web.isInitialized && pageReady) event("briznanative-status")
    }

    override fun onPause() {
        super.onPause()
        // leaving the app ends a dictation (what was heard so far is kept)
        dictId?.let { id -> dictation.stop(id) }
        CookieManager.getInstance().flush()
    }

    override fun onSaveInstanceState(out: Bundle) { super.onSaveInstanceState(out); web.saveState(out) }

    override fun onDestroy() {
        for (id in saves.keys.toList()) drop(id)
        translator.close()
        dictation.cancel()
        super.onDestroy()
    }
}
