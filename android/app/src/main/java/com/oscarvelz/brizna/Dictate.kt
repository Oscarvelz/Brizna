package com.oscarvelz.brizna

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognitionService
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import org.json.JSONObject

/**
 * android-4 (web 1.5.05): "Dictar" with the phone's own speech recognizer. A plain WebView has no Web Speech
 * recognition (webkitSpeechRecognition exists there but always fails with "not-allowed"), so the app listens itself.
 *
 * android-7 (web 1.5.19): the plan names the SERVICE, not just the mode. On Samsung phones the system default
 * recognition service is Samsung's own, and it answers third-party callers with ERROR_SERVER / ERROR_CLIENT —
 * the old plan's three steps all reached that same service (offline preference is only an extra on it), so the
 * cascade was an illusion and every dictation ended in the generic "failed". Now the services installed on the
 * phone are enumerated and Google's (the Google app, com.google.android.googlequicksearchbox) is bound
 * explicitly, ahead of the default. And the last recognizer error code rides along in the failure reply
 * ({..., code}) so the page can show it — a bare "failed" taught us nothing.
 *
 * android-8 (web 1.5.24): android-7 was installed and the phone answered with code 11 —
 * ERROR_SERVER_DISCONNECTED: every bound service, Google's explicitly-bound one included, dropped the
 * connection before hearing a word. Two changes. (a) The ladder gains its last rung: when every service
 * step has failed without hearing anything, MainActivity is asked (systemFallback) to open the SYSTEM's
 * own speech screen (RecognizerIntent.ACTION_RECOGNIZE_SPEECH — the same screen the keyboard's microphone
 * opens); its answer comes back through deliverSystem(). It is a visible screen, so it runs only after the
 * silent services are exhausted. (b) Every step's error code is recorded and the failure reply carries the
 * whole chain ({..., attempts:"google:11, default:11"}) — one bare last code hid which services died.
 * The on-device gate also drops from API 33 to 31, where createOnDeviceSpeechRecognizer actually arrived.
 *
 * android-10 (web 1.5.67): Oscar's phone reported the chain 13 · 13 · 11 and no system screen ever
 * opened, though rung 5 had existed since android-8. The cause was in the manifest: <queries> declared
 * the RecognitionService intent but never the RECOGNIZE_SPEECH intent, so on Android 11+
 * Intent.resolveActivity() answered null and launchSpeechUi() declined in silence — the last rung was
 * unreachable from the day it shipped. The manifest declares it now. Second wound in the same chain:
 * both offline steps died with 13 (the es-US on-device language pack is not downloaded on that phone),
 * so once an offline step reports the language unavailable (12/13) the remaining offline steps are
 * poisoned and skipped — the ladder reaches the online service and the system screen sooner.
 *
 * Order of recognizers, best first; the next one is tried only when one fails before it heard anything
 * (language pack missing, service gone):
 *   1. Android 12+: the on-device recognizer (createOnDeviceSpeechRecognizer), nothing leaves the phone.
 *   2. Google's recognition service bound explicitly, offline first, then as it is (skipped when it already
 *      IS the phone's default — the default steps below reach it).
 *   3. The phone's default recognizer asked to stay offline (EXTRA_PREFER_OFFLINE).
 *   4. The default recognizer as it is (it may use the network).
 *   5. The system's own speech screen (android-8, see above).
 * Replies go to the page as CustomEvent "briznanative-dictate":
 *   {id, state:"listening"|"processing"}, {id, partial}, then {id, ok:true, text} or {id, ok:false, error, code?}
 *   error: no-speech | denied | blocked | offline | busy | none | failed.
 * Must be used on the main thread (SpeechRecognizer's rule). The caller checks RECORD_AUDIO before start().
 */
class Dictate(private val ctx: Context, private val reply: (JSONObject) -> Unit) {
    private var rec: SpeechRecognizer? = null
    private var id: String? = null
    private var lang = "es-US"
    /** One attempt: an explicit service component (null = the phone's default), on-device, or plain; whether it is asked to stay offline; and its name for the attempts record. */
    private data class Step(val comp: ComponentName?, val onDevice: Boolean, val offline: Boolean, val label: String)
    private var plan = ArrayList<Step>()
    private var heard = false
    private var stopping = false
    private var busyRetry = false
    /** android-7: the last SpeechRecognizer error code seen this session (0 = none); it rides in the failure reply. */
    private var lastCode = 0
    /** android-8: every step's error, in plan order ("google:11"), so a failure shows the whole chain. */
    private val attempts = ArrayList<String>()
    /** android-8: MainActivity opens the system's speech screen when set; returns false when the phone has none. */
    var systemFallback: ((id: String, lang: String) -> Boolean)? = null
    private var triedSystem = false
    /** android-10: an offline step died with language-unavailable (12/13) — every other offline step would die the same way. */
    private var offlinePoisoned = false
    private val main = android.os.Handler(android.os.Looper.getMainLooper())

    /** "yes" when the phone has any speech recognizer, else "no". */
    fun available(): Boolean =
        SpeechRecognizer.isRecognitionAvailable(ctx) ||
            (Build.VERSION.SDK_INT >= 31 && runCatching { SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx) }.getOrDefault(false))

    fun start(newId: String, language: String) {
        cancel()
        id = newId
        lang = language.ifBlank { "es-US" }
        heard = false; stopping = false; busyRetry = false; lastCode = 0; attempts.clear(); triedSystem = false; offlinePoisoned = false
        plan = ArrayList()
        if (Build.VERSION.SDK_INT >= 31 && runCatching { SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx) }.getOrDefault(false)) plan.add(Step(null, onDevice = true, offline = true, label = "device"))
        if (SpeechRecognizer.isRecognitionAvailable(ctx)) {
            // Google's service explicitly, ahead of the default — unless it already is the default (see header).
            val google = recognitionServices().firstOrNull { it.packageName == "com.google.android.googlequicksearchbox" }
            if (google != null && google != defaultService()) {
                plan.add(Step(google, onDevice = false, offline = true, label = "google"))
                if (online()) plan.add(Step(google, onDevice = false, offline = false, label = "google"))
            }
            plan.add(Step(null, onDevice = false, offline = true, label = "default"))
            if (online()) plan.add(Step(null, onDevice = false, offline = false, label = "default"))
        }
        if (plan.isEmpty()) { finish(fail("none")); return }
        next()
    }

    /** android-8: the system's speech screen has closed. text = what it heard (null/blank = it heard nothing or was dismissed). */
    fun deliverSystem(forId: String, text: String?) {
        if (forId != id) return
        val t = text?.trim().orEmpty()
        finish(if (t.isEmpty()) fail("no-speech") else JSONObject().put("id", forId).put("ok", true).put("text", t))
    }

    /** Every recognition service installed on the phone, as components (Android 11+ needs the manifest <queries> entry, which Brizna has). */
    private fun recognitionServices(): List<ComponentName> = runCatching {
        ctx.packageManager.queryIntentServices(Intent(RecognitionService.SERVICE_INTERFACE), PackageManager.MATCH_ALL)
            .map { ComponentName(it.serviceInfo.packageName, it.serviceInfo.name) }
    }.getOrDefault(emptyList())

    /** The phone's chosen default recognition service ("pkg/class" in secure settings), or null when unreadable. */
    private fun defaultService(): ComponentName? = runCatching {
        Settings.Secure.getString(ctx.contentResolver, "voice_recognition_service")
            ?.let { ComponentName.unflattenFromString(it) }
    }.getOrNull()

    /** Stop listening and keep what was said (final result follows). */
    fun stop(forId: String) {
        if (forId != id) return
        stopping = true
        runCatching { rec?.stopListening() }
    }

    /** Drop everything (the composer closed). No reply. */
    fun cancel() {
        id = null
        runCatching { rec?.cancel() }
        runCatching { rec?.destroy() }
        rec = null
    }

    private fun next() {
        val cur = id ?: return
        // android-10: skip offline steps poisoned by an earlier language-unavailable (12/13).
        while (plan.isNotEmpty() && offlinePoisoned && (plan[0].offline || plan[0].onDevice)) plan.removeAt(0)
        if (plan.isEmpty()) {
            // android-8: one rung left — the system's own speech screen, but only when nothing was ever
            // heard (a service that heard speech and then failed keeps its own honest ending).
            if (!heard && !triedSystem) {
                triedSystem = true
                val offered = runCatching { systemFallback?.invoke(cur, lang) }.getOrNull()
                if (offered == true) return // deliverSystem() or cancel() ends the session from here
            }
            finish(fail(if (online()) "failed" else "offline")); return
        }
        val step = plan.removeAt(0)
        runCatching { rec?.destroy() }
        rec = null
        val r = try {
            when {
                step.onDevice && Build.VERSION.SDK_INT >= 31 -> SpeechRecognizer.createOnDeviceSpeechRecognizer(ctx)
                step.comp != null -> SpeechRecognizer.createSpeechRecognizer(ctx, step.comp)
                else -> SpeechRecognizer.createSpeechRecognizer(ctx)
            }
        } catch (e: Exception) { null }
        if (r == null) { next(); return }
        rec = r
        r.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) { if (id == cur) reply(JSONObject().put("id", cur).put("state", "listening")) }
            override fun onBeginningOfSpeech() { heard = true }
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() { if (id == cur) reply(JSONObject().put("id", cur).put("state", "processing")) }
            override fun onPartialResults(b: Bundle?) {
                if (id != cur) return
                val t = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.trim().orEmpty()
                if (t.isNotEmpty()) { heard = true; reply(JSONObject().put("id", cur).put("partial", t)) }
            }
            override fun onResults(b: Bundle?) {
                if (id != cur) return
                val t = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.trim().orEmpty()
                finish(if (t.isEmpty()) fail("no-speech") else JSONObject().put("id", cur).put("ok", true).put("text", t))
            }
            override fun onError(code: Int) {
                if (id != cur) return
                lastCode = code
                attempts.add("${step.label}:$code")
                if ((step.offline || step.onDevice) && (code == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED || code == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE)) offlinePoisoned = true
                when (code) {
                    SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> finish(fail("no-speech"))
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> finish(fail("denied"))
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> {
                        // another app (or our last session) still holds it: try once more after a moment
                        if (!busyRetry) { busyRetry = true; plan.add(0, step); runCatching { rec?.cancel() }; main.postDelayed({ if (id == cur) next() }, 400) }
                        else finish(fail("busy"))
                    }
                    SpeechRecognizer.ERROR_CLIENT -> if (stopping) finish(fail("no-speech")) else if (!heard) later(cur) else finish(fail("failed"))
                    else -> {
                        // language pack missing (12/13), service gone (11), network (1/2/4), too many requests (10):
                        // try the next recognizer if nothing was heard yet
                        if (!heard && plan.isNotEmpty()) later(cur)
                        else finish(fail(if (code == SpeechRecognizer.ERROR_NETWORK || code == SpeechRecognizer.ERROR_NETWORK_TIMEOUT || !online()) "offline" else "failed"))
                    }
                }
            }
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, ctx.packageName)
            if (step.offline) putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            // a pause of ~2 s ends the line, like the browser's Dictar
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
        }
        try { r.startListening(i) } catch (e: Exception) { next() }
    }

    /** The next recognizer, after this callback returns (never destroy a recognizer inside its own callback). */
    private fun later(cur: String) = main.post { if (id == cur) next() }

    private fun finish(j: JSONObject) {
        if (id == null) return
        reply(j)
        id = null
        val r = rec; rec = null
        main.post { runCatching { r?.destroy() } }
    }

    private fun fail(why: String) = JSONObject().put("id", id ?: "").put("ok", false).put("error", why)
        .also {
            if (lastCode != 0) it.put("code", lastCode)
            if (attempts.isNotEmpty()) it.put("attempts", attempts.joinToString(", "))
        }

    private fun online(): Boolean = runCatching {
        val cm = ctx.getSystemService(ConnectivityManager::class.java) ?: return true
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }.getOrDefault(true)
}
