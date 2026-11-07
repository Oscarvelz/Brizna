package com.oscarvelz.brizna

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import org.json.JSONObject

/**
 * android-4 (web 1.5.05): "Dictar" with the phone's own speech recognizer. A plain WebView has no Web Speech
 * recognition (webkitSpeechRecognition exists there but always fails with "not-allowed"), so the app listens itself.
 *
 * Order of recognizers, best first; the next one is tried only when one fails before it heard anything
 * (language pack missing, service gone):
 *   1. Android 13+: the on-device recognizer (createOnDeviceSpeechRecognizer), nothing leaves the phone.
 *   2. The phone's default recognizer asked to stay offline (EXTRA_PREFER_OFFLINE).
 *   3. The default recognizer as it is (it may use the network).
 * Replies go to the page as CustomEvent "briznanative-dictate":
 *   {id, state:"listening"|"processing"}, {id, partial}, then {id, ok:true, text} or {id, ok:false, error}
 *   error: no-speech | denied | blocked | offline | busy | none | failed.
 * Must be used on the main thread (SpeechRecognizer's rule). The caller checks RECORD_AUDIO before start().
 */
class Dictate(private val ctx: Context, private val reply: (JSONObject) -> Unit) {
    private var rec: SpeechRecognizer? = null
    private var id: String? = null
    private var lang = "es-US"
    private var plan = ArrayList<Int>()
    private var heard = false
    private var stopping = false
    private var busyRetry = false
    private val main = android.os.Handler(android.os.Looper.getMainLooper())

    companion object {
        private const val ON_DEVICE = 1
        private const val OFFLINE = 2
        private const val DEFAULT = 3
    }

    /** "yes" when the phone has any speech recognizer, else "no". */
    fun available(): Boolean =
        SpeechRecognizer.isRecognitionAvailable(ctx) ||
            (Build.VERSION.SDK_INT >= 33 && runCatching { SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx) }.getOrDefault(false))

    fun start(newId: String, language: String) {
        cancel()
        id = newId
        lang = language.ifBlank { "es-US" }
        heard = false; stopping = false; busyRetry = false
        plan = ArrayList()
        if (Build.VERSION.SDK_INT >= 33 && runCatching { SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx) }.getOrDefault(false)) plan.add(ON_DEVICE)
        if (SpeechRecognizer.isRecognitionAvailable(ctx)) {
            plan.add(OFFLINE)
            if (online()) plan.add(DEFAULT)
        }
        if (plan.isEmpty()) { finish(fail("none")); return }
        next()
    }

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
        if (plan.isEmpty()) { finish(fail(if (online()) "failed" else "offline")); return }
        val kind = plan.removeAt(0)
        runCatching { rec?.destroy() }
        rec = null
        val r = try {
            if (kind == ON_DEVICE && Build.VERSION.SDK_INT >= 33) SpeechRecognizer.createOnDeviceSpeechRecognizer(ctx)
            else SpeechRecognizer.createSpeechRecognizer(ctx)
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
                when (code) {
                    SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> finish(fail("no-speech"))
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> finish(fail("denied"))
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> {
                        // another app (or our last session) still holds it: try once more after a moment
                        if (!busyRetry) { busyRetry = true; plan.add(0, kind); runCatching { rec?.cancel() }; main.postDelayed({ if (id == cur) next() }, 400) }
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
            if (kind == OFFLINE || kind == ON_DEVICE) putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
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

    private fun online(): Boolean = runCatching {
        val cm = ctx.getSystemService(ConnectivityManager::class.java) ?: return true
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }.getOrDefault(true)
}
